import { afterEach, describe, expect, it } from "vitest";
import { buildRequest } from "../src/request.js";
import type { HubOperationDetail } from "../src/types.js";

const detail: HubOperationDetail = {
  api: {
    slug: "tasks",
    name: "Tasks",
    provider: "Example",
    category: "Productivity",
    title: { zh: "任务", en: "Tasks" },
    summary: { zh: "任务", en: "Tasks" },
    packageName: "@pontx/api-tasks",
    sdkVersion: "0.1.0",
    sdkStatus: "planned",
    operationCount: 1,
    schemaCount: 1,
    authTypes: ["bearer"],
    servers: [{ id: "default", url: "https://api.example.com" }],
    auth: [{ id: "bearer", type: "bearer", envVar: "PONTX_HUB_CLI_TEST_TOKEN" }]
  },
  operation: {
    slug: "get-task",
    operationId: "getTask",
    method: "GET",
    path: "/tasks/{taskId}",
    parameters: [
      { name: "taskId", in: "path", required: true, type: "string" },
      { name: "include", in: "query", type: "boolean" }
    ]
  }
};

afterEach(() => {
  delete process.env.PONTX_HUB_CLI_TEST_TOKEN;
});

describe("buildRequest", () => {
  it("partitions typed parameters and reads credentials only from the environment", () => {
    process.env.PONTX_HUB_CLI_TEST_TOKEN = "test-secret";
    const request = buildRequest(detail, {
      param: ["taskId=task-1", "include=true"]
    });
    expect(request.path).toEqual({ taskId: "task-1" });
    expect(request.query).toEqual({ include: true });
    expect(request.auth).toEqual({
      type: "bearer",
      schemeId: "bearer",
      token: "test-secret"
    });
  });
});
