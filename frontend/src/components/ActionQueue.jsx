import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarClock, ClipboardCheck, Plus, RefreshCw } from "lucide-react";
import { changeActionStatus, createAction, getActionAssignees, getActionSources, getActions, reassignAction } from "../services/actionService";
import "./ActionQueue.css";

const SOURCE = { AUDIT: "Auditoría", RISK: "Riesgo", CONTROL: "Control", FINDING: "Hallazgo" };
const STATUS = { OPEN: "Abierta", IN_PROGRESS: "En curso", DONE: "Terminada", CANCELLED: "Cancelada" };
const NEXT = { OPEN: ["IN_PROGRESS", "DONE", "CANCELLED"], IN_PROGRESS: ["OPEN", "DONE", "CANCELLED"], DONE: ["OPEN"], CANCELLED: ["OPEN"] };
const formatDate = (value) => value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }) : "Sin fecha";
const sourcePath = (action) => action.sourceType === "AUDIT"
  ? `/auditorias?auditId=${encodeURIComponent(action.sourceId)}`
  : action.sourceType === "RISK" ? `/riesgos#risk-${encodeURIComponent(action.sourceId)}`
    : action.sourceType === "CONTROL" ? `/controles#control-${encodeURIComponent(action.sourceId)}` : "/controles";
const initialForm = { sourceKey: "", title: "", rationale: "", dueDate: "", assigneeId: "" };

