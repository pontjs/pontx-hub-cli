import { describe, expect, it } from "vitest";
import { formatSearch } from "../src/format.js";

describe("formatSearch", () => {
  it("renders stable IDs and aggregate counts", () => {
    const output = formatSearch({
      query: "task",
      locale: "en",
      total: 1,
      offset: 0,
      limit: 30,
      counts: { api: 0, endpoint: 0, schema: 1 },
      items: [
        {
          id: "schema:dida365/Task",
          kind: "schema",
          score: 100,
          apiSlug: "dida365",
          apiTitle: "Dida365 Open API",
          provider: "Dida365",
          title: "Task",
          description: "Task model",
          href: "/en/apis/dida365/schemas/Task",
          schemaName: "Task",
          schemaType: "object",
          propertyCount: 16,
          properties: []
        }
      ]
    });
    expect(output).toContain("schema:dida365/Task");
    expect(output).toContain("1 results · 0 APIs · 0 endpoints · 1 schemas");
  });
});
