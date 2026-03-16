import Anthropic from "@anthropic-ai/sdk";
import { StockInput, AgentOutput } from "./types";
import { computeConsensus } from "./consensus";
import { AGENTS } from "./agents";
import {
  BacktestCase,
  BacktestResult,
  BacktestReport,
  AgentStats,
  BacktestProgress,
} from "./backtest-types";
import { parseAgentResponse } from "./parse-agent";

/**
 * Build the same prompt used by agents.ts — duplicated here to avoid
 * coupling the backtester to client-side code.
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
 * Run the swarm for a single stock (server-side version).
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
 * Compute per-agent statistics from backtest results.
 */
function computeAgentStats(results: BacktestResult[]): AgentStats[] {
  const agentMap = new Map<
    string,
    { name: string; probs: number[]; errors: number[]; briers: number[]; labels: string[] }
  >();

  for (const result of results) {
    const actualOutcome = result.outcome.hit ? 1 : 0;

    for (const output of result.outputs) {
      if (!agentMap.has(output.agentId)) {
        agentMap.set(output.agentId, {
          name: output.name,
          probs: [],
          errors: [],
          briers: [],
          labels: [],
        });
      }
      const stats = agentMap.get(output.agentId)!;
      const probNorm = output.probability / 100;
      const error = Math.abs(output.probability - actualOutcome * 100);

      stats.probs.push(output.probability);
      stats.errors.push(error);
      stats.briers.push(Math.pow(probNorm - actualOutcome, 2));
      stats.labels.push(result.label);
    }
  }

  const agentStats: AgentStats[] = [];

  for (const [agentId, data] of agentMap) {
    const avgProb = data.probs.reduce((s, p) => s + p, 0) / data.probs.length;
    const avgError = data.errors.reduce((s, e) => s + e, 0) / data.errors.length;
    const brierScore = data.briers.reduce((s, b) => s + b, 0) / data.briers.length;

    // Accuracy: predicted >50% and hit, or predicted <=50% and not hit
    let correct = 0;
    for (let i = 0; i < results.length; i++) {
      const output = results[i].outputs.find((o) => o.agentId === agentId);
      if (!output) continue;
      const predictedHit = output.probability > 50;
      const actualHit = results[i].outcome.hit;
      if (predictedHit === actualHit) correct++;
    }

    // Find best and worst cases
    let bestIdx = 0;
    let worstIdx = 0;
    for (let i = 1; i < data.errors.length; i++) {
      if (data.errors[i] < data.errors[bestIdx]) bestIdx = i;
      if (data.errors[i] > data.errors[worstIdx]) worstIdx = i;
    }

    agentStats.push({
      agentId,
      name: data.name,
      avgProbability: Math.round(avgProb * 10) / 10,
      avgError: Math.round(avgError * 10) / 10,
      brierScore: Math.round(brierScore * 1000) / 1000,
      accuracy: Math.round((correct / results.length) * 100),
      bullishBias: Math.round((avgProb - 50) * 10) / 10,
      bestCase: { label: data.labels[bestIdx], error: Math.round(data.errors[bestIdx] * 10) / 10 },
      worstCase: { label: data.labels[worstIdx], error: Math.round(data.errors[worstIdx] * 10) / 10 },
    });
  }

  // Sort by accuracy descending
  agentStats.sort((a, b) => b.accuracy - a.accuracy || a.brierScore - b.brierScore);

  return agentStats;
}

/**
 * Generate AI-powered improvement recommendations based on backtest results.
 */
