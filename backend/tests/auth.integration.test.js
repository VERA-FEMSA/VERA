const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { generateSync } = require("otplib");

process.env.JWT_SECRET ||= "auth-integration-test-secret-at-least-32-characters";

const loginLogger = require("../services/loginLogger");
const originalRecordLogin = loginLogger.recordLogin;
const loginRecords = [];
loginLogger.recordLogin = async (entry) => loginRecords.push(entry);

const app = require("../server");
const users = require("../data/users");
const userRepository = require("../repositories/userRepository");
const { PRIVACY_NOTICE_VERSION } = require("../config/privacyNotice");
const { startTestServer } = require("./helpers/testServer");

test.after(() => {
  loginLogger.recordLogin = originalRecordLogin;
});

const tokenFor = (id) => jwt.sign({ id }, process.env.JWT_SECRET);
const request = (baseUrl, path, { method = "GET", token, body, ip } = {}) => fetch(`${baseUrl}${path}`, {
  method,
  headers: {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(body ? { "Content-Type": "application/json" } : {}),
    ...(ip ? { "X-Forwarded-For": ip } : {})
  },
  ...(body ? { body: JSON.stringify(body) } : {})
});

test("RF-01: direct registration accepts any email, assigns AUDITOR and requires authenticator setup", async (context) => {
  const previousFlag = process.env.VERA_DIRECT_REGISTRATION_ENABLED;
  const nativeFetch = global.fetch;
  process.env.VERA_DIRECT_REGISTRATION_ENABLED = "true";
  global.fetch = (url, options) => String(url).startsWith("https://api.pwnedpasswords.com/")
    ? Promise.resolve(new Response("", { status: 200 })) : nativeFetch(url, options);
  context.after(() => {
    if (previousFlag === undefined) delete process.env.VERA_DIRECT_REGISTRATION_ENABLED;
    else process.env.VERA_DIRECT_REGISTRATION_ENABLED = previousFlag;
    global.fetch = nativeFetch;
  });
  const baseUrl = await startTestServer(context, app);
  const privacy = { privacyNoticeVersion: PRIVACY_NOTICE_VERSION, privacyAccepted: true };
  const duplicate = await request(baseUrl, "/api/auth/register", {
    method: "POST",
    body: { name: "Cuenta Duplicada", email: "demo@vera.local", password: "VeraTestPassword2026!", ...privacy }
  });
  assert.equal(duplicate.status, 409);

  const disabledUser = userRepository.findById(4);
  const originalStatus = disabledUser.status;
  disabledUser.status = "DISABLED";
  context.after(() => { disabledUser.status = originalStatus; });
  const disabledAddress = await request(baseUrl, "/api/auth/register", {
    method: "POST",
    body: { name: "Cuenta Sintética", email: disabledUser.email, password: "VeraTestPassword2026!", ...privacy }
  });
  assert.equal(disabledAddress.status, 409);

  const externalEmail = `external-${Date.now()}@example.test`;
  const nonInstitutional = await request(baseUrl, "/api/auth/register", {
    method: "POST",
    body: { name: "Cuenta Sintética", email: externalEmail, password: "VeraTestPassword2026!", ...privacy }
  });
  assert.equal(nonInstitutional.status, 201);
  const account = users.find((user) => user.email === externalEmail);
  assert.ok(account);
  assert.equal(account.status, "ACTIVE");
  assert.equal(account.role, "AUDITOR");
  assert.equal(account.mfaRequired, true);
  assert.match(account.password, /^\$2/);
  context.after(() => userRepository.remove(account.id));

  const pathologicalEmail = await request(baseUrl, "/api/auth/register", {
    method: "POST",
    body: { name: "Cuenta Sintética", email: `x@${"!.".repeat(1000)}x`, password: "VeraTestPassword2026!", ...privacy }
  });
  assert.equal(pathologicalEmail.status, 400);

  const weakPassword = await request(baseUrl, "/api/auth/register", {
    method: "POST",
    body: { name: "Cuenta Sintética", email: "weak@vera.local", password: "vera123", ...privacy }
  });
  assert.equal(weakPassword.status, 400);

  const login = await request(baseUrl, "/api/auth/login", {
    method: "POST",
    ip: "198.51.100.11",
    body: { username: externalEmail, password: "VeraTestPassword2026!" }
  });
  assert.equal(login.status, 200);
  const challenge = await login.json();
  assert.equal(challenge.requiresMfaSetup, true);
  assert.equal(challenge.token, undefined);
  assert.equal((await request(baseUrl, "/api/dashboard", { token: challenge.setupToken })).status, 401);
  const setup = await request(baseUrl, "/api/auth/2fa/setup", { method: "POST", token: challenge.setupToken });
  assert.equal(setup.status, 200);
  const { secret } = await setup.json();
  const enabled = await request(baseUrl, "/api/auth/2fa/enable", {
    method: "POST", token: challenge.setupToken, body: { code: generateSync({ secret }) }
  });
  assert.equal(enabled.status, 200);
  assert.ok((await enabled.json()).token);
});

