import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

interface StockData {
  name?: string;
  currentPrice?: number;
  pbr?: number;
  per?: number;
  roe?: number;
  dividendYield?: number;
  avgTargetPrice?: number;
  highTargetPrice?: number;
  lowTargetPrice?: number;
  buyRatings?: number;
  holdRatings?: number;
  sellRatings?: number;
  foreignHoldingPct?: number;
  foreignNetBuy3D?: number;
  shortInterestPct?: number;
  week52High?: number;
  week52Low?: number;
  priceChange1M?: number;
  priceChange3M?: number;
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function parseNum(s: string | number | undefined): number | undefined {
  if (s == null) return undefined;
  const cleaned = String(s).replace(/[,\s원주%배백만조억+]/g, "");
  const n = Number(cleaned);
  return isNaN(n) ? undefined : n;
}

// Robust fetch with exponential backoff
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      if (res.status === 404) return res; // Don't retry real 404s
    } catch (err) {
      if (attempt === maxRetries - 1) throw err;
    }
    attempt++;
    await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt))); // 1s, 2s, 4s...
  }
  throw new Error(`Failed to fetch ${url} after ${maxRetries} attempts`);
}

// Try Naver mobile JSON API — only has name + price
async function fetchBasic(ticker: string): Promise<StockData> {
  const data: StockData = {};
  try {
    const res = await fetchWithRetry(
      `https://m.stock.naver.com/api/stock/${ticker}/basic`,
      { headers: { "User-Agent": UA }, next: { revalidate: 0 } }
    );
    if (!res.ok) return data;
    const json = await res.json();

    data.name = json.stockName;
    data.currentPrice = parseNum(json.closePrice);
  } catch {
    // silent
  }
  return data;
}

// Integration endpoint — richest source: totalInfos[], consensusInfo, dealTrendInfos[]
async function fetchIntegration(ticker: string): Promise<StockData> {
  const data: StockData = {};
  try {
    const res = await fetchWithRetry(
      `https://m.stock.naver.com/api/stock/${ticker}/integration`,
      { headers: { "User-Agent": UA }, next: { revalidate: 0 } }
    );
    if (!res.ok) return data;
    const json = await res.json();

    if (json.stockName) data.name = json.stockName;

    // totalInfos is an array of { code, key, value, valueDesc }
    if (Array.isArray(json.totalInfos)) {
      const infoMap = new Map<string, string>();
      for (const item of json.totalInfos) {
        if (item.code && item.value != null) {
          infoMap.set(item.code, String(item.value));
        }
      }

      const closePrice = infoMap.get("closePrice");
      if (closePrice) data.currentPrice = parseNum(closePrice);

      const per = infoMap.get("per");
      if (per) data.per = parseNum(per);

      const pbr = infoMap.get("pbr");
      if (pbr) data.pbr = parseNum(pbr);

      const dvr = infoMap.get("dividendYieldRatio");
      if (dvr) data.dividendYield = parseNum(dvr);

      const foreignRate = infoMap.get("foreignRate");
      if (foreignRate) data.foreignHoldingPct = parseNum(foreignRate);

      const high52 = infoMap.get("highPriceOf52Weeks");
      if (high52) data.week52High = parseNum(high52);

      const low52 = infoMap.get("lowPriceOf52Weeks");
      if (low52) data.week52Low = parseNum(low52);
    }

    // Consensus info — only has mean target price
    if (json.consensusInfo) {
      const ci = json.consensusInfo;
      if (ci.priceTargetMean) data.avgTargetPrice = parseNum(ci.priceTargetMean);
    }

    // dealTrendInfos — daily trading data for foreign net buy
    if (Array.isArray(json.dealTrendInfos) && json.dealTrendInfos.length >= 3) {
      const recent3 = json.dealTrendInfos.slice(0, 3); // most recent first
      let sumShares = 0;
      for (const d of recent3) {
        const qty = parseNum(d.foreignerPureBuyQuant);
        if (qty != null) sumShares += qty;
      }
      // Convert shares to approximate 억원 using current price
      if (sumShares !== 0 && data.currentPrice) {
        data.foreignNetBuy3D = Math.round((sumShares * data.currentPrice) / 100000000);
      }
    }
  } catch {
    // silent
  }
  return data;
}

// Price history endpoint — calculate 1M/3M price changes
async function fetchPriceHistory(ticker: string): Promise<StockData> {
  const data: StockData = {};
  try {
    const res = await fetchWithRetry(
      `https://m.stock.naver.com/api/stock/${ticker}/price?pageSize=60&page=1`,
      { headers: { "User-Agent": UA }, next: { revalidate: 0 } }
    );
    if (!res.ok) return data;
    const json = await res.json();

    // Array sorted newest-first
    if (Array.isArray(json) && json.length > 1) {
      const latestPrice = parseNum(json[0]?.closePrice);
      if (latestPrice) {
        // ~1 month ago (roughly 20 trading days back)
        if (json.length >= 21) {
          const monthAgo = parseNum(json[20]?.closePrice);
          if (monthAgo) {
            data.priceChange1M = Math.round(((latestPrice - monthAgo) / monthAgo) * 1000) / 10;
          }
        }
        // ~3 months ago (use last available entry)
        if (json.length >= 55) {
          const threeMonthsAgo = parseNum(json[json.length - 1]?.closePrice);
          if (threeMonthsAgo) {
            data.priceChange3M = Math.round(((latestPrice - threeMonthsAgo) / threeMonthsAgo) * 1000) / 10;
          }
        }
      }
    }
  } catch {
    // silent
  }
  return data;
}

