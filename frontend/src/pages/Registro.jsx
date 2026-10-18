import { useState } from "react";
import { Link } from "react-router-dom";
import { registerUser } from "../services/authService";
import { PASSWORD_CHECKS, validateName } from "../constants/accountRules";
import { managedAuth, managedAuthEnabled, googleAuthEnabled, microsoftAuthEnabled, startSocialSignIn } from "../services/managedAuth";
import { PRIVACY_NOTICE_VERSION } from "../constants/privacyNotice";
import "./Login.css";
import "./Registro.css";

// New password registrations verify email and request approval before access.
function Registro() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [verified, setVerified] = useState(false);
  const [code, setCode] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

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
    if (managedAuthEnabled && !privacyAccepted) {
      setError("Lee y acepta el aviso de privacidad antes de solicitar acceso.");
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

  const verifyEmail = async (e) => {
    e.preventDefault();
    setError("");
    setSending(true);
    try {
      const { error: verificationError } = await managedAuth.auth.verifyOtp({
        email: email.trim().toLowerCase(), token: code.trim(), type: "email"
      });
      if (verificationError) throw verificationError;
      await managedAuth.auth.signOut();
      setVerified(true);
    } catch {
      setError("El código no es válido o ya expiró. Revisa el correo e inténtalo de nuevo.");
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
            <h2>{verified ? "Correo verificado" : managedAuthEnabled ? "Revisa tu correo" : "Solicitud enviada"}</h2>
            <p>{verified
              ? "Tu solicitud espera aprobación. Cuando sea aprobada, inicia sesión y configura la app de autenticación."
              : managedAuthEnabled
                ? `Enviamos un código de verificación a ${email}. La solicitud también necesita aprobación.`
                : `Un administrador revisará tu cuenta. Cuando la apruebe, podrás iniciar sesión con ${email}.`}</p>
            {managedAuthEnabled && !verified && (
              <form onSubmit={verifyEmail}>
                <label htmlFor="reg-email-code">Código recibido por correo</label>
                <input id="reg-email-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  inputMode="numeric" autoComplete="one-time-code" maxLength={8} required />
                {error && <p className="error" role="alert">{error}</p>}
                <button type="submit" disabled={sending}>{sending ? "Verificando..." : "Verificar correo"}</button>
              </form>
            )}
            <Link className="register-back" to="/">
              Volver al inicio de sesión
            </Link>
          </div>
        ) : (
          <>
            <p className="login-message">
              {managedAuthEnabled
                ? "Crea tu cuenta con cualquier correo electrónico. Verificaremos la dirección y un administrador aprobará el acceso antes de que puedas entrar."
                : "Crea tu cuenta con tu correo institucional. Un administrador la aprobará antes de que puedas entrar."}
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

              <label htmlFor="reg-email">{managedAuthEnabled ? "Correo electrónico" : "Correo institucional"}</label>
              <input
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={managedAuthEnabled ? "tu@correo.com" : "correo@institucion.mx"}
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
              {managedAuthEnabled && <p className="password-rules">Puedes usar espacios y caracteres Unicode. También rechazaremos contraseñas conocidas por filtraciones.</p>}

              <label htmlFor="reg-confirm">Confirmar contraseña</label>
              <input
                id="reg-confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />

              {managedAuthEnabled && <label className="privacy-ack" htmlFor="reg-privacy">
                <input id="reg-privacy" type="checkbox" checked={privacyAccepted}
                  onChange={(event) => setPrivacyAccepted(event.target.checked)} required />
                <span>Leí y acepto el <Link to="/privacidad" target="_blank" rel="noopener noreferrer">aviso de privacidad</Link> (versión {PRIVACY_NOTICE_VERSION}).</span>
              </label>}
              {managedAuthEnabled && <p className="privacy-summary">Responsable: Carlos Sánchez Gutiérrez, Valle Primavera 2994, Monterrey, Nuevo León. Usaremos tu nombre, correo y datos de acceso para verificar tu identidad, aprobar la cuenta y proteger VERA. El contenido de demostración se usa en los módulos y, si consultas al asistente, la pregunta se procesa con Azure OpenAI. Puedes limitar el uso o ejercer tus derechos en <a href="mailto:carlos.sanchez.gtz.it@gmail.com">carlos.sanchez.gtz.it@gmail.com</a>. <Link to="/privacidad" target="_blank" rel="noopener noreferrer">Consulta el aviso integral</Link>.</p>}

              {error && <p className="error">{error}</p>}

              <button type="submit" disabled={sending}>
                {sending ? "Enviando..." : "Enviar solicitud"}
              </button>
            </form>

            {(googleAuthEnabled || microsoftAuthEnabled) && <div className="social-options" aria-label="Crear cuenta con otro proveedor">
              {googleAuthEnabled && <button type="button" onClick={() => beginSocial("google")}>Continuar con Google</button>}
              {microsoftAuthEnabled && <button type="button" onClick={() => beginSocial("azure")}>Continuar con Microsoft</button>}
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
