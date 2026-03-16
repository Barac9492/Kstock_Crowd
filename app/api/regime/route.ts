import { NextResponse } from "next/server";
import { fetchMarketRegime } from "@/lib/regime";

export async function GET() {
  try {
    const regime = await fetchMarketRegime();
    return NextResponse.json(regime);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
