import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { StockInput } from "@/lib/types";

// Force streaming for UI progress
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { candidates } = (await req.json()) as { candidates: StockInput[] };

    if (!candidates || candidates.length === 0) {
      return NextResponse.json({ error: "No candidates provided" }, { status: 400 });
    }

    // Format the candidates into a digestible text block
    const candidatesText = candidates
      .map(
        (c, idx) => `
[후보 ${idx + 1}: ${c.name} (${c.ticker})]
현재가: ${c.currentPrice?.toLocaleString()}원
밸류에이션: PBR ${c.pbr}x / PER ${c.per}x / ROE ${c.roe}%
애널리스트 평균목표가: ${c.avgTargetPrice?.toLocaleString()}원
수급: 최근 외국인 3일 순매수 ${c.foreignNetBuy3D || 0}억원
가격흐름: 52주 최고 ${c.week52High?.toLocaleString()}원 / 최저 ${c.week52Low?.toLocaleString()}원
메모: ${c.notes || "없음"}
`
      )
      .join("\n");

    const systemPrompt = `당신은 전설적인 8인의 투자 거장들(워런 버핏, 피터 린치, 윌리엄 오닐, 레이 달리오, 벤저민 그레이엄, 스탠리 드러켄밀러, 조지 소로스, 짐 사이먼스)이 모인 '알파 위원회(The Mastermind Committee)'의 의장(Chairman)입니다.
현재 시스템이 비용 효율적인 필터링을 통해 시장에서 가장 가능성 있는 ${candidates.length}개의 종목 후보를 가져왔습니다. 

당신의 임무는 8명 거장들의 의견을 종합 분석하여, 이 후보들 중에서 '현재 시점에서 가장 상승 확률이 높은 단 하나의 Top Pick(알파 추천주)'을 최종 선정하는 것입니다.
각 거장들의 투자 철학이 어떻게 이 종목을 지지하는지(혹은 반대하는지) 간결하게 논증하고, 최종 목표가(TP)와 손절가(SL)를 현실적으로 제시하세요.`;

    const userPrompt = `다음은 오늘 스크리닝을 통과한 최종 후보 ${candidates.length}종목입니다:

${candidatesText}

위 후보 중 단 '1개'의 최종 추천 종목(Top Pick)을 선정하고 아래 JSON 형식에 맞춰 결과를 반환하세요.
(반드시 요건에 맞는 마크다운을 제외한 순수 JSON만 반환하세요)

{
  "recommendedTicker": "선정된 종목코드 (예: 005930)",
  "recommendedName": "선정된 종목명 (예: 삼성전자)",
  "reasoning": "선정된 이유를 거장 8인의 철학을 혼합하여 의장의 목소리로 작성 (3-5문장)",
  "legendQuotes": [
    {"legend": "워런 버핏", "quote": "버핏의 톤앤매너로 이 주식을 평가하는 핵심 한 줄"},
    {"legend": "윌리엄 오닐", "quote": "오닐의 톤앤매너로 이 주식을 평가하는 핵심 한 줄"}
  ],
  "targetPrice": 숫자(원),
  "stopLoss": 숫자(원)
}`;

    const anthropicApiKey = process.env.ANTHROPIC_API_KEY || (process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY as string | undefined);
      
    if (!anthropicApiKey) {
      return NextResponse.json(
        { error: "API key is missing in server environment variables" },
        { status: 500 }
      );
    }

    const anthropic = new Anthropic({ apiKey: anthropicApiKey });

    // Stream the response to give the user immediate feedback that the committee is "debating"
    const stream = await anthropic.messages.create({
      model: "claude-3-5-sonnet-latest",
      max_tokens: 1500,
      temperature: 0.2, // Low temperature for consistent JSON
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      stream: true,
    });

    const encoder = new TextEncoder();
    const customStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (
              chunk.type === "content_block_delta" &&
              chunk.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(chunk.delta.text));
            }
          }
        } catch (err: unknown) {
          console.error("Stream error in recommend:", err);
          const msg = err instanceof Error ? err.message : "Unknown error";
          controller.enqueue(encoder.encode(`\n{"error": "${msg}"}`));
        } finally {
          controller.close();
        }
      },
    });

    return new NextResponse(customStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err: unknown) {
    console.error("Recommend error:", err);
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
