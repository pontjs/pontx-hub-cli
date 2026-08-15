import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { HubClient } from "../dist/index.js";

const product = {
  id: "api:hub-cli",
  slug: "hub-cli",
  name: "Pontx Hub Discovery API",
  provider: "Pontx",
  category: "Developer Tools",
  title: { zh: "Pontx Hub 发现 API", en: "Pontx Hub Discovery API" },
  summary: { zh: "发现", en: "Discovery" },
  endpointCount: 15,
  schemaCount: 18,
  authTypes: [],
  sdk: { packageName: "@pontx/hub-cli", sdkVersion: "0.2.1", sdkStatus: "published", cliName: "pontx-hub" }
};

const server = createServer((request, response) => {
  const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
  const json = (value) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(value));
  };
  if (pathname === "/api/v2/products") {
    return json({ version: "v2", metadataRevision: "a".repeat(40), data: [product] });
  }
  if (pathname === "/api/v2/products/hub-cli") {
    return json({ version: "v2", metadataRevision: "a".repeat(40), data: { ...product, endpoints: [], schemas: [] } });
  }
  if (pathname === "/api/v2/products/hub-cli/endpoints/list-products") {
    return json({ version: "v2", metadataRevision: "a".repeat(40), data: { locale: "en", product, endpoint: { slug: "list-products" }, pontxSpec: {} } });
  }
  if (pathname === "/api/v2/products/hub-cli/schemas/ProductSummary") {
    return json({ version: "v2", metadataRevision: "a".repeat(40), data: { locale: "en", product, schema: { name: "ProductSummary" }, pontxSpec: {} } });
  }
  if (pathname === "/api/v2/products/hub-cli/metadata") {
    return json({ version: "v2", metadataRevision: "a".repeat(40), data: { locale: "en", product, pontxSpec: {} } });
  }
  if (pathname === "/api/v1/skills") {
    return json({ version: "v1", data: [{ name: "pontx-hub", version: "0.4.0", description: "Hub Skill", license: "MIT-0", contentHash: "b".repeat(64), files: [{ path: "SKILL.md", sha256: "c".repeat(64) }] }] });
  }
  response.writeHead(404, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ error: { code: "not_found", message: "Not found", requestId: "req_e2e" } }));
});

server.listen(0, "127.0.0.1");
await once(server, "listening");
const address = server.address();
assert(address && typeof address !== "string");
const baseUrl = `http://127.0.0.1:${address.port}`;

try {
  const client = new HubClient(baseUrl);
  const products = await client.listProducts();
  assert.equal(products.metadataRevision, "a".repeat(40));
  assert.equal(products.data[0]?.slug, "hub-cli");
  assert.equal((await client.product("hub-cli")).data.slug, "hub-cli");
  assert.equal((await client.endpointMetadata("hub-cli", "list-products")).data.endpoint.slug, "list-products");
  assert.equal((await client.schemaMetadata("hub-cli", "ProductSummary")).data.schema.name, "ProductSummary");
  assert.equal((await client.productMetadata("hub-cli")).data.product.slug, "hub-cli");

  const child = spawn(process.execPath, ["dist/cli.js", "--url", baseUrl, "skill", "list", "--json"], {
    cwd: new URL("..", import.meta.url),
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const [code] = await once(child, "close");
  assert.equal(code, 0, stderr);
  assert.equal(JSON.parse(stdout)[0].name, "pontx-hub");
} finally {
  server.close();
  await once(server, "close");
}

console.log("Built package E2E passed for metadata and Skill discovery paths.");
