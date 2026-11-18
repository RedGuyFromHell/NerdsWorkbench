<!-- nc-kit:start -->
## Nerd Castle engineering kit

Stack: `typescript`

Rules (knowledge base at `D:\Projects\NERD-CASTLE`; read both files before writing or reviewing code):
- Core: `D:\Projects\NERD-CASTLE\engineering\coding-guidelines.md`
- Stack: `D:\Projects\NERD-CASTLE\engineering\stacks\typescript.md`

Health gate: run `node tools/check.mjs` before every commit (all steps; `--fast` is what the pre-commit hook runs; `--only <name>` runs one step). Steps live in `check.config.json`.
The pre-commit hook (`.githooks/pre-commit`) runs the fast steps on every commit. `core.hooksPath` is per clone: after a fresh clone, run `node engineering/install.mjs <repo-path>` from the knowledge base once.
Review: `/nc-clean-review [base ref | path]` checks a branch against the rules above. Read-only; it lists findings and never fixes.
Subagents: `.claude/agents/` holds the kit's planner, coder, inspector, test-writer, web-tester, code-crawler and researcher. How to use them: "Subagents" in `D:\Projects\NERD-CASTLE\engineering\README.md`.

**Never commit with `--no-verify`.** Fix what the gate found. Never weaken a test to make it pass.
Managed by the kit, do not edit here (fix them in the knowledge base, then reinstall): `tools/check.mjs`, `tools/lib.mjs`, `.githooks/pre-commit`, `.claude/skills/nc-clean-review/`, the kit's agents in `.claude/agents/`.
<!-- nc-kit:end -->
