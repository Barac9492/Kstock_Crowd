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
  week52High?: number;
  week52Low?: number;
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// Try Naver mobile JSON API
async function fetchMobileApi(ticker: string): Promise<StockData> {
  const data: StockData = {};
  try {
    const res = await fetch(
      `https://m.stock.naver.com/api/stock/${ticker}/basic`,
      { headers: { "User-Agent": UA }, next: { revalidate: 0 } }
    );
    if (!res.ok) return data;
    const json = await res.json();

    data.name = json.stockName;
    data.currentPrice = parseNum(json.closePrice);

    if (json.per) data.per = parseFloat(json.per);
    if (json.pbr) data.pbr = parseFloat(json.pbr);
    if (json.roe) data.roe = parseFloat(json.roe);
    if (json.dividendYield) data.dividendYield = parseFloat(json.dividendYield);

    if (json.high52wPrice) data.week52High = parseNum(json.high52wPrice);
    if (json.low52wPrice) data.week52Low = parseNum(json.low52wPrice);
    if (json.foreignRatio) data.foreignHoldingPct = parseFloat(json.foreignRatio);
  } catch {
    // silent
  }
  return data;
}

// Scrape Naver Finance main page (EUC-KR)
async function fetchMainPage(ticker: string): Promise<StockData> {
  const data: StockData = {};
  try {
    const res = await fetch(
      `https://finance.naver.com/item/main.naver?code=${ticker}`,
      { headers: { "User-Agent": UA }, next: { revalidate: 0 } }
    );
    if (!res.ok) return data;

    const buf = await res.arrayBuffer();
    const html = new TextDecoder("euc-kr").decode(buf);
    const $ = cheerio.load(html);

    // Stock name
    const nameEl = $(".wrap_company h2 a");
    if (nameEl.length) data.name = nameEl.text().trim();

    // Current price
    const priceEl = $(".no_today .blind");
    if (priceEl.length) data.currentPrice = parseNum(priceEl.first().text());

    // PER, PBR from aside table
    $("#aside_invest_tab table tbody tr").each((_, row) => {
      const label = $(row).find("th").text().trim();
      const val = $(row).find("td em").first().text().trim();
      if (label.includes("PER") && val) data.per = parseFloat(val);
      if (label.includes("PBR") && val) data.pbr = parseFloat(val);
      if (label.includes("ROE") && val) data.roe = parseFloat(val);
      if (label.includes("배당수익률") && val) data.dividendYield = parseFloat(val);
    });

    // 52-week high/low
    $(".tab_con1 table tbody tr").each((_, row) => {
      const label = $(row).find("th, .title").text().trim();
      const val = $(row).find("td .blind, td em").first().text().trim();
      if (label.includes("52주 최고") && val) data.week52High = parseNum(val);
      if (label.includes("52주 최저") && val) data.week52Low = parseNum(val);
    });

    // Foreign holding
    const foreignText = $("table.tb_type1_ifm tbody tr")
      .filter((_, el) => $(el).text().includes("외국인"))
      .find("td")
      .first()
      .text()
      .trim();
    if (foreignText) data.foreignHoldingPct = parseFloat(foreignText);
  } catch {
    // silent
  }
  return data;
}

// Fetch analyst consensus data
async function fetchConsensus(ticker: string): Promise<StockData> {
  const data: StockData = {};
  try {
    const res = await fetch(
      `https://m.stock.naver.com/api/stock/${ticker}/analyst`,
      { headers: { "User-Agent": UA }, next: { revalidate: 0 } }
    );
    if (!res.ok) return data;
    const json = await res.json();

    if (json.targetPrice) data.avgTargetPrice = parseNum(json.targetPrice);
    if (json.highTargetPrice) data.highTargetPrice = parseNum(json.highTargetPrice);
    if (json.lowTargetPrice) data.lowTargetPrice = parseNum(json.lowTargetPrice);

    // Ratings breakdown
    if (json.investOpinionTotalCount != null) {
      if (json.buyCount != null) data.buyRatings = json.buyCount;
      if (json.holdCount != null) data.holdRatings = json.holdCount;
      if (json.sellCount != null) data.sellRatings = json.sellCount;
    }
  } catch {
    // silent
  }
  return data;
}

// Try integration endpoint that has many fields
async function fetchIntegration(ticker: string): Promise<StockData> {
  const data: StockData = {};
  try {
    const res = await fetch(
      `https://m.stock.naver.com/api/stock/${ticker}/integration`,
      { headers: { "User-Agent": UA }, next: { revalidate: 0 } }
    );
    if (!res.ok) return data;
    const json = await res.json();

    // Deeply nested — try common paths
    const totalInfo = json.totalInfos || json;
    if (totalInfo.stockName) data.name = totalInfo.stockName;
    if (totalInfo.closePrice) data.currentPrice = parseNum(totalInfo.closePrice);
    if (totalInfo.per) data.per = parseFloat(totalInfo.per);
    if (totalInfo.pbr) data.pbr = parseFloat(totalInfo.pbr);
    if (totalInfo.dvr) data.dividendYield = parseFloat(totalInfo.dvr);
    if (totalInfo.foreignRatio) data.foreignHoldingPct = parseFloat(totalInfo.foreignRatio);
    if (totalInfo.high52wPrice) data.week52High = parseNum(totalInfo.high52wPrice);
    if (totalInfo.low52wPrice) data.week52Low = parseNum(totalInfo.low52wPrice);
  } catch {
    // silent
  }
  return data;
}

function parseNum(s: string | number | undefined): number | undefined {
  if (s == null) return undefined;
  const cleaned = String(s).replace(/[,\s원주%]/g, "");
  const n = Number(cleaned);
  return isNaN(n) ? undefined : n;
}

function merge(...objects: StockData[]): StockData {
  const result: StockData = {};
  for (const obj of objects) {
    for (const [key, val] of Object.entries(obj)) {
      if (val != null && !isNaN(val as number)) {
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
  const [mobile, main, consensus, integration] = await Promise.all([
    fetchMobileApi(ticker),
    fetchMainPage(ticker),
    fetchConsensus(ticker),
    fetchIntegration(ticker),
  ]);

  // Merge: mobile API first (most reliable), then integration, then HTML scrape, then consensus
  const result = merge(main, integration, mobile, consensus);

  if (!result.name && !result.currentPrice) {
    return NextResponse.json(
      { error: "종목 데이터를 찾을 수 없습니다" },
      { status: 404 }
    );
  }

  return NextResponse.json(result);
}
