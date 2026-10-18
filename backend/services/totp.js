// v12 allowed one 30-second step on either side of the current code.
// v13 expresses that allowance in seconds through epochTolerance.
const verifyTotpCode = async (secret, code) => {
  const token = typeof code === "string" || typeof code === "number" ? String(code) : "";
  if (typeof secret !== "string" || !secret || !/^\d{6}$/.test(token)) return false;

  try {
    // otplib v13's CommonJS entry requires an ESM-only base32 dependency on Node 24.
    // Load its native ESM entry, matching the production Vercel runtime.
    const { verifySync } = await import("otplib");
    return verifySync({ secret, token, epochTolerance: 30 }).valid;
  } catch {
    // Invalid tokens or stored secrets are authentication failures, not server errors.
    return false;
  }
};

module.exports = { verifyTotpCode };
