import { useState } from "react";
import { Link } from "react-router-dom";
import PublicSiteShell from "../components/PublicSiteShell";
import { useDocumentTitle } from "../contexts/useDocumentTitle";

const perspectives = [
  { label: "Dirección", question: "¿Dónde se requiere atención ahora?", answer: "El panel reúne indicadores, estados y prioridades del portafolio en una primera lectura. Cada persona consulta el alcance que le corresponde.", path: "Panel de portafolio → auditorías y riesgos" },
  { label: "Planeación", question: "¿Qué iniciativas deben avanzar?", answer: "Las propuestas se describen antes de convertirse en auditorías. Una revisión registrada permite entender qué se aprobó, rechazó o sigue abierto.", path: "Propuesta → revisión → decisión" },
  { label: "Auditoría", question: "¿Con qué sustento se evaluó?", answer: "El expediente conecta riesgo, controles, evaluaciones, evidencia y hallazgos para facilitar seguimiento y explicar lo ocurrido.", path: "Auditoría → riesgo → control → evidencia" }
];

const solutions = [
  { number: "01", label: "PLANEACIÓN", title: "Convertir iniciativas en decisiones claras.", detail: "Registra objetivo, alcance y periodo; revisa propuestas y conserva el resultado antes de avanzar a ejecución.", outcome: "Qué se propuso, quién decidió y qué sigue." },
  { number: "02", label: "RIESGO Y CONTROL", title: "Entender exposición y respuesta.", detail: "Relaciona riesgos con controles, evaluaciones y posibles hallazgos dentro del trabajo de auditoría.", outcome: "Qué riesgo se observó y cómo se está tratando." },
  { number: "03", label: "EVIDENCIA", title: "Mantener el sustento cerca del expediente.", detail: "Vincula referencias y archivos de evidencia con los registros que ayudan a interpretar una evaluación.", outcome: "De dónde viene una afirmación o un hallazgo." },
  { number: "04", label: "SEGUIMIENTO", title: "Pasar del resumen a la acción.", detail: "Consulta pendientes, historial y búsqueda para encontrar registros sin perder el contexto del portafolio.", outcome: "Qué requiere atención y dónde está el registro." }
];

function PublicSolutions() {
  useDocumentTitle("Soluciones para auditoría y riesgo");
  const [selected, setSelected] = useState(0);
  const current = perspectives[selected];

  return <PublicSiteShell mainId="solutions-main">
    <section className="public-page-hero" aria-labelledby="solutions-title">
      <p className="public-eyebrow">SOLUCIONES / DEL PORTAFOLIO AL EXPEDIENTE</p>
      <h1 id="solutions-title">Una respuesta distinta para cada decisión. Un mismo contexto para todas.</h1>
      <p>VERA conecta el panorama ejecutivo con el trabajo operativo. Cada vista responde una pregunta de negocio y conduce al registro que la sustenta.</p>
      <div className="public-page-hero__rule"><span>01</span><span>VISIÓN</span><span>02</span><span>DECISIÓN</span><span>03</span><span>SUSTENTO</span></div>
    </section>

    <section className="public-section public-perspectives" aria-labelledby="perspectives-title">
      <div className="public-section__topline"><p className="public-eyebrow">EXPLORAR POR PERSPECTIVA</p><span>Selecciona una pregunta</span></div>
      <h2 id="perspectives-title" className="public-section__statement">La misma información. La lectura adecuada.</h2>
      <div className="public-perspectives__layout">
        <div className="public-perspectives__selectors" role="group" aria-label="Perspectiva de consulta">
          {perspectives.map((perspective, index) => <button key={perspective.label} type="button" aria-pressed={selected === index} onClick={() => setSelected(index)}><span>0{index + 1}</span>{perspective.label}<span aria-hidden="true">↗</span></button>)}
        </div>
        <div className="public-perspectives__detail" role="region" aria-live="polite" aria-label={`Perspectiva de ${current.label}`}>
          <p className="public-eyebrow">{current.label.toUpperCase()}</p>
          <h3>{current.question}</h3>
          <p>{current.answer}</p>
          <div><span>RECORRIDO</span><strong>{current.path}</strong></div>
        </div>
      </div>
    </section>

    <section className="public-section public-solutions" aria-labelledby="solutions-catalog-title">
      <div className="public-section__topline"><p className="public-eyebrow">CAPACIDADES CONECTADAS</p><span>Del inicio al seguimiento</span></div>
      <h2 id="solutions-catalog-title" className="public-section__statement">Cuatro momentos. Un expediente comprensible.</h2>
      <div className="public-solutions__list">
        {solutions.map((solution) => <article key={solution.number}>
          <span className="public-solutions__number">{solution.number}</span>
          <div><p className="public-eyebrow">{solution.label}</p><h3>{solution.title}</h3></div>
          <div><p>{solution.detail}</p><small>{solution.outcome}</small></div>
        </article>)}
      </div>
    </section>

    <section className="public-inline-cta" aria-labelledby="solutions-cta-title">
      <div><p className="public-eyebrow">SIGUIENTE LECTURA</p><h2 id="solutions-cta-title">¿Cómo se conserva la confianza en el recorrido?</h2></div>
      <Link className="public-button" to="/confianza">Ver confianza y trazabilidad <span aria-hidden="true">↗</span></Link>
    </section>
  </PublicSiteShell>;
}

export default PublicSolutions;
