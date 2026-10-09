// Applics browser UI. Vanilla ES module, no build step.
// Security: all server and user text is inserted with textContent or text nodes.
// innerHTML is never used, so no escaping helper is needed.

const SECTION_ORDER = [
  "identity", "logistics", "education", "experience", "projects", "skills",
  "stories", "motivation", "values", "strengths", "interests", "voice",
];
const SECTION_LABELS = Object.fromEntries(
  SECTION_ORDER.map((s) => [s, s.charAt(0).toUpperCase() + s.slice(1)]),
);
const VIEWS = ["interview", "twin", "snippets", "compose"];
const JOB_FIELDS = ["company", "role", "sector", "location", "description"];
const JOB_KEY = "applics.job.v1";

const app = {
  twin: { version: 1, answers: {}, snippets: {}, facts: {} },
  mode: "mock",
  progress: { answered: 0, total: 0 },
};
const interview = { question: null };
const compose = {
  suggestSeq: 0,
  completeSeq: 0,
  suggestTimer: null,
  completeTimer: null,
  pending: null,
};
const twinOpen = new Map(); // section -> open state, kept across re-renders

const $ = (sel) => document.querySelector(sel);

/** Build an element. Props: class, text, value, checked, dataset, on<event>, others as attributes. */
function h(tag, props, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = String(value);
    else if (key === "value") node.value = String(value);
    else if (key === "dataset") Object.assign(node.dataset, value);
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2), value);
    } else node.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

class ApiError extends Error {}

function errorMessage(e) {
  return e instanceof Error ? e.message : String(e);
}

async function api(path, { method = "GET", body } = {}) {
  const init = { method, headers: {} };
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(path, init);
  } catch {
    throw new ApiError(`Cannot reach the server (${method} ${path}).`);
  }
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    throw new ApiError(data?.error ?? `${method} ${path} failed (${res.status}).`);
  }
  return data;
}

function toast(message, kind = "info") {
  const node = h("div", { class: `toast ${kind}`, role: kind === "error" ? "alert" : "status", text: message });
  $("#toasts").append(node);
  setTimeout(() => node.remove(), kind === "error" ? 6000 : 3000);
}

/** Run fn; on failure show an error toast and return undefined. */
async function safe(fn) {
  try {
    return await fn();
  } catch (e) {
    toast(errorMessage(e), "error");
    return undefined;
  }
}

/** Disable the given controls while fn runs; errors become toasts. */
async function busy(controls, fn) {
  controls.forEach((c) => { c.disabled = true; });
  try {
    return await fn();
  } catch (e) {
    toast(errorMessage(e), "error");
    return undefined;
  } finally {
    controls.forEach((c) => { c.disabled = false; });
  }
}

async function copyText(text) {
  if (!text) {
    toast("Nothing to copy.", "error");
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied to clipboard.");
  } catch {
    const ta = h("textarea", { class: "offscreen" });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    toast(ok ? "Copied to clipboard." : "Copy failed.", ok ? "info" : "error");
  }
}

// ---------- state ----------

async function refreshState() {
  const s = await api("/api/state");
  app.twin = s.twin;
  app.mode = s.mode;
  app.progress = s.progress;
  renderBanner();
  renderProgress();
}

function renderBanner() {
  $("#mode-banner").hidden = app.mode !== "mock";
}

// ---------- routing ----------

