const test = require("node:test");
const assert = require("node:assert/strict");
const { enabled, config, getUser, normalizePassword, validateNewPassword } = require("../services/managedAuth");

const email = "sample@example.com";
const password = "VERA-ejemplo-unico-2026!";

test("new passwords are normalized and must meet the length and identity rules", async () => {
  assert.equal(normalizePassword("Cafe\u0301"), "Café");
  assert.equal((await validateNewPassword("short", email)).valid, false);
  assert.equal((await validateNewPassword("x".repeat(129), email)).valid, false);
  assert.equal((await validateNewPassword(email, email)).valid, false);
  assert.equal((await validateNewPassword("vera-digital-systems.com", email)).valid, false);
});

test("password screening rejects exposed secrets and fails closed when unavailable", async () => {
  const originalFetch = global.fetch;
  // Fixed HIBP range-protocol fixture for the synthetic password above.
  const hash = "DC77D2CA9052AA826DB278035390250F6D81DE97";
  const suffix = hash.slice(5);
  try {
    global.fetch = async (url, options) => {
      assert.ok(url.endsWith(hash.slice(0, 5)));
      assert.equal(options.headers["Add-Padding"], "true");
      return { ok: true, text: async () => `${suffix}:12\r\nOTHER:0` };
    };
    assert.match((await validateNewPassword(password, email)).message, /filtraciones/);

    global.fetch = async () => ({ ok: true, text: async () => `${suffix}:0\nOTHER:12` });
    assert.deepEqual(await validateNewPassword(password, email), { valid: true, password });

    global.fetch = async () => ({ ok: false });
    assert.deepEqual(await validateNewPassword(password, email), { valid: false, unavailable: true });

    global.fetch = async () => { throw new Error("offline"); };
    assert.deepEqual(await validateNewPassword(password, email), { valid: false, unavailable: true });
  } finally {
    global.fetch = originalFetch;
  }
});

test("managed auth requires HTTPS configuration and sends the session token", async () => {
  const original = {
    enabled: process.env.VERA_MANAGED_AUTH_ENABLED,
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_PUBLISHABLE_KEY,
    fetch: global.fetch
  };
  try {
    process.env.VERA_MANAGED_AUTH_ENABLED = "true";
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_PUBLISHABLE_KEY = "sb_public_test";
    assert.equal(enabled(), true);
    assert.throws(() => config(), /HTTPS/);

    process.env.SUPABASE_URL = "https://example.supabase.co";
    assert.equal(config().root.origin, "https://example.supabase.co");
    global.fetch = async (url, options) => {
      assert.equal(url.href, "https://example.supabase.co/auth/v1/user");
      assert.equal(options.headers.Authorization, "Bearer session-token");
      return { ok: true, status: 200, json: async () => ({ id: "user-1" }) };
    };
    assert.deepEqual(await getUser("session-token"), { ok: true, status: 200, data: { id: "user-1" } });
  } finally {
    for (const [key, value] of [
      ["VERA_MANAGED_AUTH_ENABLED", original.enabled],
      ["SUPABASE_URL", original.url],
      ["SUPABASE_PUBLISHABLE_KEY", original.key]
    ]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    global.fetch = original.fetch;
  }
});
