import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { createApp } from "../src/server.ts";
import { TwinStore } from "../src/twin/store.ts";
import { MockLLM, type LLM } from "../src/llm/provider.ts";

async function boot(llm: LLM = new MockLLM()) {
  const dir = mkdtempSync(join(tmpdir(), "applics-"));
  const path = join(dir, "twin.json");
  const srv = createServer(createApp(new TwinStore(path), llm));
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  const call = async (m: string, p: string, body?: unknown) => {
    const r = await fetch(base + p, { method: m, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, json: await r.json().catch(() => null) as any };
  };
  return { call, path, close: () => { srv.close(); rmSync(dir, { recursive: true, force: true }); } };
}

test("interview → facts → promote → suggest → adapt flow, persisted to disk", async () => {
  const s = await boot();
  try {
    const next = (await s.call("GET", "/api/next")).json;
    assert.ok(next.question && next.progress.total > 50);
    const q = next.question;

    const a = (await s.call("POST", "/api/answer", { questionId: q.id, answer: "Short answer." })).json;
    assert.equal(a.answer.id, q.id);
    assert.notEqual((await s.call("GET", "/api/next")).json.question?.id, q.id, "answered question not repeated");

    assert.equal((await s.call("POST", "/api/answer", { questionId: q.id, answer: "  " })).status, 400);
    assert.equal((await s.call("POST", "/api/answer", { questionId: "nope", answer: "x" })).status, 400);

    const sn = (await s.call("POST", "/api/snippets", {
      title: "Why us", kind: "cover-letter-part", tags: ["Why-Us", "motivation"],
      text: "I want to join {company} because of the client-facing work in {sector}.",
    })).json;
    assert.deepEqual(sn.tags, ["why-us", "motivation"]);

    const sug = (await s.call("POST", "/api/suggest", { question: "Why do you want to work at Lloyds?", job: { company: "Lloyds", sector: "Banking", role: "Placement" } })).json;
    assert.equal(sug.suggestions[0]?.snippet.id, sn.id);
    assert.match(sug.suggestions[0].filled, /join Lloyds .* in Banking/);

    const ad = (await s.call("POST", "/api/adapt", { snippetId: sn.id, question: "Why us?", job: { company: "Lloyds" } })).json;
    assert.ok(ad.adapted.includes("Lloyds") && Array.isArray(ad.diff) && ad.note, "mock mode returns unchanged text with a note");

    const p = (await s.call("POST", "/api/promote", { answerId: q.id })).json;
    assert.equal(p.source, q.id);

    const state = (await s.call("GET", "/api/state")).json;
    assert.equal(state.mode, "mock");
    assert.equal(Object.keys(state.twin.snippets).length, 2);
    assert.equal((await s.call("DELETE", `/api/snippets/${sn.id}`)).status, 200);
  } finally { s.close(); }
});

test("answers with factKey populate facts; follow-ups chain and are capped", async () => {
  const s = await boot();
  try {
    const bank = (await s.call("GET", "/api/bank")).json as any[];
    const fq = bank.find((b) => b.factKey);
    assert.ok(fq);
    await s.call("POST", "/api/answer", { questionId: fq.id, answer: "Alex Example" });
    assert.equal((await s.call("GET", "/api/state")).json.twin.facts[fq.key ?? fq.factKey], "Alex Example");

    const sq = bank.find((b) => b.section === "stories");
    let r = (await s.call("POST", "/api/answer", { questionId: sq.id, answer: "I helped a team once." })).json;
    assert.ok(r.followUp, "thin story answer triggers a probing follow-up");
    let n = 0;
    while (r.followUp && n < 6) {
      r = (await s.call("POST", "/api/answer", { questionId: sq.id, parentId: sq.id, question: r.followUp, answer: "ok" })).json;
      n++;
    }
    assert.ok(n <= 2, `follow-up chain capped (got ${n})`);
  } finally { s.close(); }
});

test("static serving blocks path traversal; unknown routes 404", async () => {
  const dir = mkdtempSync(join(tmpdir(), "applics-"));
  const srv = createServer(createApp(new TwinStore(join(dir, "t.json")), new MockLLM()));
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  try {
    const raw = (path: string) => new Promise<number>((resolve, reject) => {
      import("node:http").then(({ request }) => {
        const u = new URL(base);
        request({ host: u.hostname, port: u.port, path, method: "GET" }, (r) => { r.resume(); resolve(r.statusCode!); }).on("error", reject).end();
      });
    });
    assert.notEqual(await raw("/../package.json"), 200);
    assert.notEqual(await raw("/%2e%2e/package.json"), 200);
    assert.equal(await raw("/api/nope"), 404);
  } finally { srv.close(); rmSync(dir, { recursive: true, force: true }); }
});
