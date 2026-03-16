/**
 * Curated Korean stock universe — focused watchlist of key blue-chips.
 * Keep this tight to manage API costs (~16 Anthropic calls per stock).
 */

export interface UniverseStock {
  ticker: string;
  name: string;
  sector: string;
}

export const UNIVERSE: UniverseStock[] = [
  // Semiconductors
  { ticker: "005930", name: "삼성전자", sector: "반도체" },
  { ticker: "000660", name: "SK하이닉스", sector: "반도체" },

  // Internet/Platform
  { ticker: "035420", name: "네이버", sector: "인터넷" },
  { ticker: "035720", name: "카카오", sector: "인터넷" },

  // Auto
  { ticker: "005380", name: "현대차", sector: "자동차" },
  { ticker: "000270", name: "기아", sector: "자동차" },

  // Battery/Energy
  { ticker: "373220", name: "LG에너지솔루션", sector: "배터리" },
  { ticker: "006400", name: "삼성SDI", sector: "배터리" },

  // Bio/Pharma
  { ticker: "068270", name: "셀트리온", sector: "바이오" },

  // Steel/Materials
  { ticker: "005490", name: "POSCO홀딩스", sector: "소재" },
];

export const SECTORS = [...new Set(UNIVERSE.map((s) => s.sector))];

export function getStocksBySection(sector: string): UniverseStock[] {
  return UNIVERSE.filter((s) => s.sector === sector);
}
