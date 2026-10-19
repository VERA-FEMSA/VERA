import { Link } from "react-router-dom";
import PublicSiteShell from "../components/PublicSiteShell";
import { useDocumentTitle } from "../contexts/useDocumentTitle";

const steps = [
  { number: "01", name: "Propuesta", detail: "Objetivo y alcance" },
  { number: "02", name: "Decisión", detail: "Revisión registrada" },
  { number: "03", name: "Ejecución", detail: "Riesgos y controles" },
  { number: "04", name: "Evidencia", detail: "Seguimiento trazable" }
];

const valuePillars = [
  { index: "01 / VISIBILIDAD", title: "El portafolio, en contexto.", detail: "Indicadores, prioridades y auditorías visibles según el alcance de cada usuario." },
  { index: "02 / GOBIERNO", title: "Decisiones que dejan rastro.", detail: "Una propuesta pasa por revisión antes de iniciar; la decisión y su historial se conservan." },
  { index: "03 / SUSTENTO", title: "La evidencia no queda aislada.", detail: "Riesgos, controles, hallazgos y evidencias se relacionan con el expediente." }
];

function PublicOverview() {
  useDocumentTitle("Plataforma de auditoría y riesgo");

  return <PublicSiteShell mainId="public-overview-main">
    <section className="public-hero" aria-labelledby="public-overview-title">
      <div className="public-hero__copy">
        <p className="public-eyebrow public-eyebrow--on-dark">VERA / GOBIERNO · RIESGO · AUDITORÍA</p>
        <h1 id="public-overview-title">Decisiones mejor informadas. Auditorías conectadas.</h1>
        <p className="public-hero__lead">VERA reúne planificación, riesgo, controles y evidencia en un recorrido visible para cada rol. Del planteamiento de una iniciativa a su seguimiento, con contexto en cada decisión.</p>
        <div className="public-hero__actions">
          <Link className="public-button public-button--light" to="/soluciones">Explorar la plataforma <span aria-hidden="true">↗</span></Link>
          <Link className="public-text-link public-text-link--light" to="/">Acceder al entorno <span aria-hidden="true">↗</span></Link>
        </div>
        <p className="public-hero__disclaimer">Prototipo funcional en evolución · Entorno público con datos de demostración</p>
      </div>
      <div className="public-flow" aria-label="Recorrido de VERA: propuesta, decisión, ejecución y evidencia">
        <div className="public-flow__heading"><span>UN RECORRIDO CON CONTEXTO</span><span>VERA / 01—04</span></div>
        <div className="public-flow__path" aria-hidden="true"><span /></div>
        <ol>
          {steps.map((step) => <li key={step.number}>
            <span className="public-flow__number">{step.number}</span>
            <div><strong>{step.name}</strong><small>{step.detail}</small></div>
            <span className="public-flow__mark" aria-hidden="true" />
          </li>)}
        </ol>
        <p>Del planteamiento al registro de lo ocurrido.</p>
      </div>
    </section>

    <section className="public-section public-intro" aria-labelledby="public-intro-title">
      <div className="public-section__heading">
        <p className="public-eyebrow">LA IDEA CENTRAL</p>
        <h2 id="public-intro-title">Lo importante no es ver más información. Es entender cómo se relaciona.</h2>
      </div>
      <div className="public-intro__aside">
        <p>Cuando propuestas, auditorías, riesgos y evidencias viven en lugares separados, resulta más difícil explicar una decisión y darle seguimiento. VERA presenta esas piezas como parte de un mismo proceso.</p>
        <Link className="public-text-link" to="/soluciones">Conoce las soluciones <span aria-hidden="true">↗</span></Link>
      </div>
    </section>

    <section className="public-section public-value" aria-labelledby="public-value-title">
      <div className="public-section__topline"><p className="public-eyebrow">VALOR PARA EL NEGOCIO</p><span>Un sistema de lectura, decisión y seguimiento</span></div>
      <h2 id="public-value-title" className="public-section__statement">Un portafolio que se puede explicar.</h2>
      <div className="public-value__grid">
        {valuePillars.map((pillar) => <article className="public-value__card" key={pillar.index}>
          <span>{pillar.index}</span><h3>{pillar.title}</h3><p>{pillar.detail}</p>
        </article>)}
      </div>
    </section>

    <section className="public-section public-split" aria-labelledby="public-differentiation-title">
      <div className="public-split__visual" aria-hidden="true">
        <span className="public-split__orbit public-split__orbit--outer" />
        <span className="public-split__orbit public-split__orbit--inner" />
        <span className="public-split__core">VERA</span>
        <span className="public-split__label public-split__label--one">AUDITORÍA</span>
        <span className="public-split__label public-split__label--two">RIESGO</span>
        <span className="public-split__label public-split__label--three">EVIDENCIA</span>
      </div>
      <div className="public-split__copy">
        <p className="public-eyebrow">GRC + IRM EN EL MISMO RECORRIDO</p>
        <h2 id="public-differentiation-title">La decisión, el riesgo y su sustento deben verse juntos.</h2>
        <p>VERA no presenta un indicador sin su contexto. El usuario puede pasar del panorama a la propuesta, la auditoría y los registros relacionados. El asistente ayuda a consultar información autorizada y muestra fuentes para que una persona compruebe la respuesta.</p>
        <Link className="public-text-link" to="/confianza">Cómo cuidamos la trazabilidad <span aria-hidden="true">↗</span></Link>
      </div>
    </section>

    <section className="public-final-cta" aria-labelledby="public-final-title">
      <p className="public-eyebrow public-eyebrow--on-dark">CONOCE VERA</p>
      <h2 id="public-final-title">Explora el recorrido completo.</h2>
      <p>Una experiencia de demostración para entender cómo se conectan planificación, ejecución, riesgo y evidencia.</p>
      <div className="public-hero__actions"><Link className="public-button public-button--light" to="/">Entrar a la demo <span aria-hidden="true">↗</span></Link><Link className="public-text-link public-text-link--light" to="/tecnologia">Ver la ingeniería <span aria-hidden="true">↗</span></Link></div>
    </section>
  </PublicSiteShell>;
}

export default PublicOverview;
