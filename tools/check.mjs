#!/usr/bin/env node
// The Nerd Castle health gate. Reads check.config.json from the current directory (the repo root).
//
//   node tools/check.mjs                 all steps
//   node tools/check.mjs --fast          only steps marked "fast": true (the pre-commit hook)
//   node tools/check.mjs --only <name>   one step
//
// check.config.json: { "steps": [ { "name": "...", "command": "...", "level": "fail"|"warn", "fast": true|false } ] }
// Exit code is 1 if any fail-level step failed; warn-level steps never fail the gate.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildSummary, exitCodeOf, parseArgs, selectSteps, statusOf, validateConfig } from "./lib.mjs";

function die(msg) {
  console.error(`check: ${msg}`);
  process.exit(2);
}

/** Run one shell command, mirroring its output live and keeping a copy. */
function runStep(step) {
  return new Promise((resolve) => {
    const started = Date.now();
    let output = "";
    const child = spawn(step.command, { shell: true, cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] });
    const take = (stream) => (chunk) => {
      const text = chunk.toString();
      output += text;
      stream.write(text);
    };
    child.stdout.on("data", take(process.stdout));
    child.stderr.on("data", take(process.stderr));
    child.on("error", (err) => {
      output += `could not start: ${err.message}\n`;
      resolve({ code: 1, output, ms: Date.now() - started });
    });
    child.on("close", (code) => resolve({ code: code ?? 1, output, ms: Date.now() - started }));
  });
}

const args = parseArgs(process.argv.slice(2));
if (args.error) die(args.error);

let config;
try {
  config = JSON.parse(readFileSync(join(process.cwd(), "check.config.json"), "utf8"));
} catch (err) {
  die(`cannot read check.config.json in ${process.cwd()}: ${err.message}`);
}
const problems = validateConfig(config);
if (problems.length) die(`bad check.config.json:\n  ${problems.join("\n  ")}`);

let steps;
try {
  steps = selectSteps(config.steps, args);
} catch (err) {
  die(err.message);
}

const results = [];
for (const step of steps) {
  console.log(`\n> ${step.name}: ${step.command}`);
  const { code, output, ms } = await runStep(step);
  results.push({ name: step.name, status: statusOf(step, code), ms, output });
}

console.log(`\n${buildSummary(results)}`);
process.exit(exitCodeOf(results));
