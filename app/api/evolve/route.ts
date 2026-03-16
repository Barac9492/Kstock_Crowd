import { NextRequest, NextResponse } from "next/server";
import { evolveAgents } from "@/lib/agent-evolution";
import { BacktestReport } from "@/lib/backtest-types";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const report: BacktestReport = body.report;

    if (!report || !report.agentStats) {
      return NextResponse.json(
        { error: "Valid backtest report required" },
        { status: 400 }
      );
    }

    const result = await evolveAgents(report);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
