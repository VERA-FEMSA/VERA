import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
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
  const [isTrailerVisible, setIsTrailerVisible] = useState(false);
  const { hash } = useLocation();
  useDocumentTitle("Plataforma de auditoría y riesgo");

  useEffect(() => {
    if (hash !== "#trailer-vera") return undefined;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById("trailer-vera")?.scrollIntoView({ block: window.innerWidth > 760 ? "center" : "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [hash]);

  return <PublicSiteShell mainId="public-overview-main">
    <section className="public-hero" aria-labelledby="public-overview-title">
      <div className="public-hero__copy">
        <p className="public-eyebrow public-eyebrow--on-dark">VERA / GOBIERNO · RIESGO · AUDITORÍA</p>
        <h1 id="public-overview-title">Decisiones mejor informadas. Auditorías conectadas.</h1>
        <p className="public-hero__definition">Una plataforma de auditoría y gestión de riesgos que conecta decisiones, controles y evidencias.</p>
        <p className="public-hero__lead">Del planteamiento de una iniciativa a su seguimiento, cada rol puede entender qué ocurrió y consultar el contexto que le corresponde.</p>
        <div className="public-hero__actions">
          <Link className="public-button public-button--light" to="/soluciones">Explorar la plataforma <span aria-hidden="true">↗</span></Link>
          <Link className="public-text-link public-text-link--light" to="/">Acceder al entorno <span aria-hidden="true">↗</span></Link>
        </div>
        <p className="public-hero__access">Para entrar necesitas una cuenta. <Link to="/registro">Puedes crearla aquí.</Link></p>
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

    <section className="public-section public-showcase" aria-labelledby="public-showcase-title">
      <div className="public-section__topline"><p className="public-eyebrow">UNA VISTA DEL PRODUCTO</p><span>Panel de portafolio · interfaz actual</span></div>
      <div className="public-showcase__intro">
        <h2 id="public-showcase-title" className="public-section__statement">El contexto también se ve.</h2>
        <p>Indicadores, acciones y riesgo aparecen en una misma vista. Esta captura se generó con la interfaz de VERA y datos sintéticos de demostración.</p>
      </div>
      <figure className="public-showcase__figure">
        <div className="public-showcase__frame">
          <div className="public-showcase__frame-label"><span>PANEL DE PORTAFOLIO</span><span>VERA / DEMO</span></div>
          <picture>
            <source media="(max-width: 760px)" srcSet="/portfolio-demo-mobile.png" width="390" height="844" />
            <img src="/portfolio-demo.png" width="1440" height="960" loading="lazy" decoding="async" alt="Panel de portafolio de VERA con navegación e indicadores de auditoría; las cifras son sintéticas." />
          </picture>
        </div>
        <figcaption>Vista en modo claro con cifras de prueba; no representa actividad real. <a className="public-showcase__full--desktop" href="/portfolio-demo.png" target="_blank" rel="noopener noreferrer">Ampliar captura de escritorio (nueva pestaña)</a><a className="public-showcase__full--mobile" href="/portfolio-demo-mobile.png" target="_blank" rel="noopener noreferrer">Ampliar captura móvil (nueva pestaña)</a></figcaption>
      </figure>
      <nav className="public-showcase__evidence" aria-label="Evidencia pública de VERA">
        <span>VERA, EN ABIERTO</span>
        <a href="https://github.com/VERA-GRC-IRM/VERA">Código y cambios <span aria-hidden="true">↗</span></a>
        <a href="https://github.com/VERA-GRC-IRM/VERA/wiki">Documentación <span aria-hidden="true">↗</span></a>
        <a href="https://vera-grc-irm.github.io/VERA/">Resultados de calidad <span aria-hidden="true">↗</span></a>
      </nav>
    </section>

    <section className="public-section public-film" id="trailer-vera" aria-labelledby="public-film-title">
      <div className="public-film__copy">
        <p className="public-eyebrow">VERA EN VIDEO</p>
        <h2 id="public-film-title">El recorrido, en movimiento.</h2>
        <p>Una introducción visual a VERA. Reproduce el tráiler aquí o ábrelo directamente en YouTube.</p>
        <div className="public-film__actions">
          <button className="public-button" type="button" aria-controls="public-film-player" aria-expanded={isTrailerVisible} onClick={() => setIsTrailerVisible((visible) => !visible)}>
            {isTrailerVisible ? "Cerrar video" : "Reproducir tráiler"}
          </button>
          <a className="public-text-link" href="https://www.youtube.com/shorts/X2RuivSwSVo" target="_blank" rel="noopener noreferrer" aria-label="Abrir tráiler en YouTube (nueva pestaña)">Abrir en YouTube <span aria-hidden="true">↗</span></a>
        </div>
        <p className="public-film__note">El reproductor de YouTube se carga solo al pulsar reproducir.</p>
      </div>
      <div className="public-film__stage" id="public-film-player" role="group" aria-label="Tráiler de VERA">
        <div className="public-film__frame">
          {isTrailerVisible
            ? <iframe title="Tráiler de VERA en YouTube" src="https://www.youtube-nocookie.com/embed/X2RuivSwSVo?autoplay=1&playsinline=1&rel=0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
            : <div className="public-film__poster" aria-hidden="true">
              <span className="public-film__poster-top">VERA / PERSPECTIVA</span>
              <img src="/vera-logo.svg" width="84" height="84" alt="" />
              <span className="public-film__poster-bottom">AUDITORÍA · RIESGO · EVIDENCIA</span>
            </div>}
        </div>
        <span className="public-film__caption">TRÁILER · FORMATO VERTICAL</span>
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