function tabFromHash() {
  const name = location.hash.replace(/^#/, "");
  return VIEWS.includes(name) ? name : "interview";
}

async function showTab(name) {
  const tab = VIEWS.includes(name) ? name : "interview";
  for (const v of VIEWS) {
    $(`#${v}`).hidden = v !== tab;
    const btn = $(`#tab-${v}`);
    btn.setAttribute("aria-selected", String(v === tab));
    btn.tabIndex = v === tab ? 0 : -1;
  }
  if (location.hash !== `#${tab}`) history.replaceState(null, "", `#${tab}`);

  if (tab === "interview") await safe(loadNext);
  if (tab === "twin") await safe(async () => { await refreshState(); renderTwin(); });
  if (tab === "snippets") await safe(async () => { await refreshState(); renderSnippets(); });
}

function onTabKeydown(e) {
  const tabs = VIEWS.map((v) => $(`#tab-${v}`));
  const idx = tabs.indexOf(e.target);
  if (idx < 0) return;
  let next;
  if (e.key === "ArrowRight") next = (idx + 1) % tabs.length;
  else if (e.key === "ArrowLeft") next = (idx + tabs.length - 1) % tabs.length;
  else return;
  e.preventDefault();
  tabs[next].focus();
  location.hash = VIEWS[next];
}

// ---------- interview ----------

function renderProgress() {
  const { answered = 0, total = 0 } = app.progress ?? {};
  const pct = total ? Math.round((answered / total) * 100) : 0;
  $("#progress-fill").style.width = `${pct}%`;
  $("#interview .progress").setAttribute("aria-valuenow", String(pct));
  $("#progress-text").textContent = `${answered} of ${total} questions answered`;
}

async function loadNext() {
  const r = await api("/api/next");
  app.progress = r.progress;
  renderProgress();
  showQuestion(r.question);
}

function followUpQuestion(parent, text, depth) {
  return {
    id: `${parent.id}.f`,
    bankId: parent.questionId,
    parentId: parent.id,
    section: parent.section,
    question: text,
    depth: Math.min(3, (depth ?? 1) + 1),
    isFollowUp: true,
  };
}

function showQuestion(q) {
  interview.question = q ?? null;
  $("#q-card").hidden = !q;
  $("#q-done").hidden = Boolean(q);
  if (!q) return;
  $("#q-section").textContent = SECTION_LABELS[q.section] ?? q.section;
  $("#q-depth").textContent = `Depth ${q.depth} of 3`;
  $("#q-followup").hidden = !q.isFollowUp;
  $("#q-text").textContent = q.question;
  $("#q-hint").hidden = !q.hint;
  $("#q-hint").textContent = q.hint ?? "";
  $("#q-answer").value = "";
  $("#q-answer").focus();
}

async function saveAnswer() {
  const q = interview.question;
  if (!q) return;
  const answer = $("#q-answer").value.trim();
  if (!answer) {
    toast("Write an answer, or use Skip.", "error");
    return;
  }
  await busy([$("#q-save"), $("#q-skip")], async () => {
    const r = await api("/api/answer", {
      method: "POST",
      body: {
        questionId: q.bankId ?? q.id,
        parentId: q.parentId,
        question: q.question,
        answer,
        section: q.section,
      },
    });
    if (r.followUp) {
      await refreshState();
      showQuestion(followUpQuestion(r.answer, r.followUp, q.depth));
    } else {
      await loadNext();
    }
  });
}

async function skipQuestion() {
  const q = interview.question;
  if (!q) return;
  await busy([$("#q-save"), $("#q-skip")], async () => {
    await api("/api/skip", { method: "POST", body: { questionId: q.id } });
    await loadNext();
  });
}

// ---------- my twin ----------

function renderTwin() {
  renderTwinAnswers();
  renderFacts();
}

function renderTwinAnswers() {
  const box = $("#twin-answers");
  box.replaceChildren();
  const answers = Object.values(app.twin.answers ?? {});
  if (!answers.length) {
    box.append(h("p", { class: "muted", text: "No answers yet. Answer some questions in the Interview tab." }));
    return;
  }
  for (const section of SECTION_ORDER) {
    const items = answers.filter((a) => a.section === section);
    if (!items.length) continue;
    const details = h(
      "details",
      { class: "section", open: twinOpen.get(section) ?? true, ontoggle: (e) => twinOpen.set(section, e.currentTarget.open) },
      h("summary", { text: `${SECTION_LABELS[section]} (${items.length})` }),
      items.map(answerItem),
    );
    box.append(details);
  }
}

function answerItem(a) {
  const ta = h("textarea", { rows: 4, "aria-label": `Answer to: ${a.question}` });
  ta.value = a.answer;
  const saveBtn = h("button", { type: "button", text: "Save" });
  const promoteBtn = h("button", { type: "button", text: "Make snippet" });
  saveBtn.addEventListener("click", () => saveAnswerEdit(a, ta.value, [saveBtn, promoteBtn]));
  promoteBtn.addEventListener("click", () => promoteAnswer(a, [saveBtn, promoteBtn]));
  return h(
    "div",
    { class: "answer" },
    h("p", { class: "question-small", text: a.question }),
    ta,
    h("div", { class: "actions" }, promoteBtn, saveBtn),
  );
}

async function saveAnswerEdit(a, text, controls) {
  const answer = text.trim();
  if (!answer) {
    toast("An answer cannot be empty.", "error");
    return;
  }
  await busy(controls, async () => {
    await api(`/api/answers/${encodeURIComponent(a.id)}`, { method: "PUT", body: { answer } });
    await refreshState();
    renderTwinAnswers();
    toast("Answer saved.");
  });
}

async function promoteAnswer(a, controls) {
  await busy(controls, async () => {
    const snippet = await api("/api/promote", { method: "POST", body: { answerId: a.id } });
    await refreshState();
    toast(`Snippet created: ${snippet.title}`);
  });
}

function renderFacts() {
  const body = $("#facts-body");
  body.replaceChildren();
  const entries = Object.entries(app.twin.facts ?? {}).sort(([a], [b]) => a.localeCompare(b));
  if (!entries.length) {
    body.append(h("tr", {}, h("td", { colspan: 3, class: "muted", text: "No facts yet." })));
    return;
  }
  for (const [key, value] of entries) body.append(factRow(key, value));
}

function factRow(key, value) {
  const input = h("input", { type: "text", "aria-label": `Value for ${key}`, value });
  const saveBtn = h("button", { type: "button", text: "Save" });
  saveBtn.addEventListener("click", () => saveFact(key, input.value, [saveBtn]));
  return h(
    "tr",
    {},
    h("th", { scope: "row", text: key }),
    h("td", {}, input),
    h("td", {}, saveBtn),
  );
}

async function saveFact(key, value, controls) {
  await busy(controls, async () => {
    await api("/api/facts", { method: "POST", body: { key, value } });
    await refreshState();
    renderFacts();
    toast(`Saved ${key}.`);
  });
}

// ---------- snippets ----------

function renderSnippets() {
  const query = $("#snip-search").value.trim().toLowerCase();
  const all = Object.values(app.twin.snippets ?? {}).sort((a, b) =>
    String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")),
  );
  const list = all.filter((s) =>
    !query || [s.title, s.text, ...(s.tags ?? [])].join(" ").toLowerCase().includes(query),
  );
  $("#snip-count").textContent = `${list.length} of ${all.length} snippets`;
  const box = $("#snip-list");
  box.replaceChildren();
  if (!list.length) {
    box.append(h("p", {
      class: "muted",
      text: all.length
        ? "No snippets match your search."
        : 'No snippets yet. Create one, or use "Make snippet" on an answer.',
    }));
    return;
  }
  for (const s of list) box.append(snippetCard(s));
}

function snippetCard(s) {
  const editBtn = h("button", { type: "button", text: "Edit" });
  const deleteBtn = h("button", { type: "button", class: "danger", text: "Delete" });
  editBtn.addEventListener("click", () => openSnippetForm(s));
  deleteBtn.addEventListener("click", () => deleteSnippet(s, [editBtn, deleteBtn]));
  return h(
    "article",
    { class: "card snippet" },
    h(
      "div",
      { class: "meta" },
      h("strong", { text: s.title }),
      h("span", { class: "pill", text: s.kind }),
      h("span", { class: "muted", text: `used ${s.uses ?? 0} times` }),
    ),
    h("p", { class: "pre", text: s.text }),
    s.tags?.length ? h("p", {}, s.tags.map((t) => h("span", { class: "tag", text: t }))) : null,
    h("div", { class: "actions" }, editBtn, deleteBtn),
  );
}

function parseTags(raw) {
  return raw.split(",").map((t) => t.trim()).filter(Boolean);
}

function openSnippetForm(s = null) {
  const form = $("#snip-form");
  form.hidden = false;
  $("#snip-id").value = s?.id ?? "";
  $("#snip-title").value = s?.title ?? "";
  $("#snip-text").value = s?.text ?? "";
  $("#snip-tags").value = (s?.tags ?? []).join(", ");
  $("#snip-kind").value = s?.kind ?? "short";
  form.scrollIntoView({ block: "nearest" });
  $("#snip-title").focus();
}

function closeSnippetForm() {
  $("#snip-form").hidden = true;
}

async function submitSnippet(e) {
  e.preventDefault();
  const title = $("#snip-title").value.trim();
  const text = $("#snip-text").value.trim();
  if (!title || !text) {
    toast("Title and text are required.", "error");
    return;
  }
  const id = $("#snip-id").value;
  const body = { title, text, tags: parseTags($("#snip-tags").value), kind: $("#snip-kind").value };
  if (id) body.id = id;
  await busy([e.submitter].filter(Boolean), async () => {
    await api("/api/snippets", { method: "POST", body });
    await refreshState();
    closeSnippetForm();
    renderSnippets();
    toast("Snippet saved.");
  });
}

async function deleteSnippet(s, controls) {
  if (!window.confirm(`Delete snippet "${s.title}"?`)) return;
  await busy(controls, async () => {
    await api(`/api/snippets/${encodeURIComponent(s.id)}`, { method: "DELETE" });
    await refreshState();
    renderSnippets();
    toast("Snippet deleted.");
  });
}

// ---------- compose ----------

function readJob() {
  const form = $("#job-form");
  const job = { company: form.elements.company.value.trim(), role: form.elements.role.value.trim() };
  for (const key of ["sector", "location", "description"]) {
    const v = form.elements[key].value.trim();
    if (v) job[key] = v;
  }
  return job;
}

function saveJobLocal() {
  try {
    const form = $("#job-form");
    const data = Object.fromEntries(JOB_FIELDS.map((k) => [k, form.elements[k].value]));
    localStorage.setItem(JOB_KEY, JSON.stringify(data));
  } catch {
    // Storage may be unavailable (private mode); the form still works.
  }
}

function loadJobLocal() {
  try {
    const raw = localStorage.getItem(JOB_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    const form = $("#job-form");
    for (const key of JOB_FIELDS) {
      if (typeof data[key] === "string") form.elements[key].value = data[key];
    }
  } catch {
    // Ignore corrupt or unavailable storage.
  }
}

function scheduleSuggest() {
  clearTimeout(compose.suggestTimer);
  compose.suggestTimer = setTimeout(runSuggest, 250);
}

async function runSuggest() {
  const question = $("#c-question").value.trim();
  const seq = ++compose.suggestSeq;
  if (!question) {
    renderSuggestions([]);
    return;
  }
  try {
    const r = await api("/api/suggest", { method: "POST", body: { question, job: readJob() } });
    if (seq !== compose.suggestSeq) return;
    renderSuggestions(r.suggestions ?? []);
  } catch (e) {
    if (seq === compose.suggestSeq) toast(errorMessage(e), "error");
  }
}

function renderSuggestions(list) {
  const box = $("#c-suggestions");
  box.replaceChildren();
  if (!list.length) {
    box.append(h("p", {
      class: "muted",
      text: $("#c-question").value.trim() ? "No matching snippets." : "Type a question to see snippet suggestions.",
    }));
    return;
  }
  const sorted = [...list].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  for (const item of sorted) box.append(suggestionCard(item));
}

function suggestionCard({ snippet, score, filled }) {
  const adaptBox = h("div", { class: "adapt", hidden: true });
  const insertBtn = h("button", { type: "button", class: "primary", text: "Insert" });
  const adaptBtn = h("button", { type: "button", text: "Adapt" });
  const copyBtn = h("button", { type: "button", text: "Copy" });
  insertBtn.addEventListener("click", () => insertSnippet(snippet.id, filled));
  adaptBtn.addEventListener("click", () => adaptSnippet(snippet, adaptBox, [adaptBtn]));
  copyBtn.addEventListener("click", () => copyText(filled));
  return h(
    "article",
    { class: "card suggestion" },
    h(
      "div",
      { class: "meta" },
      h("strong", { text: snippet.title }),
      h("span", { class: "pill", text: `score ${Number(score ?? 0).toFixed(2)}` }),
    ),
    h("p", { class: "pre", text: filled }),
    h("div", { class: "actions" }, insertBtn, adaptBtn, copyBtn),
    adaptBox,
  );
}

async function recordUse(snippetId) {
  if (!snippetId) return;
  try {
    await api("/api/use", { method: "POST", body: { snippetId } });
  } catch (e) {
    toast(errorMessage(e), "error");
  }
}

function appendToAnswer(text) {
  const ta = $("#c-answer");
  const current = ta.value.replace(/\s+$/, "");
  ta.value = current ? `${current}\n\n${text.trim()}` : text.trim();
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);
  clearSuggestion();
  updateWordCount();
}

async function insertSnippet(snippetId, filled) {
  appendToAnswer(filled);
  await recordUse(snippetId);
}

async function adaptSnippet(snippet, box, controls) {
  box.hidden = false;
  box.replaceChildren(h("p", { class: "muted", text: "Adapting..." }));
  await busy(controls, async () => {
    const r = await api("/api/adapt", {
      method: "POST",
      body: { snippetId: snippet.id, question: $("#c-question").value.trim(), job: readJob() },
    });
    box.replaceChildren(...adaptPanel(snippet, r, box));
  });
}

/** Word diff with Accept/Reject. Nothing touches the answer box until Accept is clicked. */
function adaptPanel(snippet, result, box) {
  const segments = (result.diff ?? []).map((seg) => {
    if (seg.op === "add") return h("ins", { text: seg.text });
    if (seg.op === "del") return h("del", { text: seg.text });
    return h("span", { text: seg.text });
  });
  const acceptBtn = h("button", { type: "button", class: "primary", text: "Accept" });
  const rejectBtn = h("button", { type: "button", text: "Reject" });
  const close = () => {
    box.hidden = true;
    box.replaceChildren();
  };
  acceptBtn.addEventListener("click", async () => {
    appendToAnswer(result.adapted ?? "");
    close();
    await recordUse(snippet.id);
  });
  rejectBtn.addEventListener("click", close);
  return [
    h("p", { class: "muted", text: "Proposed adaptation. Nothing changes until you accept." }),
    h("div", { class: "diff", role: "region", "aria-label": "Proposed changes" }, segments),
    result.note ? h("p", { class: "muted", text: result.note }) : null,
    h("div", { class: "actions" }, rejectBtn, acceptBtn),
  ];
}

function countWords(text) {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

function updateWordCount() {
  const n = countWords($("#c-answer").value);
  $("#c-wc").textContent = `${n} word${n === 1 ? "" : "s"}`;
}

// Predictive text: the completion is shown in a suggestion bar under the answer box.
// Tab accepts it and Esc dismisses it, and the answer text never changes without that key press or click.

function showSuggestion(text) {
  compose.pending = text;
  $("#c-suggest-text").textContent = text;
  $("#c-suggest-bar").hidden = false;
}

function clearSuggestion() {
  compose.pending = null;
  $("#c-suggest-text").textContent = "";
  $("#c-suggest-bar").hidden = true;
}

function caretAtEnd(ta) {
  return ta.selectionStart === ta.value.length && ta.selectionEnd === ta.value.length;
}

function acceptSuggestion() {
  const completion = compose.pending;
  if (!completion) return;
  const ta = $("#c-answer");
  // The trigger the user typed (their last line) is replaced by the snippet text.
  const cut = ta.value.length - lastLine(ta.value).length;
  ta.value = ta.value.slice(0, cut) + completion;
  ta.setSelectionRange(ta.value.length, ta.value.length);
  clearSuggestion();
  updateWordCount();
  scheduleComplete();
}

function scheduleComplete() {
  clearTimeout(compose.completeTimer);
  if (!$("#c-answer").value.trim()) return;
  compose.completeTimer = setTimeout(runComplete, 350);
}

function lastLine(text) {
  return text.slice(text.lastIndexOf("\n") + 1).trimStart();
}

async function runComplete() {
  const ta = $("#c-answer");
  const value = ta.value;
  const typed = lastLine(value);
  const seq = ++compose.completeSeq;
  if (typed.trim().length < 2) return;
  try {
    const r = await api("/api/complete", { method: "POST", body: { typed, job: readJob() } });
    // Ignore responses for text the user has since changed.
    if (seq !== compose.completeSeq || ta.value !== value) return;
    if (r?.completion && caretAtEnd(ta)) showSuggestion(r.completion);
  } catch (e) {
    if (seq === compose.completeSeq) toast(errorMessage(e), "error");
  }
}

function onAnswerKeydown(e) {
  if (!compose.pending) return;
  if (e.key === "Tab" && !e.shiftKey && !e.ctrlKey && !e.altKey && caretAtEnd(e.currentTarget)) {
    e.preventDefault();
    acceptSuggestion();
  } else if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    clearSuggestion();
  }
}

function onAnswerInput() {
  clearSuggestion();
  updateWordCount();
  scheduleComplete();
}

// ---------- wiring ----------

function wireInterview() {
  $("#q-save").addEventListener("click", () => safe(saveAnswer));
  $("#q-skip").addEventListener("click", () => safe(skipQuestion));
  $("#q-answer").addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      safe(saveAnswer);
    }
  });
}

