import { afterEach, describe, expect, it, vi } from "vitest";
import { createProgram } from "../src/program.js";
import { HubClient } from "../src/client.js";
import type { HubOperationDetail } from "../src/types.js";

const detail = {
  api: {
    slug: "tasks",
    servers: [{ id: "default", url: "https://example.com" }],
    auth: []
  },
  operation: {
    slug: "get-task",
    operationId: "getTask",
    tag: "task",
    method: "GET",
    path: "/tasks/{taskId}",
    parameters: [{ name: "taskId", in: "path", required: true, type: "string" }],
    responses: []
  }
} as HubOperationDetail;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createProgram", () => {
  it("registers the standalone Hub workflow", () => {
    const program = createProgram();
    expect(program.version()).toBe("0.1.3");
    expect(program.commands.map((command) => command.name())).toEqual([
      "list",
      "search",
      "show",
      "pricing",
      "preview",
      "call",
      "sdk",
      "skill"
    ]);
  });

  it("parses collection, controller, and API name before request options", async () => {
    const resolveEndpoint = vi
      .spyOn(HubClient.prototype, "resolveEndpoint")
      .mockResolvedValue(detail);
    const preview = vi.spyOn(HubClient.prototype, "preview").mockResolvedValue({
      method: "GET",
      url: "https://example.com/tasks/task-1",
      headers: {},
      requiresConfirmation: false,
      proxyEnabled: true,
      warnings: [],
      curl: "curl https://example.com/tasks/task-1"
    });
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await createProgram().parseAsync([
      "node",
      "pontx-hub",
      "tasks",
      "preview",
      "task",
      "getTask",
      "--taskId",
      "task-1"
    ]);

    expect(resolveEndpoint).toHaveBeenCalledWith("tasks", "task", "getTask");
    expect(preview).toHaveBeenCalledWith(expect.objectContaining({
      apiSlug: "tasks",
      operationSlug: "get-task",
      path: { taskId: "task-1" }
    }));
  });

  it("parses named options after an API name without a controller", async () => {
    const resolveEndpoint = vi
      .spyOn(HubClient.prototype, "resolveEndpoint")
      .mockResolvedValue(detail);
    const preview = vi.spyOn(HubClient.prototype, "preview").mockResolvedValue({
      method: "GET",
      url: "https://example.com/tasks/task-1",
      headers: {},
      requiresConfirmation: false,
      proxyEnabled: true,
      warnings: [],
      curl: "curl https://example.com/tasks/task-1"
    });
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await createProgram().parseAsync([
      "node",
      "pontx-hub",
      "tasks",
      "preview",
      "getTask",
      "--taskId",
      "task-1"
    ]);

    expect(resolveEndpoint).toHaveBeenCalledWith("tasks", "getTask", undefined);
    expect(preview).toHaveBeenCalledWith(expect.objectContaining({
      path: { taskId: "task-1" }
    }));
  });

  it("keeps the CLI --version option available by accepting --path-version for API input", async () => {
    const versionedDetail = {
      ...detail,
      operation: {
        ...detail.operation,
        parameters: [{ name: "version", in: "path", required: true, type: "string" }]
      }
    } as HubOperationDetail;
    vi.spyOn(HubClient.prototype, "resolveEndpoint").mockResolvedValue(versionedDetail);
    const preview = vi.spyOn(HubClient.prototype, "preview").mockResolvedValue({
      method: "GET",
      url: "https://example.com/versions/1.0",
      headers: {},
      requiresConfirmation: false,
      proxyEnabled: true,
      warnings: [],
      curl: "curl https://example.com/versions/1.0"
    });
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await createProgram().parseAsync([
      "node", "pontx-hub", "versions", "preview", "getVersion", "--path-version", "1.0"
    ]);

    expect(preview).toHaveBeenCalledWith(expect.objectContaining({
      path: { version: "1.0" }
    }));
  });

  it("rejects the removed -p compatibility syntax", async () => {
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    await expect(createProgram().parseAsync([
      "node",
      "pontx-hub",
      "tasks",
      "preview",
      "getTask",
      "-p",
      "taskId=task-1"
    ])).rejects.toThrow(
      "-p has been removed; pass API parameters as --parameter value"
    );
  });
});
