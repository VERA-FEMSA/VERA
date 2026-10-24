const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET ||= "assistant-user-directory-test-secret-32-characters";
const app = require("../server");
const { startTestServer } = require("./helpers/testServer");
const { parse, visibleUsers } = require("../services/assistantUserDirectoryService");

const options = (id, body) => ({ method: "POST", headers: {
  Authorization: `Bearer ${jwt.sign({ id }, process.env.JWT_SECRET)}`,
  "Content-Type": "application/json"
}, body: JSON.stringify(body) });
const conversation = async (base, id) => {
  const response = await fetch(`${base}/api/assistant/conversations`, options(id, { focus: null }));
  assert.equal(response.status, 201);
  return `${base}/api/assistant/conversations/${(await response.json()).conversation.id}/ask`;
};
const ask = async (url, id, question) => (await (await fetch(url, options(id, { question }))).json()).message;

test("El directorio reconoce lista, filtro, continuación y búsqueda exacta", () => {
  assert.deepEqual(parse("Usuarios con rol Auditor"), { kind: "list", role: "AUDITOR", next: false });
  assert.deepEqual(parse("Siguientes usuarios"), { kind: "list", role: null, next: true });
  assert.deepEqual(parse("Busca usuario GERENTE@VERA.LOCAL"), { kind: "search", email: "gerente@vera.local" });
  assert.equal(parse("Busca usuario gerente"), null);
});

test("Super Admin y Director ven sólo cuentas de su alcance; Gerente no accede", async (context) => {
  const previous = process.env.VERA_AI_CONVERSATIONS_ENABLED;
  process.env.VERA_AI_CONVERSATIONS_ENABLED = "true";
  context.after(() => { if (previous === undefined) delete process.env.VERA_AI_CONVERSATIONS_ENABLED;
    else process.env.VERA_AI_CONVERSATIONS_ENABLED = previous; });
  const base = await startTestServer(context, app);
  assert.ok((await visibleUsers({ id: 1, role: "SUPER_ADMIN" })).some((item) => item.id === 1));
  assert.ok(!(await visibleUsers({ id: 2, role: "DIRECTOR" })).some((item) => item.id === 1));
  assert.equal(await visibleUsers({ id: 3, role: "GERENTE" }), null);
  const admin = await conversation(base, 1);
  assert.match((await ask(admin, 1, "Usuarios del sistema")).text, /superadmin@vera\.local/);
  const director = await conversation(base, 2);
  const list = await ask(director, 2, "Usuarios del sistema");
  assert.doesNotMatch(list.text, /superadmin@vera\.local/);
  assert.match((await ask(director, 2, "Busca usuario gerente@vera.local")).text, /gerente@vera\.local/);
  assert.match((await ask(director, 2, "Busca usuario superadmin@vera.local")).text, /No hay una cuenta visible/);
  const manager = await conversation(base, 3);
  assert.match((await ask(manager, 3, "Usuarios del sistema")).text, /no puede consultar/);
  const ephemeral = await fetch(`${base}/api/assistant/ask`, options(1, { question: "Usuarios del sistema" }));
  assert.equal((await ephemeral.json()).mode, "action-guidance");
});
