# Contributing

`pontx-hub-cli` is intentionally independent from the Pontx monorepo and consumes only the versioned Pontx Hub HTTP API.

Before opening a pull request, run:

```bash
pnpm typecheck
pnpm test
pnpm build
```

Keep `--json` output machine-readable and backward compatible. Do not log credentials, request headers, or environment-variable values.
