// Core data model for the applicant's "digital twin". Everything is plain JSON so it
// stays human-readable and editable on disk. The applicant's own words are always kept
// verbatim in `answer`/`text`; derived fields never overwrite them.

export type SectionId =
  | "identity" | "logistics" | "education" | "experience" | "projects" | "skills"
  | "stories" | "motivation" | "values" | "strengths" | "interests" | "voice";

/** One question→answer pair, possibly with AI follow-ups chained underneath. */
export interface Answer {
  id: string;               // `${questionId}` or `${questionId}.f${n}` for follow-ups
  questionId: string;
  parentId?: string;        // set for follow-ups
  section: SectionId;
  question: string;
  answer: string;           // applicant's verbatim words
  tags: string[];
  updatedAt: string;        // ISO
}

/** A reusable piece of the applicant's own text, with optional {variables}. */
export interface Snippet {
  id: string;
  title: string;
  text: string;             // may contain {company} {role} {sector} {location}
  tags: string[];           // topics: "leadership", "why-finance", "teamwork" ...
  kind: "short" | "paragraph" | "story" | "cover-letter-part";
  source?: string;          // answer id it was promoted from
  uses: number;
  createdAt: string;
  updatedAt: string;
}

export interface Twin {
  version: 1;
  answers: Record<string, Answer>;
  snippets: Record<string, Snippet>;
  /** Short facts used for fast form filling (name, email, right to work...). */
  facts: Record<string, string>;
  /** Bank question ids the applicant chose to skip. */
  skipped: string[];
}

export interface JobContext {
  company: string;
  role: string;
  sector?: string;
  location?: string;
  description?: string;
  notes?: string;
}

export interface BankQuestion {
  id: string;
  section: SectionId;
  question: string;
  hint?: string;            // what a good answer contains
  tags: string[];
  depth: 1 | 2 | 3;         // 1 = factual, 2 = reflective, 3 = deep/probing
  factKey?: string;         // if set, the answer also populates twin.facts[factKey]
}

export const emptyTwin = (): Twin => ({ version: 1, answers: {}, snippets: {}, facts: {}, skipped: [] });
