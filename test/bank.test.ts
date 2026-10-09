import test from "node:test";
import assert from "node:assert/strict";
import { QUESTION_BANK } from "../src/interview/bank.ts";
import type { SectionId } from "../src/twin/schema.ts";

const SECTIONS: SectionId[] = [
  "identity", "logistics", "education", "experience", "projects", "skills",
  "stories", "motivation", "values", "strengths", "interests", "voice",
];

test("question count is within 90-120", () => {
  assert.ok(QUESTION_BANK.length >= 90 && QUESTION_BANK.length <= 120, `got ${QUESTION_BANK.length}`);
});

test("ids are unique", () => {
  const ids = QUESTION_BANK.map((q) => q.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("every section has at least 4 questions", () => {
  for (const s of SECTIONS) {
    const n = QUESTION_BANK.filter((q) => q.section === s).length;
    assert.ok(n >= 4, `${s} has ${n}`);
  }
});

test("every question has non-empty text, hint and tags", () => {
  for (const q of QUESTION_BANK) {
    assert.ok(q.question.trim().length > 0, `${q.id} question`);
    assert.ok(q.hint && q.hint.trim().length > 0, `${q.id} hint`);
    assert.ok(q.tags.length >= 1, `${q.id} tags`);
    for (const t of q.tags) assert.equal(t, t.toLowerCase(), `${q.id} tag ${t} not lowercase`);
  }
});

test("depth is 1, 2 or 3", () => {
  for (const q of QUESTION_BANK) {
    assert.ok([1, 2, 3].includes(q.depth), `${q.id} depth ${q.depth}`);
  }
});

test("factKeys are unique and snake_case", () => {
  const keys = QUESTION_BANK.map((q) => q.factKey).filter((k): k is string => !!k);
  assert.equal(new Set(keys).size, keys.length);
  for (const k of keys) assert.match(k, /^[a-z][a-z0-9_]*$/, k);
});

test("at least 15 depth-3 questions", () => {
  const n = QUESTION_BANK.filter((q) => q.depth === 3).length;
  assert.ok(n >= 15, `got ${n}`);
});
