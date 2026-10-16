const test = require("node:test");
const assert = require("node:assert/strict");
const { recordLogin } = require("../services/loginLogger");

test("login logging accepts a server-only Supabase secret key without a JWT bearer header", async (context) => {
  const previous = {
    fetch: global.fetch,
    url: process.env.SUPABASE_URL,
    secret: process.env.SUPABASE_SECRET_KEY,
    legacy: process.env.SUPABASE_SERVICE_ROLE_KEY,
    viteUrl: process.env.VITE_SUPABASE_URL,
    viteKey: process.env.VITE_SUPABASE_KEY,
    userStore: process.env.VERA_USER_STORE
  };
  context.after(() => {
    global.fetch = previous.fetch;
    for (const [name, value] of [
      ["SUPABASE_URL", previous.url], ["SUPABASE_SECRET_KEY", previous.secret],
      ["SUPABASE_SERVICE_ROLE_KEY", previous.legacy],
      ["VITE_SUPABASE_URL", previous.viteUrl], ["VITE_SUPABASE_KEY", previous.viteKey],
      ["VERA_USER_STORE", previous.userStore]
    ]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  process.env.VERA_USER_STORE = "supabase";
  process.env.SUPABASE_URL = "https://supabase.example/";
  process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  global.fetch = async (url, options) => {
    assert.equal(String(url), "https://supabase.example/rest/v1/logins");
    assert.equal(options.headers.apikey, "sb_secret_test");
    assert.equal(options.headers.Authorization, undefined);
    assert.deepEqual(JSON.parse(options.body), {
      user_id: 2, username: "demo", ip_address: "127.0.0.1", method: "PASSWORD"
    });
    return new Response(null, { status: 201 });
  };
  await recordLogin({ user: { id: 2, username: "demo" }, ip: "127.0.0.1", method: "PASSWORD" });

  delete process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "legacy-jwt";
  global.fetch = async (_url, options) => {
    assert.equal(options.headers.Authorization, "Bearer legacy-jwt");
    return new Response(null, { status: 201 });
  };
  await recordLogin({ user: { id: 2, username: "demo" }, method: "PASSWORD_2FA" });

  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.VITE_SUPABASE_KEY = "public-browser-key";
  await assert.rejects(
    recordLogin({ user: { id: 2, username: "demo" }, method: "PASSWORD" }),
    /clave secreta del backend/
  );

  process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
  process.env.SUPABASE_URL = "http://supabase.example";
  await assert.rejects(
    recordLogin({ user: { id: 2, username: "demo" }, method: "PASSWORD" }),
    /HTTPS/
  );
});

test("memory demo does not require Supabase to record a login", async (context) => {
  const previousStore = process.env.VERA_USER_STORE;
  const previousFetch = global.fetch;
  context.after(() => {
    if (previousStore === undefined) delete process.env.VERA_USER_STORE;
    else process.env.VERA_USER_STORE = previousStore;
    global.fetch = previousFetch;
  });

  process.env.VERA_USER_STORE = "memory";
  global.fetch = () => { throw new Error("No debe consultar Supabase en modo memory."); };
  await assert.doesNotReject(recordLogin({ user: { id: 2, username: "demo" }, method: "PASSWORD" }));
});
