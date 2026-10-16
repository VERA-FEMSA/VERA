const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET ||= "audit-log-integration-test-secret-32-characters";

const app = require("../server");
const { logActivity } = require("../services/auditLogger");
const { startTestServer } = require("./helpers/testServer");

const tokenFor = (id) => jwt.sign({ id }, process.env.JWT_SECRET);
const request = (baseUrl, token, query = "") => fetch(`${baseUrl}/api/audit/${query}`, {
  headers: token ? { Authorization: `Bearer ${token}` } : {}
});

test("RNF-04: access log query is restricted and filters a specific test event", async (context) => {
  const baseUrl = await startTestServer(context, app);
  const marker = `quality-${Date.now()}`;
  const proposalId = `TEST-${Date.now()}`;
  await logActivity({
    actor: { id: 3, username: marker, role: "GERENTE" },
    action: "TEST_QUALITY_EVENT",
    details: { proposalId }
  });

  assert.equal((await request(baseUrl, null, `?action=TEST_QUALITY_EVENT`)).status, 401);
  assert.equal((await request(baseUrl, tokenFor(2), `?action=TEST_QUALITY_EVENT`)).status, 403);

  const response = await request(baseUrl, tokenFor(1), `?action=TEST_QUALITY_EVENT&actor=${marker}&entityId=${proposalId}&limit=1`);
  assert.equal(response.status, 200);
  const { entries } = await response.json();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].actor.username, marker);
  assert.equal(entries[0].details.proposalId, proposalId);
  assert.ok(Number.isFinite(Date.parse(entries[0].date)));
});
