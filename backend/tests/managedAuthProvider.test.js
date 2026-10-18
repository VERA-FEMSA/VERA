const test = require("node:test");
const assert = require("node:assert/strict");
const { signInProvider } = require("../services/managedAuth");

const linked = {
  app_metadata: { provider: "azure", providers: ["azure", "google"] },
  identities: [
    { provider: "azure", last_sign_in_at: "2026-10-18T20:35:39Z" },
    { provider: "google", last_sign_in_at: "2026-10-18T20:47:38Z" }
  ]
};

test("linked social identities are recorded without guessing the provider", () => {
  assert.equal(signInProvider(linked, { amr: [{ method: "oauth" }] }), "linked");
  assert.equal(signInProvider(linked, { amr: [{ method: "oauth" }], iat: 1792359000 }), "linked");
});

test("one social identity preserves its exact provider", () => {
  assert.equal(signInProvider({ identities: [{ provider: "azure" }] }, {}), "azure");
  assert.equal(signInProvider({ identities: [{ provider: "google" }] }, {}), "google");
});

test("email plus OAuth distinguishes password MFA from the social identity", () => {
  const user = { identities: [{ provider: "email" }, { provider: "google" }] };
  assert.equal(signInProvider(user, { amr: [{ method: "password" }, { method: "totp" }], aal: "aal2" }), "email");
  assert.equal(signInProvider(user, { amr: [{ method: "password" }], aal: "aal1" }), null);
  assert.equal(signInProvider(user, { amr: [{ method: "oauth" }], aal: "aal1" }), "google");
  assert.equal(signInProvider(user, { amr: [{ method: "oauth_provider/authorization_code" }], aal: "aal1" }), "google");
  assert.equal(signInProvider(user, { aal: "aal1" }), null);
});

test("unsupported identities and unverified metadata fail closed", () => {
  assert.equal(signInProvider({ identities: [{ provider: "azure" }, { provider: "github" }] }, {}), null);
  assert.equal(signInProvider({ app_metadata: { provider: "azure", providers: ["azure", "google"] } }, {}), null);
});
