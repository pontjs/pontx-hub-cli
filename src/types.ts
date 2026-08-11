export type Locale = "zh" | "en";
export type SearchKind = "api" | "endpoint" | "schema";
export type SearchMatchField =
  | "product"
  | "title"
  | "description"
  | "path"
  | "parameter"
  | "request"
  | "response"
  | "schema"
  | "property";

export type SearchMatch = {
  mode: "lexical" | "semantic" | "hybrid";
  fields: SearchMatchField[];
};

type SearchResultBase = {
  id: string;
  kind: SearchKind;
  score: number;
  apiSlug: string;
  apiTitle: string;
  provider: string;
  title: string;
  description: string;
  href: string;
  match: SearchMatch;
};

export type ApiSearchResult = SearchResultBase & {
  kind: "api";
  category: string;
  endpointCount: number;
  schemaCount: number;
};

export type EndpointSearchResult = SearchResultBase & {
  kind: "endpoint";
  operationSlug: string;
  operationId: string;
  method: string;
  path: string;
  tag: string;
};

export type SchemaSearchResult = SearchResultBase & {
  kind: "schema";
  schemaName: string;
  schemaType: string;
  propertyCount: number;
  properties: string[];
};

export type SearchResult =
  | ApiSearchResult
  | EndpointSearchResult
  | SchemaSearchResult;

export type SearchResponse = {
  strategy: "hybrid-semantic";
  semanticVersion: "pontx-multilingual-v1";
  query: string;
  locale: Locale;
  total: number;
  offset: number;
  limit: number;
  counts: Record<SearchKind, number>;
  items: SearchResult[];
};

export type SearchOptions = {
  locale?: Locale;
  types?: SearchKind[];
  limit?: number;
  offset?: number;
};

export type HubEnvelope<T> = {
  version: "v1" | "v2";
  data: T;
};

export type HubErrorEnvelope = {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
};

export type HubApiSummary = {
  slug: string;
  name: string;
  provider: string;
  category: string;
  title: { zh: string; en: string };
  summary: { zh: string; en: string };
  packageName: string;
  sdkVersion: string;
  sdkStatus: "planned" | "published";
  operationCount: number;
  schemaCount: number;
  authTypes: string[];
  quickStart?: {
    operationSlug: string;
    requestExampleId: string;
  };
};

export type HubRequestExampleInput = {
  in: "path" | "query" | "header" | "body";
  name: string;
  source:
    | { kind: "operation"; operationId: string }
    | { kind: "runtime"; reason: string };
};

export type HubRequestExample = {
  id: string;
  title: { zh: string; en: string };
  request: {
    serverId?: string;
    path: Record<string, string | number | boolean>;
    query: Record<string, string | number | boolean>;
    headers: Record<string, string>;
    body?: unknown;
  };
  expectedStatus: string;
  verifiedAt?: string;
  completeness: "ready" | "requires-input";
  unresolved: HubRequestExampleInput[];
};

export type HubOperationSummary = {
  slug: string;
  operationId: string;
  tag: string;
  method: string;
  path: string;
  requestExamples?: HubRequestExample[];
};

export type HubApiDetail = {
  slug: string;
  quickStart?: {
    operationSlug: string;
    requestExampleId: string;
  };
  operations: HubOperationSummary[];
};

export type HubOperationDetail = {
  api: HubApiSummary & {
    servers: Array<{ id: string; url: string }>;
    auth: Array<{
      id: string;
      type: "apiKey" | "bearer" | "oauth2" | "basic";
      envVar?: string;
      usernameEnvVar?: string;
      passwordEnvVar?: string;
    }>;
  };
  operation: {
    slug: string;
    operationId: string;
    tag: string;
    method: string;
    path: string;
    parameters: Array<{
      name: string;
      in: "path" | "query" | "header" | "body";
      required?: boolean;
      type: string;
      format?: string;
      schemaName?: string;
      enum?: unknown[];
      example?: unknown;
    }>;
    requestBody?: {
      description?: { zh: string; en: string };
      contentTypes?: string[];
      schemaType?: string;
      schemaName?: string;
      properties?: string[];
    };
    responses: Array<{
      status: string;
      description?: { zh: string; en: string };
      contentTypes?: string[];
      schemaType?: string;
      schemaName?: string;
      properties?: string[];
    }>;
    requestExamples?: HubRequestExample[];
  };
};

export type HubRequestInput = {
  apiSlug: string;
  operationSlug: string;
  serverId: string;
  path: Record<string, unknown>;
  query: Record<string, unknown>;
  headers: Record<string, string>;
  body?: unknown;
  auth?:
    | { type: "apiKey"; schemeId: string; value: string }
    | { type: "bearer" | "oauth2"; schemeId: string; token: string }
    | {
        type: "basic";
        schemeId: string;
        username: string;
        password: string;
      };
};

export type HubPreview = {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
  curl: string;
  requiresConfirmation: boolean;
  confirmationToken?: string;
  proxyEnabled: boolean;
  warnings: string[];
};

export type HubSkillBundle = {
  name: string;
  version: string;
  files: Record<string, string>;
};
