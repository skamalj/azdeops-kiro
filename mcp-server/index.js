#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import * as http from "http";
import * as url from "url";
/* ------------------------------
   ZOD SCHEMAS (unchanged)
------------------------------*/
const CreateUserStorySchema = z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    storyPoints: z.number().int().min(1).max(21).optional(),
});
const CreateEpicSchema = z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    priority: z.enum(["Critical", "High", "Medium", "Low"]).default("Medium"),
});
const CreateIssueSchema = z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    priority: z.enum(["Critical", "High", "Medium", "Low"]).default("Medium"),
    parentId: z.number().int().positive().optional(),
});
const CreateTaskSchema = z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    remainingWork: z.number().min(0).optional(),
    parentId: z.number().int().positive().optional(),
});
const GetWorkItemsSchema = z.object({
    type: z.enum(["User Story", "Task", "Bug", "Feature", "Epic", "Issue"]).optional(),
    state: z.string().optional(),
    assignedTo: z.string().optional(),
    maxResults: z.number().int().positive().max(200).default(50),
});
const UpdateWorkItemSchema = z.object({
    id: z.number().int().positive(),
    updates: z.array(z.object({
        op: z.enum(["add", "replace", "remove"]),
        path: z.string(),
        value: z.any().optional(),
    })),
});
const GetWorkItemSchema = z.object({
    id: z.number().int().positive(),
});
const GetProjectsSchema = z.object({
    organizationUrl: z.string().url().optional(),
});
const SwitchProjectSchema = z.object({
    projectId: z.string(),
    projectName: z.string(),
});
const CreateTestCaseSchema = z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    steps: z.array(z.object({
        stepNumber: z.number().int().positive(),
        action: z.string(),
        expectedResult: z.string(),
    })),
    priority: z.enum(["Critical", "High", "Medium", "Low"]).default("Medium"),
    testPlanId: z.number().int().positive().optional(),
});
const CreateTestPlanSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    areaPath: z.string(),
    iterationPath: z.string(),
    projectId: z.string(),
});
const GetTestCasesSchema = z.object({
    projectId: z.string().optional(),
    testPlanId: z.number().int().positive().optional(),
    maxResults: z.number().int().positive().max(200).default(50),
});
const GetTestPlansSchema = z.object({
    projectId: z.string().optional(),
});
const ExecuteTestCaseSchema = z.object({
    testCaseId: z.number().int().positive(),
    outcome: z.enum(["Passed", "Failed", "Blocked", "Not Applicable"]),
    comment: z.string().optional(),
    executedBy: z.string(),
});
const BatchCreateUserStoriesSchema = z.object({
    stories: z.array(z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        storyPoints: z.number().int().min(1).max(21).optional(),
    })),
    batchSize: z.number().int().min(1).max(50).default(10),
});
const BatchCreateTasksSchema = z.object({
    tasks: z.array(z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        remainingWork: z.number().min(0).optional(),
        parentId: z.number().int().positive().optional(),
    })),
    batchSize: z.number().int().min(1).max(50).default(10),
});
const BatchCreateTestCasesSchema = z.object({
    testCases: z.array(z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        steps: z.array(z.object({
            stepNumber: z.number().int().positive(),
            action: z.string(),
            expectedResult: z.string(),
        })),
        priority: z.enum(["Critical", "High", "Medium", "Low"]).default("Medium"),
        testPlanId: z.number().int().positive().optional(),
    })),
    batchSize: z.number().int().min(1).max(50).default(10),
});
const BatchCreateTestPlansSchema = z.object({
    testPlans: z.array(z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        areaPath: z.string(),
        iterationPath: z.string(),
        projectId: z.string(),
    })),
    batchSize: z.number().int().min(1).max(20).default(5),
});
/* ------------------------------
   ADO CLIENT (your original code)
------------------------------*/
class AzureDevOpsApiClient {
    organizationUrl = "";
    projectName = "";
    pat = "";
    initialize(org, proj, pat) {
        this.organizationUrl = org;
        this.projectName = proj;
        this.pat = pat;
    }
    getAuthHeader() {
        return `Basic ${Buffer.from(`:${this.pat}`).toString("base64")}`;
    }
    getBaseUrl() {
        return `${this.organizationUrl}/${this.projectName}`;
    }
    async createWorkItem(type, fields, parentId) {
        const patchDocument = [
            { op: "add", path: "/fields/System.Title", value: fields.title },
            {
                op: "add",
                path: "/fields/System.Description",
                value: fields.description || "",
            },
        ];
        if (fields.storyPoints) {
            patchDocument.push({
                op: "add",
                path: "/fields/Microsoft.VSTS.Scheduling.StoryPoints",
                value: fields.storyPoints,
            });
        }
        if (fields.remainingWork) {
            patchDocument.push({
                op: "add",
                path: "/fields/Microsoft.VSTS.Scheduling.RemainingWork",
                value: fields.remainingWork,
            });
        }
        const res = await fetch(`${this.getBaseUrl()}/_apis/wit/workitems/$${type}?api-version=7.0`, {
            method: "POST",
            headers: {
                Authorization: this.getAuthHeader(),
                "Content-Type": "application/json-patch+json",
            },
            body: JSON.stringify(patchDocument),
        });
        if (!res.ok)
            throw new Error("Failed to create work item");
        const data = await res.json();
        if (parentId) {
            await this.linkWorkItems(data.id, parentId, "System.LinkTypes.Hierarchy-Reverse");
        }
        return this.mapAzureWorkItemToWorkItem(data);
    }
    async getWorkItems(query = {}) {
        let wiql = `SELECT [System.Id], [System.Title], [System.WorkItemType], [System.State], [System.AssignedTo] FROM WorkItems WHERE [System.TeamProject] = '${this.projectName}'`;
        if (query.type)
            wiql += ` AND [System.WorkItemType] = '${query.type}'`;
        if (query.state)
            wiql += ` AND [System.State] = '${query.state}'`;
        if (query.assignedTo)
            wiql += ` AND [System.AssignedTo] = '${query.assignedTo}'`;
        const qRes = await fetch(`${this.getBaseUrl()}/_apis/wit/wiql?api-version=7.0`, {
            method: "POST",
            headers: {
                Authorization: this.getAuthHeader(),
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ query: wiql }),
        });
        const qData = await qRes.json();
        const ids = (qData.workItems ?? []).map((w) => w.id);
        if (!ids.length)
            return [];
        const detailRes = await fetch(`${this.getBaseUrl()}/_apis/wit/workitems?ids=${ids
            .slice(0, query.maxResults)
            .join(",")}&api-version=7.0`, { headers: { Authorization: this.getAuthHeader() } });
        const final = await detailRes.json();
        return final.value.map((item) => this.mapAzureWorkItemToWorkItem(item));
    }
    async getWorkItem(id) {
        const r = await fetch(`${this.getBaseUrl()}/_apis/wit/workitems/${id}?api-version=7.0`, {
            headers: { Authorization: this.getAuthHeader() },
        });
        if (!r.ok)
            throw new Error("Failed to get work item");
        return this.mapAzureWorkItemToWorkItem(await r.json());
    }
    async getProjects() {
        const r = await fetch(`${this.organizationUrl}/_apis/projects?api-version=7.0`, {
            headers: { Authorization: this.getAuthHeader() },
        });
        if (!r.ok)
            throw new Error("Failed to get projects");
        const data = await r.json();
        return data.value.map((proj) => this.mapAzureProjectToProject(proj));
    }
    async createTestCase(fields, testPlanId) {
        const patchDocument = this.buildTestCasePatchDocument(fields, testPlanId);
        const r = await fetch(`${this.getBaseUrl()}/_apis/wit/workitems/$Test%20Case?api-version=7.0`, {
            method: "POST",
            headers: {
                Authorization: this.getAuthHeader(),
                "Content-Type": "application/json-patch+json",
            },
            body: JSON.stringify(patchDocument),
        });
        if (!r.ok)
            throw new Error("Failed to create test case");
        return this.mapAzureWorkItemToWorkItem(await r.json());
    }
    async createTestPlan(fields) {
        const testPlanData = {
            name: fields.name,
            description: fields.description,
            areaPath: fields.areaPath,
            iteration: fields.iterationPath,
            state: "Active",
        };
        const r = await fetch(`${this.getBaseUrl()}/_apis/testplan/Plans?api-version=7.0`, {
            method: "POST",
            headers: {
                Authorization: this.getAuthHeader(),
                "Content-Type": "application/json",
            },
            body: JSON.stringify(testPlanData),
        });
        if (!r.ok)
            throw new Error("Failed to create test plan");
        return await r.json();
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
        const qRes = await fetch(`${this.getBaseUrl()}/_apis/wit/wiql?api-version=7.0`, {
            method: "POST",
            headers: {
                Authorization: this.getAuthHeader(),
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ query: wiql }),
        });
        const qData = await qRes.json();
        const ids = (qData.workItems ?? []).map((w) => w.id);
        if (!ids.length)
            return [];
        const detailRes = await fetch(`${this.getBaseUrl()}/_apis/wit/workitems?ids=${ids
            .slice(0, maxResults)
            .join(",")}&$expand=all&api-version=7.0`, { headers: { Authorization: this.getAuthHeader() } });
        const final = await detailRes.json();
        return final.value.map((item) => this.mapAzureWorkItemToWorkItem(item));
    }
    async getTestPlans(projectId) {
        const r = await fetch(`${this.getBaseUrl()}/_apis/testplan/Plans?api-version=7.0`, {
            headers: { Authorization: this.getAuthHeader() },
        });
        if (!r.ok)
            throw new Error("Failed to get test plans");
        const data = await r.json();
        return data.value;
    }
    async executeTestCase(testCaseId, result) {
        const patchDocument = [
            {
                op: "replace",
                path: "/fields/Microsoft.VSTS.TCM.LastResult",
                value: result.outcome,
            },
            {
                op: "replace",
                path: "/fields/Microsoft.VSTS.TCM.LastResultDetails",
                value: result.comment || "",
            },
            {
                op: "replace",
                path: "/fields/Microsoft.VSTS.TCM.LastRunBy",
                value: result.executedBy,
            },
        ];
        const r = await fetch(`${this.getBaseUrl()}/_apis/wit/workitems/${testCaseId}?api-version=7.0`, {
            method: "PATCH",
            headers: {
                Authorization: this.getAuthHeader(),
                "Content-Type": "application/json-patch+json",
            },
            body: JSON.stringify(patchDocument),
        });
        if (!r.ok)
            throw new Error("Failed to execute test case");
        return this.mapAzureWorkItemToWorkItem(await r.json());
    }
    async updateWorkItem(id, updates) {
        const r = await fetch(`${this.getBaseUrl()}/_apis/wit/workitems/${id}?api-version=7.0`, {
            method: "PATCH",
            headers: {
                Authorization: this.getAuthHeader(),
                "Content-Type": "application/json-patch+json",
            },
            body: JSON.stringify(updates),
        });
        return this.mapAzureWorkItemToWorkItem(await r.json());
    }
    async linkWorkItems(sourceId, targetId, linkType) {
        await fetch(`${this.getBaseUrl()}/_apis/wit/workitems/${sourceId}?api-version=7.0`, {
            method: "PATCH",
            headers: {
                Authorization: this.getAuthHeader(),
                "Content-Type": "application/json-patch+json",
            },
            body: JSON.stringify([
                {
                    op: "add",
                    path: "/relations/-",
                    value: {
                        rel: linkType,
                        url: `${this.getBaseUrl()}/_apis/wit/workItems/${targetId}`,
                    },
                },
            ]),
        });
    }
    mapAzureWorkItemToWorkItem(azure) {
        const f = azure.fields ?? {};
        return {
            id: azure.id,
            type: f["System.WorkItemType"],
            title: f["System.Title"],
            description: f["System.Description"],
            state: f["System.State"],
            assignedTo: f["System.AssignedTo"]?.displayName,
            storyPoints: f["Microsoft.VSTS.Scheduling.StoryPoints"],
            remainingWork: f["Microsoft.VSTS.Scheduling.RemainingWork"],
            tags: f["System.Tags"]?.split(";") ?? [],
            createdDate: new Date(f["System.CreatedDate"]),
            changedDate: new Date(f["System.ChangedDate"]),
            projectId: f["System.TeamProject"],
            fields: f,
        };
    }
    mapAzureProjectToProject(azure) {
        return {
            id: azure.id,
            name: azure.name,
            description: azure.description || "",
            url: azure.url,
            state: azure.state || "wellFormed",
            visibility: azure.visibility || "private",
        };
    }
    buildTestCasePatchDocument(fields, testPlanId) {
        const patchDocument = [
            { op: "add", path: "/fields/System.Title", value: fields.title },
            { op: "add", path: "/fields/System.Description", value: fields.description || "" },
            { op: "add", path: "/fields/Microsoft.VSTS.Common.Priority", value: this.mapPriorityToNumber(fields.priority) },
            { op: "add", path: "/fields/Microsoft.VSTS.TCM.AutomationStatus", value: "Not Automated" },
        ];
        if (fields.steps && fields.steps.length > 0) {
            const stepsXml = this.buildTestStepsXml(fields.steps);
            patchDocument.push({
                op: "add",
                path: "/fields/Microsoft.VSTS.TCM.Steps",
                value: stepsXml,
            });
        }
        if (testPlanId) {
            patchDocument.push({
                op: "add",
                path: "/fields/Microsoft.VSTS.TCM.TestPlanId",
                value: testPlanId,
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
        xml += "</steps>";
        return xml;
    }
    escapeXml(text) {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }
    mapPriorityToNumber(priority) {
        switch (priority) {
            case "Critical": return 1;
            case "High": return 2;
            case "Medium": return 3;
            case "Low": return 4;
            default: return 3;
        }
    }
    async batchCreateUserStories(stories, batchSize) {
        const results = [];
        const errors = [];
        for (let i = 0; i < stories.length; i += batchSize) {
            const batch = stories.slice(i, i + batchSize);
            console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(stories.length / batchSize)} (${batch.length} stories)`);
            const batchPromises = batch.map(async (story, index) => {
                try {
                    const result = await this.createWorkItem("User Story", story);
                    return { index: i + index, success: true, result, story: story.title };
                }
                catch (error) {
                    return { index: i + index, success: false, error: error instanceof Error ? error.message : 'Unknown error', story: story.title };
                }
            });
            const batchResults = await Promise.allSettled(batchPromises);
            batchResults.forEach((result) => {
                if (result.status === 'fulfilled') {
                    if (result.value.success) {
                        results.push(result.value);
                    }
                    else {
                        errors.push(result.value);
                    }
                }
                else {
                    errors.push({ index: -1, success: false, error: result.reason, story: 'Unknown' });
                }
            });
            // Add delay between batches to respect API rate limits
            if (i + batchSize < stories.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        return { results, errors, total: stories.length, successful: results.length, failed: errors.length };
    }
    async batchCreateTasks(tasks, batchSize) {
        const results = [];
        const errors = [];
        for (let i = 0; i < tasks.length; i += batchSize) {
            const batch = tasks.slice(i, i + batchSize);
            console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(tasks.length / batchSize)} (${batch.length} tasks)`);
            const batchPromises = batch.map(async (task, index) => {
                try {
                    const result = await this.createWorkItem("Task", task, task.parentId);
                    return { index: i + index, success: true, result, task: task.title };
                }
                catch (error) {
                    return { index: i + index, success: false, error: error instanceof Error ? error.message : 'Unknown error', task: task.title };
                }
            });
            const batchResults = await Promise.allSettled(batchPromises);
            batchResults.forEach((result) => {
                if (result.status === 'fulfilled') {
                    if (result.value.success) {
                        results.push(result.value);
                    }
                    else {
                        errors.push(result.value);
                    }
                }
                else {
                    errors.push({ index: -1, success: false, error: result.reason, task: 'Unknown' });
                }
            });
            // Add delay between batches to respect API rate limits
            if (i + batchSize < tasks.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        return { results, errors, total: tasks.length, successful: results.length, failed: errors.length };
    }
    async batchCreateTestCases(testCases, batchSize) {
        const results = [];
        const errors = [];
        for (let i = 0; i < testCases.length; i += batchSize) {
            const batch = testCases.slice(i, i + batchSize);
            console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(testCases.length / batchSize)} (${batch.length} test cases)`);
            const batchPromises = batch.map(async (testCase, index) => {
                try {
                    const result = await this.createTestCase(testCase, testCase.testPlanId);
                    return { index: i + index, success: true, result, testCase: testCase.title };
                }
                catch (error) {
                    return { index: i + index, success: false, error: error instanceof Error ? error.message : 'Unknown error', testCase: testCase.title };
                }
            });
            const batchResults = await Promise.allSettled(batchPromises);
            batchResults.forEach((result) => {
                if (result.status === 'fulfilled') {
                    if (result.value.success) {
                        results.push(result.value);
                    }
                    else {
                        errors.push(result.value);
                    }
                }
                else {
                    errors.push({ index: -1, success: false, error: result.reason, testCase: 'Unknown' });
                }
            });
            // Add delay between batches to respect API rate limits
            if (i + batchSize < testCases.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        return { results, errors, total: testCases.length, successful: results.length, failed: errors.length };
    }
    async batchCreateTestPlans(testPlans, batchSize) {
        const results = [];
        const errors = [];
        for (let i = 0; i < testPlans.length; i += batchSize) {
            const batch = testPlans.slice(i, i + batchSize);
            console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(testPlans.length / batchSize)} (${batch.length} test plans)`);
            const batchPromises = batch.map(async (testPlan, index) => {
                try {
                    const result = await this.createTestPlan(testPlan);
                    return { index: i + index, success: true, result, testPlan: testPlan.name };
                }
                catch (error) {
                    return { index: i + index, success: false, error: error instanceof Error ? error.message : 'Unknown error', testPlan: testPlan.name };
                }
            });
            const batchResults = await Promise.allSettled(batchPromises);
            batchResults.forEach((result) => {
                if (result.status === 'fulfilled') {
                    if (result.value.success) {
                        results.push(result.value);
                    }
                    else {
                        errors.push(result.value);
                    }
                }
                else {
                    errors.push({ index: -1, success: false, error: result.reason, testPlan: 'Unknown' });
                }
            });
            // Add delay between batches to respect API rate limits
            if (i + batchSize < testPlans.length) {
                await new Promise(resolve => setTimeout(resolve, 2000)); // Longer delay for test plans
            }
        }
        return { results, errors, total: testPlans.length, successful: results.length, failed: errors.length };
    }
}
/* ------------------------------
   MAIN MCP SERVER
------------------------------*/
export class AzureDevOpsCoreServer {
    server;
    apiClient;
    currentProject = null;
    constructor() {
        this.server = new Server({ name: "azure-devops-core", version: "1.0.0" }, {
            capabilities: {
                tools: {
                    create_user_story: {},
                    create_epic: {},
                    create_issue: {},
                    create_task: {},
                    get_work_items: {},
                    update_work_item: {},
                    get_work_item: {},
                    get_projects: {},
                    switch_project: {},
                    create_test_case: {},
                    create_test_plan: {},
                    get_test_cases: {},
                    get_test_plans: {},
                    execute_test_case: {},
                    batch_create_user_stories: {},
                    batch_create_tasks: {},
                    batch_create_test_cases: {},
                    batch_create_test_plans: {},
                },
            },
        });
        this.apiClient = new AzureDevOpsApiClient();
        this.initializeFromEnvironment();
        this.setupToolHandlers();
    }
    initializeFromEnvironment() {
        const org = process.env.AZURE_DEVOPS_ORG_URL;
        const proj = process.env.AZURE_DEVOPS_PROJECT;
        const pat = process.env.AZURE_DEVOPS_PAT;
        if (org && proj && pat) {
            this.apiClient.initialize(org, proj, pat);
            this.currentProject = proj; // Track the current project
        }
    }
    ensureInitialized() {
        if (!process.env.AZURE_DEVOPS_ORG_URL ||
            !process.env.AZURE_DEVOPS_PAT) {
            throw new Error("Azure DevOps env vars missing");
        }
        // Check if we have a current project (either from env or from project switch)
        if (!this.currentProject && !process.env.AZURE_DEVOPS_PROJECT) {
            throw new Error("No project selected. Use switch_project or set AZURE_DEVOPS_PROJECT");
        }
    }
    setupToolHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
                {
                    name: "create_user_story",
                    description: "Create a new user story",
                    inputSchema: {
                        type: "object",
                        properties: {
                            title: { type: "string", description: "User story title" },
                            description: { type: "string", description: "Detailed description" },
                            storyPoints: { type: "number", description: "Story points (1-21)", minimum: 1, maximum: 21 },
                        },
                        required: ["title"],
                    },
                },
                {
                    name: "create_task",
                    description: "Create a task",
                    inputSchema: {
                        type: "object",
                        properties: {
                            title: { type: "string", description: "Task title" },
                            description: { type: "string", description: "Detailed description" },
                            remainingWork: { type: "number", description: "Remaining work in hours", minimum: 0 },
                            parentId: { type: "number", description: "Parent issue ID (optional)" },
                        },
                        required: ["title"],
                    },
                },
                {
                    name: "get_work_items",
                    description: "Query work items",
                    inputSchema: {
                        type: "object",
                        properties: {
                            type: { type: "string", enum: ["User Story", "Task", "Bug", "Feature"] },
                            state: { type: "string", description: "Work item state" },
                            assignedTo: { type: "string", description: "Assigned user" },
                            maxResults: { type: "number", minimum: 1, maximum: 200, default: 50 },
                        },
                    },
                },
                {
                    name: "update_work_item",
                    description: "Update a work item",
                    inputSchema: {
                        type: "object",
                        properties: {
                            id: { type: "number", description: "Work item ID" },
                            updates: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        op: { type: "string", enum: ["add", "replace", "remove"] },
                                        path: { type: "string" },
                                        value: {},
                                    },
                                    required: ["op", "path"],
                                },
                            },
                        },
                        required: ["id", "updates"],
                    },
                },
                {
                    name: "get_work_item",
                    description: "Retrieve a work item",
                    inputSchema: {
                        type: "object",
                        properties: {
                            id: { type: "number", description: "Work item ID" },
                        },
                        required: ["id"],
                    },
                },
                {
                    name: "get_projects",
                    description: "Get accessible projects",
                    inputSchema: {
                        type: "object",
                        properties: {
                            organizationUrl: { type: "string", description: "Organization URL (optional)" },
                        },
                    },
                },
                {
                    name: "switch_project",
                    description: "Switch to a different project",
                    inputSchema: {
                        type: "object",
                        properties: {
                            projectId: { type: "string", description: "Project ID" },
                            projectName: { type: "string", description: "Project name" },
                        },
                        required: ["projectId", "projectName"],
                    },
                },
                {
                    name: "create_test_case",
                    description: "Create a new test case",
                    inputSchema: {
                        type: "object",
                        properties: {
                            title: { type: "string", description: "Test case title" },
                            description: { type: "string", description: "Test case description" },
                            steps: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        stepNumber: { type: "number" },
                                        action: { type: "string" },
                                        expectedResult: { type: "string" },
                                    },
                                    required: ["stepNumber", "action", "expectedResult"],
                                },
                            },
                            priority: { type: "string", enum: ["Critical", "High", "Medium", "Low"], default: "Medium" },
                            testPlanId: { type: "number", description: "Test plan ID (optional)" },
                        },
                        required: ["title", "steps"],
                    },
                },
                {
                    name: "create_test_plan",
                    description: "Create a new test plan",
                    inputSchema: {
                        type: "object",
                        properties: {
                            name: { type: "string", description: "Test plan name" },
                            description: { type: "string", description: "Test plan description" },
                            areaPath: { type: "string", description: "Area path" },
                            iterationPath: { type: "string", description: "Iteration path" },
                            projectId: { type: "string", description: "Project ID" },
                        },
                        required: ["name", "areaPath", "iterationPath", "projectId"],
                    },
                },
                {
                    name: "get_test_cases",
                    description: "Get test cases",
                    inputSchema: {
                        type: "object",
                        properties: {
                            projectId: { type: "string", description: "Project ID (optional)" },
                            testPlanId: { type: "number", description: "Test plan ID (optional)" },
                            maxResults: { type: "number", minimum: 1, maximum: 200, default: 50 },
                        },
                    },
                },
                {
                    name: "get_test_plans",
                    description: "Get test plans",
                    inputSchema: {
                        type: "object",
                        properties: {
                            projectId: { type: "string", description: "Project ID (optional)" },
                        },
                    },
                },
                {
                    name: "execute_test_case",
                    description: "Execute a test case and record results",
                    inputSchema: {
                        type: "object",
                        properties: {
                            testCaseId: { type: "number", description: "Test case ID" },
                            outcome: { type: "string", enum: ["Passed", "Failed", "Blocked", "Not Applicable"] },
                            comment: { type: "string", description: "Execution comment (optional)" },
                            executedBy: { type: "string", description: "Person who executed the test" },
                        },
                        required: ["testCaseId", "outcome", "executedBy"],
                    },
                },
                {
                    name: "batch_create_user_stories",
                    description: "Create multiple user stories in batches",
                    inputSchema: {
                        type: "object",
                        properties: {
                            stories: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        title: { type: "string", description: "User story title" },
                                        description: { type: "string", description: "Detailed description" },
                                        storyPoints: { type: "number", description: "Story points (1-21)", minimum: 1, maximum: 21 },
                                    },
                                    required: ["title"],
                                },
                            },
                            batchSize: { type: "number", description: "Batch size (1-50)", minimum: 1, maximum: 50, default: 10 },
                        },
                        required: ["stories"],
                    },
                },
                {
                    name: "batch_create_tasks",
                    description: "Create multiple tasks in batches",
                    inputSchema: {
                        type: "object",
                        properties: {
                            tasks: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        title: { type: "string", description: "Task title" },
                                        description: { type: "string", description: "Detailed description" },
                                        remainingWork: { type: "number", description: "Remaining work in hours", minimum: 0 },
                                        parentId: { type: "number", description: "Parent user story ID (optional)" },
                                    },
                                    required: ["title"],
                                },
                            },
                            batchSize: { type: "number", description: "Batch size (1-50)", minimum: 1, maximum: 50, default: 10 },
                        },
                        required: ["tasks"],
                    },
                },
                {
                    name: "batch_create_test_cases",
                    description: "Create multiple test cases in batches",
                    inputSchema: {
                        type: "object",
                        properties: {
                            testCases: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        title: { type: "string", description: "Test case title" },
                                        description: { type: "string", description: "Test case description" },
                                        steps: {
                                            type: "array",
                                            items: {
                                                type: "object",
                                                properties: {
                                                    stepNumber: { type: "number" },
                                                    action: { type: "string" },
                                                    expectedResult: { type: "string" },
                                                },
                                                required: ["stepNumber", "action", "expectedResult"],
                                            },
                                        },
                                        priority: { type: "string", enum: ["Critical", "High", "Medium", "Low"], default: "Medium" },
                                        testPlanId: { type: "number", description: "Test plan ID (optional)" },
                                    },
                                    required: ["title", "steps"],
                                },
                            },
                            batchSize: { type: "number", description: "Batch size (1-50)", minimum: 1, maximum: 50, default: 10 },
                        },
                        required: ["testCases"],
                    },
                },
                {
                    name: "batch_create_test_plans",
                    description: "Create multiple test plans in batches",
                    inputSchema: {
                        type: "object",
                        properties: {
                            testPlans: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        name: { type: "string", description: "Test plan name" },
                                        description: { type: "string", description: "Test plan description" },
                                        areaPath: { type: "string", description: "Area path" },
                                        iterationPath: { type: "string", description: "Iteration path" },
                                        projectId: { type: "string", description: "Project ID" },
                                    },
                                    required: ["name", "areaPath", "iterationPath", "projectId"],
                                },
                            },
                            batchSize: { type: "number", description: "Batch size (1-20)", minimum: 1, maximum: 20, default: 5 },
                        },
                        required: ["testPlans"],
                    },
                },
            ],
        }));
        this.server.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
            const { name, arguments: args } = params;
            switch (name) {
                case "create_user_story":
                    return this.createUserStory(args);
                case "create_epic":
                    return this.createEpic(args);
                case "create_issue":
                    return this.createIssue(args);
                case "create_task":
                    return this.createTask(args);
                case "get_work_items":
                    return this.getWorkItems(args);
                case "update_work_item":
                    return this.updateWorkItem(args);
                case "get_work_item":
                    return this.getWorkItem(args);
                case "get_projects":
                    return this.getProjects(args);
                case "switch_project":
                    return this.switchProject(args);
                case "create_test_case":
                    return this.createTestCase(args);
                case "create_test_plan":
                    return this.createTestPlan(args);
                case "get_test_cases":
                    return this.getTestCases(args);
                case "get_test_plans":
                    return this.getTestPlans(args);
                case "execute_test_case":
                    return this.executeTestCase(args);
                case "batch_create_user_stories":
                    return this.batchCreateUserStories(args);
                case "batch_create_tasks":
                    return this.batchCreateTasks(args);
                case "batch_create_test_cases":
                    return this.batchCreateTestCases(args);
                case "batch_create_test_plans":
                    return this.batchCreateTestPlans(args);
            }
            throw new Error("Unknown tool: " + name);
        });
    }
    async createUserStory(args) {
        this.ensureInitialized();
        const parsed = CreateUserStorySchema.parse(args);
        const item = await this.apiClient.createWorkItem("User Story", parsed);
        return { content: [{ type: "text", text: `Created US #${item.id}` }] };
    }
    async createEpic(args) {
        this.ensureInitialized();
        const parsed = CreateEpicSchema.parse(args);
        const item = await this.apiClient.createWorkItem("Epic", parsed);
        return { content: [{ type: "text", text: `Created Epic #${item.id}: ${item.title}` }] };
    }
    async createIssue(args) {
        this.ensureInitialized();
        const parsed = CreateIssueSchema.parse(args);
        const item = await this.apiClient.createWorkItem("Issue", parsed, parsed.parentId);
        return { content: [{ type: "text", text: `Created Issue #${item.id}: ${item.title}` }] };
    }
    async createTask(args) {
        this.ensureInitialized();
        const parsed = CreateTaskSchema.parse(args);
        const item = await this.apiClient.createWorkItem("Task", parsed, parsed.parentId);
        return { content: [{ type: "text", text: `Created Task #${item.id}` }] };
    }
    async getWorkItems(args) {
        this.ensureInitialized();
        const query = GetWorkItemsSchema.parse(args);
        const items = await this.apiClient.getWorkItems(query);
        return {
            content: [
                {
                    type: "text",
                    text: items.map((x) => `#${x.id}: ${x.title} (${x.state})`).join("\n"),
                },
            ],
        };
    }
    async updateWorkItem(args) {
        this.ensureInitialized();
        const parsed = UpdateWorkItemSchema.parse(args);
        const item = await this.apiClient.updateWorkItem(parsed.id, parsed.updates);
        return { content: [{ type: "text", text: `Updated #${item.id}` }] };
    }
    async getWorkItem(args) {
        this.ensureInitialized();
        const parsed = GetWorkItemSchema.parse(args);
        const item = await this.apiClient.getWorkItem(parsed.id);
        return {
            content: [
                {
                    type: "text",
                    text: `#${item.id}: ${item.title}\nState: ${item.state}`,
                },
            ],
        };
    }
    async getProjects(args) {
        this.ensureInitialized();
        const projects = await this.apiClient.getProjects();
        return {
            content: [
                {
                    type: "text",
                    text: projects.map((p) => `${p.name} (${p.id}) - ${p.state}`).join("\n"),
                },
            ],
        };
    }
    async switchProject(args) {
        // Don't call ensureInitialized here since we're switching projects
        if (!process.env.AZURE_DEVOPS_ORG_URL || !process.env.AZURE_DEVOPS_PAT) {
            throw new Error("Azure DevOps organization URL and PAT are required");
        }
        const parsed = SwitchProjectSchema.parse(args);
        // Update the API client with new project
        this.apiClient.initialize(process.env.AZURE_DEVOPS_ORG_URL, parsed.projectName, process.env.AZURE_DEVOPS_PAT);
        // Update our current project tracking
        this.currentProject = parsed.projectName;
        return {
            content: [
                {
                    type: "text",
                    text: `Switched to project: ${parsed.projectName} (${parsed.projectId})`,
                },
            ],
        };
    }
    async createTestCase(args) {
        this.ensureInitialized();
        const parsed = CreateTestCaseSchema.parse(args);
        const item = await this.apiClient.createTestCase(parsed, parsed.testPlanId);
        return {
            content: [
                {
                    type: "text",
                    text: `Created Test Case #${item.id}: ${item.title}\nSteps: ${parsed.steps.length}\nPriority: ${parsed.priority}`,
                },
            ],
        };
    }
    async createTestPlan(args) {
        this.ensureInitialized();
        const parsed = CreateTestPlanSchema.parse(args);
        const plan = await this.apiClient.createTestPlan(parsed);
        return {
            content: [
                {
                    type: "text",
                    text: `Created Test Plan #${plan.id}: ${plan.name}\nProject: ${parsed.projectId}`,
                },
            ],
        };
    }
    async getTestCases(args) {
        this.ensureInitialized();
        const parsed = GetTestCasesSchema.parse(args);
        const testCases = await this.apiClient.getTestCases(parsed.projectId, parsed.testPlanId, parsed.maxResults);
        return {
            content: [
                {
                    type: "text",
                    text: testCases.length > 0
                        ? testCases.map((tc) => `#${tc.id}: ${tc.title} (${tc.state})`).join("\n")
                        : "No test cases found",
                },
            ],
        };
    }
    async getTestPlans(args) {
        this.ensureInitialized();
        const parsed = GetTestPlansSchema.parse(args);
        const testPlans = await this.apiClient.getTestPlans(parsed.projectId);
        return {
            content: [
                {
                    type: "text",
                    text: testPlans.length > 0
                        ? testPlans.map((tp) => `#${tp.id}: ${tp.name} (${tp.state})`).join("\n")
                        : "No test plans found",
                },
            ],
        };
    }
    async executeTestCase(args) {
        this.ensureInitialized();
        const parsed = ExecuteTestCaseSchema.parse(args);
        const result = await this.apiClient.executeTestCase(parsed.testCaseId, {
            outcome: parsed.outcome,
            comment: parsed.comment,
            executedBy: parsed.executedBy,
        });
        return {
            content: [
                {
                    type: "text",
                    text: `Test Case #${parsed.testCaseId} executed: ${parsed.outcome}\nExecuted by: ${parsed.executedBy}`,
                },
            ],
        };
    }
    async batchCreateUserStories(args) {
        this.ensureInitialized();
        const parsed = BatchCreateUserStoriesSchema.parse(args);
        const startTime = Date.now();
        const result = await this.apiClient.batchCreateUserStories(parsed.stories, parsed.batchSize);
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        let responseText = `📊 Batch User Story Creation Results:\n\n`;
        responseText += `✅ Total Stories: ${result.total}\n`;
        responseText += `✅ Successful: ${result.successful}\n`;
        responseText += `❌ Failed: ${result.failed}\n`;
        responseText += `⏱️ Duration: ${duration}s\n`;
        responseText += `📦 Batch Size: ${parsed.batchSize}\n\n`;
        if (result.successful > 0) {
            responseText += `🎉 Successfully Created Stories:\n`;
            result.results.slice(0, 10).forEach((item) => {
                responseText += `- #${item.result.id}: ${item.story}\n`;
            });
            if (result.results.length > 10) {
                responseText += `... and ${result.results.length - 10} more\n`;
            }
        }
        if (result.failed > 0) {
            responseText += `\n⚠️ Failed Stories:\n`;
            result.errors.slice(0, 5).forEach((item) => {
                responseText += `- ${item.story}: ${item.error}\n`;
            });
            if (result.errors.length > 5) {
                responseText += `... and ${result.errors.length - 5} more errors\n`;
            }
        }
        return {
            content: [
                {
                    type: "text",
                    text: responseText,
                },
            ],
        };
    }
    async batchCreateTasks(args) {
        this.ensureInitialized();
        const parsed = BatchCreateTasksSchema.parse(args);
        const startTime = Date.now();
        const result = await this.apiClient.batchCreateTasks(parsed.tasks, parsed.batchSize);
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        let responseText = `📊 Batch Task Creation Results:\n\n`;
        responseText += `✅ Total Tasks: ${result.total}\n`;
        responseText += `✅ Successful: ${result.successful}\n`;
        responseText += `❌ Failed: ${result.failed}\n`;
        responseText += `⏱️ Duration: ${duration}s\n`;
        responseText += `📦 Batch Size: ${parsed.batchSize}\n\n`;
        if (result.successful > 0) {
            responseText += `🎉 Successfully Created Tasks:\n`;
            result.results.slice(0, 10).forEach((item) => {
                responseText += `- #${item.result.id}: ${item.task}\n`;
            });
            if (result.results.length > 10) {
                responseText += `... and ${result.results.length - 10} more\n`;
            }
        }
        if (result.failed > 0) {
            responseText += `\n⚠️ Failed Tasks:\n`;
            result.errors.slice(0, 5).forEach((item) => {
                responseText += `- ${item.task}: ${item.error}\n`;
            });
            if (result.errors.length > 5) {
                responseText += `... and ${result.errors.length - 5} more errors\n`;
            }
        }
        return {
            content: [
                {
                    type: "text",
                    text: responseText,
                },
            ],
        };
    }
    async batchCreateTestCases(args) {
        this.ensureInitialized();
        const parsed = BatchCreateTestCasesSchema.parse(args);
        const startTime = Date.now();
        const result = await this.apiClient.batchCreateTestCases(parsed.testCases, parsed.batchSize);
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        let responseText = `📊 Batch Test Case Creation Results:\n\n`;
        responseText += `✅ Total Test Cases: ${result.total}\n`;
        responseText += `✅ Successful: ${result.successful}\n`;
        responseText += `❌ Failed: ${result.failed}\n`;
        responseText += `⏱️ Duration: ${duration}s\n`;
        responseText += `📦 Batch Size: ${parsed.batchSize}\n\n`;
        if (result.successful > 0) {
            responseText += `🎉 Successfully Created Test Cases:\n`;
            result.results.slice(0, 10).forEach((item) => {
                responseText += `- #${item.result.id}: ${item.testCase}\n`;
            });
            if (result.results.length > 10) {
                responseText += `... and ${result.results.length - 10} more\n`;
            }
        }
        if (result.failed > 0) {
            responseText += `\n⚠️ Failed Test Cases:\n`;
            result.errors.slice(0, 5).forEach((item) => {
                responseText += `- ${item.testCase}: ${item.error}\n`;
            });
            if (result.errors.length > 5) {
                responseText += `... and ${result.errors.length - 5} more errors\n`;
            }
        }
        return {
            content: [
                {
                    type: "text",
                    text: responseText,
                },
            ],
        };
    }
    async batchCreateTestPlans(args) {
        this.ensureInitialized();
        const parsed = BatchCreateTestPlansSchema.parse(args);
        const startTime = Date.now();
        const result = await this.apiClient.batchCreateTestPlans(parsed.testPlans, parsed.batchSize);
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        let responseText = `📊 Batch Test Plan Creation Results:\n\n`;
        responseText += `✅ Total Test Plans: ${result.total}\n`;
        responseText += `✅ Successful: ${result.successful}\n`;
        responseText += `❌ Failed: ${result.failed}\n`;
        responseText += `⏱️ Duration: ${duration}s\n`;
        responseText += `📦 Batch Size: ${parsed.batchSize}\n\n`;
        if (result.successful > 0) {
            responseText += `🎉 Successfully Created Test Plans:\n`;
            result.results.slice(0, 10).forEach((item) => {
                responseText += `- #${item.result.id}: ${item.testPlan}\n`;
            });
            if (result.results.length > 10) {
                responseText += `... and ${result.results.length - 10} more\n`;
            }
        }
        if (result.failed > 0) {
            responseText += `\n⚠️ Failed Test Plans:\n`;
            result.errors.slice(0, 5).forEach((item) => {
                responseText += `- ${item.testPlan}: ${item.error}\n`;
            });
            if (result.errors.length > 5) {
                responseText += `... and ${result.errors.length - 5} more errors\n`;
            }
        }
        return {
            content: [
                {
                    type: "text",
                    text: responseText,
                },
            ],
        };
    }
    /* ------------------------------
       RUN: SSE + STDIO
    ------------------------------*/
    async run() {
        const args = process.argv.slice(2);
        if (args.includes("--stdio")) {
            const transport = new StdioServerTransport();
            await this.server.connect(transport);
            console.error("MCP running on STDIO");
            return;
        }
        await this.runHttpServer(3001);
    }
    async runHttpServer(port) {
        const httpServer = http.createServer(async (req, res) => {
            const parsed = url.parse(req.url, true);
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
            res.setHeader("Access-Control-Allow-Headers", "Content-Type");
            if (parsed.pathname === "/sse" && req.method === "GET") {
                console.error("SSE client connecting…");
                const transport = new SSEServerTransport("/sse", res);
                await this.server.connect(transport);
                console.error("SSE connected.");
                return;
            }
            if (parsed.pathname === "/health") {
                res.writeHead(200);
                res.end(JSON.stringify({ ok: true }));
                return;
            }
            res.writeHead(404);
            res.end("Route not found");
        });
        httpServer.listen(port, "localhost", () => {
            console.error(`Azure DevOps MCP SSE running at http://localhost:${port}/sse`);
        });
    }
}
const server = new AzureDevOpsCoreServer();
server.run().catch(console.error);
