import { useState } from "react";
import { Link } from "react-router-dom";
import { registerUser } from "../services/authService";
import { PASSWORD_CHECKS, validateName } from "../constants/accountRules";
import { googleAuthEnabled, microsoftAuthEnabled, startSocialSignIn } from "../services/managedAuth";
import { PRIVACY_NOTICE_VERSION } from "../constants/privacyNotice";
import "./Login.css";
import "./Registro.css";

function Registro() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const passwordOk = PASSWORD_CHECKS.every((check) => check.test(password));
  const socialEnabled = googleAuthEnabled || microsoftAuthEnabled;
  const directRegistrationEnabled = import.meta.env.VITE_VERA_DIRECT_REGISTRATION_ENABLED === "true";

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
    if (!privacyAccepted) {
      setError("Lee y acepta el aviso de privacidad antes de crear tu cuenta.");
      return;
    }

    setSending(true);
    try {
      const cleanName = name.trim().replace(/\s+/g, " ");
      await registerUser({ name: cleanName, email, password,
        privacyAccepted, privacyNoticeVersion: PRIVACY_NOTICE_VERSION });
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const beginSocial = async (provider) => {
    setError("");
    if (!privacyAccepted) {
      setError("Lee y acepta el aviso de privacidad antes de continuar.");
      return;
    }
    try { await startSocialSignIn(provider, true); }
    catch { setError("No se pudo iniciar el acceso con este proveedor. Intenta más tarde."); }
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
            <h2>Cuenta creada</h2>
            <p>Ya puedes iniciar sesión. En el primer acceso configurarás el doble factor con tu aplicación de autenticación.</p>
            <Link className="register-back" to="/">
              Volver al inicio de sesión
            </Link>
          </div>
        ) : (
          <>
            <p className="login-message">{directRegistrationEnabled
              ? "Crea tu cuenta con cualquier correo. Entrarás con el rol Auditor y configurarás el doble factor en el primer acceso. El correo no se verifica."
              : socialEnabled
                ? "Crea tu cuenta con Microsoft o Google. Tu identidad se verifica con el proveedor y entrarás con el rol Auditor."
                : "El alta de cuentas nuevas no está disponible por ahora."}</p>

            {directRegistrationEnabled && <form onSubmit={handleSubmit}>
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

              <label htmlFor="reg-email">Correo electrónico</label>
              <input
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
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
              <p className="password-rules">Puedes usar espacios y caracteres Unicode. También rechazaremos contraseñas conocidas por filtraciones.</p>

              <label htmlFor="reg-confirm">Confirmar contraseña</label>
              <input
                id="reg-confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />

              <label className="privacy-ack" htmlFor="reg-privacy">
                <input id="reg-privacy" type="checkbox" checked={privacyAccepted}
                  onChange={(event) => setPrivacyAccepted(event.target.checked)} required />
                <span>Leí y acepto el <Link to="/privacidad" target="_blank" rel="noopener noreferrer">aviso de privacidad</Link> (versión {PRIVACY_NOTICE_VERSION}).</span>
              </label>
              <p className="privacy-summary">Responsable: Carlos Sánchez Gutiérrez, Valle Primavera 2994, Monterrey, Nuevo León. Usaremos tu nombre, correo y datos de acceso para crear y proteger la cuenta. No verificamos que controles el correo que escribas; usa uno propio. El contenido de demostración se usa en los módulos y, si consultas al asistente, la pregunta se procesa con Azure OpenAI. Puedes ejercer tus derechos en <a href="mailto:carlos.sanchez.gtz.it@gmail.com">carlos.sanchez.gtz.it@gmail.com</a>. <Link to="/privacidad" target="_blank" rel="noopener noreferrer">Consulta el aviso integral</Link>.</p>

              {error && <p className="error">{error}</p>}

              <button type="submit" disabled={sending}>
                {sending ? "Creando..." : "Crear cuenta"}
              </button>
            </form>}

            {!directRegistrationEnabled && error && <p className="error" role="alert">{error}</p>}

            {socialEnabled && <div className="social-registration">
              {directRegistrationEnabled && <p>También puedes entrar con tu cuenta Microsoft o Google.</p>}
              {!directRegistrationEnabled && <>
                <label className="privacy-ack" htmlFor="social-privacy">
                  <input id="social-privacy" type="checkbox" checked={privacyAccepted}
                    onChange={(event) => setPrivacyAccepted(event.target.checked)} />
                  <span>Leí y acepto el <Link to="/privacidad" target="_blank" rel="noopener noreferrer">aviso de privacidad</Link> (versión {PRIVACY_NOTICE_VERSION}).</span>
                </label>
                <p className="privacy-summary">Responsable: Carlos Sánchez Gutiérrez. Usaremos los datos básicos de tu cuenta externa para identificarte y crear tu cuenta con el rol inicial. <Link to="/privacidad" target="_blank" rel="noopener noreferrer">Consulta el aviso integral</Link>.</p>
              </>}
              <div className="social-options" aria-label="Crear cuenta con otro proveedor">
                {microsoftAuthEnabled && <button type="button" onClick={() => beginSocial("azure")}>Continuar con Microsoft</button>}
                {googleAuthEnabled && <button type="button" onClick={() => beginSocial("google")}>Continuar con Google</button>}
              </div>
            </div>}

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
