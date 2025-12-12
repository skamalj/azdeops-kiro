#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { z } from "zod";
import http from "http";
import url from "url";

/* ------------------------------
   ZOD SCHEMAS (unchanged)
------------------------------*/
const CreateUserStorySchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  storyPoints: z.number().int().min(1).max(21).optional(),
});

const CreateTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  remainingWork: z.number().min(0).optional(),
  parentId: z.number().int().positive().optional(),
});

const GetWorkItemsSchema = z.object({
  type: z.enum(["User Story", "Task", "Bug", "Feature"]).optional(),
  state: z.string().optional(),
  assignedTo: z.string().optional(),
  maxResults: z.number().int().positive().max(200).default(50),
});

const UpdateWorkItemSchema = z.object({
  id: z.number().int().positive(),
  updates: z.array(
    z.object({
      op: z.enum(["add", "replace", "remove"]),
      path: z.string(),
      value: z.any().optional(),
    })
  ),
});

const GetWorkItemSchema = z.object({
  id: z.number().int().positive(),
});

/* ------------------------------
   ADO CLIENT (your original code)
------------------------------*/
class AzureDevOpsApiClient {
  private organizationUrl = "";
  private projectName = "";
  private pat = "";

  initialize(org: string, proj: string, pat: string) {
    this.organizationUrl = org;
    this.projectName = proj;
    this.pat = pat;
  }

  private getAuthHeader() {
    return `Basic ${Buffer.from(`:${this.pat}`).toString("base64")}`;
  }

  private getBaseUrl() {
    return `${this.organizationUrl}/${this.projectName}`;
  }

  async createWorkItem(type: string, fields: any, parentId?: number) {
    const patchDocument: any[] = [
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

    const res = await fetch(
      `${this.getBaseUrl()}/_apis/wit/workitems/$${type}?api-version=7.0`,
      {
        method: "POST",
        headers: {
          Authorization: this.getAuthHeader(),
          "Content-Type": "application/json-patch+json",
        },
        body: JSON.stringify(patchDocument),
      }
    );

    if (!res.ok) throw new Error("Failed to create work item");

    const data = await res.json();

    if (parentId) {
      await this.linkWorkItems(
        data.id,
        parentId,
        "System.LinkTypes.Hierarchy-Reverse"
      );
    }

    return this.mapAzureWorkItemToWorkItem(data);
  }

  async getWorkItems(query: any = {}) {
    let wiql = `SELECT [System.Id], [System.Title], [System.WorkItemType], [System.State], [System.AssignedTo] FROM WorkItems WHERE [System.TeamProject] = '${this.projectName}'`;

    if (query.type)
      wiql += ` AND [System.WorkItemType] = '${query.type}'`;

    if (query.state)
      wiql += ` AND [System.State] = '${query.state}'`;

    if (query.assignedTo)
      wiql += ` AND [System.AssignedTo] = '${query.assignedTo}'`;

    const qRes = await fetch(
      `${this.getBaseUrl()}/_apis/wit/wiql?api-version=7.0`,
      {
        method: "POST",
        headers: {
          Authorization: this.getAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: wiql }),
      }
    );

    const qData = await qRes.json();
    const ids = (qData.workItems ?? []).map((w: any) => w.id);

    if (!ids.length) return [];

    const detailRes = await fetch(
      `${this.getBaseUrl()}/_apis/wit/workitems?ids=${ids
        .slice(0, query.maxResults)
        .join(",")}&api-version=7.0`,
      { headers: { Authorization: this.getAuthHeader() } }
    );

    const final = await detailRes.json();
    return final.value.map((item: any) =>
      this.mapAzureWorkItemToWorkItem(item)
    );
  }

  async getWorkItem(id: number) {
    const r = await fetch(
      `${this.getBaseUrl()}/_apis/wit/workitems/${id}?api-version=7.0`,
      {
        headers: { Authorization: this.getAuthHeader() },
      }
    );
    if (!r.ok) throw new Error("Failed to get work item");
    return this.mapAzureWorkItemToWorkItem(await r.json());
  }

  async updateWorkItem(id: number, updates: any[]) {
    const r = await fetch(
      `${this.getBaseUrl()}/_apis/wit/workitems/${id}?api-version=7.0`,
      {
        method: "PATCH",
        headers: {
          Authorization: this.getAuthHeader(),
          "Content-Type": "application/json-patch+json",
        },
        body: JSON.stringify(updates),
      }
    );
    return this.mapAzureWorkItemToWorkItem(await r.json());
  }

