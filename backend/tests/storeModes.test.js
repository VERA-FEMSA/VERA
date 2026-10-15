const test = require("node:test");
const assert = require("node:assert/strict");
const { validateStoreModes } = require("../config/storeModes");

test("persistent risks and controls require persistent users and planning", () => {
  assert.doesNotThrow(() => validateStoreModes({ VERA_RISK_CONTROL_STORE: "memory" }));
  assert.throws(() => validateStoreModes({ VERA_RISK_CONTROL_STORE: "supabase" }), /requiere/);
  assert.throws(() => validateStoreModes({
    VERA_RISK_CONTROL_STORE: "supabase", VERA_USER_STORE: "supabase"
  }), /requiere/);
  assert.doesNotThrow(() => validateStoreModes({
    VERA_RISK_CONTROL_STORE: "supabase", VERA_USER_STORE: "supabase", VERA_PLANNING_STORE: "supabase"
  }));
});