function wireTwin() {
  $("#fact-add").addEventListener("submit", (e) => {
    e.preventDefault();
    const key = $("#fact-key").value.trim();
    if (!key) return;
    const controls = [...e.currentTarget.querySelectorAll("button")];
    saveFact(key, $("#fact-value").value.trim(), controls).then(() => {
      $("#fact-key").value = "";
      $("#fact-value").value = "";
    });
  });
}

function wireSnippets() {
  $("#snip-search").addEventListener("input", renderSnippets);
  $("#snip-new").addEventListener("click", () => openSnippetForm());
  $("#snip-cancel").addEventListener("click", closeSnippetForm);
  $("#snip-form").addEventListener("submit", submitSnippet);
}

function wireCompose() {
  const jobForm = $("#job-form");
  jobForm.addEventListener("input", () => {
    saveJobLocal();
    if ($("#c-question").value.trim()) scheduleSuggest();
    if ($("#c-answer").value.trim()) scheduleComplete();
  });
  $("#c-question").addEventListener("input", scheduleSuggest);

  const answer = $("#c-answer");
  answer.addEventListener("input", onAnswerInput);
  answer.addEventListener("keydown", onAnswerKeydown);
  $("#c-suggest-accept").addEventListener("click", acceptSuggestion);
  $("#c-suggest-dismiss").addEventListener("click", clearSuggestion);
  $("#c-copy-all").addEventListener("click", () => copyText($("#c-answer").value));
}

function init() {
  window.addEventListener("unhandledrejection", (e) => toast(errorMessage(e.reason), "error"));
  window.addEventListener("hashchange", () => showTab(tabFromHash()));
  for (const v of VIEWS) {
    $(`#tab-${v}`).addEventListener("click", () => { location.hash = v; });
  }
  $(".tabs").addEventListener("keydown", onTabKeydown);

  wireInterview();
  wireTwin();
  wireSnippets();
  wireCompose();
  loadJobLocal();
  updateWordCount();

  safe(refreshState).then(() => showTab(tabFromHash()));
}

init();
