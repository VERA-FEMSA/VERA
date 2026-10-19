import { Link } from "react-router-dom";
import PublicSiteShell from "../components/PublicSiteShell";
import { useDocumentTitle } from "../contexts/useDocumentTitle";

const layers = [
  { number: "01", name: "Experiencia", detail: "Interfaz React para planificación, auditorías, riesgo, evidencia y seguimiento." },
  { number: "02", name: "Reglas y acceso", detail: "API Node.js que valida operaciones y determina los registros visibles para cada cuenta." },
  { number: "03", name: "Persistencia", detail: "Almacenes configurables; Supabase respalda el entorno conectado cuando se aplica su configuración." },
  { number: "04", name: "Asistencia", detail: "Azure OpenAI desde el servidor, con consultas sujetas al contexto y los permisos de VERA." }
];

function PublicTechnology() {
  useDocumentTitle("Tecnología y evidencia");
  return <PublicSiteShell mainId="technology-main">
    <section className="public-page-hero public-page-hero--technology" aria-labelledby="technology-title">
      <p className="public-eyebrow">TECNOLOGÍA / ARQUITECTURA Y EVIDENCIA</p>
      <h1 id="technology-title">La ingeniería también debe poder revisarse.</h1>
      <p>VERA separa experiencia, reglas de negocio, persistencia y asistencia. El código, la documentación y las corridas de calidad permiten examinar cada capa sin depender de una promesa comercial.</p>
    </section>

    <section className="public-section public-architecture" aria-labelledby="architecture-title">
      <div className="public-section__topline"><p className="public-eyebrow">MAPA DE LA SOLUCIÓN</p><span>Capas con responsabilidades distintas</span></div>
      <h2 id="architecture-title" className="public-section__statement">De la pantalla a la regla y al dato.</h2>
      <ol className="public-architecture__layers">
        {layers.map((layer) => <li key={layer.number}><span>{layer.number}</span><h3>{layer.name}</h3><p>{layer.detail}</p></li>)}
      </ol>
    </section>

    <section className="public-section public-resources" aria-labelledby="resources-title">
      <div className="public-section__topline"><p className="public-eyebrow">ABIERTO A REVISIÓN</p><span>Fuentes que se actualizan con el proyecto</span></div>
      <h2 id="resources-title" className="public-section__statement">Consulta la implementación y su evidencia.</h2>
      <div className="public-resources__grid">
        <a href="https://github.com/VERA-GRC-IRM/VERA"><span>01 / CÓDIGO</span><strong>Repositorio</strong><p>Archivos, historial y pull requests de la solución.</p><b aria-hidden="true">↗</b></a>
        <a href="https://github.com/VERA-GRC-IRM/VERA/wiki"><span>02 / CONOCIMIENTO</span><strong>Wiki</strong><p>Producto, flujos, arquitectura y límites de aceptación.</p><b aria-hidden="true">↗</b></a>
        <a href="https://vera-grc-irm.github.io/VERA/"><span>03 / CALIDAD</span><strong>Portal de calidad</strong><p>Corridas, resultados y tiempos vinculados al commit.</p><b aria-hidden="true">↗</b></a>
      </div>
    </section>

    <section className="public-trust-note public-trust-note--technical" aria-labelledby="technology-note-title">
      <div><p className="public-eyebrow">ESTADO ACTUAL</p><h2 id="technology-note-title">Evidencia verificable, afirmaciones delimitadas.</h2></div>
      <div><p>Un check verde acredita las comprobaciones de esa corrida; no certifica por sí mismo la aceptación de todos los procesos en producción. La demo y el repositorio muestran el estado actual, con riesgos y pendientes documentados.</p><a className="public-text-link" href="https://github.com/VERA-GRC-IRM/VERA/issues/113">Ver aceptación pendiente <span aria-hidden="true">↗</span></a><span aria-hidden="true"> · </span><Link className="public-text-link" to="/confianza">Volver a confianza <span aria-hidden="true">↗</span></Link></div>
    </section>
  </PublicSiteShell>;
}

export default PublicTechnology;
