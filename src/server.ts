import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { TwinStore } from "./twin/store.ts";
import type { Answer, JobContext, Snippet } from "./twin/schema.ts";
import { QUESTION_BANK } from "./interview/bank.ts";
import { followUp } from "./interview/interviewer.ts";
import { rankSnippets, completionFor, wordDiff, fillVariables } from "./snippets/engine.ts";
import { adaptText } from "./snippets/adapt.ts";
import { pickLLM, type LLM } from "./llm/provider.ts";

const WEB_ROOT = resolve("web");
const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml",
};
const now = () => new Date().toISOString();

class HttpError extends Error {
  status: number;
  constructor(status: number, msg: string) { super(msg); this.status = status; }
}

async function readJson(req: IncomingMessage): Promise<any> {
  let size = 0; const chunks: Buffer[] = [];
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > 1_000_000) throw new HttpError(413, "Body too large");
    chunks.push(c as Buffer);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new HttpError(400, "Invalid JSON"); }
}

const str = (v: unknown, max = 20000) => (typeof v === "string" ? v.slice(0, max) : "");
const job = (v: any): JobContext => ({
  company: str(v?.company, 200), role: str(v?.role, 200), sector: str(v?.sector, 200),
  location: str(v?.location, 200), description: str(v?.description, 8000), notes: str(v?.notes, 2000),
});
const tagList = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((t) => str(t, 50).trim().toLowerCase()).filter(Boolean).slice(0, 20) : [];

