const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export interface NewsItem {
  title: string;
  source: string;
  date: string;
}

export interface NewsContext {
  headlines: NewsItem[];
  headlinesText: string; // Formatted for prompt injection
}

/**
 * Fetch top news for a stock ticker from Naver Finance mobile API.
 */
export async function fetchNaverNews(
  ticker: string,
  count: number = 5
): Promise<NewsItem[]> {
  try {
    const res = await fetch(
      `https://m.stock.naver.com/api/stock/${ticker}/news?pageSize=${count}&page=1`,
      { headers: { "User-Agent": UA }, next: { revalidate: 0 } }
    );
    if (!res.ok) return [];
    const json = await res.json();

    if (!Array.isArray(json)) return [];

    return json.slice(0, count).map((item: Record<string, string>) => ({
      title: item.title?.replace(/<[^>]*>/g, "").trim() || "",
      source: item.officeName || item.mediaName || "",
      date: item.datetime?.slice(0, 10) || "",
    }));
  } catch {
    return [];
  }
}

/**
 * Build a formatted news context string for agent prompt injection.
 */
export async function buildNewsContext(
  ticker: string
): Promise<NewsContext> {
  const headlines = await fetchNaverNews(ticker, 5);

  const headlinesText =
    headlines.length > 0
      ? headlines
          .map(
            (h, i) =>
              `  ${i + 1}. ${h.title}${h.source ? ` (${h.source})` : ""}${h.date ? ` [${h.date}]` : ""}`
          )
          .join("\n")
      : "  (최근 뉴스 없음)";

  return { headlines, headlinesText };
}
