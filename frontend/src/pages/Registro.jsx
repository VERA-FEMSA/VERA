import { useState } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff, UserRoundPlus } from "lucide-react";
import AccessShell from "../components/AccessShell";
import { useDocumentTitle } from "../contexts/useDocumentTitle";
import { registerUser } from "../services/authService";
import { PASSWORD_CHECKS, validateName } from "../constants/accountRules";
import { googleAuthEnabled, microsoftAuthEnabled, startSocialSignIn } from "../services/managedAuth";
import { PRIVACY_NOTICE_VERSION } from "../constants/privacyNotice";
import "./Login.css";
import "./Registro.css";

function Registro() {
  useDocumentTitle("Crear cuenta");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [socialBusy, setSocialBusy] = useState(null);

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
    setSocialBusy(provider);
    try { await startSocialSignIn(provider, true); }
    catch {
      setError("No se pudo iniciar el acceso con este proveedor. Intenta más tarde.");
      setSocialBusy(null);
    }
  };

  return (
    <AccessShell variant="register">
      <div className="access-card__heading">
        <p className="access-card__eyebrow"><UserRoundPlus size={15} aria-hidden="true" /> NUEVA CUENTA</p>
        <h1>{sent ? "Cuenta creada" : "Crea tu cuenta"}</h1>
        <p>{sent ? "Ya puedes acceder a VERA." : "Elige un método para empezar. Todas las cuentas nuevas comienzan con el rol Auditor."}</p>
      </div>

      {sent ? <div className="register-done" role="status">
        <p>Si te registraste con contraseña, configurarás el doble factor con una aplicación de autenticación en tu primer acceso.</p>
        <Link className="auth-primary register-back" to="/">Ir al inicio de sesión</Link>
      </div> : <>
        <div className="registration-note" role="note">
          {directRegistrationEnabled
            ? "Puedes usar cualquier correo. Si eliges contraseña, no verificamos que controles esa dirección; escribe una que sea tuya."
            : socialEnabled
              ? "Tu identidad se confirma con Microsoft o Google."
              : "El alta de cuentas nuevas no está disponible por ahora."}
        </div>

        {(directRegistrationEnabled || socialEnabled) && <>
          <label className="privacy-ack" htmlFor="reg-privacy">
            <input id="reg-privacy" type="checkbox" checked={privacyAccepted}
              onChange={(event) => setPrivacyAccepted(event.target.checked)} required />
            <span>Leí y acepto el <Link to="/privacidad" target="_blank" rel="noopener noreferrer">aviso de privacidad</Link> (versión {PRIVACY_NOTICE_VERSION}).</span>
          </label>
          <details className="privacy-details">
            <summary>Cómo se usarán mis datos</summary>
            <p>Responsable: Carlos Sánchez Gutiérrez, Valle Primavera 2994, Monterrey, Nuevo León. Usaremos tu nombre, correo y datos de acceso para crear y proteger la cuenta. No verificamos que controles el correo que escribas; usa uno propio. El contenido de demostración se usa en los módulos y, si consultas al asistente, la pregunta se procesa con Azure OpenAI. Puedes ejercer tus derechos en <a href="mailto:carlos.sanchez.gtz.it@gmail.com">carlos.sanchez.gtz.it@gmail.com</a>. <Link to="/privacidad" target="_blank" rel="noopener noreferrer">Consulta el aviso integral</Link>.</p>
          </details>
        </>}

        {error && <p id="registration-error" className="auth-error" role="alert">{error}</p>}

        {socialEnabled && <div className="registration-social">
          <p className="auth-method-label">Crear con una cuenta existente</p>
          <div className="social-options" aria-label="Crear cuenta con proveedor de identidad">
            {microsoftAuthEnabled && <button type="button" disabled={sending || Boolean(socialBusy)}
              onClick={() => beginSocial("azure")}>{socialBusy === "azure" ? "Abriendo Microsoft…" : "Continuar con Microsoft"}</button>}
            {googleAuthEnabled && <button type="button" disabled={sending || Boolean(socialBusy)}
              onClick={() => beginSocial("google")}>{socialBusy === "google" ? "Abriendo Google…" : "Continuar con Google"}</button>}
          </div>
        </div>}

        {directRegistrationEnabled && <>
          {socialEnabled && <div className="auth-divider"><span>o crea con correo y contraseña</span></div>}
          <form className="auth-form" onSubmit={handleSubmit}>
            <label htmlFor="reg-name">Nombre completo</label>
            <input id="reg-name" value={name} onChange={(event) => setName(event.target.value)}
              placeholder="Como quieres aparecer en VERA" autoComplete="name" maxLength={75} required />

            <label htmlFor="reg-email">Correo electrónico</label>
            <input id="reg-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)}
              placeholder="tu@correo.com" autoComplete="email" required />

            <label htmlFor="reg-password">Contraseña</label>
            <div className="auth-password-field">
              <input id="reg-password" type={showPassword ? "text" : "password"} value={password}
                onChange={(event) => setPassword(event.target.value)} autoComplete="new-password"
                aria-describedby="reg-password-rules" required />
              <button className="auth-password-toggle" type="button" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>
                {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </button>
            </div>
            <ul id="reg-password-rules" className="password-rules" aria-live="polite">
              {PASSWORD_CHECKS.map((check) => {
                const ok = check.test(password);
                return <li key={check.label} className={ok ? "ok" : ""}>
                  <span aria-hidden="true">{ok ? "✓" : "○"}</span>
                  <span className="visually-hidden">{ok ? "Cumple: " : "Pendiente: "}</span>{check.label}
                </li>;
              })}
            </ul>
            <p className="auth-hint">Se permiten espacios y caracteres Unicode. Se rechazan contraseñas conocidas por filtraciones.</p>

            <label htmlFor="reg-confirm">Confirma la contraseña</label>
            <div className="auth-password-field">
              <input id="reg-confirm" type={showConfirm ? "text" : "password"} value={confirm}
                onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" required />
              <button className="auth-password-toggle" type="button" aria-label={showConfirm ? "Ocultar confirmación" : "Mostrar confirmación"}
                aria-pressed={showConfirm} onClick={() => setShowConfirm((visible) => !visible)}>
                {showConfirm ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </button>
            </div>
            {confirm && <p className={`auth-hint${confirm === password ? " auth-hint--good" : ""}`} role="status">
              {confirm === password ? "Las contraseñas coinciden." : "Las contraseñas todavía no coinciden."}
            </p>}

            <button className="auth-primary" type="submit" disabled={sending || Boolean(socialBusy)}>
              {sending ? "Creando cuenta…" : "Crear cuenta"}
            </button>
          </form>
        </>}

        <div className="access-card__bottom"><p>¿Ya tienes cuenta? <Link to="/">Inicia sesión</Link></p></div>
      </>}
    </AccessShell>
  );
}

export default Registro;
