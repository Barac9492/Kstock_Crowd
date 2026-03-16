import { NextResponse } from "next/server";
import { runBacktest } from "@/lib/backtester";
import { BACKTEST_FIXTURES } from "@/lib/backtest-fixtures";
import { BacktestCase } from "@/lib/backtest-types";

export const maxDuration = 300; // 5 min — swarm calls take time

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const cases: BacktestCase[] = body.cases?.length ? body.cases : BACKTEST_FIXTURES;

    // Use streaming response to send progress updates
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const report = await runBacktest(cases, (progress) => {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "progress", ...progress })}\n\n`)
            );
          });

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "result", report })}\n\n`)
          );
          controller.close();
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", message })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
