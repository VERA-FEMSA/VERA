const path = require("node:path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const { isValidPassword, isValidName } = require("../config/accountRules");
const repository = require("../repositories/supabaseUserRepository");

const main = async () => {
  if (process.env.VERA_USER_STORE !== "supabase") {
    throw new Error("Configura VERA_USER_STORE=supabase antes de inicializar la cuenta.");
  }
  const name = String(process.env.VERA_BOOTSTRAP_ADMIN_NAME || "").trim();
  const email = String(process.env.VERA_BOOTSTRAP_ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.VERA_BOOTSTRAP_ADMIN_PASSWORD;
  if (!isValidName(name) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !isValidPassword(password)) {
    throw new Error("Define nombre, correo y contraseña válidos en VERA_BOOTSTRAP_ADMIN_*.");
  }
  const user = await repository.createBootstrapAdmin({ name, email, password });
  console.log(`Cuenta inicial creada: ${user.email} (${user.role}).`);
};

main().catch((error) => {
  console.error(error.userStorage ? error.message : "No se pudo inicializar la cuenta.");
  process.exitCode = 1;
});
