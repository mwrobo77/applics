// Pure snippet engine: variable filling, relevance ranking, word-level diffs and
// TextExpander-style completion. No I/O, no dependencies.

import type { JobContext, Snippet } from "../twin/schema.ts";

export type DiffOp = "same" | "add" | "del";
export interface DiffSegment { op: DiffOp; text: string }
export interface RankedSnippet { snippet: Snippet; score: number; filled: string }
export interface Completion { snippet: Snippet; completion: string }

// ---------------------------------------------------------------------------
// Variables
// ---------------------------------------------------------------------------

const VAR_RE = /\{(company|role|sector|location)\}/gi;

/**
 * Replace {company} {role} {sector} {location} (case-insensitive). A variable whose
 * job field is missing or blank is left as-is so the user can see it. Unknown
 * {vars} are never touched.
 */
export function fillVariables(text: string, job: JobContext): string {
  return text.replace(VAR_RE, (placeholder: string, name: string) => {
    const value = job[name.toLowerCase() as keyof JobContext];
    return typeof value === "string" && value.trim() !== "" ? value.trim() : placeholder;
  });
}

// ---------------------------------------------------------------------------
// Tokenising
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "of", "to", "at", "in", "on", "for",
  "with", "from", "by", "as", "is", "are", "was", "were", "be", "been", "being",
  "do", "does", "did", "have", "has", "had", "i", "me", "my", "we", "our", "you",
  "your", "he", "she", "it", "its", "they", "them", "their", "this", "that", "these",
  "those", "what", "which", "who", "how", "would", "could", "should", "can", "will",
  "shall", "about", "please", "tell", "give", "so", "there", "any",
]);

// Irregular forms that light suffix stripping cannot reach.
const IRREGULAR: Record<string, string> = {
  led: "lead", leads: "lead", leading: "lead", leader: "lead", leaders: "lead",
};

function stem(word: string): string {
  const irregular = IRREGULAR[word];
  if (irregular) return irregular;
  let w = word;
  if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s") && !/(ss|us|is)$/.test(w)) w = w.slice(0, -1);
  if (w.length > 4 && w.endsWith("e")) w = w.slice(0, -1);
  return w;
}

/** Lowercase, strip punctuation, drop stopwords and 1-letter tokens, light stemming. */
export function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
    .map(stem);
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

const K1 = 1.2;             // BM25 term-frequency saturation
const B = 0.75;             // BM25 length normalisation
const JOB_WEIGHT = 0.3;     // job role/sector/description terms count for less than query terms
const TAG_BOOST = 0.5;      // per distinct query token that equals a snippet tag token
const KIND_BOOST = 0.75;    // when the snippet kind matches the question's shape
const USES_STEP = 0.001;    // tiny tie-break by usage count ...
const USES_CAP = 50;        // ... capped so it can never outweigh relevance

const COMPANY_WORD_SPLIT = /[^\p{L}\p{N}]+/u;

/**
 * Infer which snippet kind the question is asking for from its wording.
 * Returns null when there is no clear cue.
 */
export function kindCue(query: string, job: JobContext): Snippet["kind"] | null {
  const q = query.toLowerCase();
  const words = new Set(q.split(COMPANY_WORD_SPLIT));
  const companyWords = job.company ? job.company.toLowerCase().split(COMPANY_WORD_SPLIT) : [];

  if (/\bwhy\b/.test(q) && (/\b(us|company|firm|organisation|organization)\b/.test(q) ||
      companyWords.some((w) => w.length > 2 && words.has(w)))) {
    return "cover-letter-part";
  }
  if (/\b(a time|an example|examples? of|when you|a situation|an occasion)\b/.test(q)) {
    return "story";
  }
  const length = q.split(/\s+/).filter(Boolean).length;
  if (length >= 30) return "paragraph";
  if (length <= 6) return "short";
  return null;
}

/**
 * Rank snippets against the application question. Query tokens score with BM25 at
 * weight 1; job role/sector/description tokens add at weight 0.3 but only to snippets
 * that already match the question. Snippets with no query match are excluded.
 */
