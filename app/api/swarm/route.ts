import { NextRequest } from "next/server";
import { runSwarm } from "@/lib/agents";
import { computeConsensus } from "@/lib/consensus";
import { StockInput } from "@/lib/types";

export async function POST(req: NextRequest) {
  const stock: StockInput = await req.json();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const outputs = await runSwarm(stock, (output) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "agent", output })}\n\n`)
          );
        });

        const consensus = computeConsensus(outputs, stock);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "consensus", consensus })}\n\n`)
        );
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", message: err instanceof Error ? err.message : "Unknown error" })}\n\n`
          )
        );
      } finally {
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
}
