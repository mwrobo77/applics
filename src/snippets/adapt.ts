import type { LLM } from "../llm/provider.ts";
import type { JobContext } from "../twin/schema.ts";

const SYSTEM = `You lightly adapt a job applicant's OWN existing text so it fits a specific company, role and question.
Rules:
- Preserve the applicant's voice, sentence style and every factual claim. Never add facts, numbers, skills or experiences that are not in the text.
- Change only what is needed: tie the point to the role/company where the supplied context genuinely supports it, adjust emphasis, trim to fit.
- Do NOT parrot the job description or company marketing language back; no flattery, no clichés ("passionate", "dynamic", "excited to apply").
- If the company/role context is too thin for a genuine link, make minimal changes rather than inventing one.
- Return ONLY the adapted text, nothing else.`;

/** Returns adapted text; falls back to the unchanged text (with a note) when no model is available. */
export async function adaptText(
  llm: LLM, opts: { text: string; question: string; job: JobContext },
): Promise<{ adapted: string; note?: string }> {
  const { text, question, job } = opts;
  try {
    const out = (await llm.complete({
      system: SYSTEM, maxTokens: 900,
      user: `Question/field: ${question || "(none given)"}\nCompany: ${job.company || "?"}\nRole: ${job.role || "?"}\n` +
        `Sector: ${job.sector || "?"}\nJob description / notes: ${(job.description || job.notes || "").slice(0, 3000)}\n\n` +
        `Applicant's existing text:\n${text}`,
    })).trim();
    if (out) return { adapted: out };
  } catch (e) {
    return { adapted: text, note: `Adaptation failed (${(e as Error).message}); text unchanged.` };
  }
  return { adapted: text, note: "Offline mode: no AI adaptation available. Set ANTHROPIC_API_KEY to enable." };
}