async function generateRecommendations(
  client: Anthropic,
  report: Omit<BacktestReport, "recommendations">
): Promise<string[]> {
  const agentSummary = report.agentStats
    .map(
      (a) =>
        `${a.name} (${a.agentId}): accuracy=${a.accuracy}%, brier=${a.brierScore}, bias=${a.bullishBias > 0 ? "bullish" : "bearish"} (${a.bullishBias}), avgError=${a.avgError}`
    )
    .join("\n");

  const signalSummary = `BUY signals: ${report.signalBreakdown.buy.correct}/${report.signalBreakdown.buy.total} correct
CAUTION signals: ${report.signalBreakdown.caution.correct}/${report.signalBreakdown.caution.total} correct
MONITOR signals: ${report.signalBreakdown.monitor.correct}/${report.signalBreakdown.monitor.total} correct`;

  const caseSummary = report.results
    .map(
      (r) =>
        `${r.label}: SP=${r.consensus.sp}%, signal=${r.consensus.signal}, actual=${r.outcome.hit ? "HIT (+10%)" : "MISS"} (${r.outcome.pctChange.toFixed(1)}%)`
    )
    .join("\n");

  const res = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: `You are an AI system tuning expert. Analyze the following backtest results from a stock prediction swarm system and provide specific, actionable recommendations to improve accuracy.

## Agent Performance
${agentSummary}

## Signal Accuracy
${signalSummary}

## Case Results
${caseSummary}

## Overall
- Overall accuracy: ${report.overallAccuracy}%
- Overall Brier score: ${report.overallBrierScore}

Provide 3-5 specific recommendations in Korean. Focus on:
1. Which agents are miscalibrated and how to fix their personas
2. Whether consensus weights should be adjusted
3. Whether signal thresholds (currently alphaGap > 15 for BUY) should change
4. Any systematic biases (e.g. all agents too bullish/bearish)

Return as JSON array of strings:
["recommendation1", "recommendation2", ...]`,
      },
    ],
  });

  try {
    const text = (res.content[0] as { type: "text"; text: string }).text
      .replace(/```json|```/g, "")
      .trim();
    return JSON.parse(text);
  } catch {
    return ["백테스트 결과 분석 중 오류가 발생했습니다. 데이터를 확인해주세요."];
  }
}

/**
 * Main backtesting function. Runs all cases through the swarm and produces a full report.
 */
export async function runBacktest(
  cases: BacktestCase[],
  onProgress?: (progress: BacktestProgress) => void
): Promise<BacktestReport> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const results: BacktestResult[] = [];

  // Process each case
  for (let i = 0; i < cases.length; i++) {
    const testCase = cases[i];

    onProgress?.({
      currentCase: i + 1,
      totalCases: cases.length,
      currentLabel: testCase.label,
      phase: "running_swarm",
    });

    // Run the swarm
    const outputs = await runSwarmServer(client, testCase.stock);
    const consensus = computeConsensus(outputs, testCase.stock);

    // Determine if prediction was directionally correct
    const predictedPositive = consensus.signal === "BUY";
    const predictedNegative = consensus.signal === "CAUTION";
    const actualPositive = testCase.outcome.hit;

    const predictionCorrect =
      (predictedPositive && actualPositive) ||
      (predictedNegative && !actualPositive) ||
      (consensus.signal === "MONITOR"); // MONITOR is considered neutral / not wrong

    const probabilityError = Math.abs(consensus.sp - (actualPositive ? 100 : 0));

    results.push({
      caseId: testCase.id,
      label: testCase.label,
      stock: testCase.stock,
      outputs,
      consensus,
      outcome: testCase.outcome,
      predictionCorrect,
      probabilityError,
    });
  }

  onProgress?.({
    currentCase: cases.length,
    totalCases: cases.length,
    currentLabel: "",
    phase: "computing_stats",
  });

  // Compute stats
  const agentStats = computeAgentStats(results);

  // Signal breakdown
  const signalBreakdown = {
    buy: { total: 0, correct: 0 },
    caution: { total: 0, correct: 0 },
    monitor: { total: 0, correct: 0 },
  };

  for (const result of results) {
    const key = result.consensus.signal.toLowerCase() as "buy" | "caution" | "monitor";
    signalBreakdown[key].total++;
    if (result.predictionCorrect) signalBreakdown[key].correct++;
  }

  const overallAccuracy =
    results.length > 0
      ? Math.round((results.filter((r) => r.predictionCorrect).length / results.length) * 100)
      : 0;

  const overallBrierScore =
    results.length > 0
      ? Math.round(
          (results.reduce((sum, r) => {
            const probNorm = r.consensus.sp / 100;
            const actual = r.outcome.hit ? 1 : 0;
            return sum + Math.pow(probNorm - actual, 2);
          }, 0) /
            results.length) *
            1000
        ) / 1000
      : 0;

  const partialReport = {
    timestamp: new Date().toISOString(),
    totalCases: cases.length,
    results,
    agentStats,
    overallAccuracy,
    overallBrierScore,
    signalBreakdown,
  };

  // Generate AI recommendations
  onProgress?.({
    currentCase: cases.length,
    totalCases: cases.length,
    currentLabel: "",
    phase: "generating_recommendations",
  });

  const recommendations = await generateRecommendations(client, partialReport);

  onProgress?.({
    currentCase: cases.length,
    totalCases: cases.length,
    currentLabel: "",
    phase: "done",
  });

  return {
    ...partialReport,
    recommendations,
  };
}
