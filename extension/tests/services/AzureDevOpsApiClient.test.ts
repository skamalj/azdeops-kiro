import fc from 'fast-check';
import { AzureDevOpsApiClient } from '../../src/services/AzureDevOpsApiClient';
import { AuthenticationService } from '../../src/services/AuthenticationService';
import { WorkItemType, WorkItemFields } from '../../src/types';

// Mock fetch for testing
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock localStorage (not needed for VS Code extension, but keeping for test compatibility)
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
(global as any).localStorage = localStorageMock;

describe('AzureDevOpsApiClient', () => {
  let apiClient: AzureDevOpsApiClient;
  let authService: AuthenticationService;

  beforeEach(() => {
    authService = new AuthenticationService();
    apiClient = new AzureDevOpsApiClient(authService);
    jest.clearAllMocks();
    
    // Mock successful authentication
    jest.spyOn(authService, 'isAuthenticated').mockReturnValue(true);
    jest.spyOn(authService, 'getAuthHeader').mockReturnValue('Bearer mock-token');
  });

  /**
   * Feature: azure-devops-integration, Property 3: Work item creation consistency
   * For any valid work item data, creation should result in a work item stored in Azure DevOps 
   * with all provided fields preserved
   */
  describe('Property 3: Work item creation consistency', () => {
    it('should preserve all provided fields when creating work items', async () => {
      await fc.assert(fc.asyncProperty(
        // Generator for work item types
        fc.oneof(
          fc.constant('User Story' as WorkItemType),
          fc.constant('Task' as WorkItemType),
          fc.constant('Bug' as WorkItemType),
          fc.constant('Feature' as WorkItemType)
        ),
        // Generator for work item fields
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 255 }),
          description: fc.option(fc.string({ maxLength: 1000 }), { nil: undefined }),
          assignedTo: fc.option(fc.emailAddress(), { nil: undefined }),
          storyPoints: fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
          remainingWork: fc.option(fc.float({ min: 0, max: 1000 }), { nil: undefined }),
          tags: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes(';')), { maxLength: 5 }), { nil: undefined })
        }),
        async (workItemType: WorkItemType, fields: WorkItemFields) => {
          // Initialize client
          apiClient.initialize('https://dev.azure.com/testorg', 'testproject');

          // Mock successful creation response
          const mockCreatedWorkItem = {
            id: 12345,
            fields: {
              'System.WorkItemType': workItemType,
              'System.Title': fields.title,
              'System.Description': fields.description || '',
              'System.AssignedTo': fields.assignedTo ? { displayName: fields.assignedTo } : undefined,
              'Microsoft.VSTS.Scheduling.StoryPoints': fields.storyPoints,
              'Microsoft.VSTS.Scheduling.RemainingWork': fields.remainingWork,
              'System.Tags': fields.tags ? fields.tags.join(';') : '',
              'System.State': 'New',
              'System.CreatedDate': new Date().toISOString(),
              'System.ChangedDate': new Date().toISOString()
            }
          };

          mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => mockCreatedWorkItem,
            headers: new Headers({ 'content-type': 'application/json' })
          } as Response);

          // Create work item
          const createdWorkItem = await apiClient.createWorkItem(workItemType, fields);

          // Verify all provided fields are preserved
          expect(createdWorkItem.type).toBe(workItemType);
          expect(createdWorkItem.title).toBe(fields.title);
          
          if (fields.description) {
            expect(createdWorkItem.description).toBe(fields.description);
          }
          
          if (fields.assignedTo) {
            expect(createdWorkItem.assignedTo).toBe(fields.assignedTo);
          }
          
          if (fields.storyPoints !== undefined) {
            expect(createdWorkItem.storyPoints).toBe(fields.storyPoints);
          }
          
          if (fields.remainingWork !== undefined) {
            expect(createdWorkItem.remainingWork).toBe(fields.remainingWork);
          }
          
          if (fields.tags) {
            // Tags are trimmed when processed, so we need to compare trimmed versions
            const expectedTags = fields.tags.map(tag => tag.trim());
            expect(createdWorkItem.tags).toEqual(expectedTags);
          }

          // Verify API was called with correct patch document
          expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining('/_apis/wit/workitems/$' + workItemType),
            expect.objectContaining({
              method: 'POST',
              headers: expect.objectContaining({
                'Content-Type': 'application/json-patch+json'
              })
            })
          );
        }
      ), { numRuns: 100 });
    });
  });

  /**
   * Feature: azure-devops-integration, Property 4: Work item validation
   * For any work item creation or update with missing required fields, 
   * the operation should be rejected with specific field-level error messages
   */
  describe('Property 4: Work item validation', () => {
    it('should reject work item creation with missing required fields', async () => {
      await fc.assert(fc.asyncProperty(
        fc.oneof(
          // Empty title
          fc.record({
            title: fc.constant(''),
            description: fc.option(fc.string(), { nil: undefined }),
          }),
          // Invalid story points
          fc.record({
            title: fc.string({ minLength: 1 }),
            storyPoints: fc.oneof(
              fc.constant(-1),
              fc.constant(0),
              fc.float({ min: Math.fround(0.1), max: Math.fround(0.9) }) // Non-integer values
            )
          })
        ),
        async (invalidFields: WorkItemFields) => {
          apiClient.initialize('https://dev.azure.com/testorg', 'testproject');

          // Mock validation error response from Azure DevOps
          mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 400,
            text: async () => JSON.stringify({
              message: 'Field validation failed',
              details: 'Title field is required'
            }),
            headers: new Headers()
          } as Response);

          // Attempt to create work item with invalid fields
          await expect(apiClient.createWorkItem('Task', invalidFields))
            .rejects
            .toThrow(/HTTP 400/);

          // Verify API was called
          expect(mockFetch).toHaveBeenCalled();
        }
      ), { numRuns: 100 });
    });

    it('should handle Azure DevOps field constraint violations', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          title: fc.string({ minLength: 256, maxLength: 500 }), // Too long
          description: fc.string({ minLength: 10000 }), // Too long
          storyPoints: fc.integer({ min: 101, max: 1000 }), // Out of range
        }),
        async (constraintViolatingFields: WorkItemFields) => {
          apiClient.initialize('https://dev.azure.com/testorg', 'testproject');

          // Mock constraint violation response
          mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 400,
            text: async () => JSON.stringify({
              message: 'Field constraint violation',
              details: 'Field values exceed maximum allowed length or range'
            }),
            headers: new Headers()
          } as Response);

          await expect(apiClient.createWorkItem('User Story', constraintViolatingFields))
            .rejects
            .toThrow(/HTTP 400/);
        }
      ), { numRuns: 100 });
    });
  });

  describe('Unit Tests', () => {
    it('should handle authentication errors', async () => {
      jest.spyOn(authService, 'isAuthenticated').mockReturnValue(false);

      await expect(apiClient.getWorkItems({}))
        .rejects
        .toThrow('Not authenticated with Azure DevOps');
    });

    it('should handle rate limiting with exponential backoff', async () => {
      apiClient.initialize('https://dev.azure.com/testorg', 'testproject');

      // Mock rate limit response followed by success
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: new Headers({ 'Retry-After': '2' }),
          text: async () => 'Rate limited'
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ value: [] }),
          headers: new Headers({ 'content-type': 'application/json' })
        } as Response);

      // This should eventually succeed after retry
      const result = await apiClient.getWorkItems({});
      expect(result).toEqual([]);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should map Azure DevOps work items correctly', async () => {
      apiClient.initialize('https://dev.azure.com/testorg', 'testproject');

      const mockAzureWorkItem = {
        id: 123,
        fields: {
          'System.WorkItemType': 'Task',
          'System.Title': 'Test Task',
          'System.Description': 'Test Description',
          'System.State': 'Active',
          'System.AssignedTo': { displayName: 'John Doe' },
          'Microsoft.VSTS.Scheduling.StoryPoints': 5,
          'System.Tags': 'tag1;tag2;tag3',
          'System.CreatedDate': '2023-01-01T00:00:00Z',
          'System.ChangedDate': '2023-01-02T00:00:00Z'
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockAzureWorkItem,
        headers: new Headers({ 'content-type': 'application/json' })
      } as Response);

      const workItem = await apiClient.getWorkItem(123);

      expect(workItem.id).toBe(123);
      expect(workItem.type).toBe('Task');
      expect(workItem.title).toBe('Test Task');
      expect(workItem.description).toBe('Test Description');
      expect(workItem.state).toBe('Active');
      expect(workItem.assignedTo).toBe('John Doe');
      expect(workItem.storyPoints).toBe(5);
      expect(workItem.tags).toEqual(['tag1', 'tag2', 'tag3']);
      expect(workItem.createdDate).toBeInstanceOf(Date);
      expect(workItem.changedDate).toBeInstanceOf(Date);
    });
  });
});