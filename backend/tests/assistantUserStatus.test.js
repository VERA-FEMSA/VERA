const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET ||= "assistant-user-status-test-secret-32-characters";
const app = require("../server");
const { startTestServer } = require("./helpers/testServer");
const users = require("../repositories/userRepository");
const { parse } = require("../services/assistantUserStatusService");

const auth = (id, method, body) => ({ method, headers: {
  Authorization: `Bearer ${jwt.sign({ id }, process.env.JWT_SECRET)}`,
  ...(body === undefined ? {} : { "Content-Type": "application/json" })
}, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const threadFor = async (base, id) => {
  const result = await fetch(`${base}/api/assistant/conversations`, auth(id, "POST", { focus: null }));
  assert.equal(result.status, 201);
  return (await result.json()).conversation.id;
};
const ask = async (base, id, thread, question) => {
  const result = await fetch(`${base}/api/assistant/conversations/${thread}/ask`,
    auth(id, "POST", { question }));
  return { status: result.status, body: await result.json() };
};

test("Los comandos de cuenta requieren un ID exacto y confirmación separada", () => {
  assert.deepEqual(parse("Deshabilita cuenta #5"), { active: false, id: 5 });
  assert.deepEqual(parse("Habilitar cuenta 5"), { active: true, id: 5 });
  assert.deepEqual(parse("Confirmar cambio de cuenta"), { confirm: true });
  assert.equal(parse("Deshabilita todos"), null);
});

test("Solo Super Admin cambia otra cuenta con vista previa, versión y bitácora", async (context) => {
  const previous = process.env.VERA_AI_CONVERSATIONS_ENABLED;
  process.env.VERA_AI_CONVERSATIONS_ENABLED = "true";
  context.after(async () => {
    if (previous === undefined) delete process.env.VERA_AI_CONVERSATIONS_ENABLED;
    else process.env.VERA_AI_CONVERSATIONS_ENABLED = previous;
    await users.setStatus(5, "ACTIVE");
  });
  const base = await startTestServer(context, app);
  const admin = await threadFor(base, 1);
  const director = await threadFor(base, 2);
  assert.match((await ask(base, 2, director, "Deshabilita cuenta #5")).body.message.text,
    /Solo un Super Admin/);
  assert.match((await ask(base, 1, admin, "Deshabilita cuenta #1")).body.message.text,
    /propia cuenta/);
  const preview = await ask(base, 1, admin, "Deshabilita cuenta #5");
  assert.equal(preview.body.message.mode, "action-preview");
  assert.equal((await users.findById(5)).status, "ACTIVE");
  const changed = await ask(base, 1, admin, "Confirmar cambio de cuenta");
  assert.equal(changed.status, 200);
  assert.equal(changed.body.message.mode, "action-executed", changed.body.message.text);
  assert.equal((await users.findById(5)).status, "DISABLED");
  assert.equal((await ask(base, 1, admin, "Confirmar cambio de cuenta")).body.message.mode,
    "action-guidance");
  const enable = await ask(base, 1, admin, "Habilita cuenta #5");
  assert.equal(enable.body.message.mode, "action-preview");
  assert.equal((await ask(base, 1, admin, "Confirmar cambio de cuenta")).body.message.mode,
    "action-executed");
  assert.equal((await users.findById(5)).status, "ACTIVE");
});

test("Una cuenta que cambia después de la vista previa impide confirmar", async (context) => {
  const previous = process.env.VERA_AI_CONVERSATIONS_ENABLED;
  process.env.VERA_AI_CONVERSATIONS_ENABLED = "true";
  context.after(async () => {
    if (previous === undefined) delete process.env.VERA_AI_CONVERSATIONS_ENABLED;
    else process.env.VERA_AI_CONVERSATIONS_ENABLED = previous;
    await users.setStatus(4, "ACTIVE");
  });
  const base = await startTestServer(context, app);
  const admin = await threadFor(base, 1);
  assert.equal((await ask(base, 1, admin, "Deshabilita cuenta #4")).body.message.mode,
    "action-preview");
  await users.setStatus(4, "DISABLED");
  assert.match((await ask(base, 1, admin, "Confirmar cambio de cuenta")).body.message.text,
    /estado de la cuenta cambi/);
  assert.equal((await users.findById(4)).status, "DISABLED");
});
