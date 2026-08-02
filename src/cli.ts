#!/usr/bin/env node
import { createProgram } from "./program.js";

createProgram().parseAsync().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unexpected error";
  process.stderr.write(`pontx-hub: ${message}\n`);
  process.exitCode = 1;
});
