import { Link } from "react-router-dom";
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
  return (
    <main className="public-overview">
      <div className="public-overview__shell">
        <header className="public-overview__header">
          <Link className="public-overview__brand" to="/" aria-label="VERA, ir al inicio de sesión">
            <img src="/vera-logo.svg" alt="" width="42" height="42" />
            <span>VERA</span>
          </Link>
          <Link className="public-overview__login" to="/">Iniciar sesión</Link>
        </header>

        <section className="public-overview__hero" aria-labelledby="public-overview-title">
          <p className="public-overview__eyebrow">VERIFICACIÓN · EVIDENCIA · RIESGO · AUDITORÍA</p>
          <h1 id="public-overview-title">Decisiones de auditoría con contexto y trazabilidad.</h1>
          <p className="public-overview__intro">
            VERA reúne la planificación de auditorías, el seguimiento de riesgos y controles,
            y las evidencias que sustentan cada decisión. Es un prototipo funcional en evolución.
          </p>
          <div className="public-overview__actions">
            <Link className="public-overview__primary" to="/">Entrar a VERA</Link>
            <Link className="public-overview__secondary" to="/registro">Solicitar acceso</Link>
          </div>
        </section>

        <section className="public-overview__capabilities" aria-label="Recorrido de VERA">
          {capabilities.map((item) => (
            <article className="public-overview__card" key={item.number}>
              <span className="public-overview__number">{item.number}</span>
              <h2>{item.title}</h2>
              <p>{item.description}</p>
            </article>
          ))}
        </section>

        <footer className="public-overview__footer">
          <p>El entorno público usa datos de demostración y cuentas invitadas. Las solicitudes de acceso requieren aprobación.</p>
          <p>
            <a href="https://github.com/VERA-GRC-IRM/VERA">Repositorio</a>
            <span aria-hidden="true"> · </span>
            <a href="mailto:carlos.sanchez.gtz.it@gmail.com?subject=VERA%20-%20privacidad">Consultas de privacidad</a>
          </p>
        </footer>
      </div>
    </main>
  );
}

export default PublicOverview;
