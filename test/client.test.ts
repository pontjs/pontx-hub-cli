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
});
