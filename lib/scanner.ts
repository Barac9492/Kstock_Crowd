import { StockInput, AgentOutput, ConsensusResult } from "./types";
import { computeConsensus } from "./consensus";
import { AGENTS } from "./agents";
import Anthropic from "@anthropic-ai/sdk";
import { parseAgentResponse } from "./parse-agent";

export interface ScanResult {
  stock: StockInput;
  outputs: AgentOutput[];
  consensus: ConsensusResult;
  rank: number;
  score: number; // |alphaGap| × conviction / 100
}

export interface ScanProgress {
  currentTicker: string;
  currentName: string;
  currentIndex: number;
  totalStocks: number;
  phase: "fetching_data" | "running_swarm" | "done";
  result?: ScanResult;
}

/**
 * Build agent prompt — same as agents.ts but server-side.
 */
function buildPrompt(
  persona: string,
  stock: StockInput,
  priorOutputs?: AgentOutput[]
): string {
  const priorContext = priorOutputs
    ? `\n다른 분석가들의 의견:\n${priorOutputs.map((o) => `[${o.name}] ${o.probability}% — ${o.reasoning}`).join("\n")}\n\n위 의견 참고 후 당신의 관점으로 최종 판단하세요.`
    : "";

  return `${persona}

종목: ${stock.name} (${stock.ticker})
현재가: ${stock.currentPrice.toLocaleString()}원
52주: ${stock.week52Low.toLocaleString()}~${stock.week52High.toLocaleString()}원
최근: 1개월 ${stock.priceChange1M}% / 3개월 ${stock.priceChange3M}%

밸류에이션: PBR ${stock.pbr}x / PER ${stock.per}x / ROE ${stock.roe}% / 배당 ${stock.dividendYield}%

애널리스트: 매수 ${stock.buyRatings} / 중립 ${stock.holdRatings} / 매도 ${stock.sellRatings}
평균 목표가: ${stock.avgTargetPrice.toLocaleString()}원 (최고 ${stock.highTargetPrice.toLocaleString()} / 최저 ${stock.lowTargetPrice.toLocaleString()})

수급: 외국인 보유 ${stock.foreignHoldingPct}% / 3일 순매수 ${stock.foreignNetBuy3D}억원 / 공매도 ${stock.shortInterestPct}%

메모: ${stock.notes || "없음"}
${priorContext}

질문: 향후 3개월 내 현재가 대비 10% 이상 상승할 확률(0-100)?

JSON만 반환:
{"probability": 숫자, "reasoning": "2-3문장 한국어 핵심 근거"}`;
}

/**
 * Run swarm for a single stock (server-side).
 */
async function runSwarmServer(
  client: Anthropic,
  stock: StockInput
): Promise<AgentOutput[]> {
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
      const parsed = parseAgentResponse(
        (res.content[0] as { type: "text"; text: string }).text
      );
      return {
        agentId: agent.id,
        name: agent.name,
        probability: Math.max(0, Math.min(100, parsed.probability)),
        reasoning: parsed.reasoning,
        round: 1,
      } as AgentOutput;
    })
  );

  // Round 2: Each agent sees others' Round 1 outputs
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
      const parsed = parseAgentResponse(
        (res.content[0] as { type: "text"; text: string }).text
      );
      return {
        agentId: agent.id,
        name: agent.name,
        probability: Math.max(0, Math.min(100, parsed.probability)),
        reasoning: parsed.reasoning,
        round: 2,
      } as AgentOutput;
    })
  );

  return round2;
}

/**
 * Fetch stock data from internal API and fill defaults for missing fields.
 */
export async function fetchStockData(
  ticker: string,
  name: string,
  baseUrl: string
): Promise<StockInput | null> {
  try {
    const res = await fetch(`${baseUrl}/api/stock/${ticker}`);
    if (!res.ok) return null;
    const data = await res.json();

    return {
      ticker,
      name: data.name || name,
      currentPrice: data.currentPrice || 0,
      pbr: data.pbr || 0,
      per: data.per || 0,
      roe: data.roe || 0,
      dividendYield: data.dividendYield || 0,
      avgTargetPrice: data.avgTargetPrice || 0,
      highTargetPrice: data.highTargetPrice || 0,
      lowTargetPrice: data.lowTargetPrice || 0,
      buyRatings: data.buyRatings || 0,
      holdRatings: data.holdRatings || 0,
      sellRatings: data.sellRatings || 0,
      foreignHoldingPct: data.foreignHoldingPct || 0,
      foreignNetBuy3D: data.foreignNetBuy3D || 0,
      shortInterestPct: data.shortInterestPct || 0,
      week52High: data.week52High || 0,
      week52Low: data.week52Low || 0,
      priceChange1M: data.priceChange1M || 0,
      priceChange3M: data.priceChange3M || 0,
      notes: "",
    };
  } catch {
    return null;
  }
}

/**
 * Scan a list of stocks through the swarm and rank by alpha signal strength.
 */
export async function runScan(
  stocks: { ticker: string; name: string }[],
  baseUrl: string,
  onProgress?: (progress: ScanProgress) => void
): Promise<ScanResult[]> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const results: ScanResult[] = [];

  for (let i = 0; i < stocks.length; i++) {
    const { ticker, name } = stocks[i];

    // Phase 1: Fetch data
    onProgress?.({
      currentTicker: ticker,
      currentName: name,
      currentIndex: i + 1,
      totalStocks: stocks.length,
      phase: "fetching_data",
    });

    const stockData = await fetchStockData(ticker, name, baseUrl);
    if (!stockData || stockData.currentPrice === 0) continue;

    // Phase 2: Run swarm
    onProgress?.({
      currentTicker: ticker,
      currentName: name,
      currentIndex: i + 1,
      totalStocks: stocks.length,
      phase: "running_swarm",
    });

    try {
      const outputs = await runSwarmServer(client, stockData);
      const consensus = computeConsensus(outputs, stockData);
      const score = Math.round((Math.abs(consensus.alphaGap) * consensus.conviction) / 100);

      const result: ScanResult = {
        stock: stockData,
        outputs,
        consensus,
        rank: 0,
        score,
      };

      results.push(result);

      onProgress?.({
        currentTicker: ticker,
        currentName: name,
        currentIndex: i + 1,
        totalStocks: stocks.length,
        phase: "running_swarm",
        result,
      });
    } catch {
      // Skip failed stocks silently
      continue;
    }
  }

  // Rank by score descending
  results.sort((a, b) => b.score - a.score);
  results.forEach((r, i) => (r.rank = i + 1));

  onProgress?.({
    currentTicker: "",
    currentName: "",
    currentIndex: stocks.length,
    totalStocks: stocks.length,
    phase: "done",
  });

  return results;
}
