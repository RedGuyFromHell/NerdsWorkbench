// Pure logic of the health gate: no I/O, so node --test can cover it.

export const TAIL_LINES = 20;

/** Parse argv (without node and script). Returns { fast, only, error }. */
export function parseArgs(argv) {
  const out = { fast: false, only: null, error: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--fast") out.fast = true;
    else if (a === "--only") {
      const v = argv[++i];
      if (!v || v.startsWith("--")) out.error = "--only needs a step name";
      else out.only = v;
    } else out.error = `unknown option: ${a}`;
  }
  return out;
}

/** Check the shape of check.config.json. Returns a list of problems (empty = fine). */
export function validateConfig(config) {
  const problems = [];
  if (!config || !Array.isArray(config.steps) || config.steps.length === 0) {
    return ['config needs a non-empty "steps" array'];
  }
  const seen = new Set();
  config.steps.forEach((s, i) => {
    const where = `steps[${i}]`;
    if (!s || typeof s.name !== "string" || !s.name) problems.push(`${where}: "name" is required`);
    else if (seen.has(s.name)) problems.push(`${where}: duplicate name "${s.name}"`);
    else seen.add(s.name);
    if (!s || typeof s.command !== "string" || !s.command) problems.push(`${where}: "command" is required`);
    if (!s || (s.level !== "fail" && s.level !== "warn")) problems.push(`${where}: "level" must be "fail" or "warn"`);
    if (s && s.fast !== undefined && typeof s.fast !== "boolean") problems.push(`${where}: "fast" must be true or false`);
  });
  return problems;
}

/** Pick the steps to run. Throws on an unknown --only name or when nothing is selected. */
export function selectSteps(steps, { fast = false, only = null } = {}) {
  if (only) {
    const hit = steps.filter((s) => s.name === only);
    if (hit.length === 0) {
      throw new Error(`no step named "${only}" (known: ${steps.map((s) => s.name).join(", ")})`);
    }
    return hit;
  }
  const picked = fast ? steps.filter((s) => s.fast === true) : steps.slice();
  if (picked.length === 0) throw new Error(fast ? "no step is marked fast: true" : "no steps to run");
  return picked;
}

/** PASS on exit 0; otherwise FAIL for a fail-level step and WARN for a warn-level one. */
export function statusOf(step, exitCode) {
  if (exitCode === 0) return "PASS";
  return step.level === "warn" ? "WARN" : "FAIL";
}

/** Last n lines of a block of output, trailing blank lines dropped. */
export function tail(output, n = TAIL_LINES) {
  const lines = String(output).replace(/\r\n/g, "\n").split("\n");
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
  return lines.slice(-n);
}

/** One summary line: "PASS  name  (1.2s)". */
export function summaryLine({ status, name, ms }) {
  return `${status.padEnd(4)}  ${name}  (${(ms / 1000).toFixed(1)}s)`;
}

/** Whole summary text. results: [{ name, status, ms, output }]. */
export function buildSummary(results) {
  const lines = [];
  lines.push("=".repeat(46));
  for (const r of results) lines.push(summaryLine(r));
  lines.push("=".repeat(46));
  for (const r of results) {
    if (r.status === "PASS") continue;
    lines.push(`FAIL> ${r.name}: `);
    const t = tail(r.output);
    if (t.length === 0) lines.push("FAIL>   (no output)");
    for (const l of t) lines.push(`FAIL>   ${l}`);
  }
  const failed = results.filter((r) => r.status === "FAIL").length;
  const warned = results.filter((r) => r.status === "WARN").length;
  lines.push(
    failed > 0
      ? `${failed} of ${results.length} step(s) FAILED${warned ? `, ${warned} warning(s)` : ""}.`
      : `All ${results.length} step(s) passed${warned ? ` (${warned} warning(s), read them above)` : ""}.`,
  );
  return lines.join("\n");
}

/** Non-zero only when a fail-level step failed. Warnings never fail the gate. */
export function exitCodeOf(results) {
  return results.some((r) => r.status === "FAIL") ? 1 : 0;
}
