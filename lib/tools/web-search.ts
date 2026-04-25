import { tavily } from "@tavily/core";

export type WebSearchResult = {
  title: string;
  url: string;
  content: string;
};

let _client: ReturnType<typeof tavily> | null = null;
function getClient() {
  if (!_client) {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) throw new Error("TAVILY_API_KEY missing");
    _client = tavily({ apiKey });
  }
  return _client;
}

export async function webSearch(
  query: string,
  maxResults = 5
): Promise<WebSearchResult[]> {
  try {
    const r = await getClient().search(query, {
      maxResults,
      searchDepth: "basic",
    });
    return (r.results ?? []).map((x) => ({
      title: x.title ?? "(untitled)",
      url: x.url ?? "",
      content: x.content ?? "",
    }));
  } catch (e) {
    console.warn(
      "[webSearch] failed:",
      e instanceof Error ? e.message : String(e)
    );
    return [];
  }
}
