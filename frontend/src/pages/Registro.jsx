import { useState } from "react";
import { Link } from "react-router-dom";
import { registerUser } from "../services/authService";
import { PASSWORD_CHECKS, validateName } from "../constants/accountRules";
import "./Login.css";
import "./Registro.css";

// HU-01 (RF-01): registro propio con correo institucional.
function Registro() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const passwordOk = PASSWORD_CHECKS.every((check) => check.test(password));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const nameError = validateName(name);

    if (nameError) {
      setError(nameError);
      return;
    }

    if (!passwordOk) {
      setError("La contraseña no cumple todas las reglas.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setSending(true);
    try {
      const cleanName = name.trim().replace(/\s+/g, " ");
      await registerUser({ name: cleanName, email, password });
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="logo-box">
           <img src="/vera-logo.svg" alt="VERA" style={{ width: 46, height: 46 }} />
        </div>

        <h1>VERA</h1>

        <p className="brand-line">
          VERIFICACIÓN · EVIDENCIA · RIESGO · AUDITORÍA
        </p>

        {sent ? (
          <div className="register-done" role="status">
            <h2>Solicitud enviada</h2>
            <p>
              Un administrador revisará tu cuenta. Cuando la apruebe, podrás iniciar
              sesión con <strong>{email}</strong>.
            </p>
            <Link className="register-back" to="/">
              Volver al inicio de sesión
            </Link>
          </div>
        ) : (
          <>
            <p className="login-message">
              Crea tu cuenta con tu correo institucional. Un administrador la
              aprobará antes de que puedas entrar.
            </p>

            <form onSubmit={handleSubmit}>
              <label htmlFor="reg-name">Nombre completo</label>
              <input
                id="reg-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre completo"
                autoComplete="name"
                maxLength={75}
                required
              />

              <label htmlFor="reg-email">Correo institucional</label>
              <input
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@institucion.mx"
                autoComplete="email"
                required
              />

              <label htmlFor="reg-password">Contraseña</label>
              <input
                id="reg-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                aria-describedby="reg-password-rules"
                required
              />

              <ul id="reg-password-rules" className="password-rules">
                {PASSWORD_CHECKS.map((check) => {
                  const ok = check.test(password);
                  return (
                    <li key={check.label} className={ok ? "ok" : ""}>
                      <span aria-hidden="true">{ok ? "✓" : "•"}</span>
                      {check.label}
                    </li>
                  );
                })}
              </ul>

              <label htmlFor="reg-confirm">Confirmar contraseña</label>
              <input
                id="reg-confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />

              {error && <p className="error">{error}</p>}

              <button type="submit" disabled={sending}>
                {sending ? "Enviando..." : "Enviar solicitud"}
              </button>
            </form>

            <p className="create-account">
              ¿Ya tienes cuenta? <Link to="/">Inicia sesión</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default Registro;
