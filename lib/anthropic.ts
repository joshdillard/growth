// Thin Claude API client (no SDK dependency). Used for topic research,
// script generation, B-roll prompting, descriptions, and thumbnail prompts.

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

interface ClaudeOptions {
  system?: string;
  maxTokens?: number;
  webSearch?: boolean; // enable Anthropic's server-side web search tool
}

export async function askClaude(
  prompt: string,
  opts: ClaudeOptions = {}
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const body: Record<string, unknown> = {
    model: MODEL,
    max_tokens: opts.maxTokens ?? 4096,
    messages: [{ role: "user", content: prompt }],
  };
  if (opts.system) body.system = opts.system;
  if (opts.webSearch) {
    body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }];
  }

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Claude API error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  // Concatenate all text blocks (web search responses interleave tool blocks).
  return data.content
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("\n");
}

// Ask Claude for JSON and parse it, tolerating markdown fences.
export async function askClaudeJSON<T>(
  prompt: string,
  opts: ClaudeOptions = {}
): Promise<T> {
  const text = await askClaude(
    prompt + "\n\nRespond with ONLY valid JSON, no commentary.",
    opts
  );
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
  return JSON.parse((match[1] || text).trim());
}
