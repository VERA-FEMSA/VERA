import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import demoUsers from "../backend/data/users.js";

const candidate = process.env.VERA_PREVIEW_URL;
let origin;
try {
  const url = new URL(candidate);
  if (
    url.protocol !== "https:" ||
    !/^vera-[a-z0-9]{6,32}-(?:salva-ventures|carlos-sanchez-it)\.vercel\.app$/.test(url.hostname) ||
    url.username || url.password || url.port ||
    url.pathname !== "/" || url.search || url.hash
  ) throw new Error("invalid preview origin");
  origin = url.origin;
} catch {
  console.error("VERA_PREVIEW_URL must be an isolated VERA preview deployment origin; production is not accepted.");
  process.exit(2);
}

const roles = [
  { username: "superadmin", role: "SUPER_ADMIN" },
  { username: "demo", role: "DIRECTOR" },
  { username: "gerente", role: "GERENTE" },
  { username: "auditor", role: "AUDITOR" },
  { username: "jefatura", role: "JEFATURA" },
];
const sharedRoutes = [
  "/api/dashboard", "/api/planning", "/api/planning/active",
  "/api/planning/search?q=VERA", "/api/risks", "/api/controls",
  "/api/evidence", "/api/notifications", "/api/findings",
  "/api/audit/recent", "/api/assistant/status",
];
const restrictedRoutes = [
  { path: "/api/audit", allowed: ["SUPER_ADMIN"] },
  { path: "/api/users", allowed: ["SUPER_ADMIN", "DIRECTOR"] },
  { path: "/api/risks/owners", allowed: ["SUPER_ADMIN", "GERENTE"] },
  { path: "/api/planning/auditors", allowed: ["SUPER_ADMIN", "GERENTE", "JEFATURA"] },
];
const results = [];

function statusLabel(status) {
  switch (status) {
    case 200: return "200";
    case 401: return "401";
    case 403: return "403";
    case 404: return "404";
    case 429: return "429";
    case 500: return "500";
    case 502: return "502";
    case 503: return "503";
    default: return "other";
  }
}

async function request(label, path, expectedStatus, token, inspect) {
  const started = performance.now();
  try {
    const response = await fetch(new URL(path, origin), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    let contentPassed = true;
    if (inspect && response.status === expectedStatus) {
      const body = await response.json();
      contentPassed = inspect(body);
    } else {
      await response.body?.cancel();
    }
    results.push({
      label, path, expectedStatus,
      status: statusLabel(response.status),
      durationMs: Math.round(performance.now() - started),
      passed: response.status === expectedStatus && contentPassed,
    });
  } catch {
    results.push({
      label, path, expectedStatus, status: "request-error",
      durationMs: Math.round(performance.now() - started), passed: false,
    });
  }
}

for (const path of ["/api/dashboard", "/api/users", "/api/assistant/status"]) {
  await request("anonymous", path, 401);
}

for (const { username, role } of roles) {
  const fixture = demoUsers.find((user) => user.username === username && user.role === role && user.status === "ACTIVE");
  if (!fixture?.password) throw new Error(`Missing active demo fixture for ${role}`);

  const started = performance.now();
  let token;
  try {
    const response = await fetch(new URL("/api/auth/login", origin), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password: fixture.password }),
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    const body = response.status === 200 ? await response.json() : null;
    if (!body) await response.body?.cancel();
    if (body?.user?.role === role && typeof body.token === "string" && body.token.length > 0) token = body.token;
    results.push({
      label: role, path: "POST /api/auth/login", expectedStatus: 200,
      status: statusLabel(response.status), durationMs: Math.round(performance.now() - started),
      passed: Boolean(token) && response.status === 200,
    });
  } catch {
    results.push({
      label: role, path: "POST /api/auth/login", expectedStatus: 200,
      status: "request-error", durationMs: Math.round(performance.now() - started), passed: false,
    });
  }
  if (!token) continue;

  for (const path of sharedRoutes) {
    const inspect = path === "/api/assistant/status"
      ? (body) => body?.available === false && body?.reason === "persistent-stores-required"
      : undefined;
    await request(role, path, 200, token, inspect);
  }
  for (const { path, allowed } of restrictedRoutes) {
    const expectedStatus = allowed.includes(role) ? 200 : 403;
    const inspect = path === "/api/users" && role === "SUPER_ADMIN"
      ? (body) => Array.isArray(body?.users) && body.users.length > 0 &&
          body.users.every((user) => typeof user.email === "string" && user.email.endsWith("@vera.local"))
      : undefined;
    await request(role, path, expectedStatus, token, inspect);
  }
}

const passedCount = results.filter((result) => result.passed).length;
const report = {
  checkedAt: new Date().toISOString(), origin,
  workflowSha: process.env.GITHUB_SHA ?? null,
  scope: "Isolated public preview with in-memory demo fixtures; read-only API checks after login. No Supabase or Azure production acceptance.",
  passed: passedCount === results.length,
  passedCount, totalCount: results.length, results,
};
await mkdir("quality-report", { recursive: true });
await writeFile("quality-report/preview-role-acceptance.json", `${JSON.stringify(report, null, 2)}\n`, "utf8");

const summary = [
  "## Preview role acceptance",
  "",
  `- Preview: ${origin}`,
  `- Checked (UTC): ${report.checkedAt}`,
  `- Workflow SHA: ${report.workflowSha ?? "local run"}`,
  `- Result: **${report.passed ? "PASS" : "FAIL"}**, ${passedCount}/${results.length} checks`,
  "- Scope: demo accounts and read-only endpoints in isolated memory mode; no real Supabase or Azure validation.",
  "",
  "| Role | Route | Expected | Actual | Time | Result |",
  "| --- | --- | ---: | ---: | ---: | --- |",
  ...results.map((result) => `| ${result.label} | \`${result.path}\` | ${result.expectedStatus} | ${result.status} | ${result.durationMs} ms | ${result.passed ? "PASS" : "FAIL"} |`),
  "",
].join("\n");
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary, "utf8");
if (!report.passed) process.exitCode = 1;
