export interface UniverseStock {
  ticker: string;
  name: string;
  sector: string;
}

export const UNIVERSE: UniverseStock[] = [
  // IT / Semiconductors
  { ticker: "005930", name: "삼성전자", sector: "IT/반도체" },
  { ticker: "000660", name: "SK하이닉스", sector: "IT/반도체" },
  { ticker: "042700", name: "한미반도체", sector: "IT/반도체" },
  { ticker: "272210", name: "한화시스템", sector: "IT/반도체" },
  { ticker: "009150", name: "삼성전기", sector: "IT/반도체" },
  { ticker: "066570", name: "LG전자", sector: "IT/반도체" },
  { ticker: "018260", name: "삼성SDS", sector: "IT/반도체" },
  { ticker: "011070", name: "LG이노텍", sector: "IT/반도체" },
  { ticker: "034220", name: "LG디스플레이", sector: "IT/반도체" },
  { ticker: "240810", name: "원익IPS", sector: "IT/반도체" },
  { ticker: "036540", name: "SFA반도체", sector: "IT/반도체" },
  { ticker: "271560", name: "오리온", sector: "IT/반도체" },
  { ticker: "108320", name: "LX세미콘", sector: "IT/반도체" },
  { ticker: "095660", name: "네오위즈", sector: "IT/반도체" },
  { ticker: "036830", name: "솔브레인", sector: "IT/반도체" },

  // Internet/Games/Media
  { ticker: "035420", name: "NAVER", sector: "플랫폼/게임" },
  { ticker: "035720", name: "카카오", sector: "플랫폼/게임" },
  { ticker: "259960", name: "크래프톤", sector: "플랫폼/게임" },
  { ticker: "036570", name: "엔씨소프트", sector: "플랫폼/게임" },
  { ticker: "352820", name: "하이브", sector: "플랫폼/게임" },
  { ticker: "018250", name: "현대코퍼레이션", sector: "플랫폼/게임" },
  { ticker: "377300", name: "카카오페이", sector: "플랫폼/게임" },
  { ticker: "323410", name: "카카오뱅크", sector: "플랫폼/게임" },
  { ticker: "251270", name: "넷마블", sector: "플랫폼/게임" },
  { ticker: "112040", name: "위메이드", sector: "플랫폼/게임" },

  // Autos & Parts
  { ticker: "005380", name: "현대차", sector: "자동차" },
  { ticker: "000270", name: "기아", sector: "자동차" },
  { ticker: "012330", name: "현대모비스", sector: "자동차" },
  { ticker: "000120", name: "CJ대한통운", sector: "자동차" },
  { ticker: "316140", name: "우리금융지주", sector: "자동차" },
  { ticker: "018880", name: "한온시스템", sector: "자동차" },
  { ticker: "028670", name: "팬오션", sector: "자동차" },
  { ticker: "004020", name: "현대제철", sector: "자동차" },
  { ticker: "011210", name: "현대위아", sector: "자동차" },
  
  // Batteries / Chemicals / Energy
  { ticker: "373220", name: "LG에너지솔루션", sector: "2차전지/화학" },
  { ticker: "006400", name: "삼성SDI", sector: "2차전지/화학" },
  { ticker: "051910", name: "LG화학", sector: "2차전지/화학" },
  { ticker: "096770", name: "SK이노베이션", sector: "2차전지/화학" },
  { ticker: "247540", name: "에코프로비엠", sector: "2차전지/화학" },
  { ticker: "003670", name: "포스코퓨처엠", sector: "2차전지/화학" },
  { ticker: "086520", name: "에코프로", sector: "2차전지/화학" },
  { ticker: "010950", name: "S-Oil", sector: "2차전지/화학" },
  { ticker: "011790", name: "SKC", sector: "2차전지/화학" },
  { ticker: "005830", name: "DB손해보험", sector: "2차전지/화학" },
  { ticker: "066970", name: "엘앤에프", sector: "2차전지/화학" },

  // Bio / Healthcare
  { ticker: "207940", name: "삼성바이오로직스", sector: "바이오/헬스케어" },
  { ticker: "068270", name: "셀트리온", sector: "바이오/헬스케어" },
  { ticker: "000100", name: "유한양행", sector: "바이오/헬스케어" },
  { ticker: "068240", name: "다원시스", sector: "바이오/헬스케어" },
  { ticker: "096530", name: "씨젠", sector: "바이오/헬스케어" },
  { ticker: "128940", name: "한미약품", sector: "바이오/헬스케어" },
  { ticker: "019170", name: "신풍제약", sector: "바이오/헬스케어" },
  { ticker: "278280", name: "천보", sector: "바이오/헬스케어" },
  { ticker: "008560", name: "메리츠증권", sector: "바이오/헬스케어" },
  { ticker: "001450", name: "현대해상", sector: "바이오/헬스케어" },
  
  // Finance / Holdings
  { ticker: "105560", name: "KB금융", sector: "금융/지주" },
  { ticker: "055550", name: "신한지주", sector: "금융/지주" },
  { ticker: "086790", name: "하나금융지주", sector: "금융/지주" },
  { ticker: "316140", name: "우리금융지주", sector: "금융/지주" },
  { ticker: "032830", name: "삼성생명", sector: "금융/지주" },
  { ticker: "000810", name: "삼성화재", sector: "금융/지주" },
  { ticker: "024110", name: "기업은행", sector: "금융/지주" },
  { ticker: "138040", name: "메리츠금융지주", sector: "금융/지주" },
  { ticker: "377300", name: "카카오페이", sector: "금융/지주" },
  { ticker: "000030", name: "우리은행", sector: "금융/지주" },
  { ticker: "016360", name: "삼성증권", sector: "금융/지주" },
  { ticker: "001040", name: "CJ", sector: "금융/지주" },
  { ticker: "000150", name: "두산", sector: "금융/지주" },
  { ticker: "034730", name: "SK", sector: "금융/지주" },

  // Industrials / Defense / Shipbuilding
  { ticker: "012450", name: "한화에어로스페이스", sector: "산업재/방산" },
  { ticker: "329180", name: "HD현대중공업", sector: "산업재/방산" },
  { ticker: "047050", name: "포스코인터내셔널", sector: "산업재/방산" },
  { ticker: "042660", name: "한화오션", sector: "산업재/방산" },
  { ticker: "010140", name: "삼성중공업", sector: "산업재/방산" },
  { ticker: "004020", name: "현대제철", sector: "산업재/방산" },
  { ticker: "267250", name: "HD현대", sector: "산업재/방산" },
  { ticker: "028670", name: "팬오션", sector: "산업재/방산" },
  { ticker: "034020", name: "두산에너빌리티", sector: "산업재/방산" },
  { ticker: "000720", name: "현대건설", sector: "산업재/방산" },
  { ticker: "006360", name: "GS건설", sector: "산업재/방산" },

  // Materials / Steel
  { ticker: "005490", name: "POSCO홀딩스", sector: "소재/철강" },
  { ticker: "010130", name: "고려아연", sector: "소재/철강" },
  { ticker: "004020", name: "현대제철", sector: "소재/철강" },
  { ticker: "011780", name: "금호석유", sector: "소재/철강" },
  { ticker: "001120", name: "LS", sector: "소재/철강" },
  { ticker: "002380", name: "KCC", sector: "소재/철강" },

  // Consumer / Retail / Cosmetics
  { ticker: "090430", name: "아모레퍼시픽", sector: "소비재" },
  { ticker: "033780", name: "KT&G", sector: "소비재" },
  { ticker: "051900", name: "LG생활건강", sector: "소비재" },
  { ticker: "023530", name: "롯데쇼핑", sector: "소비재" },
  { ticker: "139480", name: "이마트", sector: "소비재" },
  { ticker: "028260", name: "삼성물산", sector: "소비재" },
  { ticker: "271560", name: "오리온", sector: "소비재" },
  { ticker: "002790", name: "아모레G", sector: "소비재" },
  { ticker: "018250", name: "에스원", sector: "소비재" },
  { ticker: "097520", name: "엠씨넥스", sector: "소비재" },

  // Telecom / Utilities
  { ticker: "017670", name: "SK텔레콤", sector: "통신/유틸리티" },
  { ticker: "030200", name: "KT", sector: "통신/유틸리티" },
  { ticker: "032640", name: "LG유플러스", sector: "통신/유틸리티" },
  { ticker: "015760", name: "한국전력", sector: "통신/유틸리티" },
  { ticker: "036460", name: "한국가스공사", sector: "통신/유틸리티" },
];

export const SECTORS = [...new Set(UNIVERSE.map((s) => s.sector))];

export function getStocksBySection(sector: string): UniverseStock[] {
  return UNIVERSE.filter((s) => s.sector === sector);
}
