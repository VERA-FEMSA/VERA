import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowRight, BellRing, CalendarClock, CheckCircle2, ClipboardList, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import ActionQueue from "../components/ActionQueue";
import { getNotifications, setNotificationRead } from "../services/notificationService";
import "./Notificaciones.css";

const TYPES = {
  PROPOSAL_REVIEW: "Decisión requerida",
  PROPOSAL_TRACK: "Seguimiento de propuesta",
  AUDIT_START: "Lista para iniciar",
  AUDIT_FOLLOW_UP: "Seguimiento de ejecución"
};
const PRIORITY = { HIGH: "Prioridad alta", MEDIUM: "Prioridad media", LOW: "Seguimiento" };
const dateLabel = (value) => value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }) : null;

const currentUser = JSON.parse(
  localStorage.getItem("user") || "null"
);

const canModifyNotifications =
  currentUser?.role !== "DIRECTOR";

function Notificaciones() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionRevision, setActionRevision] = useState(0);

  const toggleRead = async (item) => {
    try {
      const result = await setNotificationRead(item.id, !item.readAt);
      setNotifications((current) => current.map((entry) => entry.id === item.id ? { ...entry, readAt: result.readAt } : entry));
      setError("");
    } catch (cause) { setError(cause.message); }
  };

  const load = async () => {
    setLoading(true);
    try { const data = await getNotifications(); setNotifications(data.notifications); setError(""); setActionRevision((current) => current + 1); }
    catch (loadError) { setError(loadError.message); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    let cancelled = false;
    getNotifications()
      .then((data) => { if (!cancelled) { setNotifications(data.notifications); setError(""); } })
      .catch((loadError) => { if (!cancelled) setError(loadError.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const visible = useMemo(() => notifications.filter((item) => filter === "ALL" || (filter === "UNREAD" ? !item.readAt : filter === "DECISIONS" ? ["PROPOSAL_REVIEW", "PROPOSAL_TRACK"].includes(item.type) : ["AUDIT_START", "AUDIT_FOLLOW_UP"].includes(item.type))), [notifications, filter]);
  const unreadCount = notifications.filter((item) => !item.readAt).length;
  const highCount = notifications.filter((item) => item.priority === "HIGH").length;
  const decisionCount = notifications.filter((item) => ["PROPOSAL_REVIEW", "PROPOSAL_TRACK"].includes(item.type)).length;

  return <div className="dashboard-layout"><Sidebar active="notificaciones" /><main className="dashboard-main"><section className="dashboard-content notifications-page">
    <header className="dashboard-header"><div><span className="eyebrow">CENTRO DE ACCIÓN</span><h1>Pendientes</h1><p>Decisiones y seguimientos que requieren atención según tu rol.</p></div><button className="secondary-action" onClick={load} disabled={loading}><RefreshCw size={16} />Actualizar</button></header>
    <div className="notification-kpis"><article className="notification-kpi-high"><AlertCircle size={19} /><div><strong>{highCount}</strong><span>Prioridad alta</span></div></article><article><ClipboardList size={19} /><div><strong>{decisionCount}</strong><span>Propuestas por revisar</span></div></article><article><BellRing size={19} /><div><strong>{unreadCount}</strong><span>Sin leer de {notifications.length}</span></div></article></div>
    <ActionQueue revision={actionRevision} />
    {error && <p className="notification-error">{error}</p>}
    <div className="notification-toolbar"><div><span className="eyebrow">TU COLA DE TRABAJO</span><h2>{filter === "ALL" ? "Todas las actividades" : filter === "UNREAD" ? "Sin leer" : filter === "DECISIONS" ? "Decisiones y propuestas" : "Ejecución de auditorías"}</h2></div><div className="notification-filters"><button className={filter === "ALL" ? "selected" : ""} onClick={() => setFilter("ALL")}>Todas</button><button className={filter === "UNREAD" ? "selected" : ""} onClick={() => setFilter("UNREAD")}>Sin leer</button><button className={filter === "DECISIONS" ? "selected" : ""} onClick={() => setFilter("DECISIONS")}>Decisiones</button><button className={filter === "EXECUTION" ? "selected" : ""} onClick={() => setFilter("EXECUTION")}>Ejecución</button></div></div>
    {loading ? <div className="notification-empty">Actualizando pendientes...</div> : visible.length === 0 ? <div className="notification-empty"><CheckCircle2 size={23} /><div><b>Tu bandeja está al día</b><p>No hay actividades para este filtro. La lista se genera desde el estado actual de auditorías y propuestas.</p></div></div> : <div className="notification-list">{visible.map((item) => <article className={`notification-card priority-${item.priority.toLowerCase()} ${item.readAt ? "notification-read" : ""}`} key={item.id}><div className="notification-icon">{item.type === "AUDIT_FOLLOW_UP" ? <CalendarClock size={20} /> : item.type === "PROPOSAL_REVIEW" ? <AlertCircle size={20} /> : <ClipboardList size={20} />}</div><div className="notification-body"><div className="notification-card-meta"><span>{TYPES[item.type]}</span><strong>{PRIORITY[item.priority]}</strong><span>{item.readAt ? "Leída" : "Sin leer"}</span></div><h3>{item.title}</h3><p>{item.description}</p><div className="notification-date">{item.dueAt ? <span><CalendarClock size={14} /> Fecha objetivo: {dateLabel(item.dueAt)}</span> : <span>Generada desde el estado de la propuesta</span>}<span>{item.entityId}</span></div></div><div className="notification-card-actions">{canModifyNotifications && (<button className="notification-action" type="button" aria-pressed={Boolean(item.readAt)} onClick={() => toggleRead(item)}>{item.readAt ? "Marcar sin leer" : "Marcar leída"}</button>)}<button className="notification-action" type="button" onClick={() => navigate(item.path)}>Abrir tarea <ArrowRight size={16} /></button></div></article>)}</div>}
    <p className="notification-footnote">Las tareas se calculan desde el estado actual de las propuestas. Marcar una como leída no la completa; la lectura persiste cuando se activa el almacén de notificaciones en Supabase. No se envían correos ni push.</p>
  </section></main></div>;
}

export default Notificaciones;
