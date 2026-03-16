"use client";

import { AgentStats } from "@/lib/backtest-types";

interface Props {
  stats: AgentStats[];
}

function getAccuracyColor(accuracy: number): string {
  if (accuracy >= 80) return "text-emerald-400";
  if (accuracy >= 60) return "text-yellow-400";
  return "text-red-400";
}

function getBrierColor(brier: number): string {
  if (brier <= 0.15) return "text-emerald-400";
  if (brier <= 0.25) return "text-yellow-400";
  return "text-red-400";
}

function getBiasLabel(bias: number): { text: string; color: string } {
  if (bias > 10) return { text: "강한 낙관", color: "text-red-400" };
  if (bias > 3) return { text: "약한 낙관", color: "text-yellow-400" };
  if (bias < -10) return { text: "강한 비관", color: "text-blue-400" };
  if (bias < -3) return { text: "약한 비관", color: "text-cyan-400" };
  return { text: "균형적", color: "text-emerald-400" };
}

export default function BacktestAgentReport({ stats }: Props) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">에이전트별 성과</h3>

      {/* Table view */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400">
              <th className="text-left py-3 px-2">순위</th>
              <th className="text-left py-3 px-2">에이전트</th>
              <th className="text-right py-3 px-2">정확도</th>
              <th className="text-right py-3 px-2">Brier</th>
              <th className="text-right py-3 px-2">평균 오차</th>
              <th className="text-center py-3 px-2">성향</th>
              <th className="text-left py-3 px-2">최고 예측</th>
              <th className="text-left py-3 px-2">최악 예측</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((agent, idx) => {
              const bias = getBiasLabel(agent.bullishBias);
              return (
                <tr
                  key={agent.agentId}
                  className="border-b border-gray-800 hover:bg-gray-900/50 transition-colors"
                >
                  <td className="py-3 px-2 text-gray-500 font-mono">
                    {idx + 1}
                  </td>
                  <td className="py-3 px-2">
                    <div className="font-medium text-white">{agent.name}</div>
                    <div className="text-xs text-gray-500">{agent.agentId}</div>
                  </td>
                  <td
                    className={`py-3 px-2 text-right font-bold ${getAccuracyColor(agent.accuracy)}`}
                  >
                    {agent.accuracy}%
                  </td>
                  <td
                    className={`py-3 px-2 text-right font-mono ${getBrierColor(agent.brierScore)}`}
                  >
                    {agent.brierScore.toFixed(3)}
                  </td>
                  <td className="py-3 px-2 text-right text-gray-300">
                    {agent.avgError.toFixed(1)}
                  </td>
                  <td className={`py-3 px-2 text-center ${bias.color}`}>
                    <span className="text-xs">{bias.text}</span>
                    <div className="text-xs text-gray-500">
                      ({agent.bullishBias > 0 ? "+" : ""}
                      {agent.bullishBias.toFixed(1)})
                    </div>
                  </td>
                  <td className="py-3 px-2">
                    {agent.bestCase && (
                      <div>
                        <div className="text-xs text-emerald-400 truncate max-w-[140px]">
                          {agent.bestCase.label}
                        </div>
                        <div className="text-xs text-gray-500">
                          오차 {agent.bestCase.error}
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-2">
                    {agent.worstCase && (
                      <div>
                        <div className="text-xs text-red-400 truncate max-w-[140px]">
                          {agent.worstCase.label}
                        </div>
                        <div className="text-xs text-gray-500">
                          오차 {agent.worstCase.error}
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Visual bias chart */}
      <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
        <h4 className="text-sm text-gray-400 mb-3">낙관/비관 성향 분포</h4>
        <div className="space-y-2">
          {stats.map((agent) => {
            const barWidth = Math.min(Math.abs(agent.bullishBias) * 2, 50);
            const isPositive = agent.bullishBias > 0;
            return (
              <div key={agent.agentId} className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-28 truncate">
                  {agent.name}
                </span>
                <div className="flex-1 flex items-center h-5">
                  <div className="w-1/2 flex justify-end">
                    {!isPositive && (
                      <div
                        className="bg-blue-500/40 rounded-l h-4"
                        style={{ width: `${barWidth}%` }}
                      />
                    )}
                  </div>
                  <div className="w-px h-5 bg-gray-600" />
                  <div className="w-1/2 flex justify-start">
                    {isPositive && (
                      <div
                        className="bg-red-500/40 rounded-r h-4"
                        style={{ width: `${barWidth}%` }}
                      />
                    )}
                  </div>
                </div>
                <span className="text-xs text-gray-500 w-12 text-right font-mono">
                  {agent.bullishBias > 0 ? "+" : ""}
                  {agent.bullishBias.toFixed(1)}
                </span>
              </div>
            );
          })}
          <div className="flex items-center gap-2 text-[10px] text-gray-600 mt-1">
            <span className="w-28" />
            <div className="flex-1 flex">
              <span className="w-1/2 text-right pr-2">← 비관</span>
              <span className="w-1/2 text-left pl-2">낙관 →</span>
            </div>
            <span className="w-12" />
          </div>
        </div>
      </div>
    </div>
  );
}