export function rankSnippets(
  snippets: Snippet[],
  query: string,
  job: JobContext,
  limit = 8,
): RankedSnippet[] {
  const queryTerms = [...new Set(tokenise(query))];
  if (queryTerms.length === 0 || snippets.length === 0 || limit <= 0) return [];
  const querySet = new Set(queryTerms);
  const jobTerms = [...new Set(tokenise([job.role, job.sector ?? "", job.description ?? ""].join(" ")))]
    .filter((t) => !querySet.has(t));

  const docs = snippets.map((snippet) => {
    const tagTokens = new Set(snippet.tags.flatMap(tokenise));
    const tokens = [...tokenise(fillVariables(`${snippet.title} ${snippet.text}`, job)), ...tagTokens];
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    return { snippet, tagTokens, tf, length: tokens.length };
  });

  const n = docs.length;
  const avgLength = Math.max(1, docs.reduce((sum, d) => sum + d.length, 0) / n);
  const df = new Map<string, number>();
  for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);

  const bm25 = (d: (typeof docs)[number], term: string): number => {
    const f = d.tf.get(term) ?? 0;
    if (f === 0) return 0;
    const docFreq = df.get(term) ?? 0;
    const idf = Math.log(1 + (n - docFreq + 0.5) / (docFreq + 0.5));
    return idf * (f * (K1 + 1)) / (f + K1 * (1 - B + B * d.length / avgLength));
  };

  const cue = kindCue(query, job);
  const results: RankedSnippet[] = [];
  for (const d of docs) {
    const queryScore = queryTerms.reduce((sum, t) => sum + bm25(d, t), 0);
    if (queryScore <= 0) continue;
    const jobScore = jobTerms.reduce((sum, t) => sum + JOB_WEIGHT * bm25(d, t), 0);
    const tagMatches = queryTerms.filter((t) => d.tagTokens.has(t)).length;
    const kindBoost = cue !== null && d.snippet.kind === cue ? KIND_BOOST : 0;
    const usesTie = USES_STEP * Math.min(d.snippet.uses, USES_CAP);
    const score = queryScore + jobScore + TAG_BOOST * tagMatches + kindBoost + usesTie;
    if (score > 0) results.push({ snippet: d.snippet, score, filled: fillVariables(d.snippet.text, job) });
  }

  results.sort((a, b) => b.score - a.score || a.snippet.id.localeCompare(b.snippet.id));
  return results.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Word diff
// ---------------------------------------------------------------------------

/** Split into words, each carrying its leading whitespace, plus trailing whitespace pieces. */
function pieces(s: string): string[] {
  return s.match(/\s*\S+|\s+/g) ?? [];
}

/**
 * Word-level diff via LCS. Concatenating the "same" and "del" segments reproduces `a`;
 * concatenating "same" and "add" reproduces `b`. Consecutive segments with the same op
 * are merged.
 */
export function wordDiff(a: string, b: string): DiffSegment[] {
  const at = pieces(a);
  const bt = pieces(b);
  const n = at.length;
  const m = bt.length;

  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = at[i] === bt[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const out: DiffSegment[] = [];
  const push = (op: DiffOp, text: string): void => {
    const last = out[out.length - 1];
    if (last && last.op === op) last.text += text;
    else out.push({ op, text });
  };

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (at[i] === bt[j]) {
      push("same", at[i]);
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      push("del", at[i++]);
    } else {
      push("add", bt[j++]);
    }
  }
  while (i < n) push("del", at[i++]);
  while (j < m) push("add", bt[j++]);
  return out;
}

// ---------------------------------------------------------------------------
// Completion
// ---------------------------------------------------------------------------

function pickBest(hits: Snippet[], job: JobContext): Completion | null {
  if (hits.length === 0) return null;
  const top = [...hits].sort((a, b) => b.uses - a.uses || a.id.localeCompare(b.id))[0];
  return { snippet: top, completion: fillVariables(top.text, job) };
}

/**
 * TextExpander-style completion.
 * - ";tag" (exact, case-insensitive) returns the most-used snippet carrying that tag.
 * - Otherwise, typed text of 3+ characters that prefixes a snippet title wins; failing
 *   that, a prefix of the snippet's opening text. Ties go to the most-used snippet.
 */
export function completionFor(snippets: Snippet[], typed: string, job: JobContext): Completion | null {
  const t = typed.replace(/^\s+/, "");

  if (t.startsWith(";")) {
    const tag = t.slice(1).trim().toLowerCase();
    if (tag === "") return null;
    return pickBest(
      snippets.filter((s) => s.tags.some((x) => x.trim().toLowerCase() === tag)),
      job,
    );
  }

  if (t.length < 3) return null;
  const needle = t.toLowerCase();
  const titleHits = snippets.filter((s) => s.title.trim().toLowerCase().startsWith(needle));
  if (titleHits.length > 0) return pickBest(titleHits, job);
  return pickBest(snippets.filter((s) => s.text.trimStart().toLowerCase().startsWith(needle)), job);
}
