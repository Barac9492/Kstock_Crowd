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
  { ticker: "042700", name: "한미반도체", sector: "반도체" },

  // Internet/Platform
  { ticker: "035420", name: "NAVER", sector: "인터넷" },
  { ticker: "035720", name: "카카오", sector: "인터넷" },

  // Auto
  { ticker: "005380", name: "현대차", sector: "자동차" },
  { ticker: "000270", name: "기아", sector: "자동차" },
  { ticker: "012330", name: "현대모비스", sector: "자동차" },

  // Battery/Energy
  { ticker: "373220", name: "LG에너지솔루션", sector: "배터리" },
  { ticker: "006400", name: "삼성SDI", sector: "배터리" },
  { ticker: "051910", name: "LG화학", sector: "배터리" },
  { ticker: "096770", name: "SK이노베이션", sector: "배터리" },
  { ticker: "042700", name: "한미반도체", sector: "배터리" }, // actually semi, but expanded

  // Bio/Pharma
  { ticker: "068270", name: "셀트리온", sector: "바이오" },
  { ticker: "207940", name: "삼성바이오로직스", sector: "바이오" },
  { ticker: "000100", name: "유한양행", sector: "바이오" },

  // Financial
  { ticker: "105560", name: "KB금융", sector: "금융" },
  { ticker: "055550", name: "신한지주", sector: "금융" },
  { ticker: "086790", name: "하나금융지주", sector: "금융" },
  { ticker: "316140", name: "우리금융지주", sector: "금융" },
  { ticker: "032830", name: "삼성생명", sector: "금융" },

  // Defense/Shipbuilding
  { ticker: "012450", name: "한화에어로스페이스", sector: "조선/방산" },
  { ticker: "329180", name: "HD현대중공업", sector: "조선/방산" },
  { ticker: "047050", name: "포스코인터내셔널", sector: "소재" },

  // Steel/Materials
  { ticker: "005490", name: "POSCO홀딩스", sector: "소재" },
  { ticker: "010130", name: "고려아연", sector: "소재" },

  // Tech Hardware/Electronics
  { ticker: "066570", name: "LG전자", sector: "전자" },
  { ticker: "009150", name: "삼성전기", sector: "전자" },

  // Telecom
  { ticker: "017670", name: "SK텔레콤", sector: "통신" },
  { ticker: "030200", name: "KT", sector: "통신" },

  // Gaming/Entertainment
  { ticker: "259960", name: "크래프톤", sector: "게임" },
  { ticker: "036570", name: "엔씨소프트", sector: "게임" },

  // Consumer
  { ticker: "090430", name: "아모레퍼시픽", sector: "소비재" },
  { ticker: "033780", name: "KT&G", sector: "소비재" },
];

export const SECTORS = [...new Set(UNIVERSE.map((s) => s.sector))];

export function getStocksBySection(sector: string): UniverseStock[] {
  return UNIVERSE.filter((s) => s.sector === sector);
}
