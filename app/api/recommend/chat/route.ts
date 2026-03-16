import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { StockInput } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { candidates, parsedPick, chatHistory, userMessage } = await req.json();

    if (!candidates || !parsedPick || !userMessage) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const anthropicApiKey = process.env.ANTHROPIC_API_KEY || (process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY as string | undefined);
    
    if (!anthropicApiKey) {
      return NextResponse.json(
        { error: "API key is missing in server environment variables" },
        { status: 500 }
      );
    }

    const anthropic = new Anthropic({ apiKey: anthropicApiKey });

    // Format candidates for context
    const candidatesText = candidates
      .map(
        (c: StockInput, idx: number) => `[후보 ${idx + 1}: ${c.name} (${c.ticker})] - 최근 외국인 3일 순매수 ${c.foreignNetBuy3D || 0}억원, PBR ${c.pbr}x, 52주 최저 대비 반등 여력 확인`
      )
      .join("\n");

    const systemPrompt = `당신은 전설적인 8인의 투자 거장들이 모인 '알파 위원회(The Mastermind Committee)'의 의장(Chairman)입니다.
당신은 방금 다음 5개의 후보들 중에서 [${parsedPick.recommendedName}(${parsedPick.recommendedTicker})]를 '오늘의 Top Pick'으로 강력히 추천했습니다.
후보 목록:
${candidatesText}

사용자가 당신의 추천에 대해 추가적인 질문이나 반론을 제기했습니다.
의장으로서 당신의 이전 결정(Top Pick 선정 논리)을 방어하거나, 사용자가 묻는 특정 리스크, 타 후보 종목과의 비교 우위 등을 전문가답게, 그러나 이해하기 쉽게 설명하십시오.
답변은 구구절절하지 않게, 핵심만 타격감 있게 작성하세요 (최대 3-4 단락).`;

    // Map frontend chat history to Anthropic format
    const messages: Anthropic.MessageParam[] = chatHistory.map((msg: any) => ({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.content,
    }));

    // Append the new user message
    messages.push({ role: "user", content: userMessage });

    const stream = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      temperature: 0.4,
      system: systemPrompt,
      messages: messages,
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
          console.error("Stream error in recommend chat:", err);
          const msg = err instanceof Error ? err.message : "Unknown error";
          controller.enqueue(encoder.encode(`\n[Error: ${msg}]`));
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
    console.error("Recommend chat error:", err);
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
