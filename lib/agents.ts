import Anthropic from "@anthropic-ai/sdk";
import { StockInput, AgentOutput, DebateOutput, JudgeVerdict } from "./types";
import { parseAgentResponse } from "./parse-agent";

export const AGENTS = [
  {
    id: "warren_buffett",
    name: "Warren Buffett",
    persona: `당신은 워런 버핏(Warren Buffett)입니다. 당신의 투자 철학은 '경제적 해자(Economic Moat)', 꾸준한 창출 이익(ROE), 그리고 '안전 마진(Margin of Safety)'입니다. 단기적인 모멘텀이나 시장의 소음은 철저히 무시하고, 기업의 장기적인 내재가치 대비 현재가가 싼지(PER, PBR, 배당)에만 집중합니다. 주총에서 주주들에게 설명하듯 정중하고 단호하게 말하세요.`,
  },
  {
    id: "peter_lynch",
    name: "Peter Lynch",
    persona: `당신은 피터 린치(Peter Lynch)입니다. 당신의 투자 철학은 '생활 속의 발견'과 GARP(성장성 대비 저평가)입니다. 월스트리트의 복잡한 잣대보다 이 회사의 이익 성장 가능성, 턴어라운드 스토리, 애널리스트들이 놓치고 있는 현장의 모멘텀에 집중하세요. 친근하고 열정적인 톤으로, 왜 이 주식이 '10루타(Tenbagger)'가 될 수 있는지(혹은 안 되는지) 평가하세요.`,
  },
  {
    id: "william_oneil",
    name: "William O'Neil",
    persona: `당신은 윌리엄 오닐(William O'Neil)입니다. CAN SLIM 투자법의 창시자로서, 싸구려 주식을 바닥에서 줍지 않고 '비싸 보이는 주식을 더 비싸게' 사는 것을 선호합니다. 기관의 수급(외국인/기관 순매수)이 뒷받침되는지, 52주 신고가 근처에서 모멘텀을 타는지(가격 추세)를 가장 중요하게 봅니다. 펀더멘털은 모멘텀을 뒷받침하는 용도로만 씁니다. 날카롭고 수치 중심적으로 말하세요.`,
  },
  {
    id: "ray_dalio",
    name: "Ray Dalio",
    persona: `당신은 레이 달리오(Ray Dalio)입니다. 브리지워터의 창립자로서, 모든 자산은 거시 경제 메커니즘(Macro Machine)의 하위 요소로 봅니다. 원달러 환율, KOSPI 레벨, 시장 체제(Regime) 등 거시적 환경이 이 개별 종목의 수익 모델에 어떤 사이클적 영향을 미치는지 톱다운(Top-down) 방식으로 철저히 분석하세요. 기계적이고 원칙주의적인 어조로 말하세요.`,
  },
  {
    id: "benjamin_graham",
    name: "Benjamin Graham",
    persona: `당신은 벤저민 그레이엄(Benjamin Graham)입니다. 가치투자의 아버지로서, 기업의 장래성이나 스토리보다는 현재 장부상 가치(PBR, 청산가치), 배당수익률 등 철저히 '하방 안전성(Downside Protection)'에 집착합니다. PBR이 1보다 크거나 수치가 고평가되었다면 가차없이 매도를 외치고, 철저히 통계와 방어적 보수주의에 입각해 평가하세요. 학구적이고 엄격한 어조를 쓰세요.`,
  },
  {
    id: "stanley_druckenmiller",
    name: "Stanley Druckenmiller",
    persona: `당신은 스탠리 드러켄밀러(Stanley Druckenmiller)입니다. 당신은 밸류에이션(PER/PBR) 자체보다 "무엇이 주가를 움직이게 만들 촉매(Catalyst)인가?"에 집착합니다. 유동성 흐름, 뉴스/이슈 흐름, 트렌드의 변곡점을 읽어냅니다. 밸류가 비싸도 촉매가 강력하면 베팅하고, 싸도 모멘텀이 꺾이면 버립니다. 공격적이고 승부사적인 마인드로 팩트를 직설적으로 짚어내세요.`,
  },
  {
    id: "george_soros",
    name: "George Soros",
    persona: `당신은 조지 소로스(George Soros)입니다. 당신의 핵심 이론은 '재귀성(Reflexivity)'입니다. 주가가 펀더멘털을 반영하는 것이 아니라, 가짜 내러티브와 군중 심리가 주가를 만들고 그것이 다시 현실을 바꾼다고 믿습니다. 외국인 수급 변곡점, 공매도 비율, 뉴스에 대한 대중의 반응을 보며 거대한 붐/버스트 사이클의 어느 지점에 있는지 파악하세요. 철학적이고 통찰력 있는 톤으로 말하세요.`,
  },
  {
    id: "jim_simons",
    name: "Jim Simons",
    persona: `당신은 짐 사이먼스(Jim Simons)입니다. 르네상스 테크놀로지스의 창립자로, 스토리는 전혀 믿지 않고 오직 데이터의 '패턴과 통계적 편차'만 봅니다. 애널리스트 목표가의 분산(최고가 vs 최저가), 매수/매도 비율의 불균형, 현재 주가와 1M/3M 변동률 사이의 통계적 이격 등 순수 수학적 관점에서 승률(Probability)을 계산합니다. 감정을 완전히 배제한 분석가처럼 말하세요.`,
  },
];

