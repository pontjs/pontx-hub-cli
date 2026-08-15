# Pontx Hub CLI

Standalone CLI and TypeScript client for the public [Pontx Hub](https://pontx.dev) search API.

**Pontx Hub:** [https://pontx.dev](https://pontx.dev) · [Agent Skill and CLI guide](https://pontx.dev/en/skills/pontx-hub)

## Usage

```bash
pnpm install
pnpm build

node dist/cli.js search "create a todo"
node dist/cli.js search "返回 dueDate 的接口" --locale zh --json
node dist/cli.js search projectId --type schema --locale en --json
node dist/cli.js show schema:dida365/TaskCreate
node dist/cli.js pricing massive
node dist/cli.js frankfurter preview 'Exchange Rates' getLatestRates --base USD
node dist/cli.js frankfurter call 'Exchange Rates' getLatestRates --base USD
node dist/cli.js frankfurter-v2 call getRates --base USD
node dist/cli.js skill list
node dist/cli.js skill install
node dist/cli.js skill install dida365
```

Search returns API products, individual HTTP endpoints, and OpenAPI schemas from one hybrid semantic index. Ranking reuses product titles and descriptions plus endpoint parameters, request bodies, responses, referenced schemas, and nested fields. Every result has a stable ID that can be passed to `show`, along with `match.mode` and `match.fields` explaining why it matched.

The standalone CLI also provides `list`, `preview`, `call`, `sdk`, and
product-aware Skill installation. `pontx-hub skill install` keeps installing
the universal `pontx-hub` Skill, while `pontx-hub skill install <api-slug>` or
`pontx-hub skill install <skill-name>` installs a published product Skill.
Use `pontx-hub skill list` (or `--json`) to discover the available names.
Every downloaded Skill is checked against its per-file SHA-256 digests and
aggregate content hash before any files are written; absolute paths and path
traversal are rejected. Use `--output` to choose a directory and `--force` to
update an existing installation.

Mutation calls stop after the redacted preview unless the unchanged request is
explicitly repeated with `--yes`.

API calls follow the same hierarchy as Pontx projects:
`pontx-hub <api-collection> call <controller> <api-name>`. Collections whose
OpenAPI document has no meaningful controller omit that segment. The earlier
`pontx-hub call <api-collection> <endpoint-slug>` form remains available for
existing scripts.

Pass OpenAPI path, query, and declared header parameters as named options such
as `--projectId 123` or `--includeCompleted true`. Use `--body '<json>'` for a
request body and `-H 'Header: value'` for an extra raw header. When an API has
an OpenAPI parameter named `version`, pass it as `--path-version` so the CLI's
own `--version` flag remains available.

## TypeScript client

```ts
import { HubClient } from "@pontx/hub-cli";

const hub = new HubClient();
const results = await hub.search("exchange rate", {
  types: ["api", "endpoint", "schema"],
  locale: "en"
});

const skills = await hub.listSkills();
const dida365Skill = await hub.getSkill(
  skills.find((skill) => skill.apiSlug === "dida365")!.name
);
```

`HubClient.skill()` and `GET /api/v1/skill` remain available for consumers of
the legacy universal-Skill bundle. New integrations should use `listSkills()`
and `getSkill(name)`, whose bundles include immutable content hashes.

Set `PONTX_HUB_URL` or pass `--url` to use another Hub deployment.

## Development

```bash
pnpm typecheck
pnpm test
pnpm build
```
