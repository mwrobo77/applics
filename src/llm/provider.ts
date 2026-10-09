// Minimal provider abstraction so the whole app runs offline (mock) or against Claude.
export interface LLM {
  readonly name: string;
  /** Plain text completion. `system` carries rules; `user` carries the task. */
  complete(opts: { system: string; user: string; maxTokens?: number; fast?: boolean }): Promise<string>;
}

export class ClaudeLLM implements LLM {
  readonly name = "claude";
  constructor(
    private apiKey: string,
    private models = { fast: "claude-haiku-4-5", smart: "claude-sonnet-4-5" },
  ) {}
  async complete({ system, user, maxTokens = 1024, fast = false }: Parameters<LLM["complete"]>[0]) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": this.apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: fast ? this.models.fast : this.models.smart,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { content: { type: string; text?: string }[] };
    return data.content.filter((c) => c.type === "text").map((c) => c.text).join("");
  }
}

/** Deterministic offline stand-in. Returns "" so callers fall back to their heuristics. */
export class MockLLM implements LLM {
  readonly name = "mock";
  async complete() { return ""; }
}

export function pickLLM(env = process.env): LLM {
  return env.ANTHROPIC_API_KEY ? new ClaudeLLM(env.ANTHROPIC_API_KEY) : new MockLLM();
}
