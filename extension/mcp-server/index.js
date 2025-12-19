#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AzureDevOpsCoreServer = void 0;
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const zod_1 = require("zod");
// Tool schemas
const CreateUserStorySchema = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Title is required'),
    description: zod_1.z.string().optional(),
    storyPoints: zod_1.z.number().int().min(1).max(21).optional(),
});
const CreateTaskSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Title is required'),
    description: zod_1.z.string().optional(),
    remainingWork: zod_1.z.number().min(0).optional(),
    parentId: zod_1.z.number().int().positive().optional(),
});
const GetWorkItemsSchema = zod_1.z.object({
    type: zod_1.z.enum(['User Story', 'Task', 'Bug', 'Feature']).optional(),
    state: zod_1.z.string().optional(),
    assignedTo: zod_1.z.string().optional(),
    maxResults: zod_1.z.number().int().positive().max(200).default(50),
});
const UpdateWorkItemSchema = zod_1.z.object({
    id: zod_1.z.number().int().positive(),
    updates: zod_1.z.array(zod_1.z.object({
        op: zod_1.z.enum(['add', 'replace', 'remove']),
        path: zod_1.z.string(),
        value: zod_1.z.any().optional(),
    })),
});
const GetWorkItemSchema = zod_1.z.object({
    id: zod_1.z.number().int().positive(),
});
const CreateTestCaseSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Title is required'),
    description: zod_1.z.string().optional(),
    steps: zod_1.z.array(zod_1.z.object({
        stepNumber: zod_1.z.number().int().positive(),
        action: zod_1.z.string(),
        expectedResult: zod_1.z.string(),
    })),
    priority: zod_1.z.enum(['Critical', 'High', 'Medium', 'Low']).default('Medium'),
    testPlanId: zod_1.z.number().int().positive().optional(),
});
const CreateTestPlanSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required'),
    description: zod_1.z.string().optional(),
    areaPath: zod_1.z.string(),
    iterationPath: zod_1.z.string(),
    projectId: zod_1.z.string(),
});
const GetProjectsSchema = zod_1.z.object({
    organizationUrl: zod_1.z.string().url().optional(),
});
const SwitchProjectSchema = zod_1.z.object({
    projectId: zod_1.z.string(),
    projectName: zod_1.z.string(),
});
const GetScrumMetricsSchema = zod_1.z.object({
    projectId: zod_1.z.string().optional(),
});
const GetTestCasesSchema = zod_1.z.object({
    projectId: zod_1.z.string().optional(),
    testPlanId: zod_1.z.number().int().positive().optional(),
    maxResults: zod_1.z.number().int().positive().max(200).default(50),
});
const GetTestPlansSchema = zod_1.z.object({
    projectId: zod_1.z.string().optional(),
});
const ExecuteTestCaseSchema = zod_1.z.object({
    testCaseId: zod_1.z.number().int().positive(),
    outcome: zod_1.z.enum(['Passed', 'Failed', 'Blocked', 'Not Applicable']),
    comment: zod_1.z.string().optional(),
    executedBy: zod_1.z.string(),
});
// Sprint management schemas
const GetSprintsSchema = zod_1.z.object({
    projectId: zod_1.z.string().optional(),
    teamId: zod_1.z.string().optional(),
    state: zod_1.z.enum(['current', 'future', 'closed']).optional(),
});
const GetCurrentSprintSchema = zod_1.z.object({
    projectId: zod_1.z.string().optional(),
    teamId: zod_1.z.string().optional(),
});
const GetSprintSchema = zod_1.z.object({
    sprintId: zod_1.z.string().optional(),
    iterationPath: zod_1.z.string().optional(),
});
const GetSprintWorkItemsSchema = zod_1.z.object({
    sprintId: zod_1.z.string().optional(),
    iterationPath: zod_1.z.string().optional(),
    workItemTypes: zod_1.z.array(zod_1.z.string()).optional(),
    includeCompleted: zod_1.z.boolean().default(true),
});
const AssignWorkItemsToSprintSchema = zod_1.z.object({
    workItemIds: zod_1.z.array(zod_1.z.number().int().positive()),
    sprintId: zod_1.z.string().optional(),
    iterationPath: zod_1.z.string().optional(),
});
const RemoveWorkItemsFromSprintSchema = zod_1.z.object({
    workItemIds: zod_1.z.array(zod_1.z.number().int().positive()),
    sprintId: zod_1.z.string().optional(),
});
// Batch operation schemas
const BatchCreateUserStoriesSchema = zod_1.z.object({
    stories: zod_1.z.array(zod_1.z.object({
        title: zod_1.z.string().min(1, 'Title is required'),
        description: zod_1.z.string().optional(),
        storyPoints: zod_1.z.number().int().min(1).max(21).optional(),
    })),
    batchSize: zod_1.z.number().int().min(1).max(50).default(10),
});
const BatchCreateTasksSchema = zod_1.z.object({
    tasks: zod_1.z.array(zod_1.z.object({
        title: zod_1.z.string().min(1, 'Title is required'),
        description: zod_1.z.string().optional(),
        remainingWork: zod_1.z.number().min(0).optional(),
        parentId: zod_1.z.number().int().positive().optional(),
    })),
    batchSize: zod_1.z.number().int().min(1).max(50).default(10),
});
const BatchCreateTestCasesSchema = zod_1.z.object({
    testCases: zod_1.z.array(zod_1.z.object({
        title: zod_1.z.string().min(1, 'Title is required'),
        description: zod_1.z.string().optional(),
        steps: zod_1.z.array(zod_1.z.object({
            stepNumber: zod_1.z.number().int().positive(),
            action: zod_1.z.string(),
            expectedResult: zod_1.z.string(),
        })),
        priority: zod_1.z.enum(['Critical', 'High', 'Medium', 'Low']).default('Medium'),
        testPlanId: zod_1.z.number().int().positive().optional(),
    })),
    batchSize: zod_1.z.number().int().min(1).max(50).default(10),
});
const BatchCreateTestPlansSchema = zod_1.z.object({
    testPlans: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string().min(1, 'Name is required'),
        description: zod_1.z.string().optional(),
        areaPath: zod_1.z.string(),
        iterationPath: zod_1.z.string(),
        projectId: zod_1.z.string(),
    })),
    batchSize: zod_1.z.number().int().min(1).max(20).default(5),
});
class AzureDevOpsApiClient {
    organizationUrl = '';
    projectName = '';
    pat = '';
    initialize(organizationUrl, projectName, pat) {
        this.organizationUrl = organizationUrl;
        this.projectName = projectName;
        this.pat = pat;
    }
    getAuthHeader() {
        return `Basic ${Buffer.from(`:${this.pat}`).toString('base64')}`;
    }
    getBaseUrl() {
        return `${this.organizationUrl}/${this.projectName}`;
    }
    async createWorkItem(type, fields, parentId) {
        const patchDocument = [
            { op: 'add', path: '/fields/System.Title', value: fields.title },
            { op: 'add', path: '/fields/System.Description', value: fields.description || '' },
        ];
        if (fields.storyPoints) {
            patchDocument.push({ op: 'add', path: '/fields/Microsoft.VSTS.Scheduling.StoryPoints', value: fields.storyPoints });
        }
        if (fields.remainingWork) {
            patchDocument.push({ op: 'add', path: '/fields/Microsoft.VSTS.Scheduling.RemainingWork', value: fields.remainingWork });
        }
        const response = await fetch(`${this.getBaseUrl()}/_apis/wit/workitems/$${type}?api-version=7.0`, {
            method: 'POST',
            headers: {
                'Authorization': this.getAuthHeader(),
                'Content-Type': 'application/json-patch+json'
            },
            body: JSON.stringify(patchDocument)
        });
        if (!response.ok) {
            throw new Error(`Failed to create work item: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        // Link to parent if specified
        if (parentId) {
            await this.linkWorkItems(data.id, parentId, 'System.LinkTypes.Hierarchy-Reverse');
        }
        return this.mapAzureWorkItemToWorkItem(data);
    }
    async getWorkItems(query = {}) {
        let wiql = `SELECT [System.Id], [System.Title], [System.WorkItemType], [System.State], [System.AssignedTo] FROM WorkItems WHERE [System.TeamProject] = '${this.projectName}'`;
        if (query.type) {
            wiql += ` AND [System.WorkItemType] = '${query.type}'`;
        }
        if (query.state) {
            wiql += ` AND [System.State] = '${query.state}'`;
        }
        if (query.assignedTo) {
            wiql += ` AND [System.AssignedTo] = '${query.assignedTo}'`;
        }
        const queryResponse = await fetch(`${this.getBaseUrl()}/_apis/wit/wiql?api-version=7.0`, {
            method: 'POST',
            headers: {
                'Authorization': this.getAuthHeader(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: wiql })
        });
        if (!queryResponse.ok) {
            throw new Error(`Failed to query work items: ${queryResponse.status} ${queryResponse.statusText}`);
        }
        const queryData = await queryResponse.json();
        const workItemIds = queryData.workItems?.map((wi) => wi.id) || [];
        if (workItemIds.length === 0) {
            return [];
        }
        const idsParam = workItemIds.slice(0, query.maxResults || 50).join(',');
        const detailsResponse = await fetch(`${this.getBaseUrl()}/_apis/wit/workitems?ids=${idsParam}&api-version=7.0`, {
            headers: {
                'Authorization': this.getAuthHeader(),
                'Content-Type': 'application/json'
            }
        });
        if (!detailsResponse.ok) {
            throw new Error(`Failed to get work item details: ${detailsResponse.status} ${detailsResponse.statusText}`);
        }
        const detailsData = await detailsResponse.json();
        return detailsData.value.map((item) => this.mapAzureWorkItemToWorkItem(item));
    }
    async getWorkItem(id) {
        const response = await fetch(`${this.getBaseUrl()}/_apis/wit/workitems/${id}?api-version=7.0`, {
            headers: {
                'Authorization': this.getAuthHeader(),
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) {
            throw new Error(`Failed to get work item: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return this.mapAzureWorkItemToWorkItem(data);
    }
    async updateWorkItem(id, updates) {
        const response = await fetch(`${this.getBaseUrl()}/_apis/wit/workitems/${id}?api-version=7.0`, {
            method: 'PATCH',
            headers: {
                'Authorization': this.getAuthHeader(),
                'Content-Type': 'application/json-patch+json'
            },
            body: JSON.stringify(updates)
        });
        if (!response.ok) {
            throw new Error(`Failed to update work item: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return this.mapAzureWorkItemToWorkItem(data);
    }
    async linkWorkItems(sourceId, targetId, linkType) {
        const linkData = {
            op: 'add',
            path: '/relations/-',
            value: {
                rel: linkType,
                url: `${this.getBaseUrl()}/_apis/wit/workItems/${targetId}`
            }
        };
        const response = await fetch(`${this.getBaseUrl()}/_apis/wit/workitems/${sourceId}?api-version=7.0`, {
            method: 'PATCH',
            headers: {
                'Authorization': this.getAuthHeader(),
                'Content-Type': 'application/json-patch+json'
            },
            body: JSON.stringify([linkData])
        });
        if (!response.ok) {
            throw new Error(`Failed to link work items: ${response.status} ${response.statusText}`);
        }
    }
    async getProjects() {
        const response = await fetch(`${this.organizationUrl}/_apis/projects?api-version=7.0`, {
            headers: {
                'Authorization': this.getAuthHeader(),
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) {
            throw new Error(`Failed to get projects: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return data.value.map((proj) => this.mapAzureProjectToProject(proj));
    }
    async createTestCase(fields, testPlanId) {
        const patchDocument = this.buildTestCasePatchDocument(fields, testPlanId);
        const response = await fetch(`${this.getBaseUrl()}/_apis/wit/workitems/$Test%20Case?api-version=7.0`, {
            method: 'POST',
            headers: {
                'Authorization': this.getAuthHeader(),
                'Content-Type': 'application/json-patch+json'
            },
            body: JSON.stringify(patchDocument)
        });
        if (!response.ok) {
            throw new Error(`Failed to create test case: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return this.mapAzureWorkItemToWorkItem(data);
    }
    async createTestPlan(fields) {
        const testPlanData = {
            name: fields.name,
            description: fields.description,
            areaPath: fields.areaPath,
            iteration: fields.iterationPath,
            state: 'Active'
        };
        const response = await fetch(`${this.getBaseUrl()}/_apis/testplan/Plans?api-version=7.0`, {
            method: 'POST',
            headers: {
                'Authorization': this.getAuthHeader(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testPlanData)
        });
        if (!response.ok) {
            throw new Error(`Failed to create test plan: ${response.status} ${response.statusText}`);
        }
        return await response.json();
    }
    async getTestCases(projectId, testPlanId, maxResults = 50) {
        let wiql = `SELECT [System.Id], [System.Title], [System.State], [System.AssignedTo] FROM WorkItems WHERE [System.WorkItemType] = 'Test Case'`;
        if (projectId) {
            wiql += ` AND [System.TeamProject] = '${projectId}'`;
        }
        else if (this.projectName) {
            wiql += ` AND [System.TeamProject] = '${this.projectName}'`;
        }
        if (testPlanId) {
            wiql += ` AND [Microsoft.VSTS.TCM.TestPlanId] = ${testPlanId}`;
        }
        const queryResponse = await fetch(`${this.getBaseUrl()}/_apis/wit/wiql?api-version=7.0`, {
            method: 'POST',
            headers: {
                'Authorization': this.getAuthHeader(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: wiql })
        });
        if (!queryResponse.ok) {
            throw new Error(`Failed to query test cases: ${queryResponse.status} ${queryResponse.statusText}`);
        }
        const queryData = await queryResponse.json();
        const workItemIds = queryData.workItems?.map((wi) => wi.id) || [];
        if (workItemIds.length === 0) {
            return [];
        }
        const idsParam = workItemIds.slice(0, maxResults).join(',');
        const detailsResponse = await fetch(`${this.getBaseUrl()}/_apis/wit/workitems?ids=${idsParam}&$expand=all&api-version=7.0`, {
            headers: {
                'Authorization': this.getAuthHeader(),
                'Content-Type': 'application/json'
            }
        });
        if (!detailsResponse.ok) {
            throw new Error(`Failed to get test case details: ${detailsResponse.status} ${detailsResponse.statusText}`);
        }
        const detailsData = await detailsResponse.json();
        return detailsData.value.map((item) => this.mapAzureWorkItemToWorkItem(item));
    }
    async getTestPlans(projectId) {
        const response = await fetch(`${this.getBaseUrl()}/_apis/testplan/Plans?api-version=7.0`, {
            headers: {
                'Authorization': this.getAuthHeader(),
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) {
            throw new Error(`Failed to get test plans: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return data.value;
    }
    async executeTestCase(testCaseId, result) {
        const patchDocument = [
            {
                op: 'replace',
                path: '/fields/Microsoft.VSTS.TCM.LastResult',
                value: result.outcome
            },
            {
                op: 'replace',
                path: '/fields/Microsoft.VSTS.TCM.LastResultDetails',
                value: result.comment || ''
            },
            {
                op: 'replace',
                path: '/fields/Microsoft.VSTS.TCM.LastRunBy',
                value: result.executedBy
            }
        ];
        const response = await fetch(`${this.getBaseUrl()}/_apis/wit/workitems/${testCaseId}?api-version=7.0`, {
            method: 'PATCH',
            headers: {
                'Authorization': this.getAuthHeader(),
                'Content-Type': 'application/json-patch+json'
            },
            body: JSON.stringify(patchDocument)
        });
        if (!response.ok) {
            throw new Error(`Failed to execute test case: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return this.mapAzureWorkItemToWorkItem(data);
    }
    buildTestCasePatchDocument(fields, testPlanId) {
        const patchDocument = [
            {
                op: 'add',
                path: '/fields/System.Title',
                value: fields.title
            },
            {
                op: 'add',
                path: '/fields/System.Description',
                value: fields.description || ''
            },
            {
                op: 'add',
                path: '/fields/Microsoft.VSTS.Common.Priority',
                value: this.mapPriorityToNumber(fields.priority)
            },
            {
                op: 'add',
                path: '/fields/Microsoft.VSTS.TCM.AutomationStatus',
                value: 'Not Automated'
            }
        ];
        if (fields.steps && fields.steps.length > 0) {
            const stepsXml = this.buildTestStepsXml(fields.steps);
            patchDocument.push({
                op: 'add',
                path: '/fields/Microsoft.VSTS.TCM.Steps',
                value: stepsXml
            });
        }
        if (testPlanId) {
            patchDocument.push({
                op: 'add',
                path: '/fields/Microsoft.VSTS.TCM.TestPlanId',
                value: testPlanId
            });
        }
        return patchDocument;
    }
    buildTestStepsXml(steps) {
        let xml = `<steps id="0" last="${steps.length}">`;
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
    escapeXml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    mapPriorityToNumber(priority) {
        switch (priority) {
            case 'Critical': return 1;
            case 'High': return 2;
            case 'Medium': return 3;
            case 'Low': return 4;
            default: return 3;
        }
    }
    mapAzureProjectToProject(azureProject) {
        return {
            id: azureProject.id,
            name: azureProject.name,
            description: azureProject.description || '',
            url: azureProject.url,
            state: azureProject.state || 'wellFormed',
            visibility: azureProject.visibility || 'private'
        };
    }
    mapAzureWorkItemToWorkItem(azureWorkItem) {
        const fields = azureWorkItem.fields || {};
        return {
            id: azureWorkItem.id,
            type: fields['System.WorkItemType'] || 'Task',
            title: fields['System.Title'] || '',
            description: fields['System.Description'] || '',
            state: fields['System.State'] || 'New',
            assignedTo: fields['System.AssignedTo']?.displayName || undefined,
            storyPoints: fields['Microsoft.VSTS.Scheduling.StoryPoints'] || undefined,
            remainingWork: fields['Microsoft.VSTS.Scheduling.RemainingWork'] || undefined,
            tags: fields['System.Tags'] ? fields['System.Tags'].split(';').map((tag) => tag.trim()).filter((tag) => tag) : undefined,
            createdDate: new Date(fields['System.CreatedDate']),
            changedDate: new Date(fields['System.ChangedDate']),
            projectId: fields['System.TeamProject'] || '',
            fields: fields
        };
    }
    // Sprint Management Method
    async getSprints(projectId, teamId, state) {
        const projectToUse = projectId || this.projectName;
        try {
            console.log(`[DEBUG] Getting sprints for project: ${projectToUse}`);
            console.log(`[DEBUG] Organization URL: ${this.organizationUrl}`);
            // Approach 1: Try classification nodes API to get iterations
            let url = `${this.organizationUrl}/${projectToUse}/_apis/wit/classificationnodes/iterations?api-version=7.0&$depth=2`;
            console.log(`[DEBUG] Trying classification nodes API: ${url}`);
            let response = await fetch(url, {
                headers: {
                    'Authorization': this.getAuthHeader(),
                    'Content-Type': 'application/json'
                }
            });
            console.log(`[DEBUG] Classification nodes response: ${response.status} ${response.statusText}`);
            if (response.ok) {
                const data = await response.json();
                console.log('[DEBUG] Classification nodes data:', JSON.stringify(data, null, 2));
                const iterations = [];
                // Handle nested structure
                if (data.children) {
                    data.children.forEach((child) => {
                        console.log(`[DEBUG] Found child iteration: ${child.name}`);
                        iterations.push({
                            id: child.id,
                            name: child.name,
                            path: child.path,
                            url: child.url,
                            attributes: child.attributes || {},
                            hasChildren: child.hasChildren || false,
                            structureType: child.structureType
                        });
                    });
                }
                console.log(`[DEBUG] Found ${iterations.length} iterations via classification nodes`);
                return iterations;
            }
            // Approach 2: Try team settings API with different team name variations
            const teamVariations = [
                teamId,
                `${projectToUse} Team`,
                projectToUse,
                `${projectToUse}\\${projectToUse} Team`
            ].filter(Boolean);
            for (const teamName of teamVariations) {
                try {
                    console.log(`[DEBUG] Trying team settings API with team: ${teamName}`);
                    let teamUrl = `${this.organizationUrl}/${projectToUse}/${teamName}/_apis/work/teamsettings/iterations?api-version=7.0`;
                    if (state) {
                        teamUrl += `&$timeframe=${state}`;
                    }
                    response = await fetch(teamUrl, {
                        headers: {
                            'Authorization': this.getAuthHeader(),
                            'Content-Type': 'application/json'
                        }
                    });
                    console.log(`[DEBUG] Team settings response for ${teamName}: ${response.status} ${response.statusText}`);
                    if (response.ok) {
                        const data = await response.json();
                        console.log(`[DEBUG] Team settings data for ${teamName}:`, JSON.stringify(data, null, 2));
                        return data.value || [];
                    }
                }
                catch (teamError) {
                    console.log(`[DEBUG] Team ${teamName} failed:`, teamError);
                }
            }
            // Approach 3: Query work items to find iteration paths
            console.log('[DEBUG] Trying work item query approach...');
            const wiql = `
        SELECT [System.Id], [System.IterationPath]
        FROM WorkItems 
        WHERE [System.TeamProject] = '${projectToUse}'
        AND [System.IterationPath] <> ''
        AND [System.IterationPath] <> '${projectToUse}'
      `;
            response = await fetch(`${this.getBaseUrl()}/_apis/wit/wiql?api-version=7.0`, {
                method: 'POST',
                headers: {
                    'Authorization': this.getAuthHeader(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query: wiql })
            });
            console.log(`[DEBUG] WIQL query response: ${response.status} ${response.statusText}`);
            if (response.ok) {
                const queryData = await response.json();
                console.log('[DEBUG] WIQL query data:', JSON.stringify(queryData, null, 2));
                const iterationPaths = new Set();
                if (queryData.workItems && queryData.workItems.length > 0) {
                    const workItemIds = queryData.workItems.map((wi) => wi.id);
                    const idsParam = workItemIds.slice(0, 50).join(',');
                    const detailsResponse = await fetch(`${this.getBaseUrl()}/_apis/wit/workitems?ids=${idsParam}&fields=System.IterationPath&api-version=7.0`, {
                        headers: {
                            'Authorization': this.getAuthHeader(),
                            'Content-Type': 'application/json'
                        }
                    });
                    if (detailsResponse.ok) {
                        const detailsData = await detailsResponse.json();
                        console.log('[DEBUG] Work item details:', JSON.stringify(detailsData, null, 2));
                        detailsData.value.forEach((item) => {
                            const iterationPath = item.fields?.['System.IterationPath'];
                            if (iterationPath && iterationPath !== projectToUse) {
                                console.log(`[DEBUG] Found iteration path: ${iterationPath}`);
                                iterationPaths.add(iterationPath);
                            }
                        });
                    }
                }
                const sprints = Array.from(iterationPaths).map((path, index) => {
                    const pathParts = path.split('\\');
                    const name = pathParts[pathParts.length - 1];
                    return {
                        id: `sprint-${index + 1}`,
                        name: name,
                        path: path,
                        attributes: {},
                        hasChildren: false,
                        structureType: 'iteration'
                    };
                });
                console.log(`[DEBUG] Found ${sprints.length} sprints via work item query`);
                return sprints;
            }
            console.log('[DEBUG] All approaches failed, returning empty array');
            return [];
        }
        catch (error) {
            console.error('[DEBUG] Error getting sprints:', error);
            return [];
        }
    }
    async getCurrentSprint(projectId, teamId) {
        console.log('[DEBUG] Getting current sprint...');
        try {
            const sprints = await this.getSprints(projectId, teamId, 'current');
            const currentSprint = sprints.length > 0 ? sprints[0] : null;
            console.log(`[DEBUG] Current sprint found: ${currentSprint ? currentSprint.name : 'None'}`);
            return currentSprint;
        }
        catch (error) {
            console.error('[DEBUG] Error getting current sprint:', error);
            return null;
        }
    }
    async getSprint(sprintId, iterationPath) {
        console.log(`[DEBUG] Getting sprint by ID: ${sprintId} or path: ${iterationPath}`);
        try {
            if (sprintId) {
                // Try to find sprint by ID in the list of all sprints
                const allSprints = await this.getSprints();
                const sprint = allSprints.find(s => s.id === sprintId || s.id === parseInt(sprintId));
                if (sprint) {
                    console.log(`[DEBUG] Found sprint by ID: ${sprint.name}`);
                    return sprint;
                }
            }
            if (iterationPath) {
                // Try to find sprint by iteration path
                const allSprints = await this.getSprints();
                const sprint = allSprints.find(s => s.path === iterationPath);
                if (sprint) {
                    console.log(`[DEBUG] Found sprint by path: ${sprint.name}`);
                    return sprint;
                }
            }
            console.log('[DEBUG] Sprint not found');
            return null;
        }
        catch (error) {
            console.error('[DEBUG] Error getting sprint:', error);
            return null;
        }
    }
    async getSprintWorkItems(sprintId, iterationPath, workItemTypes, includeCompleted = true) {
        console.log(`[DEBUG] Getting work items for sprint ID: ${sprintId} or path: ${iterationPath}`);
        try {
            let pathToUse = iterationPath;
            // If we have sprintId but no iterationPath, get the path from sprint details
            if (sprintId && !iterationPath) {
                const sprint = await this.getSprint(sprintId);
                if (sprint) {
                    pathToUse = sprint.path;
                    console.log(`[DEBUG] Resolved sprint path: ${pathToUse}`);
                }
            }
            if (!pathToUse) {
                console.log('[DEBUG] No valid iteration path found');
                return [];
            }
            // Build WIQL query to get work items in this iteration
            let wiql = `
        SELECT [System.Id], [System.Title], [System.WorkItemType], [System.State], 
               [System.AssignedTo], [Microsoft.VSTS.Scheduling.StoryPoints], 
               [Microsoft.VSTS.Scheduling.RemainingWork], [System.IterationPath]
        FROM WorkItems 
        WHERE [System.TeamProject] = '${this.projectName}'
        AND [System.IterationPath] = '${pathToUse}'
      `;
            if (workItemTypes && workItemTypes.length > 0) {
                wiql += ` AND [System.WorkItemType] IN (${workItemTypes.map(type => `'${type}'`).join(', ')})`;
            }
            if (!includeCompleted) {
                wiql += ` AND [System.State] NOT IN ('Closed', 'Done', 'Resolved', 'Completed')`;
            }
            wiql += ` ORDER BY [System.WorkItemType], [System.Id]`;
            console.log(`[DEBUG] WIQL query: ${wiql}`);
            const queryResponse = await fetch(`${this.getBaseUrl()}/_apis/wit/wiql?api-version=7.0`, {
                method: 'POST',
                headers: {
                    'Authorization': this.getAuthHeader(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query: wiql })
            });
            if (!queryResponse.ok) {
                console.log(`[DEBUG] WIQL query failed: ${queryResponse.status} ${queryResponse.statusText}`);
                return [];
            }
            const queryData = await queryResponse.json();
            const workItemIds = queryData.workItems?.map((wi) => wi.id) || [];
            console.log(`[DEBUG] Found ${workItemIds.length} work item IDs in sprint`);
            if (workItemIds.length === 0) {
                return [];
            }
            // Get detailed work item information
            const idsParam = workItemIds.join(',');
            const detailsResponse = await fetch(`${this.getBaseUrl()}/_apis/wit/workitems?ids=${idsParam}&api-version=7.0`, {
                headers: {
                    'Authorization': this.getAuthHeader(),
                    'Content-Type': 'application/json'
                }
            });
            if (!detailsResponse.ok) {
                console.log(`[DEBUG] Work item details failed: ${detailsResponse.status} ${detailsResponse.statusText}`);
                return [];
            }
            const detailsData = await detailsResponse.json();
            const workItems = detailsData.value.map((item) => this.mapAzureWorkItemToWorkItem(item));
            console.log(`[DEBUG] Retrieved ${workItems.length} work items with details`);
            return workItems;
        }
        catch (error) {
            console.error('[DEBUG] Error getting sprint work items:', error);
            return [];
        }
    }
    async assignWorkItemsToSprint(workItemIds, sprintId, iterationPath) {
        console.log(`[DEBUG] Assigning ${workItemIds.length} work items to sprint ID: ${sprintId} or path: ${iterationPath}`);
        try {
            let pathToUse = iterationPath;
            // If we have sprintId but no iterationPath, get the path from sprint details
            if (sprintId && !iterationPath) {
                const sprint = await this.getSprint(sprintId);
                if (sprint) {
                    pathToUse = sprint.path;
                    console.log(`[DEBUG] Resolved sprint path: ${pathToUse}`);
                }
            }
            if (!pathToUse) {
                console.log('[DEBUG] No valid iteration path found for assignment');
                return [{
                        workItemId: 0,
                        success: false,
                        message: 'No valid sprint path found. Either sprintId or iterationPath must be provided.'
                    }];
            }
            const results = [];
            for (const workItemId of workItemIds) {
                try {
                    console.log(`[DEBUG] Assigning work item ${workItemId} to path: ${pathToUse}`);
                    const patchDocument = [
                        {
                            op: 'replace',
                            path: '/fields/System.IterationPath',
                            value: pathToUse
                        }
                    ];
                    const url = `${this.getBaseUrl()}/_apis/wit/workitems/${workItemId}?api-version=7.0`;
                    console.log(`[DEBUG] Request URL: ${url}`);
                    console.log(`[DEBUG] Patch document: ${JSON.stringify(patchDocument, null, 2)}`);
                    const response = await fetch(url, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': this.getAuthHeader(),
                            'Content-Type': 'application/json-patch+json'
                        },
                        body: JSON.stringify(patchDocument)
                    });
                    if (response.ok) {
                        console.log(`[DEBUG] Successfully assigned work item ${workItemId}`);
                        results.push({
                            workItemId,
                            success: true,
                            message: 'Assigned to sprint successfully'
                        });
                    }
                    else {
                        const errorText = await response.text();
                        console.log(`[DEBUG] Failed to assign work item ${workItemId}: ${response.status} ${response.statusText} - ${errorText}`);
                        // Try to parse error details
                        let errorDetails = errorText;
                        try {
                            const errorJson = JSON.parse(errorText);
                            errorDetails = errorJson.message || errorJson.value?.Message || errorText;
                        }
                        catch (e) {
                            // Keep original error text if not JSON
                        }
                        results.push({
                            workItemId,
                            success: false,
                            message: `Failed: ${response.status} ${response.statusText} - ${errorDetails}`
                        });
                    }
                }
                catch (error) {
                    console.log(`[DEBUG] Error assigning work item ${workItemId}:`, error);
                    results.push({
                        workItemId,
                        success: false,
                        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
                    });
                }
            }
            console.log(`[DEBUG] Assignment complete. ${results.filter(r => r.success).length}/${results.length} successful`);
            return results;
        }
        catch (error) {
            console.error('[DEBUG] Error in assignWorkItemsToSprint:', error);
            return [{
                    workItemId: 0,
                    success: false,
                    message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
                }];
        }
    }
    async removeWorkItemsFromSprint(workItemIds, sprintId) {
        console.log(`[DEBUG] Removing ${workItemIds.length} work items from sprint`);
        try {
            const results = [];
            for (const workItemId of workItemIds) {
                try {
                    console.log(`[DEBUG] Removing work item ${workItemId} from sprint`);
                    // Set iteration path to the project root (removes from sprint)
                    const patchDocument = [
                        {
                            op: 'replace',
                            path: '/fields/System.IterationPath',
                            value: this.projectName
                        }
                    ];
                    const url = `${this.getBaseUrl()}/_apis/wit/workitems/${workItemId}?api-version=7.0`;
                    console.log(`[DEBUG] Request URL: ${url}`);
                    console.log(`[DEBUG] Patch document: ${JSON.stringify(patchDocument, null, 2)}`);
                    const response = await fetch(url, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': this.getAuthHeader(),
                            'Content-Type': 'application/json-patch+json'
                        },
                        body: JSON.stringify(patchDocument)
                    });
                    if (response.ok) {
                        console.log(`[DEBUG] Successfully removed work item ${workItemId} from sprint`);
                        results.push({
                            workItemId,
                            success: true,
                            message: 'Removed from sprint successfully'
                        });
                    }
                    else {
                        const errorText = await response.text();
                        console.log(`[DEBUG] Failed to remove work item ${workItemId}: ${response.status} ${response.statusText} - ${errorText}`);
                        // Try to parse error details
                        let errorDetails = errorText;
                        try {
                            const errorJson = JSON.parse(errorText);
                            errorDetails = errorJson.message || errorJson.value?.Message || errorText;
                        }
                        catch (e) {
                            // Keep original error text if not JSON
                        }
                        results.push({
                            workItemId,
                            success: false,
                            message: `Failed: ${response.status} ${response.statusText} - ${errorDetails}`
                        });
                    }
                }
                catch (error) {
                    console.log(`[DEBUG] Error removing work item ${workItemId}:`, error);
                    results.push({
                        workItemId,
                        success: false,
                        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
                    });
                }
            }
            console.log(`[DEBUG] Removal complete. ${results.filter(r => r.success).length}/${results.length} successful`);
            return results;
        }
        catch (error) {
            console.error('[DEBUG] Error in removeWorkItemsFromSprint:', error);
            return [{
                    workItemId: 0,
                    success: false,
                    message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
                }];
        }
    }
}
class AzureDevOpsCoreServer {
    server;
    apiClient;
    constructor() {
        this.server = new index_js_1.Server({
            name: 'azure-devops-core',
            version: '1.0.0',
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.apiClient = new AzureDevOpsApiClient();
        this.initializeFromEnvironment();
        this.setupToolHandlers();
    }
    initializeFromEnvironment() {
        const organizationUrl = process.env.AZURE_DEVOPS_ORG_URL;
        const projectName = process.env.AZURE_DEVOPS_PROJECT;
        const pat = process.env.AZURE_DEVOPS_PAT;
        if (organizationUrl && projectName && pat) {
            this.apiClient.initialize(organizationUrl, projectName, pat);
        }
    }
    ensureInitialized() {
        const organizationUrl = process.env.AZURE_DEVOPS_ORG_URL;
        const projectName = process.env.AZURE_DEVOPS_PROJECT;
        const pat = process.env.AZURE_DEVOPS_PAT;
        if (!organizationUrl || !projectName || !pat) {
            throw new Error('Azure DevOps configuration missing. Please set AZURE_DEVOPS_ORG_URL, AZURE_DEVOPS_PROJECT, and AZURE_DEVOPS_PAT environment variables.');
        }
    }
    setupToolHandlers() {
        this.server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: 'create_user_story',
                        description: 'Create a new user story in Azure DevOps',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                title: { type: 'string', description: 'User story title' },
                                description: { type: 'string', description: 'Detailed description' },
                                storyPoints: { type: 'number', description: 'Story points (1-21)', minimum: 1, maximum: 21 },
                            },
                            required: ['title'],
                        },
                    },
                    {
                        name: 'create_task',
                        description: 'Create a new task in Azure DevOps',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                title: { type: 'string', description: 'Task title' },
                                description: { type: 'string', description: 'Detailed description' },
                                remainingWork: { type: 'number', description: 'Remaining work in hours', minimum: 0 },
                                parentId: { type: 'number', description: 'Parent user story ID (optional)' },
                            },
                            required: ['title'],
                        },
                    },
                    {
                        name: 'get_work_items',
                        description: 'Retrieve work items from Azure DevOps',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                type: { type: 'string', enum: ['User Story', 'Task', 'Bug', 'Feature'] },
                                state: { type: 'string', description: 'Work item state' },
                                assignedTo: { type: 'string', description: 'Assigned user' },
                                maxResults: { type: 'number', minimum: 1, maximum: 200, default: 50 },
                            },
                        },
                    },
                    {
                        name: 'update_work_item',
                        description: 'Update an existing work item',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                id: { type: 'number', description: 'Work item ID' },
                                updates: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            op: { type: 'string', enum: ['add', 'replace', 'remove'] },
                                            path: { type: 'string' },
                                            value: {},
                                        },
                                        required: ['op', 'path'],
                                    },
                                },
                            },
                            required: ['id', 'updates'],
                        },
                    },
                    {
                        name: 'get_work_item',
                        description: 'Get a specific work item by ID',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                id: { type: 'number', description: 'Work item ID' },
                            },
                            required: ['id'],
                        },
                    },
                    {
                        name: 'get_projects',
                        description: 'Get accessible projects in the organization',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                organizationUrl: { type: 'string', description: 'Organization URL (optional)' },
                            },
                        },
                    },
                    {
                        name: 'switch_project',
                        description: 'Switch to a different project',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                projectId: { type: 'string', description: 'Project ID' },
                                projectName: { type: 'string', description: 'Project name' },
                            },
                            required: ['projectId', 'projectName'],
                        },
                    },
                    {
                        name: 'create_test_case',
                        description: 'Create a new test case',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                title: { type: 'string', description: 'Test case title' },
                                description: { type: 'string', description: 'Test case description' },
                                steps: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            stepNumber: { type: 'number' },
                                            action: { type: 'string' },
                                            expectedResult: { type: 'string' },
                                        },
                                        required: ['stepNumber', 'action', 'expectedResult'],
                                    },
                                },
                                priority: { type: 'string', enum: ['Critical', 'High', 'Medium', 'Low'], default: 'Medium' },
                                testPlanId: { type: 'number', description: 'Test plan ID (optional)' },
                            },
                            required: ['title', 'steps'],
                        },
                    },
                    {
                        name: 'create_test_plan',
                        description: 'Create a new test plan',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                name: { type: 'string', description: 'Test plan name' },
                                description: { type: 'string', description: 'Test plan description' },
                                areaPath: { type: 'string', description: 'Area path' },
                                iterationPath: { type: 'string', description: 'Iteration path' },
                                projectId: { type: 'string', description: 'Project ID' },
                            },
                            required: ['name', 'areaPath', 'iterationPath', 'projectId'],
                        },
                    },
                    {
                        name: 'get_test_cases',
                        description: 'Get test cases',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                projectId: { type: 'string', description: 'Project ID (optional)' },
                                testPlanId: { type: 'number', description: 'Test plan ID (optional)' },
                                maxResults: { type: 'number', minimum: 1, maximum: 200, default: 50 },
                            },
                        },
                    },
                    {
                        name: 'get_test_plans',
                        description: 'Get test plans',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                projectId: { type: 'string', description: 'Project ID (optional)' },
                            },
                        },
                    },
                    {
                        name: 'execute_test_case',
                        description: 'Execute a test case and record results',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                testCaseId: { type: 'number', description: 'Test case ID' },
                                outcome: { type: 'string', enum: ['Passed', 'Failed', 'Blocked', 'Not Applicable'] },
                                comment: { type: 'string', description: 'Execution comment (optional)' },
                                executedBy: { type: 'string', description: 'Person who executed the test' },
                            },
                            required: ['testCaseId', 'outcome', 'executedBy'],
                        },
                    },
                    {
                        name: 'batch_create_user_stories',
                        description: 'Create multiple user stories in batches',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                stories: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            title: { type: 'string', description: 'User story title' },
                                            description: { type: 'string', description: 'Detailed description' },
                                            storyPoints: { type: 'number', description: 'Story points (1-21)', minimum: 1, maximum: 21 },
                                        },
                                        required: ['title'],
                                    },
                                },
                                batchSize: { type: 'number', description: 'Batch size (1-50)', minimum: 1, maximum: 50, default: 10 },
                            },
                            required: ['stories'],
                        },
                    },
                    {
                        name: 'batch_create_tasks',
                        description: 'Create multiple tasks in batches',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                tasks: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            title: { type: 'string', description: 'Task title' },
                                            description: { type: 'string', description: 'Detailed description' },
                                            remainingWork: { type: 'number', description: 'Remaining work in hours', minimum: 0 },
                                            parentId: { type: 'number', description: 'Parent work item ID (optional)' },
                                        },
                                        required: ['title'],
                                    },
                                },
                                batchSize: { type: 'number', description: 'Batch size (1-50)', minimum: 1, maximum: 50, default: 10 },
                            },
                            required: ['tasks'],
                        },
                    },
                    {
                        name: 'batch_create_test_cases',
                        description: 'Create multiple test cases in batches',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                testCases: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            title: { type: 'string', description: 'Test case title' },
                                            description: { type: 'string', description: 'Test case description' },
                                            steps: {
                                                type: 'array',
                                                items: {
                                                    type: 'object',
                                                    properties: {
                                                        stepNumber: { type: 'number' },
                                                        action: { type: 'string' },
                                                        expectedResult: { type: 'string' },
                                                    },
                                                    required: ['stepNumber', 'action', 'expectedResult'],
                                                },
                                            },
                                            priority: { type: 'string', enum: ['Critical', 'High', 'Medium', 'Low'], default: 'Medium' },
                                            testPlanId: { type: 'number', description: 'Test plan ID (optional)' },
                                        },
                                        required: ['title', 'steps'],
                                    },
                                },
                                batchSize: { type: 'number', description: 'Batch size (1-50)', minimum: 1, maximum: 50, default: 10 },
                            },
                            required: ['testCases'],
                        },
                    },
                    {
                        name: 'batch_create_test_plans',
                        description: 'Create multiple test plans in batches',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                testPlans: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            name: { type: 'string', description: 'Test plan name' },
                                            description: { type: 'string', description: 'Test plan description' },
                                            areaPath: { type: 'string', description: 'Area path' },
                                            iterationPath: { type: 'string', description: 'Iteration path' },
                                            projectId: { type: 'string', description: 'Project ID' },
                                        },
                                        required: ['name', 'areaPath', 'iterationPath', 'projectId'],
                                    },
                                },
                                batchSize: { type: 'number', description: 'Batch size (1-20)', minimum: 1, maximum: 20, default: 5 },
                            },
                            required: ['testPlans'],
                        },
                    },
                    {
                        name: 'get_sprints',
                        description: 'Get all sprints/iterations. Returns sprint details including the correct path format for use in other sprint tools.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                projectId: { type: 'string', description: 'Project ID (optional)' },
                                teamId: { type: 'string', description: 'Team ID (optional)' },
                                state: { type: 'string', enum: ['current', 'future', 'closed'], description: 'Sprint state filter' },
                            },
                        },
                    },
                    {
                        name: 'get_current_sprint',
                        description: 'Get the currently active sprint',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                projectId: { type: 'string', description: 'Project ID (optional)' },
                                teamId: { type: 'string', description: 'Team ID (optional)' },
                            },
                        },
                    },
                    {
                        name: 'get_sprint',
                        description: 'Get a specific sprint by ID or iteration path',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                sprintId: { type: 'string', description: 'Sprint ID' },
                                iterationPath: { type: 'string', description: 'Iteration path in format: ProjectName\\SprintName (e.g., "MyProject\\Sprint 1")' },
                            },
                        },
                    },
                    {
                        name: 'get_sprint_work_items',
                        description: 'Get work items assigned to a sprint',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                sprintId: { type: 'string', description: 'Sprint ID' },
                                iterationPath: { type: 'string', description: 'Iteration path in format: ProjectName\\SprintName (e.g., "MyProject\\Sprint 1")' },
                                workItemTypes: { type: 'array', items: { type: 'string' }, description: 'Filter by work item types' },
                                includeCompleted: { type: 'boolean', default: true, description: 'Include completed work items' },
                            },
                        },
                    },
                    {
                        name: 'assign_work_items_to_sprint',
                        description: 'Assign work items to a sprint. Either sprintId or iterationPath must be provided.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                workItemIds: { type: 'array', items: { type: 'number' }, description: 'Work item IDs to assign' },
                                sprintId: { type: 'string', description: 'Sprint ID (preferred method)' },
                                iterationPath: { type: 'string', description: 'Iteration path in format: ProjectName\\SprintName (e.g., "MyProject\\Sprint 1"). Use this format if sprintId is not available.' },
                            },
                            required: ['workItemIds'],
                        },
                    },
                    {
                        name: 'remove_work_items_from_sprint',
                        description: 'Remove work items from sprint',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                workItemIds: { type: 'array', items: { type: 'number' }, description: 'Work item IDs to remove' },
                                sprintId: { type: 'string', description: 'Sprint ID (optional)' },
                            },
                            required: ['workItemIds'],
                        },
                    },
                ],
            };
        });
        this.server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            try {
                switch (name) {
                    case 'create_user_story':
                        return await this.createUserStory(args);
                    case 'create_task':
                        return await this.createTask(args);
                    case 'get_work_items':
                        return await this.getWorkItems(args);
                    case 'update_work_item':
                        return await this.updateWorkItem(args);
                    case 'get_work_item':
                        return await this.getWorkItem(args);
                    case 'get_projects':
                        return await this.getProjects(args);
                    case 'switch_project':
                        return await this.switchProject(args);
                    case 'create_test_case':
                        return await this.createTestCase(args);
                    case 'create_test_plan':
                        return await this.createTestPlan(args);
                    case 'get_test_cases':
                        return await this.getTestCases(args);
                    case 'get_test_plans':
                        return await this.getTestPlans(args);
                    case 'execute_test_case':
                        return await this.executeTestCase(args);
                    case 'batch_create_user_stories':
                        return await this.batchCreateUserStories(args);
                    case 'batch_create_tasks':
                        return await this.batchCreateTasks(args);
                    case 'batch_create_test_cases':
                        return await this.batchCreateTestCases(args);
                    case 'batch_create_test_plans':
                        return await this.batchCreateTestPlans(args);
                    case 'get_sprints':
                        return await this.getSprints(args);
                    case 'get_current_sprint':
                        return await this.getCurrentSprint(args);
                    case 'get_sprint':
                        return await this.getSprint(args);
                    case 'get_sprint_work_items':
                        return await this.getSprintWorkItems(args);
                    case 'assign_work_items_to_sprint':
                        return await this.assignWorkItemsToSprint(args);
                    case 'remove_work_items_from_sprint':
                        return await this.removeWorkItemsFromSprint(args);
                    default:
                        throw new Error(`Unknown tool: ${name}`);
                }
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error: ${errorMessage}`,
                        },
                    ],
                };
            }
        });
    }
    async createUserStory(args) {
        this.ensureInitialized();
        const { title, description, storyPoints } = CreateUserStorySchema.parse(args);
        const fields = { title, description: description || '', storyPoints };
        const workItem = await this.apiClient.createWorkItem('User Story', fields);
        return {
            content: [
                {
                    type: 'text',
                    text: `✅ Created User Story #${workItem.id}: ${workItem.title}\n\nDetails:\n- ID: ${workItem.id}\n- Title: ${workItem.title}\n- State: ${workItem.state}\n- Story Points: ${workItem.storyPoints || 'Not set'}\n- Description: ${workItem.description || 'No description'}`,
                },
            ],
        };
    }
    async createTask(args) {
        this.ensureInitialized();
        const { title, description, remainingWork, parentId } = CreateTaskSchema.parse(args);
        const fields = { title, description: description || '', remainingWork };
        const workItem = await this.apiClient.createWorkItem('Task', fields, parentId);
        const parentInfo = parentId ? `\n- Parent: User Story #${parentId}` : '\n- Type: Independent task';
        return {
            content: [
                {
                    type: 'text',
                    text: `✅ Created Task #${workItem.id}: ${workItem.title}\n\nDetails:\n- ID: ${workItem.id}\n- Title: ${workItem.title}\n- State: ${workItem.state}\n- Remaining Work: ${workItem.remainingWork || 'Not set'} hours${parentInfo}\n- Description: ${workItem.description || 'No description'}`,
                },
            ],
        };
    }
    async getWorkItems(args) {
        this.ensureInitialized();
        const query = GetWorkItemsSchema.parse(args);
        const workItems = await this.apiClient.getWorkItems(query);
        if (workItems.length === 0) {
            return {
                content: [
                    {
                        type: 'text',
                        text: 'No work items found matching the specified criteria.',
                    },
                ],
            };
        }
        const workItemsList = workItems.map(item => `- #${item.id}: ${item.title} (${item.type}, ${item.state}${item.assignedTo ? `, assigned to ${item.assignedTo}` : ''})`).join('\n');
        return {
            content: [
                {
                    type: 'text',
                    text: `Found ${workItems.length} work item(s):\n\n${workItemsList}`,
                },
            ],
        };
    }
    async updateWorkItem(args) {
        this.ensureInitialized();
        const { id, updates } = UpdateWorkItemSchema.parse(args);
        const workItem = await this.apiClient.updateWorkItem(id, updates);
        return {
            content: [
                {
                    type: 'text',
                    text: `✅ Updated Work Item #${workItem.id}: ${workItem.title}\n\nCurrent Details:\n- ID: ${workItem.id}\n- Title: ${workItem.title}\n- Type: ${workItem.type}\n- State: ${workItem.state}\n- Assigned To: ${workItem.assignedTo || 'Unassigned'}`,
                },
            ],
        };
    }
    async getWorkItem(args) {
        this.ensureInitialized();
        const { id } = GetWorkItemSchema.parse(args);
        const workItem = await this.apiClient.getWorkItem(id);
        return {
            content: [
                {
                    type: 'text',
                    text: `Work Item #${workItem.id}: ${workItem.title}\n\nDetails:\n- Type: ${workItem.type}\n- State: ${workItem.state}\n- Assigned To: ${workItem.assignedTo || 'Unassigned'}\n- Created: ${workItem.createdDate.toLocaleDateString()}\n- Modified: ${workItem.changedDate.toLocaleDateString()}\n- Story Points: ${workItem.storyPoints || 'Not set'}\n- Remaining Work: ${workItem.remainingWork || 'Not set'} hours\n- Tags: ${workItem.tags?.join(', ') || 'None'}\n\nDescription:\n${workItem.description || 'No description'}`,
                },
            ],
        };
    }
    async getProjects(args) {
        this.ensureInitialized();
        const projects = await this.apiClient.getProjects();
        if (projects.length === 0) {
            return {
                content: [
                    {
                        type: 'text',
                        text: 'No accessible projects found in this organization.',
                    },
                ],
            };
        }
        const projectsList = projects.map(project => `- ${project.name} (${project.id}) - ${project.state} | ${project.visibility}`).join('\n');
        return {
            content: [
                {
                    type: 'text',
                    text: `Found ${projects.length} accessible project(s):\n\n${projectsList}`,
                },
            ],
        };
    }
    async switchProject(args) {
        this.ensureInitialized();
        const { projectId, projectName } = SwitchProjectSchema.parse(args);
        // Update the API client with new project
        this.apiClient.initialize(process.env.AZURE_DEVOPS_ORG_URL, projectName, process.env.AZURE_DEVOPS_PAT);
        return {
            content: [
                {
                    type: 'text',
                    text: `✅ Switched to project: ${projectName} (${projectId})\n\nYou can now create and manage work items in this project.`,
                },
            ],
        };
    }
    async createTestCase(args) {
        this.ensureInitialized();
        const { title, description, steps, priority, testPlanId } = CreateTestCaseSchema.parse(args);
        const fields = { title, description: description || '', steps, priority };
        const testCase = await this.apiClient.createTestCase(fields, testPlanId);
        const testPlanInfo = testPlanId ? `\n- Test Plan: #${testPlanId}` : '\n- Type: Independent test case';
        return {
            content: [
                {
                    type: 'text',
                    text: `✅ Created Test Case #${testCase.id}: ${testCase.title}\n\nDetails:\n- ID: ${testCase.id}\n- Title: ${testCase.title}\n- State: ${testCase.state}\n- Priority: ${priority}\n- Steps: ${steps.length}${testPlanInfo}\n- Description: ${testCase.description || 'No description'}`,
                },
            ],
        };
    }
    async createTestPlan(args) {
        this.ensureInitialized();
        const { name, description, areaPath, iterationPath, projectId } = CreateTestPlanSchema.parse(args);
        const fields = { name, description: description || '', areaPath, iterationPath };
        const testPlan = await this.apiClient.createTestPlan(fields);
        return {
            content: [
                {
                    type: 'text',
                    text: `✅ Created Test Plan #${testPlan.id}: ${testPlan.name}\n\nDetails:\n- ID: ${testPlan.id}\n- Name: ${testPlan.name}\n- Project: ${projectId}\n- Area Path: ${areaPath}\n- Iteration Path: ${iterationPath}\n- State: ${testPlan.state}\n- Description: ${testPlan.description || 'No description'}`,
                },
            ],
        };
    }
    async getTestCases(args) {
        this.ensureInitialized();
        const { projectId, testPlanId, maxResults } = GetTestCasesSchema.parse(args);
        const testCases = await this.apiClient.getTestCases(projectId, testPlanId, maxResults);
        if (testCases.length === 0) {
            return {
                content: [
                    {
                        type: 'text',
                        text: 'No test cases found matching the specified criteria.',
                    },
                ],
            };
        }
        const testCasesList = testCases.map(testCase => `- #${testCase.id}: ${testCase.title} (${testCase.state}${testCase.assignedTo ? `, assigned to ${testCase.assignedTo}` : ''})`).join('\n');
        return {
            content: [
                {
                    type: 'text',
                    text: `Found ${testCases.length} test case(s):\n\n${testCasesList}`,
                },
            ],
        };
    }
    async getTestPlans(args) {
        this.ensureInitialized();
        const { projectId } = GetTestPlansSchema.parse(args);
        const testPlans = await this.apiClient.getTestPlans(projectId);
        if (testPlans.length === 0) {
            return {
                content: [
                    {
                        type: 'text',
                        text: 'No test plans found in the specified project.',
                    },
                ],
            };
        }
        const testPlansList = testPlans.map(testPlan => `- #${testPlan.id}: ${testPlan.name} (${testPlan.state})`).join('\n');
        return {
            content: [
                {
                    type: 'text',
                    text: `Found ${testPlans.length} test plan(s):\n\n${testPlansList}`,
                },
            ],
        };
    }
    async executeTestCase(args) {
        this.ensureInitialized();
        const { testCaseId, outcome, comment, executedBy } = ExecuteTestCaseSchema.parse(args);
        const result = { outcome, comment, executedBy };
        const testCase = await this.apiClient.executeTestCase(testCaseId, result);
        return {
            content: [
                {
                    type: 'text',
                    text: `✅ Test Case #${testCaseId} executed successfully\n\nExecution Details:\n- Test Case: #${testCase.id} - ${testCase.title}\n- Outcome: ${outcome}\n- Executed By: ${executedBy}\n- Comment: ${comment || 'No comment'}\n- Execution Date: ${new Date().toLocaleDateString()}`,
                },
            ],
        };
    }
    async batchCreateUserStories(args) {
        this.ensureInitialized();
        const { stories, batchSize } = BatchCreateUserStoriesSchema.parse(args);
        const results = [];
        const errors = [];
        for (let i = 0; i < stories.length; i += batchSize) {
            const batch = stories.slice(i, i + batchSize);
            console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(stories.length / batchSize)} (${batch.length} user stories)`);
            const batchPromises = batch.map(async (story, index) => {
                try {
                    const result = await this.apiClient.createWorkItem("User Story", story);
                    return { index: i + index, success: true, result, story: story.title };
                }
                catch (error) {
                    return { index: i + index, success: false, error: error instanceof Error ? error.message : 'Unknown error', story: story.title };
                }
            });
            const batchResults = await Promise.all(batchPromises);
            batchResults.forEach(result => {
                if (result.success) {
                    results.push(result);
                }
                else {
                    errors.push(result);
                }
            });
            // Rate limiting: wait between batches
            if (i + batchSize < stories.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        const successCount = results.length;
        const errorCount = errors.length;
        const successList = results.map(r => `- #${r.result.id}: ${r.story}`).join('\n');
        const errorList = errors.length > 0 ? `\n\nErrors:\n${errors.map(e => `- ${e.story}: ${e.error}`).join('\n')}` : '';
        return {
            content: [
                {
                    type: 'text',
                    text: `✅ Batch User Story Creation Complete\n\nSummary:\n- Total requested: ${stories.length}\n- Successfully created: ${successCount}\n- Errors: ${errorCount}\n\nCreated User Stories:\n${successList}${errorList}`,
                },
            ],
        };
    }
    async batchCreateTasks(args) {
        this.ensureInitialized();
        const { tasks, batchSize } = BatchCreateTasksSchema.parse(args);
        const results = [];
        const errors = [];
        for (let i = 0; i < tasks.length; i += batchSize) {
            const batch = tasks.slice(i, i + batchSize);
            console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(tasks.length / batchSize)} (${batch.length} tasks)`);
            const batchPromises = batch.map(async (task, index) => {
                try {
                    const result = await this.apiClient.createWorkItem("Task", task, task.parentId);
                    return { index: i + index, success: true, result, task: task.title };
                }
                catch (error) {
                    return { index: i + index, success: false, error: error instanceof Error ? error.message : 'Unknown error', task: task.title };
                }
            });
            const batchResults = await Promise.all(batchPromises);
            batchResults.forEach(result => {
                if (result.success) {
                    results.push(result);
                }
                else {
                    errors.push(result);
                }
            });
            // Rate limiting: wait between batches
            if (i + batchSize < tasks.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        const successCount = results.length;
        const errorCount = errors.length;
        const successList = results.map(r => `- #${r.result.id}: ${r.task}${r.result.parentId ? ` (parent: #${r.result.parentId})` : ''}`).join('\n');
        const errorList = errors.length > 0 ? `\n\nErrors:\n${errors.map(e => `- ${e.task}: ${e.error}`).join('\n')}` : '';
        return {
            content: [
                {
                    type: 'text',
                    text: `✅ Batch Task Creation Complete\n\nSummary:\n- Total requested: ${tasks.length}\n- Successfully created: ${successCount}\n- Errors: ${errorCount}\n\nCreated Tasks:\n${successList}${errorList}`,
                },
            ],
        };
    }
    async batchCreateTestCases(args) {
        this.ensureInitialized();
        const { testCases, batchSize } = BatchCreateTestCasesSchema.parse(args);
        const results = [];
        const errors = [];
        for (let i = 0; i < testCases.length; i += batchSize) {
            const batch = testCases.slice(i, i + batchSize);
            console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(testCases.length / batchSize)} (${batch.length} test cases)`);
            const batchPromises = batch.map(async (testCase, index) => {
                try {
                    const result = await this.apiClient.createTestCase(testCase, testCase.testPlanId);
                    return { index: i + index, success: true, result, testCase: testCase.title };
                }
                catch (error) {
                    return { index: i + index, success: false, error: error instanceof Error ? error.message : 'Unknown error', testCase: testCase.title };
                }
            });
            const batchResults = await Promise.all(batchPromises);
            batchResults.forEach(result => {
                if (result.success) {
                    results.push(result);
                }
                else {
                    errors.push(result);
                }
            });
            // Rate limiting: wait between batches
            if (i + batchSize < testCases.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        const successCount = results.length;
        const errorCount = errors.length;
        const successList = results.map(r => `- #${r.result.id}: ${r.testCase}`).join('\n');
        const errorList = errors.length > 0 ? `\n\nErrors:\n${errors.map(e => `- ${e.testCase}: ${e.error}`).join('\n')}` : '';
        return {
            content: [
                {
                    type: 'text',
                    text: `✅ Batch Test Case Creation Complete\n\nSummary:\n- Total requested: ${testCases.length}\n- Successfully created: ${successCount}\n- Errors: ${errorCount}\n\nCreated Test Cases:\n${successList}${errorList}`,
                },
            ],
        };
    }
    async batchCreateTestPlans(args) {
        this.ensureInitialized();
        const { testPlans, batchSize } = BatchCreateTestPlansSchema.parse(args);
        const results = [];
        const errors = [];
        for (let i = 0; i < testPlans.length; i += batchSize) {
            const batch = testPlans.slice(i, i + batchSize);
            console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(testPlans.length / batchSize)} (${batch.length} test plans)`);
            const batchPromises = batch.map(async (testPlan, index) => {
                try {
                    const result = await this.apiClient.createTestPlan(testPlan);
                    return { index: i + index, success: true, result, testPlan: testPlan.name };
                }
                catch (error) {
                    return { index: i + index, success: false, error: error instanceof Error ? error.message : 'Unknown error', testPlan: testPlan.name };
                }
            });
            const batchResults = await Promise.all(batchPromises);
            batchResults.forEach(result => {
                if (result.success) {
                    results.push(result);
                }
                else {
                    errors.push(result);
                }
            });
            // Rate limiting: wait between batches
            if (i + batchSize < testPlans.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        const successCount = results.length;
        const errorCount = errors.length;
        const successList = results.map(r => `- #${r.result.id}: ${r.testPlan}`).join('\n');
        const errorList = errors.length > 0 ? `\n\nErrors:\n${errors.map(e => `- ${e.testPlan}: ${e.error}`).join('\n')}` : '';
        return {
            content: [
                {
                    type: 'text',
                    text: `✅ Batch Test Plan Creation Complete\n\nSummary:\n- Total requested: ${testPlans.length}\n- Successfully created: ${successCount}\n- Errors: ${errorCount}\n\nCreated Test Plans:\n${successList}${errorList}`,
                },
            ],
        };
    }
    async getSprints(args) {
        this.ensureInitialized();
        const { projectId, teamId, state } = GetSprintsSchema.parse(args);
        const sprints = await this.apiClient.getSprints(projectId, teamId, state);
        const sprintList = sprints.map(sprint => {
            // Extract the correct iteration path format for assignment
            const pathParts = sprint.path ? sprint.path.split('\\') : [];
            const assignmentPath = pathParts.length >= 2 ? `${pathParts[1]}\\${sprint.name}` : sprint.name;
            return `- ${sprint.name} (ID: ${sprint.id})\n  📍 Assignment Path: "${assignmentPath}"\n  🔗 Full Path: ${sprint.path || 'No path'}`;
        }).join('\n\n');
        return {
            content: [
                {
                    type: 'text',
                    text: `Found ${sprints.length} sprint(s):\n\n${sprintList || 'No sprints found.'}\n\n💡 **Path Format Note**: Use the "Assignment Path" format (ProjectName\\SprintName) when assigning work items to sprints.\n\n[DEBUG] Check console for detailed debug information.`
                }
            ]
        };
    }
    async getCurrentSprint(args) {
        this.ensureInitialized();
        const { projectId, teamId } = GetCurrentSprintSchema.parse(args);
        const currentSprint = await this.apiClient.getCurrentSprint(projectId, teamId);
        if (!currentSprint) {
            return {
                content: [
                    {
                        type: 'text',
                        text: 'No current active sprint found.\n\n[DEBUG] Check console for detailed debug information.'
                    }
                ]
            };
        }
        return {
            content: [
                {
                    type: 'text',
                    text: `Current Sprint: ${currentSprint.name}\n\nDetails:\n- ID: ${currentSprint.id}\n- Path: ${currentSprint.path}\n- Structure Type: ${currentSprint.structureType}\n\n[DEBUG] Check console for detailed debug information.`
                }
            ]
        };
    }
    async getSprint(args) {
        this.ensureInitialized();
        const { sprintId, iterationPath } = GetSprintSchema.parse(args);
        if (!sprintId && !iterationPath) {
            return {
                content: [
                    {
                        type: 'text',
                        text: 'Error: Either sprintId or iterationPath must be provided.'
                    }
                ]
            };
        }
        const sprint = await this.apiClient.getSprint(sprintId, iterationPath);
        if (!sprint) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Sprint not found for ID: ${sprintId || 'N/A'}, Path: ${iterationPath || 'N/A'}\n\n[DEBUG] Check console for detailed debug information.`
                    }
                ]
            };
        }
        return {
            content: [
                {
                    type: 'text',
                    text: `Sprint: ${sprint.name}\n\nDetails:\n- ID: ${sprint.id}\n- Path: ${sprint.path}\n- Structure Type: ${sprint.structureType}\n- Has Children: ${sprint.hasChildren}\n\n[DEBUG] Check console for detailed debug information.`
                }
            ]
        };
    }
    async getSprintWorkItems(args) {
        this.ensureInitialized();
        const { sprintId, iterationPath, workItemTypes, includeCompleted } = GetSprintWorkItemsSchema.parse(args);
        if (!sprintId && !iterationPath) {
            return {
                content: [
                    {
                        type: 'text',
                        text: 'Error: Either sprintId or iterationPath must be provided.'
                    }
                ]
            };
        }
        const workItems = await this.apiClient.getSprintWorkItems(sprintId, iterationPath, workItemTypes, includeCompleted);
        const workItemList = workItems.map(wi => `- #${wi.id}: ${wi.title} (${wi.type}, ${wi.state})`).join('\n');
        const filterInfo = workItemTypes ? `\nFiltered by types: ${workItemTypes.join(', ')}` : '';
        const completedInfo = includeCompleted ? '' : '\nExcluding completed items';
        return {
            content: [
                {
                    type: 'text',
                    text: `Found ${workItems.length} work item(s) in sprint:${filterInfo}${completedInfo}\n\n${workItemList || 'No work items found in this sprint.'}\n\n[DEBUG] Check console for detailed debug information.`
                }
            ]
        };
    }
    async assignWorkItemsToSprint(args) {
        this.ensureInitialized();
        const { workItemIds, sprintId, iterationPath } = AssignWorkItemsToSprintSchema.parse(args);
        if (!sprintId && !iterationPath) {
            return {
                content: [
                    {
                        type: 'text',
                        text: 'Error: Either sprintId or iterationPath must be provided.\n\n💡 Examples:\n- Using sprintId: {"workItemIds": [123, 456], "sprintId": "15"}\n- Using iterationPath: {"workItemIds": [123, 456], "iterationPath": "MyProject\\\\Sprint 1"}\n\n📋 Use get_sprints to see available sprints and their correct path formats.'
                    }
                ]
            };
        }
        const results = await this.apiClient.assignWorkItemsToSprint(workItemIds, sprintId, iterationPath);
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.filter(r => !r.success).length;
        const resultText = results.map(r => `- Work Item #${r.workItemId}: ${r.success ? '✅' : '❌'} ${r.message}`).join('\n');
        // Add detailed error information to the response
        const debugInfo = results.filter(r => !r.success).map(r => `\n🔍 Work Item #${r.workItemId} Error Details:\n${r.message}`).join('\n');
        return {
            content: [
                {
                    type: 'text',
                    text: `Assignment Results: ${successCount} successful, ${failureCount} failed\n\n${resultText}${debugInfo}\n\n[DEBUG] Check console for detailed debug information.`
                }
            ]
        };
    }
    async removeWorkItemsFromSprint(args) {
        this.ensureInitialized();
        const { workItemIds, sprintId } = RemoveWorkItemsFromSprintSchema.parse(args);
        const results = await this.apiClient.removeWorkItemsFromSprint(workItemIds, sprintId);
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.filter(r => !r.success).length;
        const resultText = results.map(r => `- Work Item #${r.workItemId}: ${r.success ? '✅' : '❌'} ${r.message}`).join('\n');
        // Add detailed error information to the response
        const debugInfo = results.filter(r => !r.success).map(r => `\n🔍 Work Item #${r.workItemId} Error Details:\n${r.message}`).join('\n');
        return {
            content: [
                {
                    type: 'text',
                    text: `Removal Results: ${successCount} successful, ${failureCount} failed\n\n${resultText}${debugInfo}\n\n[DEBUG] Check console for detailed debug information.`
                }
            ]
        };
    }
    async run() {
        try {
            // Check command line arguments for HTTP mode
            const args = process.argv.slice(2);
            const httpIndex = args.indexOf('--http');
            console.error('MCP Server starting with args:', args);
            if (httpIndex !== -1 && args[httpIndex + 1]) {
                // HTTP mode
                const port = parseInt(args[httpIndex + 1], 10);
                console.error(`Starting in HTTP mode on port ${port}`);
                await this.runHttpServer(port);
            }
            else {
                // stdio mode (default)
                console.error('Starting in stdio mode');
                const transport = new stdio_js_1.StdioServerTransport();
                await this.server.connect(transport);
                console.error('Azure DevOps Core MCP server running on stdio');
            }
        }
        catch (error) {
            console.error('MCP Server failed to start:', error);
            process.exit(1);
        }
    }
    async runHttpServer(port) {
        try {
            console.error(`Starting HTTP server on port ${port}...`);
            // Try to require express
            let express;
            try {
                express = require('express');
            }
            catch (error) {
                console.error('Express not found, installing...');
                throw new Error('Express dependency not available. Please run: npm install express');
            }
            const app = express();
            app.use(express.json());
            // Health check endpoint (simple, no MCP dependency)
            app.get('/health', (req, res) => {
                res.json({
                    status: 'healthy',
                    server: 'azure-devops-core',
                    version: '1.0.0',
                    mode: 'http',
                    timestamp: new Date().toISOString()
                });
            });
            // Basic info endpoint
            app.get('/', (req, res) => {
                res.json({
                    name: 'Azure DevOps Core MCP Server',
                    version: '1.0.0',
                    endpoints: {
                        health: '/health',
                        info: '/',
                        mcp: '/mcp'
                    }
                });
            });
            // MCP JSON-RPC endpoint for GitHub Copilot
            app.post('/mcp', async (req, res) => {
                try {
                    const request = req.body;
                    console.error('Received MCP request:', JSON.stringify(request, null, 2));
                    // Handle MCP requests
                    let response;
                    if (request.method === 'tools/list') {
                        // Handle list tools request directly
                        const tools = [
                            {
                                name: 'create_user_story',
                                description: 'Create a new user story in Azure DevOps',
                                inputSchema: {
                                    type: 'object',
                                    properties: {
                                        title: { type: 'string', description: 'User story title' },
                                        description: { type: 'string', description: 'Detailed description' },
                                        storyPoints: { type: 'number', description: 'Story points (1-21)', minimum: 1, maximum: 21 },
                                    },
                                    required: ['title'],
                                },
                            },
                            {
                                name: 'create_task',
                                description: 'Create a new task in Azure DevOps',
                                inputSchema: {
                                    type: 'object',
                                    properties: {
                                        title: { type: 'string', description: 'Task title' },
                                        description: { type: 'string', description: 'Detailed description' },
                                        remainingWork: { type: 'number', description: 'Remaining work in hours', minimum: 0 },
                                        parentId: { type: 'number', description: 'Parent user story ID (optional)' },
                                    },
                                    required: ['title'],
                                },
                            },
                            {
                                name: 'get_work_items',
                                description: 'Retrieve work items from Azure DevOps',
                                inputSchema: {
                                    type: 'object',
                                    properties: {
                                        type: { type: 'string', enum: ['User Story', 'Task', 'Bug', 'Feature'] },
                                        state: { type: 'string', description: 'Work item state' },
                                        assignedTo: { type: 'string', description: 'Assigned user' },
                                        maxResults: { type: 'number', minimum: 1, maximum: 200, default: 50 },
                                    },
                                },
                            },
                            {
                                name: 'update_work_item',
                                description: 'Update an existing work item',
                                inputSchema: {
                                    type: 'object',
                                    properties: {
                                        id: { type: 'number', description: 'Work item ID' },
                                        updates: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    op: { type: 'string', enum: ['add', 'replace', 'remove'] },
                                                    path: { type: 'string' },
                                                    value: {},
                                                },
                                                required: ['op', 'path'],
                                            },
                                        },
                                    },
                                    required: ['id', 'updates'],
                                },
                            },
                            {
                                name: 'get_work_item',
                                description: 'Get a specific work item by ID',
                                inputSchema: {
                                    type: 'object',
                                    properties: {
                                        id: { type: 'number', description: 'Work item ID' },
                                    },
                                    required: ['id'],
                                },
                            },
                            {
                                name: 'get_projects',
                                description: 'Get accessible projects in the organization',
                                inputSchema: {
                                    type: 'object',
                                    properties: {
                                        organizationUrl: { type: 'string', description: 'Organization URL (optional)' },
                                    },
                                },
                            },
                            {
                                name: 'switch_project',
                                description: 'Switch to a different project',
                                inputSchema: {
                                    type: 'object',
                                    properties: {
                                        projectId: { type: 'string', description: 'Project ID' },
                                        projectName: { type: 'string', description: 'Project name' },
                                    },
                                    required: ['projectId', 'projectName'],
                                },
                            },
                            {
                                name: 'get_sprints',
                                description: 'Get all sprints/iterations',
                                inputSchema: {
                                    type: 'object',
                                    properties: {
                                        projectId: { type: 'string', description: 'Project ID (optional)' },
                                        teamId: { type: 'string', description: 'Team ID (optional)' },
                                        state: { type: 'string', enum: ['current', 'future', 'closed'], description: 'Sprint state filter' },
                                    },
                                },
                            },
                            {
                                name: 'assign_work_items_to_sprint',
                                description: 'Assign work items to a sprint',
                                inputSchema: {
                                    type: 'object',
                                    properties: {
                                        workItemIds: { type: 'array', items: { type: 'number' }, description: 'Work item IDs to assign' },
                                        sprintId: { type: 'string', description: 'Sprint ID (preferred method)' },
                                        iterationPath: { type: 'string', description: 'Iteration path in format: ProjectName\\SprintName' },
                                    },
                                    required: ['workItemIds'],
                                },
                            }
                        ];
                        response = {
                            jsonrpc: '2.0',
                            id: request.id,
                            result: { tools }
                        };
                    }
                    else if (request.method === 'tools/call') {
                        // Handle tool call request directly
                        const { name, arguments: args } = request.params;
                        let toolResult;
                        switch (name) {
                            case 'create_user_story':
                                toolResult = await this.createUserStory(args);
                                break;
                            case 'create_task':
                                toolResult = await this.createTask(args);
                                break;
                            case 'get_work_items':
                                toolResult = await this.getWorkItems(args);
                                break;
                            case 'update_work_item':
                                toolResult = await this.updateWorkItem(args);
                                break;
                            case 'get_work_item':
                                toolResult = await this.getWorkItem(args);
                                break;
                            case 'get_projects':
                                toolResult = await this.getProjects(args);
                                break;
                            case 'switch_project':
                                toolResult = await this.switchProject(args);
                                break;
                            case 'get_sprints':
                                toolResult = await this.getSprints(args);
                                break;
                            case 'assign_work_items_to_sprint':
                                toolResult = await this.assignWorkItemsToSprint(args);
                                break;
                            default:
                                throw new Error(`Unknown tool: ${name}`);
                        }
                        response = {
                            jsonrpc: '2.0',
                            id: request.id,
                            result: toolResult
                        };
                    }
                    else {
                        // Unknown method
                        response = {
                            jsonrpc: '2.0',
                            id: request.id,
                            error: {
                                code: -32601,
                                message: `Method not found: ${request.method}`
                            }
                        };
                    }
                    console.error('Sending MCP response:', JSON.stringify(response, null, 2));
                    res.json(response);
                }
                catch (error) {
                    console.error('MCP request error:', error);
                    res.status(500).json({
                        jsonrpc: '2.0',
                        id: req.body?.id || null,
                        error: {
                            code: -32603,
                            message: 'Internal error',
                            data: error instanceof Error ? error.message : 'Unknown error'
                        }
                    });
                }
            });
            // Start the HTTP server
            const httpServer = app.listen(port, () => {
                console.error(`✅ Azure DevOps Core MCP server running on HTTP port ${port}`);
                console.error(`🔗 Health check: http://localhost:${port}/health`);
                console.error(`📋 Info: http://localhost:${port}/`);
                console.error(`🔌 MCP HTTP endpoint: http://localhost:${port}/mcp`);
            });
            // Handle server errors
            httpServer.on('error', (error) => {
                console.error('HTTP server error:', error);
                throw error;
            });
        }
        catch (error) {
            console.error('Failed to start HTTP server:', error);
            throw error;
        }
    }
}
exports.AzureDevOpsCoreServer = AzureDevOpsCoreServer;
// Run the server
const server = new AzureDevOpsCoreServer();
server.run().catch(console.error);