  private async linkWorkItems(
    sourceId: number,
    targetId: number,
    linkType: string
  ) {
    await fetch(
      `${this.getBaseUrl()}/_apis/wit/workitems/${sourceId}?api-version=7.0`,
      {
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
      }
    );
  }

  private mapAzureWorkItemToWorkItem(azure: any) {
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
      fields: f,
    };
  }
}

/* ------------------------------
   MAIN MCP SERVER
------------------------------*/
export class AzureDevOpsCoreServer {
  private server: Server;
  private apiClient: AzureDevOpsApiClient;

  constructor() {
    this.server = new Server(
      { name: "azure-devops-core", version: "1.0.0" },
      {
        capabilities: {
          tools: {
            create_user_story: {},
            create_task: {},
            get_work_items: {},
            update_work_item: {},
            get_work_item: {},
          },
        },
      }
    );

    this.apiClient = new AzureDevOpsApiClient();
    this.initializeFromEnvironment();
    this.setupToolHandlers();
  }

  private initializeFromEnvironment() {
    const org = process.env.AZURE_DEVOPS_ORG_URL;
    const proj = process.env.AZURE_DEVOPS_PROJECT;
    const pat = process.env.AZURE_DEVOPS_PAT;

    if (org && proj && pat) {
      this.apiClient.initialize(org, proj, pat);
    }
  }

  private ensureInitialized() {
    if (
      !process.env.AZURE_DEVOPS_ORG_URL ||
      !process.env.AZURE_DEVOPS_PROJECT ||
      !process.env.AZURE_DEVOPS_PAT
    ) {
      throw new Error("Azure DevOps env vars missing");
    }
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "create_user_story",
          description: "Create a new user story",
          inputSchema: CreateUserStorySchema.toJSON(),
        },
        {
          name: "create_task",
          description: "Create a task",
          inputSchema: CreateTaskSchema.toJSON(),
        },
        {
          name: "get_work_items",
          description: "Query work items",
          inputSchema: GetWorkItemsSchema.toJSON(),
        },
        {
          name: "update_work_item",
          description: "Update a work item",
          inputSchema: UpdateWorkItemSchema.toJSON(),
        },
        {
          name: "get_work_item",
          description: "Retrieve a work item",
          inputSchema: GetWorkItemSchema.toJSON(),
        },
      ],
    }));

    this.server.setRequestHandler(
      CallToolRequestSchema,
      async ({ params }) => {
        const { name, arguments: args } = params;

        switch (name) {
          case "create_user_story":
            return this.createUserStory(args);
          case "create_task":
            return this.createTask(args);
          case "get_work_items":
            return this.getWorkItems(args);
          case "update_work_item":
            return this.updateWorkItem(args);
          case "get_work_item":
            return this.getWorkItem(args);
        }

        throw new Error("Unknown tool: " + name);
      }
    );
  }

  private async createUserStory(args: any) {
    this.ensureInitialized();
    const parsed = CreateUserStorySchema.parse(args);
    const item = await this.apiClient.createWorkItem("User Story", parsed);

    return { content: [{ type: "text", text: `Created US #${item.id}` }] };
  }

  private async createTask(args: any) {
    this.ensureInitialized();
    const parsed = CreateTaskSchema.parse(args);
    const item = await this.apiClient.createWorkItem("Task", parsed, parsed.parentId);

    return { content: [{ type: "text", text: `Created Task #${item.id}` }] };
  }

  private async getWorkItems(args: any) {
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

  private async updateWorkItem(args: any) {
    this.ensureInitialized();
    const parsed = UpdateWorkItemSchema.parse(args);
    const item = await this.apiClient.updateWorkItem(parsed.id, parsed.updates);

    return { content: [{ type: "text", text: `Updated #${item.id}` }] };
  }

  private async getWorkItem(args: any) {
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

  async runHttpServer(port: number) {
    const httpServer = http.createServer(async (req, res) => {
      const parsed = url.parse(req.url!, true);

      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");

      if (parsed.pathname === "/sse" && req.method === "GET") {
        console.error("SSE client connecting…");

        const transport = new SSEServerTransport({
          request: req,
          response: res,
        });

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
