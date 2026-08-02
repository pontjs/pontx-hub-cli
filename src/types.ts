export type Locale = "zh" | "en";
export type SearchKind = "api" | "endpoint" | "schema";

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
    method: string;
    path: string;
    parameters: Array<{
      name: string;
      in: "path" | "query" | "header" | "body";
      required?: boolean;
      type: string;
      example?: unknown;
    }>;
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
