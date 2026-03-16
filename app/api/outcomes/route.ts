import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

// This endpoint is called from the client to trigger outcome checking.
// The actual localStorage operations happen client-side via the outcome-tracker lib.
// This endpoint just proxies price checks for multiple tickers at once (to avoid CORS issues).

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tickers: string[] = body.tickers || [];

    if (tickers.length === 0) {
      return NextResponse.json({ prices: {} });
    }

    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const host = req.headers.get("host") || "localhost:3000";
    const baseUrl = `${protocol}://${host}`;

    const prices: Record<string, number> = {};

    // Fetch prices in parallel (batched)
    await Promise.all(
      tickers.map(async (ticker) => {
        try {
          const res = await fetch(`${baseUrl}/api/stock/${ticker}`);
          if (!res.ok) return;
          const data = await res.json();
          if (data.currentPrice) {
            prices[ticker] = data.currentPrice;
          }
        } catch {
          // Skip
        }
      })
    );

    return NextResponse.json({ prices });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