test("RF-02: account approval is removed; only Super Admin can review role requests", async (context) => {
  const baseUrl = await startTestServer(context, app);
  assert.equal((await request(baseUrl, "/api/users/5/approve", { method: "POST", token: tokenFor(1) })).status, 404);
  const created = await request(baseUrl, "/api/users/role-requests", {
    method: "POST", token: tokenFor(5), body: { role: "DIRECTOR", reason: "Necesito consultar reportes de dirección." }
  });
  assert.equal(created.status, 201);
  const { request: roleRequest } = await created.json();
  assert.equal((await request(baseUrl, "/api/users/role-requests/pending", { token: tokenFor(2) })).status, 403);
  const denied = await request(baseUrl, `/api/users/role-requests/${roleRequest.id}/review`, {
    method: "POST", token: tokenFor(2), body: { approve: true }
  });
  assert.equal(denied.status, 403);
  const approved = await request(baseUrl, `/api/users/role-requests/${roleRequest.id}/review`, {
    method: "POST", token: tokenFor(1), body: { approve: true }
  });
  assert.equal(approved.status, 200);
  assert.equal(userRepository.findById(5).role, "DIRECTOR");
  context.after(() => userRepository.updateRole(5, "AUDITOR"));
});

test("RF-03/RNF-04: successful login returns a signed session and records its method", async (context) => {
  const baseUrl = await startTestServer(context, app);
  loginRecords.length = 0;

  const response = await request(baseUrl, "/api/auth/login", {
    method: "POST",
    ip: "198.51.100.12",
    body: { username: "demo@vera.local", password: "vera123" }
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.user.role, "DIRECTOR");
  assert.equal(jwt.verify(payload.token, process.env.JWT_SECRET).id, 2);
  assert.equal(loginRecords.length, 1);
  assert.equal(loginRecords[0].method, "PASSWORD");

  const protectedResponse = await request(baseUrl, "/api/dashboard", { token: payload.token });
  assert.equal(protectedResponse.status, 200);
});

test("RF-03/RF-04: invalid and inactive accounts are denied; five failures lock the client", async (context) => {
  const baseUrl = await startTestServer(context, app);
  const disabledUser = userRepository.findById(4);
  const originalStatus = disabledUser.status;
  disabledUser.status = "DISABLED";
  context.after(() => { disabledUser.status = originalStatus; });

  const disabled = await request(baseUrl, "/api/auth/login", {
    method: "POST",
    ip: "198.51.100.13",
    body: { username: disabledUser.username, password: "vera123" }
  });
  assert.equal(disabled.status, 403);

  const nonexistent = await request(baseUrl, "/api/auth/login", {
    method: "POST",
    ip: "198.51.100.14",
    body: { username: "missing@vera.local", password: "incorrecta" }
  });
  assert.equal(nonexistent.status, 401);

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const failed = await request(baseUrl, "/api/auth/login", {
      method: "POST",
      ip: "198.51.100.15",
      body: { username: "demo", password: "incorrecta" }
    });
    assert.equal(failed.status, attempt === 5 ? 429 : 401, `intento ${attempt}`);
    if (attempt === 5) {
      const payload = await failed.json();
      assert.ok(payload.retryAfter > 0 && payload.retryAfter <= 300);
      assert.equal(Number(failed.headers.get("retry-after")), payload.retryAfter);
    }
  }

  const stillLocked = await request(baseUrl, "/api/auth/login", {
    method: "POST",
    ip: "198.51.100.15",
    body: { username: "demo", password: "vera123" }
  });
  assert.equal(stillLocked.status, 429);
  assert.ok(Number(stillLocked.headers.get("retry-after")) > 0);
});

