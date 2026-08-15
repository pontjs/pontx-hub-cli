import { describe, expect, it, vi } from "vitest";
import { HubClient, resolveOperation } from "../src/client.js";

describe("HubClient", () => {
  it("calls the global v2 search endpoint with reusable filters", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        version: "v2",
        data: {
          strategy: "hybrid-semantic",
          semanticVersion: "pontx-multilingual-v1",
          query: "task",
          locale: "en",
          total: 1,
          offset: 0,
          limit: 10,
          counts: { api: 0, endpoint: 0, schema: 1 },
          items: []
        }
      })
    );
    const client = new HubClient("https://hub.example///", fetcher);
    await client.search("task", {
      locale: "en",
      types: ["schema"],
      limit: 10
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://hub.example/api/v2/search?q=task&locale=en&limit=10&offset=0&types=schema",
      { headers: { Accept: "application/json" } }
    );
  });

  it("reads every layered v2 product metadata resource with an immutable revision", async () => {
    const fetcher = vi.fn(async () => Response.json({
      version: "v2",
      metadataRevision: "a".repeat(40),
      data: { slug: "hub-cli" }
    }));
    const client = new HubClient("https://hub.example", fetcher);

    await expect(client.listProducts()).resolves.toMatchObject({
      metadataRevision: "a".repeat(40)
    });
    await client.product("hub-cli");
    await client.endpointMetadata("hub-cli", "list-products", "zh");
    await client.schemaMetadata("hub-cli", "Product Summary");
    await client.productMetadata("hub-cli", "zh");

    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "https://hub.example/api/v2/products",
      "https://hub.example/api/v2/products/hub-cli",
      "https://hub.example/api/v2/products/hub-cli/endpoints/list-products?locale=zh",
      "https://hub.example/api/v2/products/hub-cli/schemas/Product%20Summary?locale=en",
      "https://hub.example/api/v2/products/hub-cli/metadata?locale=zh"
    ]);
  });

  it("resolves a controller and API name to the stable endpoint slug", () => {
    expect(resolveOperation({
      slug: "dida365",
      operations: [
        {
          slug: "create-task",
          operationId: "createTask",
          tag: "task",
          method: "POST",
          path: "/task"
        }
      ]
    }, "task", "createTask")).toMatchObject({ slug: "create-task" });
  });

  it("allows an API name without a controller for default collections", () => {
    expect(resolveOperation({
      slug: "frankfurter-v2",
      operations: [
        {
          slug: "get-rates",
          operationId: "getRates",
          tag: "default",
          method: "GET",
          path: "/rates"
        }
      ]
    }, "getRates")).toMatchObject({ slug: "get-rates" });
  });

  it("resolves stable schema result IDs", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ version: "v2", data: { schema: { name: "TaskCreate" } } })
    );
    const client = new HubClient("https://hub.example", fetcher);
    await client.show("schema:dida365/TaskCreate");
    expect(fetcher).toHaveBeenCalledWith(
      "https://hub.example/api/v2/specs/dida365/schemas/TaskCreate",
      { headers: { Accept: "application/json" } }
    );
  });

  it("reads reviewed pricing from the dedicated API contract", async () => {
    const fetcher = vi.fn(async () => Response.json({
      version: "v1",
      data: {
        status: "free",
        summary: { zh: "免费", en: "Free" },
        officialUrl: "https://example.com/pricing",
        verifiedAt: "2026-08-14"
      }
    }));
    const client = new HubClient("https://hub.example", fetcher);
    await expect(client.pricing("rates")).resolves.toMatchObject({ status: "free" });
    expect(fetcher).toHaveBeenCalledWith(
      "https://hub.example/api/v1/specs/rates/pricing",
      { headers: { Accept: "application/json" } }
    );
  });

  it("lists published Agent Skills from the versioned Hub API", async () => {
    const fetcher = vi.fn(async () => Response.json({ version: "v1", data: [] }));
    const client = new HubClient("https://hub.example", fetcher);

    await expect(client.listSkills()).resolves.toEqual([]);
    expect(fetcher).toHaveBeenCalledWith(
      "https://hub.example/api/v1/skills",
      { headers: { Accept: "application/json" } }
    );
  });

  it("gets an installable Skill bundle by its encoded name", async () => {
    const fetcher = vi.fn(async () => Response.json({
      version: "v1",
      data: {
        name: "pontx-demo/api",
        apiSlug: "demo",
        version: "1.0.0",
        description: "Demo",
        license: "MIT-0",
        contentHash: "0".repeat(64),
        files: []
      }
    }));
    const client = new HubClient("https://hub.example", fetcher);

    await expect(client.getSkill("pontx-demo/api")).resolves.toMatchObject({
      name: "pontx-demo/api"
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://hub.example/api/v1/skills/pontx-demo%2Fapi",
      { headers: { Accept: "application/json" } }
    );
  });

  it("keeps the legacy universal Skill API available", async () => {
    const fetcher = vi.fn(async () => Response.json({
      version: "v1",
      data: { name: "pontx-hub", version: "0.3.0", files: {} }
    }));
    const client = new HubClient("https://hub.example", fetcher);

    await client.skill();
    expect(fetcher).toHaveBeenCalledWith(
      "https://hub.example/api/v1/skill",
      { headers: { Accept: "application/json" } }
    );
  });
});
