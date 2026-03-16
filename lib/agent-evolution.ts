import { AGENTS } from "./agents";
import Anthropic from "@anthropic-ai/sdk";
import { BacktestReport, AgentStats } from "./backtest-types";

export interface EvolvedAgent {
  agentId: string;
  originalName: string;
  evolvedPersona: string;
  changes: string;
  weaknesses: string;
}

export interface EvolutionResult {
  evolvedAgents: EvolvedAgent[];
  summary: string;
  timestamp: string;
}

const EVOLUTION_STORAGE_KEY = "swarm_evolved_agents";

/**
 * Analyze backtest results and generate improved agent personas.
 */
export async function evolveAgents(
  report: BacktestReport
): Promise<EvolutionResult> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const evolvedAgents: EvolvedAgent[] = [];

  // Focus on worst-performing agents (Brier > 0.3 or accuracy < 50%)
  const needsEvolution = report.agentStats.filter(
    (s) => s.brierScore > 0.3 || s.accuracy < 50
  );

  // If all agents perform well, evolve the bottom 3
  const agentsToEvolve =
    needsEvolution.length > 0
      ? needsEvolution
      : [...report.agentStats]
          .sort((a, b) => b.brierScore - a.brierScore)
          .slice(0, 3);

  for (const stat of agentsToEvolve) {
    const originalAgent = AGENTS.find((a) => a.id === stat.agentId);
    if (!originalAgent) continue;

    // Build failure analysis
    const failures = report.results
      .filter((r) => !r.predictionCorrect)
      .map((r) => {
        const agentOutput = r.outputs.find(
          (o) => o.agentId === stat.agentId && o.round === 2
        );
        if (!agentOutput) return null;
        return {
          stock: r.label,
          predicted: agentOutput.probability,
          actual: r.outcome.hit ? "상승" : "하락",
          reasoning: agentOutput.reasoning,
        };
      })
      .filter(Boolean);

    const prompt = `당신은 AI 에이전트 개선 전문가입니다.

아래 에이전트의 백테스트 성과가 좋지 않습니다. 개선된 페르소나를 작성하세요.

## 현재 에이전트
이름: ${originalAgent.name}
ID: ${originalAgent.id}
현재 페르소나:
${originalAgent.persona}

## 성과 데이터
- 정확도: ${stat.accuracy}%
- Brier Score: ${stat.brierScore.toFixed(3)}
- 평균 확률: ${stat.avgProbability}%
- 불 바이어스: ${stat.bullishBias.toFixed(3)}

## 오판 사례
${failures.map((f) => `- ${f!.stock}: 예측 ${f!.predicted}% → 실제 ${f!.actual} (근거: ${f!.reasoning})`).join("\n")}

## 지시사항
1. 기존 역할(${originalAgent.name})은 유지하되, 판단 기준을 개선하세요
2. 오판 패턴을 분석하여 구체적인 개선점을 반영하세요
3. 바이어스가 ${stat.bullishBias > 0 ? "낙관적" : "비관적"}이므로 이를 교정하세요

JSON만 반환:
{"evolvedPersona": "개선된 한국어 페르소나 전문 (3-5문장)", "changes": "변경 요약 (1문장)", "weaknesses": "기존 약점 (1문장)"}`;

    try {
      const res = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      });

      const text = (res.content[0] as { type: "text"; text: string }).text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        evolvedAgents.push({
          agentId: stat.agentId,
          originalName: originalAgent.name,
          evolvedPersona: parsed.evolvedPersona || originalAgent.persona,
          changes: parsed.changes || "변경 없음",
          weaknesses: parsed.weaknesses || "분석 불가",
        });
      }
    } catch {
      // Skip failed evolution
      continue;
    }
  }

  const summary = `${evolvedAgents.length}개 에이전트 개선 완료: ${evolvedAgents.map((e) => e.originalName).join(", ")}`;

  return {
    evolvedAgents,
    summary,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Save evolved agents to localStorage.
 */
export function saveEvolvedAgents(result: EvolutionResult): void {
  localStorage.setItem(EVOLUTION_STORAGE_KEY, JSON.stringify(result));
}

/**
 * Load evolved agents from localStorage.
 */
export function loadEvolvedAgents(): EvolutionResult | null {
  try {
    const stored = localStorage.getItem(EVOLUTION_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

/**
 * Get the active persona for an agent (evolved if available, original otherwise).
 */
export function getActivePersona(agentId: string): string {
  const evolved = loadEvolvedAgents();
  if (evolved) {
    const match = evolved.evolvedAgents.find((e) => e.agentId === agentId);
    if (match) return match.evolvedPersona;
  }
  const original = AGENTS.find((a) => a.id === agentId);
  return original?.persona || "";
}
