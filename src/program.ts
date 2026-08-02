import { Command, Option } from "commander";
import { access, mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, resolve, sep } from "node:path";
import { formatSearch } from "./format.js";
import { HubClient } from "./client.js";
import { buildRequest, type RequestOptions } from "./request.js";
import type { Locale, SearchKind } from "./types.js";

function collect(value: string, previous: string[]): string[] {
  return previous.concat(value);
}

function parseInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error(`Expected an integer, received: ${value}`);
  return parsed;
}

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function clientFor(program: Command): HubClient {
  return new HubClient(program.opts<{ url: string }>().url);
}

function addRequestOptions(command: Command): Command {
  return command
    .option("-p, --param <key=value>", "Request parameter; repeat to add more", collect, [])
    .option("-H, --header <header>", "Request header; repeat to add more", collect, [])
    .option("--body <json>", "JSON request body");
}

export function createProgram(): Command {
  const program = new Command()
    .name("pontx-hub")
    .description("Search and inspect APIs across Pontx Hub")
    .version("0.1.0")
    .option(
      "--url <url>",
      "Pontx Hub base URL",
      process.env.PONTX_HUB_URL || "https://pontx-hub.vercel.app"
    );

  program
    .command("list")
    .description("List API products in the Hub catalog")
    .option("--json", "Print JSON")
    .action(async (options: { json?: boolean }) => {
      const apis = await clientFor(program).list();
      if (options.json) return printJson(apis);
      for (const api of apis) {
        process.stdout.write(
          `${api.slug.padEnd(16)} ${api.name} · ${api.operationCount} endpoints · ${api.schemaCount} schemas\n`
        );
      }
    });

  program
    .command("search")
    .description("Semantically search API products, endpoints, inputs, outputs, and schemas")
    .argument("<query>", "Natural-language search query")
    .addOption(
      new Option("--locale <locale>", "Result language")
        .choices(["zh", "en"])
        .default("en")
    )
    .option(
      "-t, --type <type>",
      "Resource type: api, endpoint, or schema; repeat to combine",
      collect,
      []
    )
    .option("--limit <number>", "Maximum results (1-100)", parseInteger, 30)
    .option("--offset <number>", "Result offset", parseInteger, 0)
    .option("--json", "Print the versioned search response as JSON")
    .action(
      async (
        query: string,
        options: {
          locale: Locale;
          type: string[];
          limit: number;
          offset: number;
          json?: boolean;
        }
      ) => {
        const validTypes = new Set<SearchKind>(["api", "endpoint", "schema"]);
        if (options.type.some((type) => !validTypes.has(type as SearchKind))) {
          throw new Error("--type must be api, endpoint, or schema");
        }
        const client = clientFor(program);
        const result = await client.search(query, {
          locale: options.locale,
          types: options.type as SearchKind[],
          limit: options.limit,
          offset: options.offset
        });
        if (options.json) printJson(result);
        else process.stdout.write(`${formatSearch(result)}\n`);
      }
    );

  program
    .command("show")
    .description("Show a resource returned by search")
    .argument("<resource-id>", "Stable ID such as schema:dida365/Task")
    .action(async (resourceId: string) => {
      const client = clientFor(program);
      printJson(await client.show(resourceId));
    });

  addRequestOptions(
    program
      .command("preview")
      .description("Build a redacted request preview without calling the provider")
      .argument("<api>", "API slug")
      .argument("<endpoint>", "Endpoint slug")
  ).action(
    async (
      api: string,
      endpoint: string,
      options: RequestOptions
    ) => {
      const client = clientFor(program);
      const detail = await client.endpoint(api, endpoint);
      printJson(await client.preview(buildRequest(detail, options)));
    }
  );

  addRequestOptions(
    program
      .command("call")
      .description("Call an endpoint through the Hub proxy; mutations require --yes")
      .argument("<api>", "API slug")
      .argument("<endpoint>", "Endpoint slug")
      .option("--yes", "Confirm the exact mutation shown by the preview")
  ).action(
    async (
      api: string,
      endpoint: string,
      options: RequestOptions & { yes?: boolean }
    ) => {
      const client = clientFor(program);
      const detail = await client.endpoint(api, endpoint);
      const request = buildRequest(detail, options);
      const preview = await client.preview(request);
      printJson({ preview });
      if (preview.requiresConfirmation && !options.yes) {
        throw new Error("Mutation stopped after preview. Review it and rerun unchanged with --yes.");
      }
      printJson(
        await client.execute({
          ...request,
          ...(preview.confirmationToken
            ? { confirmationToken: preview.confirmationToken }
            : {})
        })
      );
    }
  );

  program
    .command("sdk")
    .description("Show the operator-published SDK status for an API")
    .argument("<api>", "API slug")
    .action(async (api: string) => printJson(await clientFor(program).sdk(api)));

  program
    .command("skill")
    .description("Install the universal Pontx Hub Agent Skill")
    .argument("[action]", "install", "install")
    .option("--output <directory>", "Skill installation directory", ".agents/skills/pontx-hub")
    .option("--force", "Overwrite an existing Skill directory")
    .action(
      async (
        action: string,
        options: { output: string; force?: boolean }
      ) => {
        if (action !== "install") throw new Error(`Unsupported skill action: ${action}`);
        const target = resolve(process.cwd(), options.output);
        if (!options.force) {
          try {
            await access(target);
            throw new Error(`Skill directory already exists: ${target}. Use --force to update it.`);
          } catch (error: unknown) {
            if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
              throw error;
            }
          }
        }
        const bundle = await clientFor(program).skill();
        for (const [name, content] of Object.entries(bundle.files)) {
          if (isAbsolute(name) || name.split(/[\\/]/).includes("..")) {
            throw new Error(`Unsafe skill file path: ${name}`);
          }
          const destination = resolve(target, name);
          if (destination !== target && !destination.startsWith(`${target}${sep}`)) {
            throw new Error(`Unsafe skill file path: ${name}`);
          }
          await mkdir(resolve(destination, ".."), { recursive: true });
          await writeFile(destination, content, "utf8");
        }
        process.stdout.write(`Installed ${bundle.name}@${bundle.version} to ${target}\n`);
      }
    );

  return program;
}
