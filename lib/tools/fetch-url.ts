const MAX_BYTES = 50_000;
const TIMEOUT_MS = 8_000;

export type FetchUrlResult = {
  ok: boolean;
  status?: number;
  url: string;
  text: string;
  truncated: boolean;
};

export async function fetchUrlText(url: string): Promise<FetchUrlResult> {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return {
        ok: false,
        url,
        text: `[unsupported protocol: ${u.protocol}]`,
        truncated: false,
      };
    }
  } catch {
    return { ok: false, url, text: "[invalid URL]", truncated: false };
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; hack-mvp-DD/1.0; +https://example.com)",
        Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "follow",
    });
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        url,
        text: `[fetch failed: ${res.status} ${res.statusText}]`,
        truncated: false,
      };
    }
    const raw = await res.text();
    const text = stripHtml(raw).slice(0, MAX_BYTES);
    return {
      ok: true,
      status: res.status,
      url,
      text,
      truncated: raw.length > MAX_BYTES,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      url,
      text: `[fetch error: ${msg}]`,
      truncated: false,
    };
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
