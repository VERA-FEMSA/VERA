const test = require("node:test");
const assert = require("node:assert/strict");

const repository = require("../repositories/supabaseUserRepository");

test("Supabase user adapter persists accounts, approvals, 2FA and versioned changes", async (context) => {
  const previous = {
    fetch: global.fetch,
    url: process.env.SUPABASE_URL,
    secret: process.env.SUPABASE_SECRET_KEY,
    legacy: process.env.SUPABASE_SERVICE_ROLE_KEY
  };
  context.after(() => {
    global.fetch = previous.fetch;
    for (const [name, value] of [
      ["SUPABASE_URL", previous.url],
      ["SUPABASE_SECRET_KEY", previous.secret],
      ["SUPABASE_SERVICE_ROLE_KEY", previous.legacy]
    ]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  process.env.SUPABASE_URL = "https://supabase.example";
  process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  const rows = new Map();
  let nextId = 1;
  global.fetch = async (input, options) => {
    const url = new URL(input);
    assert.equal(url.pathname, "/rest/v1/vera_users");
    assert.equal(options.headers.apikey, "sb_secret_test");
    assert.equal(options.headers.Authorization, undefined);
    const filters = ["id", "email", "username", "version", "pending_secret", "status"]
      .map((field) => [field, url.searchParams.get(field)?.slice(3)])
      .filter(([, value]) => value !== undefined);
    const found = [...rows.values()].filter((row) =>
      filters.every(([field, value]) => String(row[field]) === value));
    if (options.method === "GET") return Response.json(found);
    if (options.method === "POST") {
      const body = JSON.parse(options.body);
      if ([...rows.values()].some((row) => row.email === body.email)) {
        return Response.json({ code: "23505" }, { status: 409 });
      }
      const row = {
        id: nextId++, version: 1, requested_at: null, two_factor_enabled: false,
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
    if (options.method === "DELETE") {
      if (!found.length) return Response.json([]);
      rows.delete(found[0].id);
      return Response.json(found);
    }
    throw new Error(`Unexpected method: ${options.method}`);
  };

  const admin = await repository.createBootstrapAdmin({
    name: "Administradora", email: "admin@vera.local", password: "VeraTest123"
  });
  assert.equal(admin.role, "SUPER_ADMIN");
  assert.equal(admin.password, undefined);
  await assert.rejects(repository.createBootstrapAdmin({
    name: "Otra", email: "other@vera.local", password: "VeraTest123"
  }), (error) => error.status === 409);

  const pending = await repository.createPending({
    name: "Auditora", email: "auditora@vera.local", password: "VeraTest123", role: "JEFATURA"
  });
  assert.equal(pending.status, "PENDING");
  assert.equal((await repository.getAll()).length, 2);
  assert.equal(await repository.emailExists("AUDITORA@VERA.LOCAL"), true);
  assert.equal(await repository.emailExists("missing@vera.local"), false);
  const account = await repository.findByLogin("AUDITORA@VERA.LOCAL");
  assert.equal(account.id, pending.id);
  assert.match(account.password, /^\$2/);
  assert.equal(repository.checkPassword(account, "VeraTest123"), true);
  assert.equal(repository.checkPassword(account, "incorrecta"), false);

  const approved = await repository.approvePending(account.id, "AUDITOR");
  assert.equal(approved.status, "ACTIVE");
  assert.equal(approved.role, "AUDITOR");
  await assert.rejects(repository.updateRole(account.id, "GERENTE", account.storageVersion),
    (error) => error.status === 409);
  await assert.rejects(repository.approvePending(account.id, "GERENTE"),
    (error) => error.status === 409);
  assert.equal((await repository.setStatus(account.id, "DISABLED")).status, "DISABLED");
  assert.equal((await repository.updateRole(account.id, "GERENTE")).role, "GERENTE");

  await repository.setPendingSecret(account.id, "secret-test");
  await assert.rejects(repository.enableTwoFactor(account.id, "old-secret"),
    (error) => error.status === 409);
  const enabled = await repository.enableTwoFactor(account.id, "secret-test");
  assert.equal(enabled.twoFactorEnabled, true);
  assert.equal(enabled.twoFactorSecret, "secret-test");
  assert.equal(enabled.pendingSecret, null);
  assert.equal((await repository.remove(account.id)).id, account.id);
  assert.equal(await repository.findById(account.id), null);

  const rejected = await repository.createPending({
    name: "Solicitud", email: "request@vera.local", password: "VeraTest123", role: "JEFATURA"
  });
  assert.equal((await repository.removePending(rejected.id)).id, rejected.id);
  assert.equal(await repository.removePending(admin.id), null);
});

test("Supabase user adapter fails closed when server credentials are missing", async (context) => {
  const previous = {
    url: process.env.SUPABASE_URL,
    secret: process.env.SUPABASE_SECRET_KEY,
    legacy: process.env.SUPABASE_SERVICE_ROLE_KEY
  };
  context.after(() => {
    for (const [name, value] of [
      ["SUPABASE_URL", previous.url],
      ["SUPABASE_SECRET_KEY", previous.secret],
      ["SUPABASE_SERVICE_ROLE_KEY", previous.legacy]
    ]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SECRET_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  await assert.rejects(repository.getAll(), (error) => error.userStorage && error.status === 503);
});