function ActionQueue({ revision = 0 }) {
  const [query] = useSearchParams();
  const [actions, setActions] = useState([]);
  const [sources, setSources] = useState([]);
  const [assigneeResult, setAssigneeResult] = useState({ key: "", items: [] });
  const [editAssignees, setEditAssignees] = useState([]);
  const [form, setForm] = useState(() => ({ ...initialForm, sourceKey: query.get("sourceType") && query.get("sourceId")
    ? `${query.get("sourceType")}:${query.get("sourceId")}` : "" }));
  const [createOpen, setCreateOpen] = useState(() => Boolean(query.get("sourceType") && query.get("sourceId")));
  const [view, setView] = useState("MINE");
  const [editing, setEditing] = useState(null);
  const [editMode, setEditMode] = useState("STATUS");
  const [nextStatus, setNextStatus] = useState("");
  const [nextAssignee, setNextAssignee] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const user = useMemo(() => { try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; } }, []);
  const manager = !user?.roleTour && ["SUPER_ADMIN", "GERENTE"].includes(user?.role);
  const canCreate = !user?.roleTour && ["SUPER_ADMIN", "GERENTE", "AUDITOR", "JEFATURA"].includes(user?.role);

  const reload = async () => {
    const [actionResult, sourceResult] = await Promise.all([getActions(), getActionSources()]);
    setActions(actionResult.actions);
    setSources(sourceResult.sources);
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([getActions(), getActionSources()])
      .then(([actionResult, sourceResult]) => {
        if (cancelled) return;
        setActions(actionResult.actions);
        setSources(sourceResult.sources);
        setError("");
      })
      .catch((cause) => { if (!cancelled) setError(cause.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [revision]);

  useEffect(() => {
    const source = sources.find((item) => `${item.sourceType}:${item.sourceId}` === form.sourceKey);
    if (!source) return;
    let cancelled = false;
    getActionAssignees(source.sourceType, source.sourceId)
      .then((result) => { if (!cancelled) setAssigneeResult({ key: form.sourceKey, items: result.assignees }); })
      .catch((cause) => { if (!cancelled) { setAssigneeResult({ key: form.sourceKey, items: [] }); setError(cause.message); } });
    return () => { cancelled = true; };
  }, [form.sourceKey, sources]);

  const assignees = assigneeResult.key === form.sourceKey ? assigneeResult.items : [];
  const active = actions.filter((item) => !["DONE", "CANCELLED"].includes(item.status));
  const mine = active.filter((item) => item.assigneeId === user?.id);
  const overdue = mine.filter((item) => item.dueDate < new Date().toISOString().slice(0, 10));
  const visible = view === "MINE" ? mine : view === "OPEN" ? active : actions.filter((item) => ["DONE", "CANCELLED"].includes(item.status));

  const submitCreate = async (event) => {
    event.preventDefault();
    const source = sources.find((item) => `${item.sourceType}:${item.sourceId}` === form.sourceKey);
    if (!source) { setError("Selecciona el registro relacionado."); return; }
    setSaving(true);
    try {
      await createAction({ sourceType: source.sourceType, sourceId: source.sourceId, title: form.title, rationale: form.rationale,
        dueDate: form.dueDate, assigneeId: Number(form.assigneeId) });
      await reload();
      setForm(initialForm);
      setCreateOpen(false);
      setError("");
      setView("OPEN");
    } catch (cause) { setError(cause.message); }
    finally { setSaving(false); }
  };

  const openEdit = async (action, mode) => {
    setEditing(action.id);
    setEditMode(mode);
    setNote("");
    setNextStatus(NEXT[action.status]?.[0] || "");
    setNextAssignee("");
    setEditAssignees([]);
    if (mode === "ASSIGNEE") {
      try {
        const result = await getActionAssignees(action.sourceType, action.sourceId);
        setEditAssignees(result.assignees.filter((person) => person.id !== action.assigneeId));
      } catch (cause) { setError(cause.message); setEditing(null); }
    }
  };

  const submitEdit = async (event, action) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (editMode === "STATUS") await changeActionStatus(action.id, { version: action.storageVersion, status: nextStatus, note });
      else await reassignAction(action.id, { version: action.storageVersion, assigneeId: Number(nextAssignee), note });
      await reload();
      setEditing(null);
      setError("");
    } catch (cause) { setError(cause.message); }
    finally { setSaving(false); }
  };

  return <section className="action-queue" aria-labelledby="action-queue-title">
    <div className="action-queue-heading"><div><span className="eyebrow">SEGUIMIENTO CON RESPONSABLE</span><h2 id="action-queue-title">Acciones registradas</h2><p>Compromisos con fecha y estado propios. Leer un aviso no termina una acción.</p></div>
      {canCreate && <button type="button" className="primary-action" onClick={() => setCreateOpen((open) => !open)} aria-expanded={createOpen}><Plus size={16} /> Nueva acción</button>}
    </div>
    <div className="action-queue-summary"><span><b>{mine.length}</b> Asignadas a mí</span><span><b>{overdue.length}</b> Vencidas</span><span><b>{active.length}</b> Abiertas visibles</span></div>
    {error && <p role="alert" className="notification-error">{error}</p>}
    {canCreate && createOpen && <form className="action-form" onSubmit={submitCreate}>
      <h3>Registrar compromiso</h3><p>Elige un registro existente y una persona que pueda verlo. La acción quedará en la bitácora.</p>
      <label>Registro relacionado<select required value={form.sourceKey} onChange={(event) => setForm({ ...form, sourceKey: event.target.value, assigneeId: "" })}><option value="">Seleccionar registro</option>{sources.map((item) => <option key={`${item.sourceType}:${item.sourceId}`} value={`${item.sourceType}:${item.sourceId}`}>{SOURCE[item.sourceType]} · {item.title} ({item.sourceId})</option>)}</select></label>
      <label>Título<input required minLength={3} maxLength={140} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
      <label>Responsable<select required value={form.assigneeId} onChange={(event) => setForm({ ...form, assigneeId: event.target.value })}><option value="">Seleccionar responsable</option>{assignees.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.role}</option>)}</select></label>
      <label>Fecha objetivo<input required type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></label>
      <label className="action-form-full">Motivo<textarea required minLength={10} maxLength={1000} rows={3} value={form.rationale} onChange={(event) => setForm({ ...form, rationale: event.target.value })} /></label>
      <div className="action-form-actions"><button type="button" className="secondary-action" onClick={() => setCreateOpen(false)}>Cancelar</button><button type="submit" className="primary-action" disabled={saving || !assignees.length}>{saving ? "Guardando…" : "Registrar acción"}</button></div>
    </form>}
    <div className="action-queue-tabs" role="group" aria-label="Filtrar acciones"><button type="button" aria-pressed={view === "MINE"} onClick={() => setView("MINE")}>Mis acciones</button><button type="button" aria-pressed={view === "OPEN"} onClick={() => setView("OPEN")}>Abiertas visibles</button><button type="button" aria-pressed={view === "CLOSED"} onClick={() => setView("CLOSED")}>Finalizadas</button></div>
    {loading ? <p className="action-queue-empty" role="status">Consultando acciones…</p> : visible.length === 0 ? <p className="action-queue-empty">No hay acciones en esta vista.</p> : <div className="action-queue-list">{visible.map((action) => <article className="action-card" key={action.id}>
      <div className="action-card-top"><span><ClipboardCheck size={17} aria-hidden="true" /> {SOURCE[action.sourceType]} · {action.sourceTitle}</span><strong className={`action-status action-status-${action.status.toLowerCase()}`}>{STATUS[action.status]}</strong></div>
      <h3>{action.title}</h3><p>{action.rationale}</p>
      <div className="action-card-meta"><span>Responsable: <b>{action.assigneeName}</b></span><span><CalendarClock size={14} aria-hidden="true" /> Fecha objetivo: <b>{formatDate(action.dueDate)}</b></span><span>{action.history.length} evento{action.history.length === 1 ? "" : "s"}</span></div>
      <div className="action-card-actions"><Link to={sourcePath(action)}>Abrir registro</Link>{(manager || (canCreate && action.assigneeId === user?.id)) && <button type="button" onClick={() => openEdit(action, "STATUS")}>Cambiar estado</button>}{manager && <button type="button" onClick={() => openEdit(action, "ASSIGNEE")}>Reasignar</button>}</div>
      {editing === action.id && <form className="action-edit" onSubmit={(event) => submitEdit(event, action)}><h4>{editMode === "STATUS" ? "Actualizar estado" : "Cambiar responsable"}</h4>
        {editMode === "STATUS" ? <label>Nuevo estado<select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)}>{NEXT[action.status]?.map((status) => <option key={status} value={status}>{STATUS[status]}</option>)}</select></label>
          : <label>Nuevo responsable<select required value={nextAssignee} onChange={(event) => setNextAssignee(event.target.value)}><option value="">Seleccionar responsable</option>{editAssignees.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.role}</option>)}</select></label>}
        <label>Explicación<textarea required minLength={10} maxLength={1000} rows={2} value={note} onChange={(event) => setNote(event.target.value)} /></label>
        <div><button type="button" className="secondary-action" onClick={() => setEditing(null)}>Cancelar</button><button type="submit" className="primary-action" disabled={saving || (editMode === "ASSIGNEE" && !nextAssignee)}>{saving ? "Guardando…" : "Guardar cambio"}</button></div>
      </form>}
    </article>)}</div>}
    <p className="action-queue-footnote"><RefreshCw size={13} aria-hidden="true" /> Los estados cambian solo al guardar una decisión humana; el historial conserva quién hizo cada cambio.</p>
  </section>;
}

export default ActionQueue;