function buildStockContext(stock: StockInput): string {
  const lines: string[] = [
    `종목: ${stock.name} (${stock.ticker})`,
    `현재가: ${stock.currentPrice.toLocaleString()}원`,
    `52주: ${stock.week52Low.toLocaleString()}~${stock.week52High.toLocaleString()}원`,
  ];

  if (stock.priceChange1M != null || stock.priceChange3M != null) {
    const parts: string[] = [];
    if (stock.priceChange1M != null) parts.push(`1개월 ${stock.priceChange1M}%`);
    if (stock.priceChange3M != null) parts.push(`3개월 ${stock.priceChange3M}%`);
    lines.push(`최근: ${parts.join(" / ")}`);
  }

  lines.push(
    "",
    `밸류에이션: PBR ${stock.pbr}x / PER ${stock.per}x / ROE ${stock.roe}% / 배당 ${stock.dividendYield}%`,
    "",
    `애널리스트: 매수 ${stock.buyRatings} / 중립 ${stock.holdRatings} / 매도 ${stock.sellRatings}`,
    `평균 목표가: ${stock.avgTargetPrice.toLocaleString()}원 (최고 ${stock.highTargetPrice.toLocaleString()} / 최저 ${stock.lowTargetPrice.toLocaleString()})`,
    "",
  );

  const flowParts = [`외국인 보유 ${stock.foreignHoldingPct}%`];
  if (stock.foreignNetBuy3D != null) flowParts.push(`3일 순매수 ${stock.foreignNetBuy3D}억원`);
  if (stock.shortInterestPct != null) flowParts.push(`공매도 ${stock.shortInterestPct}%`);
  lines.push(`수급: ${flowParts.join(" / ")}`);

  if (stock.regimeContext) {
    lines.push("", `시장 환경: ${stock.regimeContext}`);
  }

  if (stock.newsContext) {
    lines.push("", `최근 뉴스:`, stock.newsContext);
  }

  lines.push("", `메모: ${stock.notes || "없음"}`);

  return lines.join("\n");
}

function buildPhase1Prompt(persona: string, stock: StockInput): string {
  return `${persona}

${buildStockContext(stock)}

[중요 지시사항]
당신은 방금 부여받은 '전설적인 투자자의 페르소나와 고유의 투자 철학'을 반드시 고수해야 합니다.
다른 투자자들의 스타일에 타협하지 마시고, 당신만의 철학적 기준에 부합하는지에 따라 확률을 엄격하게 평가하세요.

질문: 당신의 고유한 투자 철학 렌즈로 보았을 때, 이 주식이 향후 3개월 내 현재가 대비 10% 이상 상승할 확률(0-100)?

JSON만 반환:
{"signal": "bullish 또는 bearish 또는 neutral", "probability": 숫자, "reasoning": "2-3문장 당신의 페르소나 톤앤매너로 작성된 핵심 근거"}`;
}

function buildBullAdvocatePrompt(
  stock: StockInput,
  bullishOutputs: AgentOutput[],
  bearishOutputs: AgentOutput[]
): string {
  const bullSummary = bullishOutputs
    .map((o) => `[${o.name}] ${o.probability}% — ${o.reasoning}`)
    .join("\n");
  const bearSummary = bearishOutputs
    .map((o) => `[${o.name}] ${o.probability}% — ${o.reasoning}`)
    .join("\n");

  return `당신은 Bull Advocate(강세 변호사)입니다. ${stock.name} (${stock.ticker})에 대한 투자 논쟁에서 강세 측을 대변합니다.

${buildStockContext(stock)}

=== 강세 분석가들의 의견 ===
${bullSummary || "(강세 분석가 없음 — 당신이 가능한 강세 논거를 직접 구성하세요)"}

=== 약세 분석가들의 의견 ===
${bearSummary || "(약세 분석가 없음)"}

[임무]
1. 위 강세 분석들을 종합하여 가장 강력한 매수 논거를 3-5문장으로 구성하세요.
2. 약세 측 주장을 직접 반박하세요. 그들의 논리에서 약점을 찾아내세요.
3. 핵심 포인트를 불릿으로 요약하세요.

JSON만 반환:
{"argument": "3-5문장의 종합 강세 논거 + 약세 반박", "keyPoints": "• 포인트1\\n• 포인트2\\n• 포인트3"}`;
}

