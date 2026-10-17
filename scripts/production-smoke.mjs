import { mkdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

const origin = "https://vera-salva-ventures.vercel.app";
const checks = [
  { path: "/", expectedStatus: 200 },
  { path: "/login", expectedStatus: 200 },
  { path: "/api/dashboard", expectedStatus: 401 },
  { path: "/api/assistant/status", expectedStatus: 401 },
];

const results = [];
for (const check of checks) {
  const started = performance.now();
  try {
    const response = await fetch(new URL(check.path, origin), {
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "VERA-production-smoke/1.0" },
    });
    await response.body?.cancel();
    results.push({
      path: check.path,
      expectedStatus: check.expectedStatus,
      status: response.status,
      durationMs: Math.round(performance.now() - started),
      passed: response.status === check.expectedStatus,
    });
  } catch (error) {
    results.push({
      path: check.path,
      expectedStatus: check.expectedStatus,
      status: null,
      durationMs: Math.round(performance.now() - started),
      passed: false,
      error: error instanceof Error ? error.name : "UnknownError",
    });
  }
}

const report = {
  checkedAt: new Date().toISOString(),
  origin,
  workflowSha: process.env.GITHUB_SHA ?? null,
  passed: results.every((result) => result.passed),
  scope: "Public routes and unauthenticated access controls only; no authenticated business, Supabase, or Azure OpenAI acceptance.",
  results,
};

await mkdir("quality-report", { recursive: true });
await writeFile("quality-report/production-smoke.json", `${JSON.stringify(report, null, 2)}\n`, "utf8");

const summary = [
  "## Production smoke check",
  "",
  `- Target: ${origin}`,
  `- Checked (UTC): ${report.checkedAt}`,
  `- Workflow SHA: ${report.workflowSha ?? "local run"}`,
  `- Result: **${report.passed ? "PASS" : "FAIL"}**`,
  "- Scope: public routes and rejection of anonymous requests only.",
  "",
  "| Route | Expected | Actual | Time | Result |",
  "| --- | ---: | ---: | ---: | --- |",
  ...results.map((result) => `| \`${result.path}\` | ${result.expectedStatus} | ${result.status ?? result.error} | ${result.durationMs} ms | ${result.passed ? "PASS" : "FAIL"} |`),
  "",
].join("\n");

console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFile } = await import("node:fs/promises");
  await appendFile(process.env.GITHUB_STEP_SUMMARY, summary, "utf8");
}
if (!report.passed) process.exitCode = 1;
