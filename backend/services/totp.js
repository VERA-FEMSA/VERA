// v12 allowed one 30-second step on either side of the current code.
// v13 expresses that allowance in seconds through epochTolerance.
const verifyTotpCode = async (secret, code) => {
  const token = typeof code === "string" || typeof code === "number" ? String(code) : "";
  if (typeof secret !== "string" || !secret || !/^\d{6}$/.test(token)) return false;

  // Load otplib v13's ESM entry on Vercel Node 24. A dependency load failure
  // must surface as a server error, not masquerade as an invalid user code.
  const { verifySync } = await import("otplib");
  try {
    return verifySync({ secret, token, epochTolerance: 30 }).valid;
  } catch {
    // Invalid tokens or stored secrets are authentication failures, not server errors.
    return false;
  }
};

module.exports = { verifyTotpCode };
