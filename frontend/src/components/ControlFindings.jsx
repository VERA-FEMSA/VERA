import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { createFinding, getFindings } from "../services/findingService";
import { RISK_CONTROL_MANAGE_ROLES } from "../constants/planning";
import "./ControlFindings.css";

function ControlFindings({ controls, risks, role }) {
  const location = useLocation();
  const [findings, setFindings] = useState([]);
  const [control, setControl] = useState(null);
  const [riskId, setRiskId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getFindings().then((items) => { if (!cancelled) setFindings(items); })
      .catch((cause) => { if (!cancelled) setError(cause.message); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    try {
      const target = decodeURIComponent(location.hash.slice(1));
      if (target.startsWith("finding-")) document.getElementById(target)?.scrollIntoView({ block: "center" });
    } catch { /* Un fragmento inválido no altera los hallazgos. */ }
  }, [location.hash, findings]);

  const canCreate = RISK_CONTROL_MANAGE_ROLES.includes(role) || role === "AUDITOR";
  const open = (item) => {
    setControl(item);
    setRiskId(risks.find((risk) => item.riskIds.includes(risk.id))?.id || "");
    setTitle(""); setDescription(""); setError("");
  };
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true); setError("");
    try {
      const finding = await createFinding({ controlId: control.id, riskId, title, description });
      setFindings((current) => [finding, ...current]);
      setControl(null);
    } catch (cause) { setError(cause.message); }
    finally { setSaving(false); }
  };

  return <section className="control-findings" aria-labelledby="control-findings-title">
    <div className="control-section-heading"><div><span className="eyebrow">SEGUIMIENTO</span><h2 id="control-findings-title">Hallazgos de controles</h2></div><span>{findings.length} registrados</span></div>
    <p>Una evaluación de 1 a 3 indica efectividad insuficiente y permite documentar un hallazgo ligado al control y a uno de sus riesgos.</p>
    {error && !control && <p className="control-feedback error" role="alert">{error}</p>}
    {canCreate && controls.filter((item) => item.effectiveness < 4 && item.riskIds.some((id) => risks.some((risk) => risk.id === id))).map((item) =>
      <button key={item.id} type="button" className="secondary-action finding-create" onClick={() => open(item)}>
        Registrar hallazgo · {item.id} {item.title}
      </button>)}
    {findings.length === 0 ? <p className="control-empty">No hay hallazgos registrados para los controles visibles.</p> :
      <div className="finding-list">{findings.map((item) => <article key={item.id} id={`finding-${item.id}`} className="finding-card">
        <strong>{item.id} · {item.title}</strong><span>{item.status === "OPEN" ? "Abierto" : item.status}</span>
        <p>{item.description}</p><small>Control {item.controlId}: {item.controlTitle} · Riesgo {item.riskId}: {item.riskTitle}</small>
        <small>Evaluación v{item.evaluationVersion} · {new Date(item.createdAt).toLocaleString("es-MX")}</small>
      </article>)}</div>}
    {control && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setControl(null); }}>
      <form className="proposal-modal control-modal finding-modal" onSubmit={submit} aria-label="Registrar hallazgo">
        <h2>Hallazgo de {control.id}</h2><p>Evalúa la observación y selecciona el riesgo relacionado.</p>
        {error && <p className="control-feedback error" role="alert">{error}</p>}
        <label>Riesgo<select required value={riskId} onChange={(event) => setRiskId(event.target.value)}>
          <option value="">Seleccionar riesgo</option>{risks.filter((risk) => control.riskIds.includes(risk.id)).map((risk) =>
            <option key={risk.id} value={risk.id}>{risk.id} · {risk.title}</option>)}
        </select></label>
        <label>Título<input required minLength={3} maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label>Descripción<textarea required minLength={10} maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        <div className="modal-actions"><button type="button" className="secondary-action" onClick={() => setControl(null)}>Cancelar</button>
          <button type="submit" className="primary-action" disabled={saving}>{saving ? "Guardando..." : "Registrar hallazgo"}</button></div>
      </form>
    </div>}
  </section>;
}

export default ControlFindings;
