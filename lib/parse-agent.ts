/**
 * Robustly parse an LLM agent response into { probability, reasoning }.
 * Handles: markdown code fences, truncated JSON, missing quotes, extra text.
 */
export function parseAgentResponse(raw: string): {
  probability: number;
  reasoning: string;
  signal?: string;
} {
  let text = raw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  // Try direct parse first
  try {
    const obj = JSON.parse(text);
    return {
      probability: Number(obj.probability) || 50,
      reasoning: String(obj.reasoning || "분석 근거 없음"),
      signal: obj.signal || undefined,
    };
  } catch {
    // Fall through to regex extraction
  }

  // Try to find JSON object in the text
  const jsonMatch = text.match(/\{[\s\S]*?\}/);
  if (jsonMatch) {
    try {
      const obj = JSON.parse(jsonMatch[0]);
      return {
        probability: Number(obj.probability) || 50,
        reasoning: String(obj.reasoning || "분석 근거 없음"),
        signal: obj.signal || undefined,
      };
    } catch {
      // Fall through
    }
  }

  // Regex extraction as last resort
  const probMatch = text.match(/"probability"\s*:\s*(\d+)/);
  const reasonMatch = text.match(
    /"reasoning"\s*:\s*"((?:[^"\\]|\\.)*)(?:"|$)/
  );

  const probability = probMatch ? Number(probMatch[1]) : 50;
  const reasoning = reasonMatch
    ? reasonMatch[1].replace(/\\"/g, '"').replace(/\\n/g, " ")
    : "응답 파싱 실패 — 기본값 사용";

  return { probability, reasoning };
}
