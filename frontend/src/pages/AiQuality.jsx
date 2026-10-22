import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import { getAssistantQuality } from "../services/assistantService";
import "./Dashboard.css";
import "./AiQuality.css";

const MODE_LABELS = {
  computed: "Dato calculado",
  generated: "Respuesta generada",
  "document-search": "Búsqueda documental",
  "no-match": "Sin coincidencias",
  uncited: "Sin cita suficiente"
};

const formatCount = (value) => new Intl.NumberFormat("es-MX").format(Number(value) || 0);
const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Hora no disponible" :
    date.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
};

function AiQuality() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try { setSummary(await getAssistantQuality()); }
    catch (failure) { setError(failure.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    let active = true;
    getAssistantQuality()
      .then((result) => { if (active) setSummary(result); })
      .catch((failure) => { if (active) setError(failure.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const rows = Object.entries(summary?.byMode || {}).sort(([a], [b]) => a.localeCompare(b, "es"));
  return <div className="dashboard-layout">
    <Sidebar active="calidad-ia" />
    <main className="dashboard-main">
      <div className="topbar"><div /></div>
      <section className="dashboard-content ai-quality-page">
        <header className="dashboard-header ai-quality-header">
          <div>
            <span className="eyebrow">OPERACIÓN DE IA</span>
            <h1>Calidad observada del asistente</h1>
            <p>Valoraciones voluntarias de respuestas, sin guardar el texto de las conversaciones.</p>
          </div>
          <button type="button" className="ai-quality-refresh" onClick={load} disabled={loading}>Actualizar datos</button>
        </header>

        {loading && <p role="status">Cargando valoraciones…</p>}
        {error && <div className="ai-quality-notice" role="alert">{error} <button type="button" onClick={load}>Reintentar</button></div>}
        {!loading && !error && summary && <>
          <p className="ai-quality-period">Últimos {summary.windowDays} días · Consultado: {formatDate(summary.asOf)}</p>
          <div className="ai-quality-metrics" aria-label="Indicadores de valoraciones">
            <article><span>Respuestas valoradas</span><strong>{formatCount(summary.total)}</strong></article>
            <article><span>Me sirvió</span><strong>{formatCount(summary.helpful)}</strong></article>
            <article><span>No me sirvió</span><strong>{formatCount(summary.unhelpful)}</strong></article>
            <article><span>Opinión positiva</span><strong>{summary.helpfulPercent === null ? "—" : `${summary.helpfulPercent} %`}</strong></article>
          </div>

          <section className="ai-quality-section" aria-labelledby="ai-quality-modes">
            <div className="ai-quality-section-header">
              <div><span className="eyebrow">DESGLOSE</span><h2 id="ai-quality-modes">Por tipo de respuesta</h2></div>
              <span>Respuestas que recibieron una valoración</span>
            </div>
            {rows.length === 0 ? <p className="ai-quality-empty">Aún no hay valoraciones en este periodo.</p> :
              <div className="ai-quality-table-wrap"><table>
                <thead><tr><th scope="col">Tipo</th><th scope="col">Me sirvió</th><th scope="col">No me sirvió</th></tr></thead>
                <tbody>{rows.map(([mode, counts]) => <tr key={mode}>
                  <th scope="row">{MODE_LABELS[mode] || mode}</th>
                  <td>{formatCount(counts.helpful)}</td><td>{formatCount(counts.unhelpful)}</td>
                </tr>)}</tbody>
              </table></div>}
          </section>
          {summary.partial && <p className="ai-quality-notice" role="status">El registro alcanzó el límite de consulta. Estos indicadores muestran una muestra parcial.</p>}
          <p className="ai-quality-caveat">El porcentaje refleja solo a quienes eligieron valorar. No mide precisión factual, permisos, seguridad ni la opinión de todas las personas usuarias.</p>
        </>}
      </section>
    </main>
  </div>;
}

export default AiQuality;
