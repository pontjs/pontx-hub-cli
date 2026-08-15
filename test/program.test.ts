import { afterEach, describe, expect, it, vi } from "vitest";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProgram } from "../src/program.js";
import { HubClient } from "../src/client.js";
import type {
  HubOperationDetail,
  HubPublishedSkillBundle,
  HubSkillSummary
} from "../src/types.js";

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

const productSkill: HubPublishedSkillBundle = {
  name: "pontx-tasks",
  apiSlug: "tasks",
  version: "1.0.0",
  description: "Task integration workflows",
  license: "MIT-0",
  contentHash: "fca25eae51bbd9011a389b0f107cda1fe14ce99c493c6d29889e8aef4604028f",
  files: [{
    path: "SKILL.md",
    sha256: "8c78633697597050ade157306c7ffe98c2446b6dc1163ee569124ee0296e304c",
    content: "# Tasks\n"
  }]
};

const productSkillSummary: HubSkillSummary = {
  ...productSkill,
  files: productSkill.files.map(({ path, sha256 }) => ({ path, sha256 }))
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createProgram", () => {
  it("registers the standalone Hub workflow", () => {
    const program = createProgram();
    expect(program.version()).toBe("0.2.0");
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

  it("lists universal and product Skills", async () => {
    vi.spyOn(HubClient.prototype, "listSkills").mockResolvedValue([
      {
        ...productSkillSummary,
        name: "pontx-hub",
        apiSlug: undefined,
        description: "Universal API discovery"
      },
      productSkillSummary
    ]);
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await createProgram().parseAsync(["node", "pontx-hub", "skill", "list"]);

    expect(write).toHaveBeenCalledWith(expect.stringContaining("pontx-hub"));
    expect(write).toHaveBeenCalledWith(expect.stringContaining("pontx-tasks"));
  });

  it("prints a machine-readable Skill summary list", async () => {
    vi.spyOn(HubClient.prototype, "listSkills").mockResolvedValue([productSkillSummary]);
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await createProgram().parseAsync([
      "node", "pontx-hub", "skill", "list", "--json"
    ]);

    const output = String(write.mock.calls[0]?.[0]);
    expect(JSON.parse(output)).toEqual([productSkillSummary]);
  });

  it("keeps no-argument install mapped to the universal pontx-hub Skill", async () => {
    const temporary = await mkdtemp(join(tmpdir(), "pontx-hub-cli-"));
    const output = join(temporary, "pontx-hub");
    const universal = { ...productSkill, name: "pontx-hub", apiSlug: undefined };
    const listSkills = vi.spyOn(HubClient.prototype, "listSkills");
    const getSkill = vi.spyOn(HubClient.prototype, "getSkill").mockResolvedValue(universal);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    try {
      await createProgram().parseAsync([
        "node", "pontx-hub", "skill", "install", "--output", output
      ]);

      expect(listSkills).not.toHaveBeenCalled();
      expect(getSkill).toHaveBeenCalledWith("pontx-hub");
      await expect(readFile(join(output, "SKILL.md"), "utf8")).resolves.toBe("# Tasks\n");
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });

  it("resolves a product API slug and installs its verified Skill bundle", async () => {
    const temporary = await mkdtemp(join(tmpdir(), "pontx-hub-cli-"));
    const output = join(temporary, "pontx-tasks");
    vi.spyOn(HubClient.prototype, "listSkills").mockResolvedValue([productSkillSummary]);
    const getSkill = vi.spyOn(HubClient.prototype, "getSkill").mockResolvedValue(productSkill);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    try {
      await createProgram().parseAsync([
        "node", "pontx-hub", "skill", "install", "tasks", "--output", output
      ]);

      expect(getSkill).toHaveBeenCalledWith("pontx-tasks");
      await expect(readFile(join(output, "SKILL.md"), "utf8")).resolves.toBe("# Tasks\n");
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });

  it("rejects a corrupted bundle before creating the installation directory", async () => {
    const temporary = await mkdtemp(join(tmpdir(), "pontx-hub-cli-"));
    const output = join(temporary, "pontx-tasks");
    vi.spyOn(HubClient.prototype, "getSkill").mockResolvedValue({
      ...productSkill,
      files: [{ ...productSkill.files[0]!, content: "tampered\n" }]
    });
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    try {
      await expect(createProgram().parseAsync([
        "node", "pontx-hub", "skill", "install", "--output", output
      ])).rejects.toThrow("Skill file hash mismatch: SKILL.md");
      await expect(access(output)).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });

  it("requires --force before updating an existing Skill directory", async () => {
    const temporary = await mkdtemp(join(tmpdir(), "pontx-hub-cli-"));
    const output = join(temporary, "pontx-tasks");
    await mkdir(output);
    await writeFile(join(output, "SKILL.md"), "old\n");
    vi.spyOn(HubClient.prototype, "getSkill").mockResolvedValue({
      ...productSkill,
      name: "pontx-hub"
    });
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    try {
      await expect(createProgram().parseAsync([
        "node", "pontx-hub", "skill", "install", "--output", output
      ])).rejects.toThrow(`Skill directory already exists: ${output}`);
      await expect(readFile(join(output, "SKILL.md"), "utf8")).resolves.toBe("old\n");

      await createProgram().parseAsync([
        "node", "pontx-hub", "skill", "install", "--output", output, "--force"
      ]);
      await expect(readFile(join(output, "SKILL.md"), "utf8")).resolves.toBe("# Tasks\n");
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });

  it("does not follow an existing Skill file symlink when --force is used", async () => {
    const temporary = await mkdtemp(join(tmpdir(), "pontx-hub-cli-"));
    const output = join(temporary, "pontx-tasks");
    const outside = join(temporary, "outside.md");
    await mkdir(output);
    await writeFile(outside, "outside\n");
    await symlink(outside, join(output, "SKILL.md"));
    vi.spyOn(HubClient.prototype, "getSkill").mockResolvedValue({
      ...productSkill,
      name: "pontx-hub"
    });
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    try {
      await expect(createProgram().parseAsync([
        "node", "pontx-hub", "skill", "install", "--output", output, "--force"
      ])).rejects.toThrow("Unsafe Skill installation path contains a symbolic link");
      await expect(readFile(outside, "utf8")).resolves.toBe("outside\n");
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });
});
