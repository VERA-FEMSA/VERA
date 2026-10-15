import { useState } from "react";
import { Activity, MessageSquareText, Send, X } from "lucide-react";
import { ROLE_LABELS } from "../constants/roles";
import { addPlanningComment, getPlanningHistory } from "../services/planningHistoryService";
import "./PlanningHistory.css";

const ACTION_LABELS = {
  AUDIT_PROPOSAL_CREATED: "Propuesta creada",
  AUDIT_PROPOSAL_UPDATED: "Propuesta actualizada",
  AUDIT_PROPOSAL_APPROVED: "Propuesta aprobada",
  AUDIT_PROPOSAL_REJECTED: "Propuesta rechazada",
  AUDIT_PROPOSAL_DELETED: "Propuesta eliminada",
  AUDIT_STARTED: "Auditoría iniciada",
  AUDIT_CLOSED: "Auditoría cerrada",
  AUDIT_UPDATED: "Auditoría editada",
  AUDIT_COMMENT_ADDED: "Comentario agregado"
};

const CHANGE_LABELS = {
  objective: "objetivo",
  responsibleId: "responsable",
  quarter: "trimestre",
  startDate: "fecha de inicio",
  endDate: "fecha de fin",
  likelihood: "probabilidad",
  impact: "impacto"
};

const formatDate = (date) => new Date(date).toLocaleString("es-MX", {
  day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
});

const eventDescription = (entry) => {
  if (entry.action === "AUDIT_PROPOSAL_APPROVED") return `Trimestre asignado: ${entry.details.quarter}.`;
  if (entry.action === "AUDIT_PROPOSAL_REJECTED") return `Motivo: ${entry.details.reason}`;
  if (entry.action === "AUDIT_UPDATED") {
  return `Datos modificados: ${Object.keys(entry.details.changes || {}).map((field) => CHANGE_LABELS[field] || field).join(", ")}.`;
  }
  if (entry.action === "AUDIT_COMMENT_ADDED") return "Se agregó un comentario al expediente.";
  return "Cambio registrado en la bitácora.";
};

function PlanningHistoryButton({ proposal, compact = false }) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await getPlanningHistory(proposal.id);
      setHistory(data.history);
      setComments(data.comments);
      setError("");
    } catch (loadError) { setError(loadError.message); }
    finally { setLoading(false); }
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await addPlanningComment(proposal.id, text);
      setText("");
      await load();
    } catch (submitError) { setError(submitError.message); }
    finally { setSaving(false); }
  };

  return <>
    <button type="button" className={compact ? "table-action" : "history-open-button"} onClick={() => { setOpen(true); load(); }}>
      <MessageSquareText size={compact ? 15 : 16} aria-hidden="true" />{compact ? "Bitácora" : "Historial y comentarios"}
    </button>
    {open && <div className="history-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="history-dialog" role="dialog" aria-modal="true" aria-labelledby={`history-title-${proposal.id}`}>
        <header className="history-header"><div><span className="eyebrow">{proposal.id} · {proposal.status}</span><h2 id={`history-title-${proposal.id}`}>{proposal.title}</h2><p>Actividad registrada y conversación del expediente.</p></div><button type="button" className="modal-close" onClick={() => setOpen(false)} aria-label="Cerrar"><X size={20} /></button></header>
        {error && <p className="history-error">{error}</p>}
        {loading ? <p className="history-empty">Cargando historial...</p> : <>
          <section className="history-section"><h3><Activity size={17} /> Historial de cambios</h3>
            {history.length === 0 ? <p className="history-empty">Todavía no hay eventos registrados para esta auditoría.</p> : <ol className="history-timeline">{history.map((entry) => <li key={entry.id}><span className="history-dot" /><div><strong>{ACTION_LABELS[entry.action] || entry.action}</strong><p>{eventDescription(entry)}</p><small>{entry.actor.username || "Sistema"} · {ROLE_LABELS[entry.actor.role] || entry.actor.role || "Sistema"} · {formatDate(entry.date)}</small></div></li>)}</ol>}
          </section>
          <section className="history-section"><h3><MessageSquareText size={17} /> Comentarios <span>{comments.length}</span></h3>
            {comments.length === 0 ? <p className="history-empty">Aún no hay comentarios.</p> : <ul className="history-comments">{comments.map((comment) => <li key={comment.id}><div><strong>{comment.author.username}</strong><small>{ROLE_LABELS[comment.author.role] || comment.author.role} · {formatDate(comment.createdAt)}</small></div><p>{comment.text}</p></li>)}</ul>}
            <form className="history-comment-form" onSubmit={submit}><label htmlFor={`comment-${proposal.id}`}>Agregar comentario</label><textarea id={`comment-${proposal.id}`} required minLength={3} maxLength={2000} value={text} onChange={(event) => setText(event.target.value)} placeholder="Comparte contexto o una actualización del expediente." /><div><small>{text.length}/2,000 caracteres</small><button type="submit" className="primary-action" disabled={saving || text.trim().length < 3}><Send size={15} />{saving ? "Enviando..." : "Publicar"}</button></div></form>
          </section>
        </>}
      </section>
    </div>}
  </>;
}

export default PlanningHistoryButton;
