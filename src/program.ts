import { Command, Option } from "commander";
import { access, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { isAbsolute, resolve, sep } from "node:path";
import { formatSearch } from "./format.js";
import { HubClient } from "./client.js";
import {
  buildRequest,
  parseNamedParameters,
  type RequestOptions
} from "./request.js";
import type { Locale, SearchKind } from "./types.js";

const { version: PACKAGE_VERSION } = createRequire(import.meta.url)("../package.json") as {
  version: string;
};

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
    .option("-H, --header <header>", "Request header; repeat to add more", collect, [])
    .option("--body <json>", "JSON request body");
}

function withNamedParameters(
  options: RequestOptions,
  namedArguments: string[]
): RequestOptions {
  return {
    ...options,
    namedParam: parseNamedParameters(namedArguments)
  };
}

type DynamicRequestArguments = {
  api: string;
  action: "preview" | "call";
  controllerOrEndpoint: string;
  endpoint?: string;
  namedArguments: string[];
};

export function parseDynamicRequestArguments(
  args: string[]
): DynamicRequestArguments {
  const [api, action, ...requestArguments] = args;
  if (!api || (action !== "preview" && action !== "call")) {
    throw new Error(
      "Use pontx-hub <api-collection> <preview|call> [controller] <api-name>"
    );
  }

  const namedOptionIndex = requestArguments.findIndex((argument) =>
    argument.startsWith("--")
  );
  const endpointArguments = namedOptionIndex < 0
    ? requestArguments
    : requestArguments.slice(0, namedOptionIndex);
  const namedArguments = namedOptionIndex < 0
    ? []
    : requestArguments.slice(namedOptionIndex);

  if (endpointArguments.includes("-p")) {
    throw new Error(
      "-p has been removed; pass API parameters as --parameter value"
    );
  }
  if (endpointArguments.length < 1 || endpointArguments.length > 2) {
    throw new Error(
      "Use pontx-hub <api-collection> <preview|call> [controller] <api-name>"
    );
  }

  return {
    api,
    action,
    controllerOrEndpoint: endpointArguments[0]!,
    ...(endpointArguments[1] ? { endpoint: endpointArguments[1] } : {}),
    namedArguments
  };
}

type CallOptions = RequestOptions & { yes?: boolean };

async function previewEndpoint(
  client: HubClient,
  detail: Awaited<ReturnType<HubClient["endpoint"]>>,
  options: RequestOptions
): Promise<void> {
  printJson(await client.preview(buildRequest(detail, options)));
}

async function callEndpoint(
  client: HubClient,
  detail: Awaited<ReturnType<HubClient["endpoint"]>>,
  options: CallOptions
): Promise<void> {
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

export function createProgram(): Command {
  const program = addRequestOptions(new Command()
    .name("pontx-hub")
    .description("Discover public APIs and inspect OpenAPI Endpoints and Schemas across Pontx Hub")
    .version(PACKAGE_VERSION)
    .usage("[options] <api-collection> <preview|call> [controller] <api-name>")
    .option(
      "--url <url>",
      "Pontx Hub base URL",
      process.env.PONTX_HUB_URL || "https://pontx.dev"
    ))
    .option("--yes", "Confirm the exact mutation shown by the preview")
    .argument("[api-collection]", "API collection slug")
    .argument("[action]", "preview or call")
    .argument("[controller-or-api]", "Controller/tag, or API name when the collection has no controller")
    .argument("[api-name]", "API name when a controller is present")
    .allowUnknownOption(true)
    .allowExcessArguments(true)
    .action(async (
      api: string | undefined,
      action: string | undefined,
      controllerOrEndpoint: string | undefined,
      endpoint: string | undefined,
      options: CallOptions,
      command: Command
    ) => {
      if (!api && !action && !controllerOrEndpoint && !endpoint) {
        program.outputHelp();
        return;
      }
      const requestArguments = parseDynamicRequestArguments(command.args);
      const client = clientFor(program);
      const detail = await client.resolveEndpoint(
        requestArguments.api,
        requestArguments.controllerOrEndpoint,
        requestArguments.endpoint
      );
      const requestOptions = withNamedParameters(
        options,
        requestArguments.namedArguments
      );
      if (requestArguments.action === "preview") {
        await previewEndpoint(client, detail, requestOptions);
      } else {
        await callEndpoint(client, detail, requestOptions);
      }
    })
    .addHelpText("after", `
Examples:
  $ pontx-hub frankfurter call 'Exchange Rates' getLatestRates --base USD
  $ pontx-hub frankfurter-v2 preview getRates --base USD

Collections with controllers use: <collection> call <controller> <api-name>
Collections without controllers use: <collection> call <api-name>
Pass API parameters by name, for example --projectId 123.`);

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

  program
    .command("pricing")
    .description("Show reviewed API pricing and its official source")
    .argument("<api>", "API collection slug")
    .action(async (api: string) => {
      printJson(await clientFor(program).pricing(api));
    });

  addRequestOptions(
    program
      .command("preview", { hidden: true })
      .description("Build a redacted request preview without calling the provider")
      .argument("<api>", "API slug")
      .argument("<endpoint>", "Endpoint slug")
      .allowUnknownOption(true)
      .allowExcessArguments(true)
  ).action(
    async (
      api: string,
      endpoint: string,
      options: RequestOptions,
      command: Command
    ) => {
      const client = clientFor(program);
      const detail = await client.endpoint(api, endpoint);
      await previewEndpoint(
        client,
        detail,
        withNamedParameters(options, command.args.slice(2))
      );
    }
  );

  addRequestOptions(
    program
      .command("call", { hidden: true })
      .description("Call an endpoint through the Hub proxy; mutations require --yes")
      .argument("<api>", "API slug")
      .argument("<endpoint>", "Endpoint slug")
      .option("--yes", "Confirm the exact mutation shown by the preview")
      .allowUnknownOption(true)
      .allowExcessArguments(true)
  ).action(
    async (
      api: string,
      endpoint: string,
      options: RequestOptions & { yes?: boolean },
      command: Command
    ) => {
      const client = clientFor(program);
      const detail = await client.endpoint(api, endpoint);
      await callEndpoint(
        client,
        detail,
        withNamedParameters(options, command.args.slice(2))
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
