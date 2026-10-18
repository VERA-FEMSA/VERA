import { useCallback, useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { exchangeManagedSession, loginUser, verify2FA } from "../services/authService";
import { managedAuth, managedAuthEnabled, googleAuthEnabled, microsoftAuthEnabled, startSocialSignIn, takeSocialPrivacyAcknowledgement } from "../services/managedAuth";
import { PRIVACY_NOTICE_VERSION } from "../constants/privacyNotice";
import "./Login.css";

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [tempToken, setTempToken] = useState(null); // set when the server asks for a 2FA code
  const [managedFactorId, setManagedFactorId] = useState(null);
  const [managedQr, setManagedQr] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const navigate = useNavigate();

  const finishLogin = useCallback((data) => {
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    navigate("/dashboard");
  }, [navigate]);

  const prepareManagedMfa = useCallback(async () => {
    const { data, error: factorsError } = await managedAuth.auth.mfa.listFactors();
    if (factorsError) throw factorsError;
    const existing = data?.totp?.find((factor) => factor.status === "verified");
    if (existing) {
      setManagedFactorId(existing.id);
      setManagedQr(null);
      return;
    }
    const { data: enrolled, error: enrollError } = await managedAuth.auth.mfa.enroll({ factorType: "totp" });
    if (enrollError) throw enrollError;
    setManagedFactorId(enrolled.id);
    setManagedQr(enrolled.totp.qr_code);
  }, []);

  const completeManaged = useCallback(async (accessToken, fromOAuthRedirect = false) => {
    try {
      const privacyAccepted = fromOAuthRedirect ? takeSocialPrivacyAcknowledgement() : false;
      const data = await exchangeManagedSession(accessToken, privacyAccepted, PRIVACY_NOTICE_VERSION);
      finishLogin(data);
    } catch (verificationError) {
      if (verificationError.code === "MFA_REQUIRED") {
        await prepareManagedMfa();
        return;
      }
      await managedAuth.auth.signOut();
      throw verificationError;
    }
  }, [finishLogin, prepareManagedMfa]);

  useEffect(() => {
    if (!managedAuth) return;
    let active = true;
    managedAuth.auth.getSession().then(async ({ data }) => {
      if (!active || !data.session) return;
      try { await completeManaged(data.session.access_token, true); }
      catch (sessionError) { if (active) setError(sessionError.message); }
    }).catch(() => { if (active) setError("No se pudo restaurar el acceso. Intenta de nuevo."); });
    return () => { active = false; };
  }, [completeManaged]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);

    try {
      if (managedFactorId) {
        const { error: factorError } = await managedAuth.auth.mfa.challengeAndVerify({
          factorId: managedFactorId, code
        });
        if (factorError) throw factorError;
        const { data } = await managedAuth.auth.getSession();
        if (!data.session) throw new Error("La sesión expiró. Inicia sesión de nuevo.");
        await completeManaged(data.session.access_token);
      } else if (tempToken) {
        // Step 2: verify the 6-digit code
        const data = await verify2FA(tempToken, code);
        finishLogin(data);
      } else {
        // Step 1: username + password
        let data;
        try { data = await loginUser(username, password); }
        catch (legacyError) {
          if (!managedAuth || legacyError.status !== 401 || !username.includes("@")) throw legacyError;
          const managed = await managedAuth.auth.signInWithPassword({
            email: username.trim().toLowerCase(), password: password.normalize("NFC")
          });
          if (managed.error || !managed.data.session) throw legacyError;
          await completeManaged(managed.data.session.access_token);
          return;
        }

        if (data.requires2FA) {
          setTempToken(data.tempToken);
        } else {
          finishLogin(data);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleBack = async () => {
    if (managedFactorId) await managedAuth.auth.signOut();
    setTempToken(null);
    setManagedFactorId(null);
    setManagedQr(null);
    setCode("");
    setPassword("");
    setError("");
  };

  const beginSocial = async (provider) => {
    setError("");
    try { await startSocialSignIn(provider); }
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

        <p className="subtitle">
          Plataforma de auditoría interna
        </p>

        <p className="login-message">
          {tempToken || managedFactorId
            ? "Ingresa el código de 6 dígitos de tu aplicación de autenticación."
            : "Inicia sesión para acceder al portafolio y a tus auditorías."}
        </p>

        <form onSubmit={handleSubmit}>
          {tempToken || managedFactorId ? (
            <>
              {managedQr && <div className="mfa-enrollment">
                <p>Escanea este código con tu aplicación de autenticación. Se exigirá en cada acceso con contraseña.</p>
                <img src={managedQr} alt="Código QR para configurar la aplicación de autenticación" />
              </div>}
              <label htmlFor="verification-code">Código de verificación</label>

              <input
                type="text"
                id="verification-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                autoFocus
              />
            </>
          ) : (
            <>
              <label htmlFor="login-username">{managedAuthEnabled ? "Correo electrónico" : "Correo institucional"}</label>

              <input
                type="text"
                id="login-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={managedAuthEnabled ? "tu@correo.com" : "correo@institucion.mx"}
                autoComplete="username"
              />


<label htmlFor="login-password">Contraseña</label>

              <input
                type="password"
                id="login-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña"
                autoComplete="current-password"
              />
            </>
          )}

          {error && <p className="error">{error}</p>}

          <button type="submit" disabled={busy}>
            {tempToken || managedFactorId ? "Verificar" : "Iniciar sesión"}
          </button>

          {(tempToken || managedFactorId) && (
            <button
              type="button"
              className="back-button"
              onClick={handleBack}
            >
              Volver
            </button>
          )}
        </form>

        {(googleAuthEnabled || microsoftAuthEnabled) && !tempToken && !managedFactorId &&
          <div className="social-options" aria-label="Otros métodos de acceso">
            {googleAuthEnabled && <button type="button" onClick={() => beginSocial("google")}>Continuar con Google</button>}
            {microsoftAuthEnabled && <button type="button" onClick={() => beginSocial("azure")}>Continuar con Microsoft</button>}
          </div>}

        <p className="create-account">
          ¿Primera vez en VERA? <Link to="/registro">Crear cuenta</Link>
        </p>
        <p className="create-account">
          <Link to="/acerca">Conoce VERA</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