function buildBearAdvocatePrompt(
  stock: StockInput,
  bearishOutputs: AgentOutput[],
  bullishOutputs: AgentOutput[]
): string {
  const bearSummary = bearishOutputs
    .map((o) => `[${o.name}] ${o.probability}% — ${o.reasoning}`)
    .join("\n");
  const bullSummary = bullishOutputs
    .map((o) => `[${o.name}] ${o.probability}% — ${o.reasoning}`)
    .join("\n");

  return `당신은 Bear Advocate(약세 변호사)입니다. ${stock.name} (${stock.ticker})에 대한 투자 논쟁에서 약세 측을 대변합니다.

${buildStockContext(stock)}

=== 약세 분석가들의 의견 ===
${bearSummary || "(약세 분석가 없음 — 당신이 가능한 약세 논거를 직접 구성하세요)"}

=== 강세 분석가들의 의견 ===
${bullSummary || "(강세 분석가 없음)"}

[임무]
1. 위 약세 분석들을 종합하여 가장 강력한 리스크/매도 논거를 3-5문장으로 구성하세요.
2. 강세 측 주장을 직접 반박하세요. 그들의 논리에서 약점을 찾아내세요.
3. 핵심 포인트를 불릿으로 요약하세요.

JSON만 반환:
{"argument": "3-5문장의 종합 약세 논거 + 강세 반박", "keyPoints": "• 포인트1\\n• 포인트2\\n• 포인트3"}`;
}

function buildJudgePrompt(
  stock: StockInput,
  phase1Outputs: AgentOutput[],
  bullArgument: DebateOutput,
  bearArgument: DebateOutput
): string {
  const analysesSummary = phase1Outputs
    .map((o) => `[${o.name}] ${o.signal} ${o.probability}% — ${o.reasoning}`)
    .join("\n");

  return `당신은 Chairman Judge(의장 심판)입니다. 8명의 전설적인 투자자들의 독립 분석과 Bull/Bear 변호사들의 논쟁을 모두 검토한 후, ${stock.name} (${stock.ticker})에 대한 최종 판결을 내립니다.

${buildStockContext(stock)}

=== Phase 1: 8명의 독립 분석 ===
${analysesSummary}

=== Phase 2: Bull Advocate 주장 ===
${bullArgument.argument}
핵심 포인트:
${bullArgument.keyPoints}

=== Phase 2: Bear Advocate 주장 ===
${bearArgument.argument}
핵심 포인트:
${bearArgument.keyPoints}

[중요 지시사항]
- 모든 증거를 종합하여 최종 판결을 내리세요.
- MONITOR를 안전한 타협안으로 선택하지 마세요. 증거가 한 방향을 가리키면 그 방향으로 판결하세요.
- 반대 의견(dissent)에서 가장 강력한 반론을 인정하세요 — 이것이 판결의 신뢰도를 높입니다.
- confidence는 판결에 대한 확신 수준(0-100)입니다. 증거가 명확할수록 높게, 양쪽이 팽팽하면 낮게.

질문: 이 주식이 향후 3개월 내 현재가 대비 10% 이상 상승할 확률은?

JSON만 반환:
{"probability": 숫자, "signal": "BUY 또는 CAUTION 또는 MONITOR", "reasoning": "3-5문장의 최종 판결 근거", "dissent": "가장 강력한 반론 1-2문장", "confidence": 숫자}`;
}

function classifySignal(probability: number): "bullish" | "bearish" | "neutral" {
  if (probability >= 60) return "bullish";
  if (probability < 40) return "bearish";
  return "neutral";
}

function parseDebateResponse(raw: string): { argument: string; keyPoints: string } {
  let text = raw.replace(/```json/gi, "").replace(/```/g, "").trim();

  try {
    const obj = JSON.parse(text);
    return {
      argument: String(obj.argument || "논거 없음"),
      keyPoints: String(obj.keyPoints || ""),
    };
  } catch {
    // Try to find JSON in text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const obj = JSON.parse(jsonMatch[0]);
        return {
          argument: String(obj.argument || "논거 없음"),
          keyPoints: String(obj.keyPoints || ""),
        };
      } catch {
        // fall through
      }
    }
    return { argument: text, keyPoints: "" };
  }
}

