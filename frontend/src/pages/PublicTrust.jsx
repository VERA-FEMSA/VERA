import { Link } from "react-router-dom";
import PublicSiteShell from "../components/PublicSiteShell";
import { useDocumentTitle } from "../contexts/useDocumentTitle";

const principles = [
  { number: "01", label: "ALCANCE", title: "Cada persona ve el contexto que le corresponde.", detail: "El servidor decide qué registros puede consultar una cuenta y qué operaciones están disponibles para su rol. La interfaz muestra ese alcance, pero no sustituye la autorización." },
  { number: "02", label: "DECISIÓN", title: "Las propuestas tienen un antes y un después.", detail: "La revisión registra aprobación o rechazo y conserva su relación con la propuesta; el proceso no se resume a un cambio de color en el tablero." },
  { number: "03", label: "TRAZABILIDAD", title: "Del indicador al registro.", detail: "El usuario puede abrir las auditorías y los datos relacionados que explican un riesgo, un control, un hallazgo o una actividad pendiente." },
  { number: "04", label: "ASISTENCIA", title: "La IA orienta; una persona decide.", detail: "El asistente puede consultar información permitida y mostrar fuentes. Sus respuestas pueden equivocarse y no aprueban ni modifican expedientes por sí solas." }
];

function PublicTrust() {
  useDocumentTitle("Confianza y trazabilidad");
  return <PublicSiteShell mainId="trust-main">
    <section className="public-page-hero public-page-hero--trust" aria-labelledby="trust-title">
      <p className="public-eyebrow">CONFIANZA / GOBIERNO DE LA INFORMACIÓN</p>
      <h1 id="trust-title">La confianza se construye al poder explicar cada paso.</h1>
      <p>En VERA, el contexto de una decisión importa tanto como el resultado. Alcance por rol, decisiones registradas y enlaces a los datos relacionados ayudan a revisar lo ocurrido.</p>
      <div className="public-page-hero__rule"><span>ALCANCE</span><span>DECISIÓN</span><span>SUSTENTO</span><span>SEGUIMIENTO</span></div>
    </section>

    <section className="public-section public-principles" aria-labelledby="principles-title">
      <div className="public-section__topline"><p className="public-eyebrow">PRINCIPIOS DE PRODUCTO</p><span>Lo observable en el sistema</span></div>
      <h2 id="principles-title" className="public-section__statement">Gobierno visible en la operación diaria.</h2>
      <div className="public-principles__grid">
        {principles.map((principle) => <article key={principle.number}>
          <span>{principle.number} / {principle.label}</span>
          <h3>{principle.title}</h3>
          <p>{principle.detail}</p>
        </article>)}
      </div>
    </section>

    <section className="public-section public-trust-note" aria-labelledby="trust-note-title">
      <div><p className="public-eyebrow">TRANSPARENCIA DEL ENTORNO</p><h2 id="trust-note-title">Una demo útil también explica sus límites.</h2></div>
      <div><p>El sitio público presenta un prototipo funcional con datos de demostración. Las verificaciones automáticas y el código son consultables; la aceptación completa de producción depende de pruebas con cuentas, datos y condiciones reales del entorno.</p>
        <p>No presentamos esta demo como una certificación de cumplimiento ni como autorización para introducir información confidencial.</p>
        <Link className="public-text-link" to="/tecnologia">Ver implementación y evidencia <span aria-hidden="true">↗</span></Link></div>
    </section>

    <section className="public-inline-cta" aria-labelledby="trust-cta-title">
      <div><p className="public-eyebrow">EXPLORA EL PRODUCTO</p><h2 id="trust-cta-title">Conoce el recorrido desde una cuenta de demostración.</h2></div>
      <Link className="public-button" to="/">Acceder a VERA <span aria-hidden="true">↗</span></Link>
    </section>
  </PublicSiteShell>;
}

export default PublicTrust;
