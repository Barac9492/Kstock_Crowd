import Anthropic from "@anthropic-ai/sdk";
import { StockInput, AgentOutput } from "./types";

export const AGENTS = [
  {
    id: "value_investor",
    name: "가치투자자",
    persona: `당신은 가치투자자입니다. PBR, PER, ROE, 배당수익률의 역사적 평균 대비 현재 수준만으로 판단합니다. 수급과 뉴스는 노이즈입니다. 구체적인 수치를 반드시 언급하세요.`,
  },
  {
    id: "momentum_trader",
    name: "모멘텀 트레이더",
    persona: `당신은 모멘텀 트레이더입니다. 외국인/기관 수급 방향, 최근 가격 추세, 거래량만 봅니다. 펀더멘털은 나중 문제입니다.`,
  },
  {
    id: "short_seller",
    name: "공매도 헤지펀드",
    persona: `당신은 공매도 전문가입니다. 항상 하방 리스크, 과대평가, 숨겨진 위험을 먼저 찾습니다. 낙관론에 의심을 품습니다.`,
  },
  {
    id: "retail_sentiment",
    name: "개미 심리 분석가",
    persona: `당신은 한국 개인투자자 집단 심리 전문가입니다. 개미들이 이 주식에 어떻게 반응할지, 커뮤니티 분위기가 어떤지 예측합니다.`,
  },
  {
    id: "macro_economist",
    name: "매크로 이코노미스트",
    persona: `당신은 거시경제 전문가입니다. Fed 금리, 원달러 환율, 미중 갈등, 글로벌 반도체 사이클이 이 주식에 미치는 영향을 분석합니다.`,
  },
  {
    id: "sector_specialist",
    name: "섹터 스페셜리스트",
    persona: `당신은 해당 섹터 전문가입니다. 경쟁사 대비 포지셔닝, 업황 사이클, 기술 트렌드 관점에서 분석합니다.`,
  },
  {
    id: "foreign_institutional",
    name: "외국인 기관",
    persona: `당신은 한국 주식에 투자하는 글로벌 패시브/액티브 기관입니다. MSCI 리밸런싱, ETF 수급, 외국인 보유율 변화를 중심으로 판단합니다.`,
  },
  {
    id: "risk_manager",
    name: "리스크 매니저",
    persona: `당신은 리스크 관리 전문가입니다. 손절 기준, 최악 시나리오, 포지션 사이즈 관점에서만 생각합니다. 업사이드보다 다운사이드를 먼저 봅니다.`,
  },
];

function buildPrompt(
  persona: string,
  stock: StockInput,
  priorOutputs?: AgentOutput[]
): string {
  const priorContext = priorOutputs
    ? `\n다른 분석가들의 의견:\n${priorOutputs.map((o) => `[${o.name}] ${o.probability}% — ${o.reasoning}`).join("\n")}\n\n위 의견 참고 후 당신의 관점으로 최종 판단하세요.`
    : "";

  const lines: string[] = [
    persona,
    "",
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

  lines.push("", `메모: ${stock.notes || "없음"}`);

  return `${lines.join("\n")}
${priorContext}

질문: 향후 3개월 내 현재가 대비 10% 이상 상승할 확률(0-100)?

JSON만 반환:
{"probability": 숫자, "reasoning": "2-3문장 한국어 핵심 근거"}`;
}

export async function runSwarm(
  stock: StockInput,
  onAgentComplete?: (output: AgentOutput) => void
): Promise<AgentOutput[]> {
  const client = new Anthropic();

  // Round 1: All agents in parallel
  const round1 = await Promise.all(
    AGENTS.map(async (agent) => {
      const res = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        messages: [
          { role: "user", content: buildPrompt(agent.persona, stock) },
        ],
      });
      const parsed = JSON.parse(
        (res.content[0] as { type: "text"; text: string }).text
          .replace(/```json|```/g, "")
          .trim()
      );
      const output: AgentOutput = {
        agentId: agent.id,
        name: agent.name,
        probability: Math.max(0, Math.min(100, parsed.probability)),
        reasoning: parsed.reasoning,
        round: 1,
      };
      onAgentComplete?.(output);
      return output;
    })
  );

  // Round 2: Each agent sees the others' Round 1 outputs
  const round2 = await Promise.all(
    AGENTS.map(async (agent) => {
      const otherOutputs = round1.filter((o) => o.agentId !== agent.id);
      const res = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: buildPrompt(agent.persona, stock, otherOutputs),
          },
        ],
      });
      const parsed = JSON.parse(
        (res.content[0] as { type: "text"; text: string }).text
          .replace(/```json|```/g, "")
          .trim()
      );
      const output: AgentOutput = {
        agentId: agent.id,
        name: agent.name,
        probability: Math.max(0, Math.min(100, parsed.probability)),
        reasoning: parsed.reasoning,
        round: 2,
      };
      onAgentComplete?.(output);
      return output;
    })
  );

  return round2;
}
