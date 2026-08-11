import type { HubOperationDetail, HubRequestInput } from "./types.js";

export type RequestOptions = {
  param?: string[];
  namedParam?: Record<string, unknown>;
  header?: string[];
  body?: string;
};

function parseValue(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function keyValues(values: string[] = []): Record<string, unknown> {
  return Object.fromEntries(
    values.map((item) => {
      const separator = item.indexOf("=");
      if (separator < 1) throw new Error(`Expected key=value, received: ${item}`);
      return [item.slice(0, separator), parseValue(item.slice(separator + 1))];
    })
  );
}

export function parseNamedParameters(args: string[]): Record<string, unknown> {
  const values: Record<string, unknown> = {};

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    if (!argument.startsWith("--") || argument.length === 2) {
      throw new Error(`Expected --parameter value, received: ${argument}`);
    }

    const separator = argument.indexOf("=");
    if (separator > 2) {
      const name = argument.slice(2, separator);
      values[name] = parseValue(argument.slice(separator + 1));
      continue;
    }

    const name = argument.slice(2);
    const next = args[index + 1];
    if (next === undefined || next.startsWith("--")) {
      values[name] = true;
      continue;
    }

    values[name] = parseValue(next);
    index += 1;
  }

  return values;
}

export function buildRequest(
  detail: HubOperationDetail,
  options: RequestOptions
): HubRequestInput {
  const namedValues = options.namedParam ?? {};
  const parameterNames = new Set(
    detail.operation.parameters.map((parameter) => parameter.name)
  );
  const unknownParameters = Object.keys(namedValues).filter(
    (name) => !parameterNames.has(name)
  );
  if (unknownParameters.length > 0) {
    const available = [...parameterNames].map((name) => `--${name}`).join(", ");
    throw new Error(
      `Unknown request parameter: ${unknownParameters.map((name) => `--${name}`).join(", ")}` +
      (available ? `. Available parameters: ${available}` : ". This API has no named parameters.")
    );
  }

  const values = {
    ...keyValues(options.param),
    ...namedValues
  };
  const path: Record<string, unknown> = {};
  const query: Record<string, unknown> = {};
  const headers = Object.fromEntries(
    (options.header ?? []).map((item) => {
      const separator = item.indexOf(":");
      if (separator < 1) throw new Error(`Expected Header: value, received: ${item}`);
      return [item.slice(0, separator).trim(), item.slice(separator + 1).trim()];
    })
  );

  for (const parameter of detail.operation.parameters) {
    if (!(parameter.name in values)) continue;
    if (parameter.in === "path") path[parameter.name] = values[parameter.name];
    if (parameter.in === "query") query[parameter.name] = values[parameter.name];
    if (parameter.in === "header") {
      headers[parameter.name] = String(values[parameter.name]);
    }
  }

  const scheme = detail.api.auth[0];
  let auth: HubRequestInput["auth"];
  if (scheme?.type === "basic") {
    const username = process.env[scheme.usernameEnvVar ?? ""];
    const password = process.env[scheme.passwordEnvVar ?? ""];
    if (username && password) {
      auth = { type: "basic", schemeId: scheme.id, username, password };
    }
  } else if (scheme?.envVar && process.env[scheme.envVar]) {
    const credential = process.env[scheme.envVar];
    if (credential && scheme.type === "apiKey") {
      auth = { type: "apiKey", schemeId: scheme.id, value: credential };
    } else if (credential && (scheme.type === "bearer" || scheme.type === "oauth2")) {
      auth = { type: scheme.type, schemeId: scheme.id, token: credential };
    }
  }

  return {
    apiSlug: detail.api.slug,
    operationSlug: detail.operation.slug,
    serverId: detail.api.servers[0]?.id ?? "default",
    path,
    query,
    headers,
    ...(options.body !== undefined ? { body: parseValue(options.body) } : {}),
    ...(auth ? { auth } : {})
  };
}
