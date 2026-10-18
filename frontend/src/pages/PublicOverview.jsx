import { Link } from "react-router-dom";
import ThemeControl from "../components/ThemeControl";
import { useDocumentTitle } from "../contexts/useDocumentTitle";
import "./PublicOverview.css";

const capabilities = [
  {
    number: "01",
    title: "Planificar",
    description: "Propuestas, revisión y decisiones antes de iniciar una auditoría."
  },
  {
    number: "02",
    title: "Relacionar",
    description: "Auditorías, riesgos, controles y evidencias en un mismo recorrido."
  },
  {
    number: "03",
    title: "Dar seguimiento",
    description: "Indicadores, actividades e historial para conocer qué requiere atención."
  }
];

function PublicOverview() {
  useDocumentTitle("Acerca de VERA");
  return (
    <div className="public-overview">
      <a className="skip-link" href="#public-overview-main">Saltar al contenido</a>
      <div className="public-overview__shell">
        <header className="public-overview__header">
          <Link className="public-overview__brand" to="/" aria-label="VERA, ir al inicio de sesión">
            <img src="/vera-logo.svg" alt="" width="42" height="42" />
            <span>VERA<small>Digital Systems</small></span>
          </Link>
          <nav className="public-overview__nav" aria-label="Navegación pública">
            <Link to="/privacidad">Privacidad</Link>
            <ThemeControl compact />
            <Link className="public-overview__login" to="/">Iniciar sesión</Link>
          </nav>
        </header>

        <main id="public-overview-main">
          <section className="public-overview__hero" aria-labelledby="public-overview-title">
            <div className="public-overview__hero-copy">
              <p className="public-overview__eyebrow">VERIFICACIÓN · EVIDENCIA · RIESGO · AUDITORÍA</p>
              <h1 id="public-overview-title">Cada decisión de auditoría merece contexto.</h1>
              <p className="public-overview__intro">
                VERA conecta propuestas, auditorías, riesgos, controles y evidencias en un recorrido trazable. Es un prototipo funcional que sigue evolucionando.
              </p>
              <div className="public-overview__actions">
                <Link className="public-overview__primary" to="/">Entrar a VERA</Link>
                <Link className="public-overview__secondary" to="/registro">Crear cuenta</Link>
              </div>
            </div>
            <div className="public-overview__journey" aria-label="Recorrido de VERA">
              <div className="public-overview__journey-head"><span>RECORRIDO DE INFORMACIÓN</span><span>VERA / 01—04</span></div>
              <ol>
                <li><span>01</span><strong>Proponer</strong><small>Definir el objetivo y el alcance.</small></li>
                <li><span>02</span><strong>Decidir</strong><small>Revisar antes de activar la auditoría.</small></li>
                <li><span>03</span><strong>Relacionar</strong><small>Vincular riesgos, controles y evidencias.</small></li>
                <li><span>04</span><strong>Dar seguimiento</strong><small>Consultar pendientes e historial.</small></li>
              </ol>
              <p>Información de demostración · Sin datos reales de FEMSA</p>
            </div>
          </section>

          <section className="public-overview__section" aria-labelledby="capabilities-title">
            <div className="public-overview__section-heading">
              <p className="public-overview__eyebrow">UNA SOLA LECTURA DEL PORTAFOLIO</p>
              <h2 id="capabilities-title">De la planificación al seguimiento</h2>
            </div>
            <div className="public-overview__capabilities">
              {capabilities.map((item) => (
                <article className="public-overview__card" key={item.number}>
                  <span className="public-overview__number">{item.number}</span>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="public-overview__before" aria-labelledby="before-title">
            <div><p className="public-overview__eyebrow">ANTES DE ENTRAR</p><h2 id="before-title">Un entorno claro desde el primer acceso.</h2></div>
            <div><p>Puedes crear una cuenta con contraseña, Microsoft o Google. Las cuentas nuevas comienzan con el rol Auditor; solicitar otro rol requiere autorización.</p>
              <p>Este entorno usa datos de demostración. No ingreses información real o confidencial en los expedientes de prueba.</p></div>
          </section>
        </main>

        <footer className="public-overview__footer">
          <p>VERA · Auditorías, riesgos y evidencia</p>
          <p>
            <a href="https://github.com/VERA-GRC-IRM/VERA">Repositorio</a>
            <span aria-hidden="true"> · </span>
            <Link to="/privacidad">Aviso de privacidad</Link>
            <span aria-hidden="true"> · </span>
            <a href="mailto:carlos.sanchez.gtz.it@gmail.com?subject=VERA%20-%20privacidad">Consultas de privacidad</a>
          </p>
        </footer>
      </div>
    </div>
  );
}

export default PublicOverview;