function parseJudgeResponse(raw: string): {
  probability: number;
  signal: "BUY" | "CAUTION" | "MONITOR";
  reasoning: string;
  dissent: string;
  confidence: number;
} {
  let text = raw.replace(/```json/gi, "").replace(/```/g, "").trim();

  const defaults = {
    probability: 50,
    signal: "MONITOR" as const,
    reasoning: "판결 근거 없음",
    dissent: "반론 없음",
    confidence: 50,
  };

  try {
    const obj = JSON.parse(text);
    return {
      probability: Math.max(0, Math.min(100, Number(obj.probability) || 50)),
      signal: (["BUY", "CAUTION", "MONITOR"].includes(obj.signal) ? obj.signal : "MONITOR") as "BUY" | "CAUTION" | "MONITOR",
      reasoning: String(obj.reasoning || defaults.reasoning),
      dissent: String(obj.dissent || defaults.dissent),
      confidence: Math.max(0, Math.min(100, Number(obj.confidence) || 50)),
    };
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const obj = JSON.parse(jsonMatch[0]);
        return {
          probability: Math.max(0, Math.min(100, Number(obj.probability) || 50)),
          signal: (["BUY", "CAUTION", "MONITOR"].includes(obj.signal) ? obj.signal : "MONITOR") as "BUY" | "CAUTION" | "MONITOR",
          reasoning: String(obj.reasoning || defaults.reasoning),
          dissent: String(obj.dissent || defaults.dissent),
          confidence: Math.max(0, Math.min(100, Number(obj.confidence) || 50)),
        };
      } catch {
        // fall through
      }
    }
    return defaults;
  }
}

export interface SwarmResult {
  phase1: AgentOutput[];
  debate: { bull: DebateOutput; bear: DebateOutput };
  verdict: JudgeVerdict;
}

export async function runSwarm(
  stock: StockInput,
  onAgentComplete?: (output: AgentOutput) => void,
  onDebateComplete?: (output: DebateOutput) => void,
  onVerdictComplete?: (verdict: JudgeVerdict) => void
): Promise<SwarmResult> {
  const client = new Anthropic();

  // Phase 1: All agents analyze independently in parallel
  const phase1 = await Promise.all(
    AGENTS.map(async (agent) => {
      const persona = stock.evolvedPersonas?.[agent.id] || agent.persona;
      const res = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        messages: [
          { role: "user", content: buildPhase1Prompt(persona, stock) },
        ],
      });
      const parsed = parseAgentResponse(
        (res.content[0] as { type: "text"; text: string }).text
      );
      const prob = Math.max(0, Math.min(100, parsed.probability));
      const output: AgentOutput = {
        agentId: agent.id,
        name: agent.name,
        probability: prob,
        reasoning: parsed.reasoning,
        round: 1,
        signal: classifySignal(prob),
      };
      onAgentComplete?.(output);
      return output;
    })
  );

  // Classify into camps
  const bullishOutputs = phase1.filter((o) => o.signal === "bullish");
  const bearishOutputs = phase1.filter((o) => o.signal === "bearish");
  const neutralOutputs = phase1.filter((o) => o.signal === "neutral");

  // Phase 2: Adversarial Debate (Bull & Bear advocates in parallel)
  const [bullRes, bearRes] = await Promise.all([
    client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: buildBullAdvocatePrompt(stock, [...bullishOutputs, ...neutralOutputs], bearishOutputs),
        },
      ],
    }),
    client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: buildBearAdvocatePrompt(stock, [...bearishOutputs, ...neutralOutputs], bullishOutputs),
        },
      ],
    }),
  ]);

  const bullParsed = parseDebateResponse(
    (bullRes.content[0] as { type: "text"; text: string }).text
  );
  const bullDebate: DebateOutput = {
    side: "bull",
    argument: bullParsed.argument,
    keyPoints: bullParsed.keyPoints,
    round: 2,
  };
  onDebateComplete?.(bullDebate);

  const bearParsed = parseDebateResponse(
    (bearRes.content[0] as { type: "text"; text: string }).text
  );
  const bearDebate: DebateOutput = {
    side: "bear",
    argument: bearParsed.argument,
    keyPoints: bearParsed.keyPoints,
    round: 2,
  };
  onDebateComplete?.(bearDebate);

  // Phase 3: Judge renders final verdict
  const judgeRes = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: buildJudgePrompt(stock, phase1, bullDebate, bearDebate),
      },
    ],
  });

  const judgeParsed = parseJudgeResponse(
    (judgeRes.content[0] as { type: "text"; text: string }).text
  );
  const verdict: JudgeVerdict = {
    probability: judgeParsed.probability,
    signal: judgeParsed.signal,
    reasoning: judgeParsed.reasoning,
    dissent: judgeParsed.dissent,
    confidence: judgeParsed.confidence,
    round: 3,
  };
  onVerdictComplete?.(verdict);

  return {
    phase1,
    debate: { bull: bullDebate, bear: bearDebate },
    verdict,
  };
}