test("RNF-16: a user enrolls in TOTP and must verify a fresh code before receiving a session", async (context) => {
  const baseUrl = await startTestServer(context, app);
  const user = userRepository.findById(4);
  const original = {
    twoFactorEnabled: user.twoFactorEnabled,
    twoFactorSecret: user.twoFactorSecret,
    pendingSecret: user.pendingSecret
  };
  context.after(() => Object.assign(user, original));

  const session = tokenFor(user.id);
  const setup = await request(baseUrl, "/api/auth/2fa/setup", { method: "POST", token: session });
  assert.equal(setup.status, 200);
  const { secret, qr } = await setup.json();
  assert.ok(secret);
  assert.match(qr, /^data:image\/png;base64,/);
  const enrollmentCode = generateSync({ secret });
  const wrongEnrollmentCode = String((Number(enrollmentCode) + 1) % 1000000).padStart(6, "0");

  const invalidSetup = await request(baseUrl, "/api/auth/2fa/setup", { method: "POST" });
  assert.equal(invalidSetup.status, 401);

  const wrongEnrollment = await request(baseUrl, "/api/auth/2fa/enable", {
    method: "POST",
    token: session,
    body: { code: wrongEnrollmentCode }
  });
  assert.equal(wrongEnrollment.status, 400);

  const enable = await request(baseUrl, "/api/auth/2fa/enable", {
    method: "POST",
    token: session,
    body: { code: enrollmentCode }
  });
  assert.equal(enable.status, 200);
  assert.equal(user.twoFactorEnabled, true);

  const firstStep = await request(baseUrl, "/api/auth/login", {
    method: "POST",
    ip: "198.51.100.16",
    body: { username: user.username, password: "vera123" }
  });
  assert.equal(firstStep.status, 200);
  const challenge = await firstStep.json();
  assert.equal(challenge.requires2FA, true);
  assert.ok(challenge.tempToken);
  assert.equal(challenge.token, undefined);

  const validCode = generateSync({ secret });
  const malformedCode = await request(baseUrl, "/api/auth/verify-2fa", {
    method: "POST",
    ip: "198.51.100.16",
    body: { tempToken: challenge.tempToken, code: "not-a-code" }
  });
  assert.equal(malformedCode.status, 401);

  const wrongCode = String((Number(validCode) + 1) % 1000000).padStart(6, "0");
  const invalidCode = await request(baseUrl, "/api/auth/verify-2fa", {
    method: "POST",
    ip: "198.51.100.16",
    body: { tempToken: challenge.tempToken, code: wrongCode }
  });
  assert.equal(invalidCode.status, 401);

  const expiredChallenge = await request(baseUrl, "/api/auth/verify-2fa", {
    method: "POST",
    ip: "198.51.100.17",
    body: {
      tempToken: jwt.sign({ id: user.id, purpose: "2fa" }, process.env.JWT_SECRET, { expiresIn: -1 }),
      code: validCode
    }
  });
  assert.equal(expiredChallenge.status, 401);

  const verification = await request(baseUrl, "/api/auth/verify-2fa", {
    method: "POST",
    ip: "198.51.100.16",
    body: { tempToken: challenge.tempToken, code: validCode }
  });
  assert.equal(verification.status, 200);
  const authenticated = await verification.json();
  assert.equal(jwt.verify(authenticated.token, process.env.JWT_SECRET).id, user.id);
  assert.equal(loginRecords.at(-1).method, "PASSWORD_2FA");
});
