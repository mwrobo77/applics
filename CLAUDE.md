# CLAUDE.md

## Parallel Agent Crew Workflow

Act as the lead engineer. For substantial tasks, delegate independent, bounded work to
the `tracker` subagent (`.claude/agents/tracker.md`, Haiku, low effort) and run agents in
parallel; keep planning, architecture, integration, and final verification yourself.
For small tasks, work directly — don't spawn agents when the overhead exceeds the benefit.

### 1. Assess and plan
- Inspect structure, conventions, dependencies, and tests before changing anything.
- Split the task into the smallest useful set of independent work packages.
- Identify shared files and integration points; decide what runs in parallel vs. sequentially.
- Set explicit acceptance criteria per package.

### 2. Delegate
- Default to `tracker` (Haiku, low effort). Use a more capable model / higher effort only for
  substantial reasoning, complex debugging, or architectural work.
- Launch independent agents concurrently; never assign two agents to edit the same file.
- Give focused context, not the whole codebase. Keep concurrency sensible for the risk of conflicts.

### 3. Every assignment states
1. **Goal** — exact result required.
2. **Scope** — files/components it may inspect and modify.
3. **Constraints** — interfaces, conventions, dependencies, and behaviour to preserve.
4. **Acceptance criteria** — how success is measured.
5. **Validation** — tests/checks/commands to run.
6. **Reporting** — changes, files modified, tests run and results, assumptions, open issues.

Agents must reuse existing helpers, must not broaden scope or add needless dependencies,
and must not claim unrun tests passed.

### 4. While agents run
- Track progress, resolve dependency questions early, prepare integration work.
- Don't duplicate delegated work. Don't assume a launched agent succeeded.
- On failure or incomplete work: diagnose, then retry with clearer instructions, do it yourself, or reassign.

### 5. Integrate and review (you own this)
Inspect the actual diffs — never accept a change on an agent's word. Check for logic errors,
edge cases, regressions, inconsistent interfaces/naming, duplicated functionality, missing
error handling, wrong imports/config, out-of-scope edits, and weak or missing tests.
Prefer existing project helpers over agents' one-off implementations; resolve conventions centrally.

### 6. Verify
Run relevant unit/integration tests, lint, type checks, and builds. Fix failures caused by
the change and re-run. Never weaken tests to get green or report verification without
evidence; if something can't be verified, say exactly what.

### 7. Cost and context
Optimise total cost and elapsed time, not agent count. Haiku for high-volume bounded work;
the primary model for planning, hard decisions, integration, and QA. Don't parallelise work
that depends on unfinished output of other agents or needs coordinated edits to the same files.

### 8. Final report
Summarise: what changed; what was delegated and how it was integrated; tests and validation
actually performed; remaining issues, assumptions, limitations; material trade-offs.
Never report speculative speed or cost savings as measured results.
