const validateStoreModes = (environment = process.env) => {
  if (environment.VERA_RISK_CONTROL_STORE === "supabase" &&
      (environment.VERA_USER_STORE !== "supabase" || environment.VERA_PLANNING_STORE !== "supabase")) {
    throw new Error("La persistencia de riesgos y controles requiere cuentas y planificación persistentes.");
  }
  if (environment.VERA_EVIDENCE_COMMENT_STORE === "supabase" &&
      (environment.VERA_RISK_CONTROL_STORE !== "supabase" ||
        environment.VERA_USER_STORE !== "supabase" || environment.VERA_PLANNING_STORE !== "supabase")) {
    throw new Error("La persistencia de evidencias y comentarios requiere riesgos, controles, cuentas y planificación persistentes.");
  }
};

module.exports = { validateStoreModes };
