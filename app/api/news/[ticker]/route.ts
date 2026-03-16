import { NextRequest, NextResponse } from "next/server";
import { buildNewsContext } from "@/lib/news";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;

  if (!/^\d{6}$/.test(ticker)) {
    return NextResponse.json(
      { error: "종목코드는 6자리 숫자여야 합니다" },
      { status: 400 }
    );
  }

  try {
    const context = await buildNewsContext(ticker);
    return NextResponse.json(context);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