// Scrape wisereport for analyst target prices and ratings
async function fetchWisereport(ticker: string): Promise<StockData> {
  const data: StockData = {};
  try {
    const res = await fetchWithRetry(
      `https://navercomp.wisereport.co.kr/v2/company/c1010001.aspx?cmp_cd=${ticker}&cn=`,
      { headers: { "User-Agent": UA }, next: { revalidate: 0 } }
    );
    if (!res.ok) return data;
    const html = await res.text();
    const $ = cheerio.load(html);

    // Parse individual analyst report table for target prices and ratings
    const targets: number[] = [];
    let buy = 0, hold = 0, sell = 0;

    $("table").each((_, table) => {
      const headerText = $(table).find("tr").first().text();
      if (!headerText.includes("제공처") || !headerText.includes("목표가")) return;

      $(table).find("tr").each((j, tr) => {
        if (j === 0) return; // skip header
        const cells: string[] = [];
        $(tr).find("td").each((_, td) => {
          cells.push($(td).text().trim());
        });
        if (cells.length < 6) return;

        // cells: [broker, date, targetPrice, prevTarget, change%, rating, prevRating]
        const target = parseNum(cells[2]);
        if (target) targets.push(target);

        const rating = cells[5].toLowerCase().replace(/\s/g, "");
        if (rating.includes("buy") || rating.includes("매수") || rating.includes("outperform") || rating.includes("overweight")) {
          buy++;
        } else if (rating.includes("hold") || rating.includes("중립") || rating.includes("neutral") || rating.includes("marketperform") || rating.includes("equalweight")) {
          hold++;
        } else if (rating.includes("sell") || rating.includes("매도") || rating.includes("underperform") || rating.includes("underweight") || rating.includes("reduce")) {
          sell++;
        }
      });
    });

    if (targets.length > 0) {
      data.highTargetPrice = Math.max(...targets);
      data.lowTargetPrice = Math.min(...targets);
      data.avgTargetPrice = Math.round(targets.reduce((a, b) => a + b, 0) / targets.length);
    }
    if (buy + hold + sell > 0) {
      data.buyRatings = buy;
      data.holdRatings = hold;
      data.sellRatings = sell;
    }
  } catch {
    // silent
  }
  return data;
}

// Scrape Naver Finance main page (UTF-8) — primary source for ROE, dividend
async function fetchMainPage(ticker: string): Promise<StockData> {
  const data: StockData = {};
  try {
    const res = await fetchWithRetry(
      `https://finance.naver.com/item/main.naver?code=${ticker}`,
      { headers: { "User-Agent": UA }, next: { revalidate: 0 } }
    );
    if (!res.ok) return data;
    const html = await res.text();
    const $ = cheerio.load(html);

    // Stock name
    const nameEl = $(".wrap_company h2 a");
    if (nameEl.length) data.name = nameEl.text().trim();

    // Current price
    const priceEl = $(".no_today .blind");
    if (priceEl.length) data.currentPrice = parseNum(priceEl.first().text());

    // PER, PBR, ROE, dividend from th > strong labels
    $("tr").each((_, row) => {
      const label = $(row).find("th strong").text().trim();
      const val = $(row).find("td").first().text().trim();
      if (!label || !val) return;

      if (label.startsWith("ROE")) {
        const n = parseFloat(val);
        if (!isNaN(n)) data.roe = n;
      } else if (label.startsWith("PER") && label.includes("배")) {
        const n = parseFloat(val);
        if (!isNaN(n)) data.per = n;
      } else if (label.startsWith("PBR") && label.includes("배")) {
        const n = parseFloat(val);
        if (!isNaN(n)) data.pbr = n;
      } else if (label.includes("시가배당률")) {
        const n = parseFloat(val);
        if (!isNaN(n)) data.dividendYield = n;
      }
    });
  } catch {
    // silent
  }
  return data;
}

function merge(...objects: StockData[]): StockData {
  const result: StockData = {};
  for (const obj of objects) {
    for (const [key, val] of Object.entries(obj)) {
      if (val != null && (typeof val === "string" || !isNaN(val as number))) {
        (result as Record<string, unknown>)[key] = val;
      }
    }
  }
  return result;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;

  if (!/^\d{6}$/.test(ticker)) {
    return NextResponse.json(
      { error: "종목코드는 6자리 숫자여야 합니다" },
      { status: 400 }
    );
  }

  // Fetch all sources in parallel
  const [basic, integration, priceHistory, mainPage, wisereport] = await Promise.all([
    fetchBasic(ticker),
    fetchIntegration(ticker),
    fetchPriceHistory(ticker),
    fetchMainPage(ticker),
    fetchWisereport(ticker),
  ]);

  // Merge: mainPage first (lowest priority), then basic, then integration, then wisereport (best for analyst data), then price history
  const result = merge(mainPage, basic, integration, wisereport, priceHistory);

  if (!result.currentPrice || !result.name) {
    return NextResponse.json(
      { error: "종목 데이터를 찾을 수 없습니다" },
      { status: 404 }
    );
  }

  return NextResponse.json(result);
}
