import { useEffect, useMemo, useState } from "react";
import { ExternalLink, FileCheck2, FileImage, FileText, Plus, Search, X } from "lucide-react";
import Sidebar from "../components/Sidebar";
import { createEvidence, getEvidence } from "../services/evidenceService";
import { getRisks } from "../services/riskService";
import { getControls } from "../services/controlService";
import { getPlanningAudits } from "../services/planningService";
import "./Evidencias.css";

const EMPTY = { title: "", description: "", evidenceType: "DOCUMENT", reference: "", entityType: "RISK", entityId: "" };
const ENTITY_LABELS = { RISK: "Riesgo", CONTROL: "Control", AUDIT: "Auditoría" };
const TYPE_LABELS = { DOCUMENT: "Documento", SCREENSHOT: "Captura", REPORT: "Informe", OTHER: "Otro" };
const safeLink = (value) => /^https:\/\//i.test(value);
const formatDate = (value) => new Date(value).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
const labelForEntity = (entity) => `${entity.id} · ${entity.title}`;

function Evidencias() {
  const [items, setItems] = useState([]);
  const [risks, setRisks] = useState([]);
  const [controls, setControls] = useState([]);
  const [audits, setAudits] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [form, setForm] = useState(EMPTY);
  const [modal, setModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    const [allEvidence, allRisks, allControls, allAudits] = await Promise.all([getEvidence(), getRisks(), getControls(), getPlanningAudits()]);
    setItems(allEvidence); setRisks(allRisks); setControls(allControls); setAudits(allAudits);
  };
  useEffect(() => {
    let cancelled = false;
    Promise.all([getEvidence(), getRisks(), getControls(), getPlanningAudits()])
      .then(([allEvidence, allRisks, allControls, allAudits]) => { if (!cancelled) { setItems(allEvidence); setRisks(allRisks); setControls(allControls); setAudits(allAudits); } })
      .catch((loadError) => { if (!cancelled) setError(loadError.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const entities = useMemo(() => ({ RISK: risks, CONTROL: controls, AUDIT: audits }[form.entityType] || []), [form.entityType, risks, controls, audits]);
  const visible = items.filter((item) => (filter === "ALL" || item.entityType === filter) && (!search || `${item.title} ${item.description} ${item.reference} ${item.entityTitle}`.toLowerCase().includes(search.toLowerCase())));
  const counts = ["RISK", "CONTROL", "AUDIT"].map((entityType) => ({ entityType, count: items.filter((item) => item.entityType === entityType).length }));

  const openCreate = () => { setForm({ ...EMPTY, entityId: risks[0]?.id || "" }); setError(""); setModal(true); };
  const closeModal = () => { setModal(false); setError(""); };
  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      await createEvidence(form); await load(); closeModal(); setMessage("Referencia de evidencia registrada y vinculada.");
    } catch (submitError) { setError(submitError.message); }
    finally { setSaving(false); }
  };

  return <div className="dashboard-layout"><Sidebar active="evidencias" /><main className="dashboard-main"><section className="dashboard-content evidence-page">
    <header className="dashboard-header"><div><span className="eyebrow">EXPEDIENTE DIGITAL</span><h1>Evidencias</h1><p>Organiza referencias de respaldo y relaciónalas con riesgos, controles o auditorías.</p></div><button className="primary-action" onClick={openCreate}><Plus size={18} /> Registrar evidencia</button></header>
    {message && <p className="evidence-feedback success">{message}</p>}{error && !modal && <p className="evidence-feedback error">{error}</p>}
    <div className="evidence-summary"><article><strong>{items.length}</strong><span>referencias registradas</span></article>{counts.map(({ entityType, count }) => <article key={entityType}><strong>{count}</strong><span>vinculadas a {ENTITY_LABELS[entityType].toLowerCase()}s</span></article>)}</div>
    <div className="evidence-notice"><FileCheck2 size={19} /><p><b>Base ligera para el expediente.</b> Esta versión registra enlaces o identificadores externos; no carga ni almacena archivos binarios. El backend de almacenamiento se puede incorporar después sin cambiar los vínculos.</p></div>
    <div className="evidence-toolbar"><label className="evidence-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar evidencia, entidad o referencia" /></label><div className="evidence-filter">{["ALL", "RISK", "CONTROL", "AUDIT"].map((value) => <button key={value} className={filter === value ? "selected" : ""} onClick={() => setFilter(value)}>{value === "ALL" ? "Todas" : ENTITY_LABELS[value]}</button>)}</div></div>
    {loading ? <div className="evidence-empty">Cargando expediente...</div> : visible.length === 0 ? <div className="evidence-empty"><FileCheck2 size={22} /><div><b>No hay referencias para mostrar</b><p>Registra una liga externa o referencia documental y asígnala a una entidad.</p></div></div> : <div className="evidence-list">{visible.map((item) => <article className="evidence-card" key={item.id}><div className="evidence-icon">{item.evidenceType === "SCREENSHOT" ? <FileImage size={21} /> : <FileText size={21} />}</div><div className="evidence-card-main"><div className="evidence-card-tags"><span className="evidence-type">{TYPE_LABELS[item.evidenceType]}</span><span className="evidence-entity-type">{ENTITY_LABELS[item.entityType]} · {item.entityId}</span></div><h2>{item.title}</h2><p>{item.description}</p><div className="evidence-meta"><span><b>Relacionada con:</b> {item.entityTitle}</span><span><b>Registró:</b> {item.author.name}</span><span>{formatDate(item.createdAt)}</span></div><div className="evidence-reference"><b>Referencia:</b> {safeLink(item.reference) ? <a href={item.reference} target="_blank" rel="noreferrer">Abrir referencia <ExternalLink size={13} /></a> : <span>{item.reference}</span>}</div></div></article>)}</div>}
    <p className="evidence-footnote">Las referencias se conservan en memoria en esta versión. Los archivos y vínculos se reinician al reiniciar el backend.</p>
  </section></main>
  {modal && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}><form className="proposal-modal evidence-modal" onSubmit={submit}><div className="modal-header"><div><span className="eyebrow">NUEVA REFERENCIA</span><h2>Registrar evidencia</h2><p>Agrega el dato de localización y relaciónalo con una pieza del portafolio.</p></div><button type="button" className="modal-close" onClick={closeModal} aria-label="Cerrar"><X size={20} /></button></div>{error && <p className="evidence-feedback error">{error}</p>}<div className="proposal-form-grid"><label className="full-width">Nombre<input required minLength="3" maxLength="120" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Informe de revisión trimestral" /></label><label className="full-width">Descripción<textarea required minLength="10" maxLength="1000" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Qué demuestra y por qué respalda el expediente" /></label><label>Tipo<select value={form.evidenceType} onChange={(event) => setForm({ ...form, evidenceType: event.target.value })}>{Object.entries(TYPE_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Vincular con<select value={form.entityType} onChange={(event) => { const nextType = event.target.value; const nextEntities = { RISK: risks, CONTROL: controls, AUDIT: audits }[nextType]; setForm({ ...form, entityType: nextType, entityId: nextEntities[0]?.id || "" }); }}>{Object.entries(ENTITY_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label className="full-width">Elemento relacionado<select required value={form.entityId} onChange={(event) => setForm({ ...form, entityId: event.target.value })}><option value="">Selecciona una entidad</option>{entities.map((entity) => <option value={entity.id} key={entity.id}>{labelForEntity(entity)}</option>)}</select></label><label className="full-width">Enlace HTTPS o identificador externo<input required minLength="3" maxLength="500" value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} placeholder="https://drive.google.com/... o archivo-expediente-042" /><small className="evidence-help">No selecciones un archivo: esta primera versión registra dónde encontrarlo.</small></label></div><div className="modal-actions"><button type="button" className="secondary-action" onClick={closeModal}>Cancelar</button><button type="submit" className="primary-action" disabled={saving || !form.entityId}>{saving ? "Guardando..." : "Guardar referencia"}</button></div></form></div>}
  </div>;
}

export default Evidencias;