export function createApp(store: TwinStore, llm: LLM) {
  const { twin } = store;
  const bankById = new Map(QUESTION_BANK.map((q) => [q.id, q]));
  const answeredBank = () => QUESTION_BANK.filter((q) => twin.answers[q.id]);
  const progress = () => ({ answered: answeredBank().length, total: QUESTION_BANK.length });

  type Handler = (body: any, params: string[]) => Promise<unknown> | unknown;
  const routes: [string, RegExp, Handler][] = [];
  const route = (m: string, p: string, h: Handler) => routes.push([m, new RegExp(`^${p}$`), h]);

  route("GET", "/api/state", () => ({ mode: llm.name === "claude" ? "claude" : "mock", twin, progress: progress() }));
  route("GET", "/api/bank", () => QUESTION_BANK);
  route("GET", "/api/next", () => {
    const q = QUESTION_BANK.find((b) => !twin.answers[b.id] && !twin.skipped.includes(b.id)) ?? null;
    return { question: q && { ...q, isFollowUp: false }, progress: progress() };
  });

  route("POST", "/api/answer", async (b) => {
    const text = str(b.answer).trim();
    if (!text) throw new HttpError(400, "Answer is empty");
    const parentId = str(b.parentId) || undefined;
    const bank = bankById.get(str(b.questionId));
    if (!bank) throw new HttpError(400, "Unknown questionId");
    const chain = Object.values(twin.answers).filter((a) => a.questionId === bank.id && a.parentId).length;
    const id = parentId ? `${bank.id}.f${chain + 1}` : bank.id;
    const ans: Answer = {
      id, questionId: bank.id, parentId, section: bank.section,
      question: parentId ? str(b.question, 500) || "Follow-up" : bank.question,
      answer: text, tags: bank.tags, updatedAt: now(),
    };
    twin.answers[id] = ans;
    twin.skipped = twin.skipped.filter((s) => s !== bank.id);
    if (!parentId && bank.factKey) twin.facts[bank.factKey] = text;
    store.save();
    const fu = await followUp(llm, { question: ans.question, section: bank.section, answer: text, chainLength: parentId ? chain + 1 : 0 });
    return { answer: ans, followUp: fu };
  });
  route("PUT", "/api/answers/([^/]+)", (b, [id]) => {
    const a = twin.answers[id];
    if (!a) throw new HttpError(404, "No such answer");
    a.answer = str(b.answer).trim() || a.answer; a.updatedAt = now(); store.save();
    const bank = bankById.get(a.questionId);
    if (bank?.factKey && !a.parentId) twin.facts[bank.factKey] = a.answer;
    store.save();
    return a;
  });
  route("POST", "/api/skip", (b) => {
    const id = str(b.questionId);
    if (bankById.has(id) && !twin.skipped.includes(id)) { twin.skipped.push(id); store.save(); }
    return { ok: true };
  });
  route("PUT", "/api/facts", (b) => {
    twin.facts = Object.fromEntries(Object.entries(b ?? {}).map(([k, v]) => [str(k, 80), str(v, 2000)]));
    store.save(); return twin.facts;
  });

  route("POST", "/api/snippets", (b) => {
    const existing = b.id ? twin.snippets[str(b.id)] : undefined;
    if (b.id && !existing) throw new HttpError(404, "No such snippet");
    const text = str(b.text).trim();
    if (!text) throw new HttpError(400, "Snippet text is empty");
    const kinds = ["short", "paragraph", "story", "cover-letter-part"];
    const s: Snippet = {
      id: existing?.id ?? randomUUID(), title: str(b.title, 200).trim() || text.slice(0, 40),
      text, tags: tagList(b.tags), kind: kinds.includes(b.kind) ? b.kind : "paragraph",
      source: existing?.source, uses: existing?.uses ?? 0, createdAt: existing?.createdAt ?? now(), updatedAt: now(),
    };
    twin.snippets[s.id] = s; store.save(); return s;
  });
  route("DELETE", "/api/snippets/([^/]+)", (_b, [id]) => { delete twin.snippets[id]; store.save(); return { ok: true }; });
  route("POST", "/api/promote", (b) => {
    const a = twin.answers[str(b.answerId)];
    if (!a) throw new HttpError(404, "No such answer");
    const kind = a.section === "stories" ? "story" : a.section === "motivation" ? "cover-letter-part"
      : a.answer.split(/\s+/).length < 25 ? "short" : "paragraph";
    const s: Snippet = {
      id: randomUUID(), title: a.question.slice(0, 80), text: a.answer, tags: a.tags, kind,
      source: a.id, uses: 0, createdAt: now(), updatedAt: now(),
    };
    twin.snippets[s.id] = s; store.save(); return s;
  });
  route("POST", "/api/use", (b) => {
    const s = twin.snippets[str(b.snippetId)];
    if (s) { s.uses++; store.save(); }
    return { ok: true };
  });

  route("POST", "/api/suggest", (b) => ({
    suggestions: rankSnippets(Object.values(twin.snippets), str(b.question, 2000), job(b.job)),
  }));
  route("POST", "/api/complete", (b) => completionFor(Object.values(twin.snippets), str(b.typed, 500), job(b.job)) ?? null);
  route("POST", "/api/adapt", async (b) => {
    const j = job(b.job);
    const sn = b.snippetId ? twin.snippets[str(b.snippetId)] : undefined;
    const original = sn ? fillVariables(sn.text, j) : str(b.text);
    if (!original.trim()) throw new HttpError(400, "Nothing to adapt");
    const { adapted, note } = await adaptText(llm, { text: original, question: str(b.question, 2000), job: j });
    return { adapted, diff: wordDiff(original, adapted), note };
  });

  return async function handle(req: IncomingMessage, res: ServerResponse) {
    const send = (status: number, body: unknown, type = "application/json") => {
      res.writeHead(status, { "content-type": type, "x-content-type-options": "nosniff", "cache-control": "no-store" });
      res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
    };
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      const method = req.method ?? "GET";
      if (url.pathname.startsWith("/api/")) {
        for (const [m, re, h] of routes) {
          const match = m === method && re.exec(url.pathname);
          if (match) {
            const body = method === "GET" || method === "DELETE" ? {} : await readJson(req);
            return send(200, await h(body, match.slice(1).map(decodeURIComponent)));
          }
        }
        throw new HttpError(404, "Not found");
      }
      if (method !== "GET") throw new HttpError(405, "Method not allowed");
      const rel = url.pathname === "/" ? "index.html" : normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/, "");
      const file = resolve(join(WEB_ROOT, rel));
      if (!file.startsWith(WEB_ROOT + "/") ) throw new HttpError(403, "Forbidden");
      try { return send(200, await readFile(file), MIME[extname(file)] ?? "application/octet-stream"); }
      catch { throw new HttpError(404, "Not found"); }
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      send(status, { error: status === 500 ? "Internal error" : (e as Error).message });
      if (status === 500) console.error(e);
    }
  };
}

if (import.meta.main) {
  const port = Number(process.env.PORT ?? 3000);
  const llm = pickLLM();
  // Bind to loopback only: the twin contains personal data and there is no auth.
  createServer(createApp(new TwinStore(process.env.TWIN_PATH ?? "data/twin.json"), llm)).listen(port, "127.0.0.1", () =>
    console.log(`applics running at http://127.0.0.1:${port}  (AI: ${llm.name})`));
}
