import type { LLM } from "../llm/provider.ts";
import type { SectionId } from "../twin/schema.ts";

const MAX_CHAIN = 2; // follow-ups per bank question; avoids interrogating the applicant forever

const SYSTEM = `You are interviewing a job applicant to build a rich, accurate profile of them.
Given a question and their answer, decide if ONE more probing follow-up would make the answer
substantially more useful for job applications (specific actions, personal contribution vs team,
numbers/outcomes, what went wrong, what they learned, real motivation). Ask about gaps in what they
said; never invent facts or suggest answers. If the answer is already specific and complete, reply NONE.
Reply with ONLY the follow-up question (one sentence) or NONE.`;

const STORY_SECTIONS: SectionId[] = ["stories", "experience", "projects"];

/** Rule-based fallback used offline or if the model call fails. */
export function heuristicFollowUp(section: SectionId, answer: string): string | null {
  const words = answer.trim().split(/\s+/).filter(Boolean);
  if (STORY_SECTIONS.includes(section)) {
    if (words.length < 40) return "Can you walk me through it in more detail: what was the situation and what exactly did you do?";
    if (!/\b(I|my|me)\b/.test(answer)) return "What did you personally do, as opposed to the wider team?";
    if (!/\d/.test(answer)) return "What was the measurable result or outcome (numbers, scale, time saved, feedback)?";
    if (!/\b(learn|learnt|learned|differently|mistake|improve)/i.test(answer)) return "What did you learn, or what would you do differently next time?";
  } else if (section === "motivation" || section === "values" || section === "strengths") {
    if (words.length < 30) return "What specific experience or moment made you feel this way?";
  }
  return null;
}

export async function followUp(
  llm: LLM, opts: { question: string; section: SectionId; answer: string; chainLength: number },
): Promise<string | null> {
  if (opts.chainLength >= MAX_CHAIN || opts.answer.trim().length < 3) return null;
  try {
    const out = (await llm.complete({
      system: SYSTEM, fast: true, maxTokens: 120,
      user: `Question: ${opts.question}\nAnswer: ${opts.answer}`,
    })).trim();
    if (out) return /^none\b/i.test(out) ? null : out.replace(/^["']|["']$/g, "");
  } catch { /* fall through to heuristics */ }
  return heuristicFollowUp(opts.section, opts.answer);
}
