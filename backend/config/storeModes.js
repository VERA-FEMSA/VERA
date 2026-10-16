const validateStoreModes = (environment = process.env) => {
  for (const name of [
    "VERA_PLANNING_STORE", "VERA_USER_STORE", "VERA_RISK_CONTROL_STORE",
    "VERA_EVIDENCE_COMMENT_STORE", "VERA_AUDIT_STORE"
  ]) {
    if (environment[name] !== undefined && !["memory", "supabase"].includes(environment[name])) {
      throw new Error(`${name} debe ser memory o supabase.`);
    }
  }

  if (environment.VERA_RISK_CONTROL_STORE === "supabase" &&
      (environment.VERA_USER_STORE !== "supabase" || environment.VERA_PLANNING_STORE !== "supabase")) {
    throw new Error("La persistencia de riesgos y controles requiere cuentas y planificación persistentes.");
  }
  if (environment.VERA_EVIDENCE_COMMENT_STORE === "supabase" &&
      (environment.VERA_RISK_CONTROL_STORE !== "supabase" ||
        environment.VERA_USER_STORE !== "supabase" || environment.VERA_PLANNING_STORE !== "supabase")) {
    throw new Error("La persistencia de evidencias y comentarios requiere riesgos, controles, cuentas y planificación persistentes.");
  }
  if (environment.VERA_AUDIT_STORE === "supabase" &&
      (environment.VERA_EVIDENCE_COMMENT_STORE !== "supabase" ||
        environment.VERA_RISK_CONTROL_STORE !== "supabase" ||
        environment.VERA_USER_STORE !== "supabase" || environment.VERA_PLANNING_STORE !== "supabase")) {
    throw new Error("La bitácora persistente requiere todos los almacenes de VERA en Supabase.");
  }
};

module.exports = { validateStoreModes };
