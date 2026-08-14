import type {
  HubEnvelope,
  HubErrorEnvelope,
  HubApiDetail,
  HubApiSummary,
  HubOperationDetail,
  HubOperationSummary,
  HubPreview,
  HubPricing,
  HubRequestInput,
  HubSkillBundle,
  SearchOptions,
  SearchResponse
} from "./types.js";

export const DEFAULT_HUB_URL =
  process.env.PONTX_HUB_URL || "https://pontx.dev";

function sameCommandName(left: string, right: string): boolean {
  return left.localeCompare(right, undefined, { sensitivity: "accent" }) === 0;
}

export function resolveOperation(
  api: HubApiDetail,
  controllerOrEndpoint: string,
  endpoint?: string
): HubOperationSummary {
  const operationName = endpoint ?? controllerOrEndpoint;
  const candidates = api.operations.filter((operation) => {
    const operationMatches =
      sameCommandName(operation.operationId, operationName) ||
      sameCommandName(operation.slug, operationName);
    const controllerMatches =
      endpoint === undefined || sameCommandName(operation.tag, controllerOrEndpoint);
    return operationMatches && controllerMatches;
  });

  if (candidates.length === 1) return candidates[0]!;

  const reference = endpoint
    ? `${controllerOrEndpoint} ${endpoint}`
    : controllerOrEndpoint;
  if (candidates.length === 0) {
    throw new Error(`Endpoint not found in ${api.slug}: ${reference}`);
  }
  throw new Error(
    `Endpoint is ambiguous in ${api.slug}: ${reference}. Include the controller before the API name.`
  );
}

export class HubRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly requestId?: string
  ) {
    super(message);
    this.name = "HubRequestError";
  }
}

export class HubClient {
  readonly baseUrl: string;

  constructor(
    baseUrl = DEFAULT_HUB_URL,
    private readonly fetcher: typeof fetch = fetch
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers
      }
    });
    const payload = (await response.json()) as HubEnvelope<T> | HubErrorEnvelope;
    if (!response.ok || "error" in payload) {
      const error =
        "error" in payload
          ? payload.error
          : {
              code: "request_failed",
              message: `Hub request failed (${response.status})`,
              requestId: undefined
            };
      throw new HubRequestError(
        error.message,
        response.status,
        error.code,
        error.requestId
      );
    }
    return payload.data;
  }

  list(): Promise<HubApiSummary[]> {
    return this.request("/api/v1/catalog");
  }

  search(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
    const parameters = new URLSearchParams({
      q: query,
      locale: options.locale ?? "en",
      limit: String(options.limit ?? 30),
      offset: String(options.offset ?? 0)
    });
    if (options.types?.length) parameters.set("types", options.types.join(","));
    return this.request(`/api/v2/search?${parameters}`);
  }

  api(apiSlug: string): Promise<HubApiDetail> {
    return this.request<HubApiDetail>(`/api/v1/specs/${encodeURIComponent(apiSlug)}`);
  }

  async resolveEndpoint(
    apiSlug: string,
    controllerOrEndpoint: string,
    endpoint?: string
  ): Promise<HubOperationDetail> {
    const api = await this.api(apiSlug);
    const operation = resolveOperation(api, controllerOrEndpoint, endpoint);
    return this.endpoint(apiSlug, operation.slug);
  }

  endpoint(apiSlug: string, operationSlug: string): Promise<HubOperationDetail> {
    return this.request<HubOperationDetail>(
      `/api/v1/specs/${encodeURIComponent(apiSlug)}/operations/${encodeURIComponent(operationSlug)}`
    );
  }

  schema(apiSlug: string, schemaName: string): Promise<unknown> {
    return this.request(
      `/api/v2/specs/${encodeURIComponent(apiSlug)}/schemas/${encodeURIComponent(schemaName)}`
    );
  }

  sdk(apiSlug: string): Promise<unknown> {
    return this.request(`/api/v1/specs/${encodeURIComponent(apiSlug)}/sdk`);
  }

  pricing(apiSlug: string): Promise<HubPricing> {
    return this.request(`/api/v1/specs/${encodeURIComponent(apiSlug)}/pricing`);
  }

  skill(): Promise<HubSkillBundle> {
    return this.request<HubSkillBundle>("/api/v1/skill");
  }

  preview(input: HubRequestInput): Promise<HubPreview> {
    return this.request<HubPreview>("/api/v1/playground/preview", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  execute(
    input: HubRequestInput & { confirmationToken?: string }
  ): Promise<unknown> {
    return this.request("/api/v1/playground/execute", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  show(resourceId: string): Promise<unknown> {
    const separator = resourceId.indexOf(":");
    if (separator < 1) {
      throw new Error("Resource ID must look like api:slug, endpoint:api/operation, or schema:api/name");
    }
    const kind = resourceId.slice(0, separator);
    const resourcePath = resourceId.slice(separator + 1);
    if (kind === "api") return this.api(resourcePath);
    const slash = resourcePath.indexOf("/");
    if (slash < 1 || slash === resourcePath.length - 1) {
      throw new Error(`${kind} resource IDs must include an API slug and resource name`);
    }
    const apiSlug = resourcePath.slice(0, slash);
    const resourceName = resourcePath.slice(slash + 1);
    if (kind === "endpoint") return this.endpoint(apiSlug, resourceName);
    if (kind === "schema") return this.schema(apiSlug, resourceName);
    throw new Error(`Unsupported resource kind: ${kind}`);
  }
}
