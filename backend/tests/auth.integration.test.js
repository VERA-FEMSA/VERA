const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { authenticator } = require("otplib");

process.env.JWT_SECRET ||= "auth-integration-test-secret-at-least-32-characters";

const loginLogger = require("../services/loginLogger");
const originalRecordLogin = loginLogger.recordLogin;
const loginRecords = [];
loginLogger.recordLogin = async (entry) => loginRecords.push(entry);

const app = require("../server");
const users = require("../data/users");
const userRepository = require("../repositories/userRepository");
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

test("RF-01: registration validates institutional email, duplicates and password before creating a pending account", async (context) => {
  const baseUrl = await startTestServer(context, app);
  const duplicate = await request(baseUrl, "/api/auth/register", {
    method: "POST",
    body: { name: "Cuenta Duplicada", email: "demo@vera.local", password: "Vera1234" }
  });
  assert.equal(duplicate.status, 409);

  const disabledUser = userRepository.findById(4);
  const originalStatus = disabledUser.status;
  disabledUser.status = "DISABLED";
  context.after(() => { disabledUser.status = originalStatus; });
  const disabledAddress = await request(baseUrl, "/api/auth/register", {
    method: "POST",
    body: { name: "Cuenta Sintética", email: disabledUser.email, password: "Vera1234" }
  });
  assert.equal(disabledAddress.status, 409);

  const nonInstitutional = await request(baseUrl, "/api/auth/register", {
    method: "POST",
    body: { name: "Cuenta Sintética", email: "external@example.test", password: "Vera1234" }
  });
  assert.equal(nonInstitutional.status, 400);

  const pathologicalEmail = await request(baseUrl, "/api/auth/register", {
    method: "POST",
    body: { name: "Cuenta Sintética", email: `x@${"!.".repeat(1000)}x`, password: "Vera1234" }
  });
  assert.equal(pathologicalEmail.status, 400);

  const weakPassword = await request(baseUrl, "/api/auth/register", {
    method: "POST",
    body: { name: "Cuenta Sintética", email: "weak@vera.local", password: "vera123" }
  });
  assert.equal(weakPassword.status, 400);

  const password = "VeraTest123";
  const email = `qa-${Date.now()}@vera.local`;
  const response = await request(baseUrl, "/api/auth/register", {
    method: "POST",
    body: { name: "Cuenta de Prueba", email, password }
  });
  assert.equal(response.status, 201);
  assert.ok(!(await response.text()).includes(password));

  const account = users.find((user) => user.email === email);
  assert.ok(account);
  assert.equal(account.status, "PENDING");
  assert.match(account.password, /^\$2/);
  context.after(() => userRepository.remove(account.id));

  const pendingLogin = await request(baseUrl, "/api/auth/login", {
    method: "POST",
    ip: "198.51.100.11",
    body: { username: email, password }
  });
  assert.equal(pendingLogin.status, 403);
});

test("RF-01/RF-02: Super Admin can approve or reject pending registration requests", async (context) => {
  const baseUrl = await startTestServer(context, app);
  const createRequest = async (suffix) => {
    const email = `review-${suffix}-${Date.now()}@vera.local`;
    const response = await request(baseUrl, "/api/auth/register", {
      method: "POST",
      body: { name: "Solicitud de Prueba", email, password: "VeraTest123" }
    });
    assert.equal(response.status, 201);
    const created = users.find((user) => user.email === email);
    context.after(() => userRepository.remove(created.id));
    return created;
  };

  const approvedAccount = await createRequest("approve");
  const approved = await request(baseUrl, `/api/users/${approvedAccount.id}/approve`, {
    method: "POST",
    token: tokenFor(1),
    body: { role: "AUDITOR" }
  });
  assert.equal(approved.status, 200);
  assert.equal((await approved.json()).user.status, "ACTIVE");
  assert.equal(approvedAccount.role, "AUDITOR");

  const repeatedApproval = await request(baseUrl, `/api/users/${approvedAccount.id}/approve`, {
    method: "POST",
    token: tokenFor(1),
    body: { role: "AUDITOR" }
  });
  assert.equal(repeatedApproval.status, 409);

  const rejectedAccount = await createRequest("reject");
  const denied = await request(baseUrl, `/api/users/${rejectedAccount.id}/reject`, {
    method: "POST",
    token: tokenFor(2)
  });
  assert.equal(denied.status, 403);

  const rejected = await request(baseUrl, `/api/users/${rejectedAccount.id}/reject`, {
    method: "POST",
    token: tokenFor(1)
  });
  assert.equal(rejected.status, 200);
  assert.equal(userRepository.findById(rejectedAccount.id), null);
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
  const enrollmentCode = authenticator.generate(secret);
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

  const validCode = authenticator.generate(secret);
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
