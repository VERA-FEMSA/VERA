const ROLE_TOUR_ACCOUNTS = Object.freeze(process.env.VERA_USER_STORE === "supabase" ? {
  AUDITOR: "auditor@vera-digital-systems.com",
  JEFATURA: "jefatura@vera-digital-systems.com",
  GERENTE: "gerente@vera-digital-systems.com",
  DIRECTOR: "director@vera-digital-systems.com"
} : {
  AUDITOR: "auditor@vera.local",
  JEFATURA: "jefatura@vera.local",
  GERENTE: "gerente@vera.local",
  DIRECTOR: "demo@vera.local"
});

module.exports = { ROLE_TOUR_ACCOUNTS };
