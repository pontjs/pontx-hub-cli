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
node dist/cli.js frankfurter preview 'Exchange Rates' getLatestRates --base USD
node dist/cli.js frankfurter call 'Exchange Rates' getLatestRates --base USD
node dist/cli.js frankfurter-v2 call getRates --base USD
```

Search returns API products, individual HTTP endpoints, and OpenAPI schemas from one hybrid semantic index. Ranking reuses product titles and descriptions plus endpoint parameters, request bodies, responses, referenced schemas, and nested fields. Every result has a stable ID that can be passed to `show`, along with `match.mode` and `match.fields` explaining why it matched.

The standalone CLI also provides `list`, `preview`, `call`, `sdk`, and
`skill install`. Mutation calls stop after the redacted preview unless the
unchanged request is explicitly repeated with `--yes`.

API calls follow the same hierarchy as Pontx projects:
`pontx-hub <api-collection> call <controller> <api-name>`. Collections whose
OpenAPI document has no meaningful controller omit that segment. The earlier
`pontx-hub call <api-collection> <endpoint-slug>` form remains available for
existing scripts.

Pass OpenAPI path, query, and declared header parameters as named options such
as `--projectId 123` or `--includeCompleted true`. Use `--body '<json>'` for a
request body and `-H 'Header: value'` for an extra raw header.

## TypeScript client

```ts
import { HubClient } from "@pontx/hub-cli";

const hub = new HubClient();
const results = await hub.search("exchange rate", {
  types: ["api", "endpoint", "schema"],
  locale: "en"
});
```

Set `PONTX_HUB_URL` or pass `--url` to use another Hub deployment.

## Development

```bash
pnpm typecheck
pnpm test
pnpm build
```
