import * as cheerio from "cheerio";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export interface MarketRegimeData {
  kospiLevel: number;
  kospiChange1D: number;
  kospiMa20: number | null;
  kospiVsMa: number | null; // % above/below 20-day MA
  usdkrw: number;
  usdkrwChange1D: number;
  regime: "risk-on" | "risk-off" | "neutral";
  label: string;
  signals: string[];
  fetchedAt: string;
}

/**
 * Fetch KOSPI index data from Naver Finance.
 */
async function fetchKospi(): Promise<{
  level: number;
  change1D: number;
  // Naver doesn't expose 20MA directly, so we estimate
}> {
  try {
    const res = await fetch(
      "https://m.stock.naver.com/api/index/KOSPI/basic",
      { headers: { "User-Agent": UA }, next: { revalidate: 0 } }
    );
    if (!res.ok) return { level: 0, change1D: 0 };
    const json = await res.json();

    const level = parseFloat(String(json.closePrice || "0").replace(/,/g, ""));
    const change = parseFloat(
      String(json.compareToPreviousClosePrice || "0").replace(/,/g, "")
    );
    const changePct =
      level > 0 ? Math.round((change / (level - change)) * 1000) / 10 : 0;

    return { level, change1D: changePct };
  } catch {
    return { level: 0, change1D: 0 };
  }
}

/**
 * Estimate KOSPI 20-day MA from price history.
 */
async function fetchKospiMa20(): Promise<number | null> {
  try {
    const res = await fetch(
      "https://m.stock.naver.com/api/index/KOSPI/price?pageSize=20&page=1",
      { headers: { "User-Agent": UA }, next: { revalidate: 0 } }
    );
    if (!res.ok) return null;
    const json = await res.json();

    if (!Array.isArray(json) || json.length === 0) return null;

    let sum = 0;
    let count = 0;
    for (const day of json) {
      const price = parseFloat(
        String(day.closePrice || "0").replace(/,/g, "")
      );
      if (price > 0) {
        sum += price;
        count++;
      }
    }

    return count > 0 ? Math.round((sum / count) * 100) / 100 : null;
  } catch {
    return null;
  }
}

/**
 * Fetch USD/KRW exchange rate from Naver.
 */
async function fetchUsdKrw(): Promise<{
  rate: number;
  change1D: number;
}> {
  try {
    const res = await fetch(
      "https://m.stock.naver.com/api/exchange/FX_USDKRW/basic",
      { headers: { "User-Agent": UA }, next: { revalidate: 0 } }
    );
    if (!res.ok) return { rate: 0, change1D: 0 };
    const json = await res.json();

    const rate = parseFloat(
      String(json.closePrice || "0").replace(/,/g, "")
    );
    const change = parseFloat(
      String(json.compareToPreviousClosePrice || "0").replace(/,/g, "")
    );
    const changePct =
      rate > 0 ? Math.round((change / (rate - change)) * 1000) / 10 : 0;

    return { rate, change1D: changePct };
  } catch {
    return { rate: 0, change1D: 0 };
  }
}

/**
 * Classify market regime based on indicators.
 */
export function classifyRegime(data: {
  kospiLevel: number;
  kospiMa20: number | null;
  usdkrw: number;
}): { regime: "risk-on" | "risk-off" | "neutral"; signals: string[] } {
  const signals: string[] = [];
  let riskScore = 0; // Positive = risk-on, negative = risk-off

  // KOSPI vs 20MA
  if (data.kospiMa20 && data.kospiLevel > 0) {
    const vsMa =
      ((data.kospiLevel - data.kospiMa20) / data.kospiMa20) * 100;
    if (vsMa > 2) {
      riskScore += 1;
      signals.push(`KOSPI 20일 MA 위 (+${vsMa.toFixed(1)}%)`);
    } else if (vsMa < -2) {
      riskScore -= 1;
      signals.push(`KOSPI 20일 MA 아래 (${vsMa.toFixed(1)}%)`);
    } else {
      signals.push(`KOSPI 20일 MA 근접 (${vsMa.toFixed(1)}%)`);
    }
  }

  // USD/KRW level (>1350 = stress, <1300 = calm)
  if (data.usdkrw > 0) {
    if (data.usdkrw > 1400) {
      riskScore -= 2;
      signals.push(`원달러 ${data.usdkrw}원 (고환율 스트레스)`);
    } else if (data.usdkrw > 1350) {
      riskScore -= 1;
      signals.push(`원달러 ${data.usdkrw}원 (약간 스트레스)`);
    } else if (data.usdkrw < 1250) {
      riskScore += 1;
      signals.push(`원달러 ${data.usdkrw}원 (안정적)`);
    } else {
      signals.push(`원달러 ${data.usdkrw}원 (중립)`);
    }
  }

  const regime: "risk-on" | "risk-off" | "neutral" =
    riskScore >= 2 ? "risk-on" : riskScore <= -2 ? "risk-off" : "neutral";

  return { regime, signals };
}

/**
 * Fetch all market data and classify regime.
 */
export async function fetchMarketRegime(): Promise<MarketRegimeData> {
  const [kospi, kospiMa20, usdkrw] = await Promise.all([
    fetchKospi(),
    fetchKospiMa20(),
    fetchUsdKrw(),
  ]);

  const kospiVsMa =
    kospiMa20 && kospi.level > 0
      ? Math.round(((kospi.level - kospiMa20) / kospiMa20) * 1000) / 10
      : null;

  const { regime, signals } = classifyRegime({
    kospiLevel: kospi.level,
    kospiMa20,
    usdkrw: usdkrw.rate,
  });

  const labels = {
    "risk-on": "🟢 Risk-On",
    "risk-off": "🔴 Risk-Off",
    neutral: "🟡 Neutral",
  };

  return {
    kospiLevel: kospi.level,
    kospiChange1D: kospi.change1D,
    kospiMa20,
    kospiVsMa,
    usdkrw: usdkrw.rate,
    usdkrwChange1D: usdkrw.change1D,
    regime,
    label: labels[regime],
    signals,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Get adjusted signal thresholds based on regime.
 */
export function getAdjustedThresholds(regime: "risk-on" | "risk-off" | "neutral") {
  switch (regime) {
    case "risk-on":
      return { buyThreshold: 12, cautionThreshold: -12 }; // More aggressive
    case "risk-off":
      return { buyThreshold: 20, cautionThreshold: -20 }; // More conservative
    default:
      return { buyThreshold: 15, cautionThreshold: -15 }; // Default
  }
}
