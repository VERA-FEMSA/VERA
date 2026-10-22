const { createHash } = require("node:crypto");
const { buildAssistantContext } = require("./assistantContextService");
const evidenceRepository = require("../repositories/evidenceRepository");

// A stored conversation must not outlive the user's present data scope.
// Hash identifiers, never record content or credentials.
const currentScope = async (user, focus = null) => {
  const { visibleRecords } = await buildAssistantContext(user, "", focus);
  const visible = Object.fromEntries(Object.entries(visibleRecords).map(([type, items]) =>
    [type, items.map((item) => String(item.id)).sort()]));
  const linked = {
    AUDIT: new Set(visible.audits), RISK: new Set(visible.risks), CONTROL: new Set(visible.controls)
  };
  visible.evidence = (await evidenceRepository.getAll())
    .filter((item) => linked[item.entityType]?.has(String(item.entityId)))
    .map((item) => String(item.id)).sort();
  return createHash("sha256").update(JSON.stringify({ role: user.role, visible })).digest("hex");
};

module.exports = { currentScope };
