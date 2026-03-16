import { NextRequest } from "next/server";
import { runScan } from "@/lib/scanner";
import { UNIVERSE } from "@/lib/universe";

export const maxDuration = 300; // 5 min

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  // Use provided tickers or full universe
  const selectedTickers: string[] | undefined = body.tickers;
  const stocks = selectedTickers
    ? UNIVERSE.filter((s) => selectedTickers.includes(s.ticker))
    : UNIVERSE;

  if (stocks.length === 0) {
    return new Response(
      JSON.stringify({ error: "No valid tickers selected" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Determine base URL from request
  const protocol = req.headers.get("x-forwarded-proto") || "http";
  const host = req.headers.get("host") || "localhost:3000";
  const baseUrl = `${protocol}://${host}`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const results = await runScan(
          stocks.map((s) => ({ ticker: s.ticker, name: s.name })),
          baseUrl,
          (progress) => {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "progress", ...progress })}\n\n`
              )
            );
          }
        );

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "result", results })}\n\n`
          )
        );
        controller.close();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", message })}\n\n`
          )
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
}
