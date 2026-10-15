const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");

process.env.JWT_SECRET ||= "supabase-users-test-secret-at-least-32-characters";
process.env.VERA_USER_STORE = "supabase";
process.env.SUPABASE_URL = "https://supabase.example";
process.env.SUPABASE_SECRET_KEY = "sb_secret_test";

const app = require("../server");
const { startTestServer } = require("./helpers/testServer");

test("Supabase accounts survive API requests and enforce approval, roles and deactivation", async (context) => {
  const nativeFetch = global.fetch;
  const rows = new Map([[1, {
    id: 1, username: "admin", email: "admin@vera.local", name: "Administradora",
    password_hash: bcrypt.hashSync("VeraTest123", 10), role: "SUPER_ADMIN",
    status: "ACTIVE", requested_at: null, two_factor_enabled: false,
    two_factor_secret: null, pending_secret: null, version: 1
  }]]);
  const loginRecords = [];
  let nextId = 2;
  global.fetch = async (input, options) => {
    if (!String(input).startsWith("https://supabase.example/")) return nativeFetch(input, options);
    const url = new URL(input);
    assert.equal(options.headers.apikey, "sb_secret_test");
    assert.equal(options.headers.Authorization, undefined);
    if (url.pathname === "/rest/v1/logins") {
      loginRecords.push(JSON.parse(options.body));
      return new Response(null, { status: 204 });
    }
    assert.equal(url.pathname, "/rest/v1/vera_users");
    const filters = ["id", "email", "username", "version"]
      .map((field) => [field, url.searchParams.get(field)?.slice(3)])
      .filter(([, value]) => value !== undefined);
    const found = [...rows.values()].filter((row) =>
      filters.every(([field, value]) => String(row[field]) === value));
    if (options.method === "GET") return Response.json(found);
    if (options.method === "POST") {
      const body = JSON.parse(options.body);
      const row = {
        id: nextId++, version: 1, two_factor_enabled: false,
        two_factor_secret: null, pending_secret: null, ...body
      };
      rows.set(row.id, row);
      return Response.json([row], { status: 201 });
    }
    if (options.method === "PATCH") {
      if (!found.length) return Response.json([]);
      const row = { ...found[0], ...JSON.parse(options.body) };
      rows.set(row.id, row);
      return Response.json([row]);
    }
    throw new Error(`Unexpected method ${options.method}`);
  };
  context.after(() => { global.fetch = nativeFetch; });

  const base = await startTestServer(context, app);
  const register = await fetch(`${base}/api/auth/register`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Cuenta Prueba", email: "qa@vera.local", password: "VeraTest123" })
  });
  assert.equal(register.status, 201);
  assert.equal(rows.get(2).status, "PENDING");
  assert.match(rows.get(2).password_hash, /^\$2/);

  const pendingLogin = await fetch(`${base}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "qa@vera.local", password: "VeraTest123" })
  });
  assert.equal(pendingLogin.status, 403);

  const adminLogin = await fetch(`${base}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "VeraTest123" })
  });
  assert.equal(adminLogin.status, 200);
  const adminToken = (await adminLogin.json()).token;
  assert.equal(loginRecords.length, 1);

  const approved = await fetch(`${base}/api/users/2/approve`, {
    method: "POST", headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ role: "AUDITOR" })
  });
  assert.equal(approved.status, 200);
  assert.equal(rows.get(2).role, "AUDITOR");
  assert.equal(rows.get(2).status, "ACTIVE");

  const userLogin = await fetch(`${base}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "qa@vera.local", password: "VeraTest123" })
  });
  assert.equal(userLogin.status, 200);
  const userToken = (await userLogin.json()).token;
  assert.equal((await fetch(`${base}/api/dashboard`, {
    headers: { Authorization: `Bearer ${userToken}` }
  })).status, 200);

  const disabled = await fetch(`${base}/api/users/2/status`, {
    method: "PATCH", headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ active: false })
  });
  assert.equal(disabled.status, 200);
  assert.equal((await fetch(`${base}/api/dashboard`, {
    headers: { Authorization: `Bearer ${userToken}` }
  })).status, 401);
});
