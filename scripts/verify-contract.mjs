import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const contract = JSON.parse(await readFile(resolve(root, "contract.json"), "utf8"));
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

assert.equal(contract.formatVersion, 1);
assert.match(contract.metadata.commit, /^[a-f0-9]{40}$/);
assert.match(contract.metadata.sha256, /^[a-f0-9]{64}$/);
assert.equal(contract.metadata.specPath, "products/hub-cli/spec.pontx.json");

const localSpec = await readFile(resolve(root, "spec.pontx.json"));
assert.equal(
  digest(localSpec),
  contract.metadata.sha256,
  "The mirrored PontxSpec differs from the contract hash",
);

async function pinnedSourceSpec() {
  const localPath = process.env.PONTX_METADATA_CONTRACT_SPEC_PATH;
  if (localPath) return readFile(localPath);

  const raw = new URL(
    `https://raw.githubusercontent.com/pontjs/pontx-api-metadata/${contract.metadata.commit}/${contract.metadata.specPath}`,
  );
  try {
    const response = await fetch(raw, { headers: { Accept: "application/json" } });
    if (response.ok) return Buffer.from(await response.arrayBuffer());
  } catch {
    // Some managed networks rewrite the raw host certificate. Use GitHub's
    // public Contents API as a byte-identical, commit-pinned fallback.
  }

  const content = new URL(
    `https://api.github.com/repos/pontjs/pontx-api-metadata/contents/${contract.metadata.specPath}?ref=${contract.metadata.commit}`,
  );
  const response = await fetch(content, {
    headers: { Accept: "application/vnd.github+json" }
  });
  assert.equal(response.status, 200, `Unable to fetch the pinned metadata contract: HTTP ${response.status}`);
  const payload = await response.json();
  assert.equal(payload.encoding, "base64", "Pinned metadata source must be a base64 file response");
  assert.equal(typeof payload.content, "string", "Pinned metadata source is missing content");
  return Buffer.from(payload.content.replace(/\s/g, ""), "base64");
}

const sourceSpec = await pinnedSourceSpec();
assert.equal(
  digest(sourceSpec),
  contract.metadata.sha256,
  "The pinned metadata PontxSpec differs from the expected contract hash",
);
assert.deepEqual(localSpec, sourceSpec, "The local PontxSpec mirror must be byte-for-byte identical to metadata");

console.log(`Verified ${contract.metadata.specPath} at metadata ${contract.metadata.commit}.`);
