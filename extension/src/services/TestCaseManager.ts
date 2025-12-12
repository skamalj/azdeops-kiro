import * as vscode from 'vscode';
import { TestCase, TestPlan, TestSuite, TestCaseFields, TestPlanFields, TestStep, TestResult } from '../types';
import { AzureDevOpsApiClient } from './AzureDevOpsApiClient';
import { AuthenticationService } from './AuthenticationService';

export class TestCaseManager {
  constructor(
    private apiClient: AzureDevOpsApiClient,
    private authService: AuthenticationService
  ) {}

  async createTestCase(fields: TestCaseFields, testPlanId?: number): Promise<TestCase> {
    if (!this.authService.isAuthenticated()) {
      throw new Error('Not authenticated with Azure DevOps');
    }

    try {
      const patchDocument = this.buildTestCasePatchDocument(fields, testPlanId);
      
      const response = await fetch(
        `${this.apiClient.getBaseUrl()}/_apis/wit/workitems/$Test%20Case?api-version=7.0`,
        {
          method: 'POST',
          headers: {
            'Authorization': this.authService.getAuthHeader() || '',
            'Content-Type': 'application/json-patch+json'
          },
          body: JSON.stringify(patchDocument)
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to create test case: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return this.mapAzureWorkItemToTestCase(data);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to create test case: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async getTestCases(projectId: string, testPlanId?: number): Promise<TestCase[]> {
    if (!this.authService.isAuthenticated()) {
      throw new Error('Not authenticated with Azure DevOps');
    }

    try {
      let wiql = `SELECT [System.Id], [System.Title], [System.State], [System.AssignedTo] FROM WorkItems WHERE [System.TeamProject] = '${projectId}' AND [System.WorkItemType] = 'Test Case'`;
      
      if (testPlanId) {
        // Add test plan filter if specified
        wiql += ` AND [Microsoft.VSTS.TCM.TestPlanId] = ${testPlanId}`;
      }

      const queryResponse = await fetch(
        `${this.apiClient.getBaseUrl()}/_apis/wit/wiql?api-version=7.0`,
        {
          method: 'POST',
          headers: {
            'Authorization': this.authService.getAuthHeader() || '',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ query: wiql })
        }
      );

      if (!queryResponse.ok) {
        throw new Error(`Failed to query test cases: ${queryResponse.status} ${queryResponse.statusText}`);
      }

      const queryData = await queryResponse.json();
      const workItemIds = queryData.workItems?.map((wi: any) => wi.id) || [];

      if (workItemIds.length === 0) {
        return [];
      }

      // Get detailed test case information
      const idsParam = workItemIds.join(',');
      const detailsResponse = await fetch(
        `${this.apiClient.getBaseUrl()}/_apis/wit/workitems?ids=${idsParam}&$expand=all&api-version=7.0`,
        {
          headers: {
            'Authorization': this.authService.getAuthHeader() || '',
            'Content-Type': 'application/json'
          }
        }
      );

      if (!detailsResponse.ok) {
        throw new Error(`Failed to get test case details: ${detailsResponse.status} ${detailsResponse.statusText}`);
      }

      const detailsData = await detailsResponse.json();
      return detailsData.value.map((item: any) => this.mapAzureWorkItemToTestCase(item));
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to get test cases: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async createTestPlan(fields: TestPlanFields, projectId: string): Promise<TestPlan> {
    if (!this.authService.isAuthenticated()) {
      throw new Error('Not authenticated with Azure DevOps');
    }

    try {
      const testPlanData = {
        name: fields.name,
        description: fields.description,
        areaPath: fields.areaPath,
        iteration: fields.iterationPath,
        state: 'Active'
      };

      const response = await fetch(
        `${this.apiClient.getBaseUrl()}/_apis/testplan/Plans?api-version=7.0`,
        {
          method: 'POST',
          headers: {
            'Authorization': this.authService.getAuthHeader() || '',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(testPlanData)
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to create test plan: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return this.mapAzureTestPlanToTestPlan(data, projectId);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to create test plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async getTestPlans(projectId: string): Promise<TestPlan[]> {
    if (!this.authService.isAuthenticated()) {
      throw new Error('Not authenticated with Azure DevOps');
    }

    try {
      const response = await fetch(
        `${this.apiClient.getBaseUrl()}/_apis/testplan/Plans?api-version=7.0`,
        {
          headers: {
            'Authorization': this.authService.getAuthHeader() || '',
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get test plans: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.value.map((plan: any) => this.mapAzureTestPlanToTestPlan(plan, projectId));
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to get test plans: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async executeTestCase(testCaseId: number, result: TestResult): Promise<void> {
    if (!this.authService.isAuthenticated()) {
      throw new Error('Not authenticated with Azure DevOps');
    }

    try {
      // Update test case with execution result
      const patchDocument = [
        {
          op: 'add',
          path: '/fields/Microsoft.VSTS.TCM.LastResult',
          value: result.outcome
        },
        {
          op: 'add',
          path: '/fields/Microsoft.VSTS.TCM.LastResultDetails',
          value: result.comment || ''
        },
        {
          op: 'add',
          path: '/fields/Microsoft.VSTS.TCM.LastRunBy',
          value: result.executedBy
        }
      ];

      const response = await fetch(
        `${this.apiClient.getBaseUrl()}/_apis/wit/workitems/${testCaseId}?api-version=7.0`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': this.authService.getAuthHeader() || '',
            'Content-Type': 'application/json-patch+json'
          },
          body: JSON.stringify(patchDocument)
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to update test case execution: ${response.status} ${response.statusText}`);
      }

      vscode.window.showInformationMessage(`Test case #${testCaseId} execution recorded: ${result.outcome}`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to execute test case: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async showTestCaseCreationDialog(): Promise<void> {
    try {
      // Get test case title
      const title = await vscode.window.showInputBox({
        prompt: 'Enter test case title',
        placeHolder: 'e.g., Verify user login functionality',
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Title is required';
          }
          return null;
        }
      });

      if (!title) return;

      // Get test case description
      const description = await vscode.window.showInputBox({
        prompt: 'Enter test case description (optional)',
        placeHolder: 'Detailed description of what this test case validates'
      });

      // Get priority
      const priorityItems = [
        { label: 'Critical', description: 'Critical priority test case' },
        { label: 'High', description: 'High priority test case' },
        { label: 'Medium', description: 'Medium priority test case' },
        { label: 'Low', description: 'Low priority test case' }
      ];

      const selectedPriority = await vscode.window.showQuickPick(priorityItems, {
        placeHolder: 'Select test case priority'
      });

      if (!selectedPriority) return;

      // Get test steps
      const steps: TestStep[] = [];
      let stepNumber = 1;
      
      while (true) {
        const action = await vscode.window.showInputBox({
          prompt: `Enter action for step ${stepNumber} (or press Escape to finish)`,
          placeHolder: 'e.g., Navigate to login page'
        });

        if (!action) break;

        const expectedResult = await vscode.window.showInputBox({
          prompt: `Enter expected result for step ${stepNumber}`,
          placeHolder: 'e.g., Login page is displayed'
        });

        if (!expectedResult) break;

        steps.push({
          stepNumber,
          action,
          expectedResult
        });

        stepNumber++;
      }

      if (steps.length === 0) {
        vscode.window.showWarningMessage('At least one test step is required');
        return;
      }

      // Create test case
      const testCaseFields: TestCaseFields = {
        title,
        description: description || '',
        steps,
        expectedResult: steps[steps.length - 1].expectedResult,
        priority: selectedPriority.label as 'Critical' | 'High' | 'Medium' | 'Low',
        automationStatus: 'Not Automated'
      };

      const testCase = await this.createTestCase(testCaseFields);
      vscode.window.showInformationMessage(`Test case #${testCase.id} created successfully: ${testCase.title}`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to create test case: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async showTestPlanCreationDialog(projectId: string): Promise<void> {
    try {
      // Get test plan name
      const name = await vscode.window.showInputBox({
        prompt: 'Enter test plan name',
        placeHolder: 'e.g., Sprint 1 Test Plan',
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Name is required';
          }
          return null;
        }
      });

      if (!name) return;

      // Get test plan description
      const description = await vscode.window.showInputBox({
        prompt: 'Enter test plan description (optional)',
        placeHolder: 'Description of what this test plan covers'
      });

      // Get area path
      const areaPath = await vscode.window.showInputBox({
        prompt: 'Enter area path',
        placeHolder: 'e.g., MyProject\\Web',
        value: projectId
      });

      // Get iteration path
      const iterationPath = await vscode.window.showInputBox({
        prompt: 'Enter iteration path',
        placeHolder: 'e.g., MyProject\\Sprint 1',
        value: projectId
      });

      if (!areaPath || !iterationPath) return;

      // Create test plan
      const testPlanFields: TestPlanFields = {
        name,
        description: description || '',
        areaPath,
        iterationPath
      };

      const testPlan = await this.createTestPlan(testPlanFields, projectId);
      vscode.window.showInformationMessage(`Test plan #${testPlan.id} created successfully: ${testPlan.name}`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to create test plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildTestCasePatchDocument(fields: TestCaseFields, testPlanId?: number): any[] {
    const patchDocument = [
      {
        op: 'add',
        path: '/fields/System.Title',
        value: fields.title
      },
      {
        op: 'add',
        path: '/fields/System.Description',
        value: fields.description
      },
      {
        op: 'add',
        path: '/fields/Microsoft.VSTS.Common.Priority',
        value: this.mapPriorityToNumber(fields.priority)
      },
      {
        op: 'add',
        path: '/fields/Microsoft.VSTS.TCM.AutomationStatus',
        value: fields.automationStatus
      }
    ];

    // Add test steps
    if (fields.steps && fields.steps.length > 0) {
      const stepsXml = this.buildTestStepsXml(fields.steps);
      patchDocument.push({
        op: 'add',
        path: '/fields/Microsoft.VSTS.TCM.Steps',
        value: stepsXml
      });
    }

    // Link to test plan if specified
    if (testPlanId) {
      patchDocument.push({
        op: 'add',
        path: '/fields/Microsoft.VSTS.TCM.TestPlanId',
        value: testPlanId
      });
    }

    return patchDocument;
  }

  private buildTestStepsXml(steps: TestStep[]): string {
    let xml = '<steps id="0" last="' + steps.length + '">';
    
    steps.forEach(step => {
      xml += `<step id="${step.stepNumber}" type="ActionStep">`;
      xml += `<parameterizedString isformatted="true">${this.escapeXml(step.action)}</parameterizedString>`;
      xml += `<parameterizedString isformatted="true">${this.escapeXml(step.expectedResult)}</parameterizedString>`;
      xml += `<description/>`;
      xml += `</step>`;
    });
    
    xml += '</steps>';
    return xml;
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private mapPriorityToNumber(priority: string): number {
    switch (priority) {
      case 'Critical': return 1;
      case 'High': return 2;
      case 'Medium': return 3;
      case 'Low': return 4;
      default: return 3;
    }
  }

  private mapAzureWorkItemToTestCase(azureWorkItem: any): TestCase {
    const fields = azureWorkItem.fields || {};
    
    return {
      id: azureWorkItem.id,
      type: 'Test Case',
      title: fields['System.Title'] || '',
      description: fields['System.Description'] || '',
      state: fields['System.State'] || 'Design',
      assignedTo: fields['System.AssignedTo']?.displayName || undefined,
      tags: fields['System.Tags'] ? fields['System.Tags'].split(';').map((tag: string) => tag.trim()).filter((tag: string) => tag) : undefined,
      createdDate: new Date(fields['System.CreatedDate']),
      changedDate: new Date(fields['System.ChangedDate']),
      projectId: fields['System.TeamProject'] || '',
      fields: fields,
      steps: this.parseTestStepsFromXml(fields['Microsoft.VSTS.TCM.Steps'] || ''),
      expectedResult: fields['Microsoft.VSTS.TCM.ExpectedResult'] || '',
      priority: this.mapNumberToPriority(fields['Microsoft.VSTS.Common.Priority'] || 3),
      testPlanId: fields['Microsoft.VSTS.TCM.TestPlanId'] || undefined,
      testSuiteId: fields['Microsoft.VSTS.TCM.TestSuiteId'] || undefined,
      automationStatus: fields['Microsoft.VSTS.TCM.AutomationStatus'] || 'Not Automated'
    };
  }

  private parseTestStepsFromXml(stepsXml: string): TestStep[] {
    // Simple XML parsing for test steps
    // In a production implementation, you'd use a proper XML parser
    const steps: TestStep[] = [];
    
    if (!stepsXml) return steps;
    
    try {
      const stepMatches = stepsXml.match(/<step[^>]*id="(\d+)"[^>]*>(.*?)<\/step>/gs);
      
      if (stepMatches) {
        stepMatches.forEach(stepMatch => {
          const idMatch = stepMatch.match(/id="(\d+)"/);
          const contentMatch = stepMatch.match(/<parameterizedString[^>]*>(.*?)<\/parameterizedString>/gs);
          
          if (idMatch && contentMatch && contentMatch.length >= 2) {
            steps.push({
              stepNumber: parseInt(idMatch[1]),
              action: this.unescapeXml(contentMatch[0].replace(/<[^>]*>/g, '')),
              expectedResult: this.unescapeXml(contentMatch[1].replace(/<[^>]*>/g, ''))
            });
          }
        });
      }
    } catch (error) {
      console.error('Failed to parse test steps XML:', error);
    }
    
    return steps;
  }

  private unescapeXml(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  private mapNumberToPriority(priority: number): 'Critical' | 'High' | 'Medium' | 'Low' {
    switch (priority) {
      case 1: return 'Critical';
      case 2: return 'High';
      case 3: return 'Medium';
      case 4: return 'Low';
      default: return 'Medium';
    }
  }

  private mapAzureTestPlanToTestPlan(azureTestPlan: any, projectId: string): TestPlan {
    return {
      id: azureTestPlan.id,
      name: azureTestPlan.name,
      description: azureTestPlan.description || '',
      projectId,
      iterationPath: azureTestPlan.iteration || '',
      areaPath: azureTestPlan.areaPath || '',
      state: azureTestPlan.state || 'Active',
      testSuites: [], // Would be populated in a full implementation
      createdDate: new Date(azureTestPlan.createdDate || Date.now()),
      changedDate: new Date(azureTestPlan.updatedDate || Date.now())
    };
  }
}
