# applics

Build a "digital twin" of an applicant through an adaptive interview, then reuse their own words
across applications with TextExpander-style suggestions. Nothing is ever inserted without the
applicant's explicit click or keypress.

## Run

    node src/server.ts            # http://127.0.0.1:3000  (Node >= 22.18, no install step)
    ANTHROPIC_API_KEY=... node src/server.ts   # enable AI follow-ups and adaptation
    npm test

Without a key it runs in offline mode: rule-based follow-ups, no AI adaptation. Data is stored
locally in `data/twin.json` (gitignored). The server binds to loopback only and has no auth.

## Tabs

- **Interview**: 105 questions across 12 sections (facts, stories, motivation, values, voice...), with
  probing follow-ups when answers are thin (no personal contribution, no outcome, no lessons).
- **My twin**: everything you've said, editable. Promote any answer to a reusable snippet.
- **Snippets**: your reusable text with `{company} {role} {sector} {location}` variables and tags.
- **Compose**: enter company/role and the application question; ranked snippets appear with variables
  filled. Insert, Adapt (AI rewrite shown as a diff you accept or reject), or Copy. On a new line in the
  answer box, type a snippet title prefix (3+ chars) or `;tag` and press Tab to expand it.

## Layout

    src/server.ts            HTTP API + static files     src/interview/   question bank, follow-ups
    src/snippets/engine.ts   ranking, variables, diff    src/snippets/adapt.ts   AI adaptation
    src/twin/                schema + JSON store         src/llm/         Claude / mock provider
    web/                     vanilla JS UI (no build)
