const test = require("node:test");
const assert = require("node:assert/strict");
const { signInProvider } = require("../services/managedAuth");

const identities = (azureTime, googleTime) => ({
  app_metadata: { provider: "azure", providers: ["azure", "google"] },
  identities: [
    { provider: "azure", last_sign_in_at: azureTime },
    { provider: "google", last_sign_in_at: googleTime }
  ]
});

test("linked account records the Google provider actually used", () => {
  const user = identities("2026-10-18T20:35:39Z", "2026-10-18T20:47:38Z");
  assert.equal(signInProvider(user, { iat: Date.parse("2026-10-18T20:47:39Z") / 1000 }), "google");
});

test("linked account records Microsoft when it is used again", () => {
  const user = identities("2026-10-18T20:50:39Z", "2026-10-18T20:47:38Z");
  assert.equal(signInProvider(user, { iat: Date.parse("2026-10-18T20:50:40Z") / 1000 }), "azure");
});

test("ambiguous or newer linked sign-ins fail closed", () => {
  const same = identities("2026-10-18T20:50:39Z", "2026-10-18T20:50:39Z");
  assert.equal(signInProvider(same, { iat: Date.parse("2026-10-18T20:50:40Z") / 1000 }), null);
  const newer = identities("2026-10-18T20:35:39Z", "2026-10-18T20:47:38Z");
  assert.equal(signInProvider(newer, { iat: Date.parse("2026-10-18T20:35:40Z") / 1000 }), null);
});

test("single identity remains compatible and metadata cannot choose among links", () => {
  assert.equal(signInProvider({ identities: [{ provider: "azure" }] }, {}), "azure");
  assert.equal(signInProvider({ identities: [{ provider: "azure" }, { provider: "github" }] }, {}), null);
  assert.equal(signInProvider({ app_metadata: { provider: "azure", providers: ["azure", "google"] } }, {}), null);
});
