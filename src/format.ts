import type { SearchResponse, SearchResult } from "./types.js";

function detail(result: SearchResult): string {
  if (result.kind === "api") {
    return `${result.endpointCount} endpoints · ${result.schemaCount} schemas`;
  }
  if (result.kind === "endpoint") return `${result.method} ${result.path}`;
  return `${result.schemaType} · ${result.propertyCount} properties`;
}

export function formatSearch(response: SearchResponse): string {
  const lines = response.items.map((result) => {
    const kind = result.kind.toUpperCase().padEnd(8);
    return `${kind} ${result.id.padEnd(52)} ${detail(result)}\n         ${result.title} — ${result.apiTitle}\n         ${result.match.mode} · ${result.match.fields.join(", ")}`;
  });
  lines.push(
    `\n${response.strategy} · ${response.total} results · ${response.counts.api} APIs · ${response.counts.endpoint} endpoints · ${response.counts.schema} schemas`
  );
  return lines.join("\n");
}
