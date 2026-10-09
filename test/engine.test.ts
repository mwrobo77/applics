import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { JobContext, Snippet } from "../src/twin/schema.ts";
import { completionFor, fillVariables, rankSnippets, wordDiff } from "../src/snippets/engine.ts";

const job: JobContext = {
  company: "Lloyds Banking Group",
  role: "Graduate Analyst",
  sector: "Retail banking",
  location: "London",
  description: "Two-year graduate scheme in retail banking analytics, working with customer data and risk.",
};

const base = { createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };

const snippets: Snippet[] = [
  {
    ...base, id: "why-company", title: "Why this company", kind: "cover-letter-part", uses: 4,
    tags: ["why-finance", "motivation"],
    text: "I want to work at {company} because retail banking is where analytics meets real customers. " +
      "The graduate scheme's focus on {sector} matches the credit-risk modelling from my dissertation.",
  },
  {
    ...base, id: "leadership-team", title: "Leading a team through a deadline", kind: "story", uses: 6,
    tags: ["leadership", "teamwork"],
    text: "In my final year I led a team of four on a supply-chain project for a local charity. " +
      "When our data pipeline failed two days before the deadline, I reassigned the tasks, ran daily " +
      "stand-ups and we delivered on time.",
  },
  {
    ...base, id: "strengths-pressure", title: "Handling pressure", kind: "short", uses: 2,
    tags: ["strengths", "resilience"],
    text: "I stay calm when deadlines collide and I am methodical about triage.",
  },
  {
    ...base, id: "python-recon", title: "Python for reconciliation", kind: "paragraph", uses: 1,
    tags: ["python", "data"],
    text: "I built a Python script to reconcile payment files, cutting the monthly close by a day.",
  },
];

describe("fillVariables", () => {
  it("fills known variables case-insensitively", () => {
    assert.equal(
      fillVariables("Dear {COMPANY}, as a {role} in {Sector} based in {location}.", job),
      "Dear Lloyds Banking Group, as a Graduate Analyst in Retail banking based in London.",
    );
  });

  it("leaves a placeholder untouched when the job field is missing or blank", () => {
    const partial: JobContext = { company: "Lloyds", role: "Analyst", sector: "", location: "   " };
    assert.equal(fillVariables("{company} / {sector} / {location}", partial), "Lloyds / {sector} / {location}");
  });

  it("never touches unknown variables", () => {
    assert.equal(fillVariables("Salary {salary} at {company}", job), "Salary {salary} at Lloyds Banking Group");
  });
});

describe("rankSnippets", () => {
  it("puts the 'why us' snippet first for a why-this-firm question", () => {
    const results = rankSnippets(snippets, "Why do you want to work at Lloyds?", job);
    assert.equal(results[0].snippet.id, "why-company");
    assert.match(results[0].filled, /I want to work at Lloyds Banking Group because/);
    assert.ok(!results[0].filled.includes("{company}"));
  });

  it("puts the leadership story first for a 'describe a time you led a team' question", () => {
    const results = rankSnippets(snippets, "Describe a time you led a team", job);
    assert.equal(results[0].snippet.id, "leadership-team");
  });

  it("returns only positive scores, sorted descending, and respects the limit", () => {
    const results = rankSnippets(snippets, "Describe a time you led a team", job);
    for (let i = 0; i < results.length; i++) {
      assert.ok(results[i].score > 0);
      if (i > 0) assert.ok(results[i - 1].score >= results[i].score);
    }
    assert.equal(rankSnippets(snippets, "Describe a time you led a team", job, 1).length, 1);
  });

  it("returns an empty array for an unrelated query", () => {
    assert.deepEqual(rankSnippets(snippets, "What is your favourite colour of paint?", job), []);
  });

  it("returns an empty array for a query made only of stopwords, or no snippets", () => {
    assert.deepEqual(rankSnippets(snippets, "the and of", job), []);
    assert.deepEqual(rankSnippets([], "Why this company?", job), []);
  });
});

describe("wordDiff", () => {
  it("returns a single same segment for identical input", () => {
    assert.deepEqual(wordDiff("same text here", "same text here"), [{ op: "same", text: "same text here" }]);
  });

  it("marks an inserted word as add", () => {
    assert.deepEqual(wordDiff("I led a team", "I led a large team"), [
      { op: "same", text: "I led a" },
      { op: "add", text: " large" },
      { op: "same", text: " team" },
    ]);
  });

  it("marks a removed word as del", () => {
    assert.deepEqual(wordDiff("a big old house", "a big house"), [
      { op: "same", text: "a big" },
      { op: "del", text: " old" },
      { op: "same", text: " house" },
    ]);
  });

  it("reconstructs both inputs from the non-add and non-del segments", () => {
    const a = "I managed  a team of four, then led the pipeline rebuild.";
    const b = "I led a team of six and rebuilt the pipeline.";
    const segs = wordDiff(a, b);
    assert.equal(segs.filter((s) => s.op !== "add").map((s) => s.text).join(""), a);
    assert.equal(segs.filter((s) => s.op !== "del").map((s) => s.text).join(""), b);
    for (let i = 1; i < segs.length; i++) assert.notEqual(segs[i].op, segs[i - 1].op);
  });

  it("handles empty input", () => {
    assert.deepEqual(wordDiff("", ""), []);
    assert.deepEqual(wordDiff("", "new"), [{ op: "add", text: "new" }]);
    assert.deepEqual(wordDiff("gone", ""), [{ op: "del", text: "gone" }]);
  });
});

describe("completionFor", () => {
  it("completes a title prefix (case-insensitive) with the filled text", () => {
    const hit = completionFor(snippets, "WHY THIS", job);
    assert.equal(hit?.snippet.id, "why-company");
    assert.equal(hit?.completion, fillVariables(snippets[0].text, job));
  });

  it("completes a prefix of the snippet's opening text", () => {
    const hit = completionFor(snippets, "In my final year", job);
    assert.equal(hit?.snippet.id, "leadership-team");
  });

  it("ignores typed text shorter than 3 characters", () => {
    assert.equal(completionFor(snippets, "Wh", job), null);
  });

  it("returns null when nothing matches", () => {
    assert.equal(completionFor(snippets, "zzzz", job), null);
  });

  it("expands an exact ;tag to the snippet carrying it", () => {
    const hit = completionFor(snippets, ";leadership", job);
    assert.equal(hit?.snippet.id, "leadership-team");
    assert.match(hit?.completion ?? "", /led a team of four/);
  });

  it("requires an exact tag match and prefers the most-used snippet for a shared tag", () => {
    assert.equal(completionFor(snippets, ";lead", job), null);
    const shared: Snippet[] = [
      { ...snippets[1], id: "a", uses: 2, tags: ["teamwork"] },
      { ...snippets[2], id: "b", uses: 9, tags: ["teamwork"] },
    ];
    assert.equal(completionFor(shared, ";teamwork", job)?.snippet.id, "b");
  });
});
