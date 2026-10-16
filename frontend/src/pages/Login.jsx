import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { loginUser, verify2FA } from "../services/authService";
import "./Login.css";

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [tempToken, setTempToken] = useState(null); // set when the server asks for a 2FA code
  const [error, setError] = useState("");

  const navigate = useNavigate();

  const finishLogin = (data) => {
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    navigate("/dashboard");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      if (tempToken) {
        // Step 2: verify the 6-digit code
        const data = await verify2FA(tempToken, code);
        finishLogin(data);
      } else {
        // Step 1: username + password
        const data = await loginUser(username, password);

        if (data.requires2FA) {
          setTempToken(data.tempToken);
        } else {
          finishLogin(data);
        }
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleBack = () => {
    setTempToken(null);
    setCode("");
    setPassword("");
    setError("");
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
          {tempToken
            ? "Ingresa el código de 6 dígitos de tu aplicación de autenticación."
            : "Inicia sesión para acceder al portafolio y a tus auditorías."}
        </p>

        <form onSubmit={handleSubmit}>
          {tempToken ? (
            <>
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
<label htmlFor="login-username">Correo institucional</label>

              <input
                type="text"
                id="login-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="correo@institucion.mx"
                autoComplete="username"
              />


<label htmlFor="login-password">Contraseña</label>

              <input
                type="password"
                id="login-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña"
              />
            </>
          )}

          {error && <p className="error">{error}</p>}

          <button type="submit">
            {tempToken ? "Verificar" : "Iniciar sesión"}
          </button>

          {tempToken && (
            <button
              type="button"
              className="back-button"
              onClick={handleBack}
            >
              Volver
            </button>
          )}
        </form>

        <p className="create-account">
          ¿Primera vez en VERA? <Link to="/registro">Crear cuenta</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
