import { useEffect, useState } from "react";
import { Check, ClipboardList, Pencil, Plus, Trash2, X, XCircle } from "lucide-react";
import Sidebar from "../components/Sidebar";
import PlanningHistoryButton from "../components/PlanningHistoryButton";
import {
  approveAuditProposal,
  createAuditProposal,
  deleteAuditProposal,
  getAuditors,
  getPlanningAudits,
  rejectAuditProposal,
  updateAuditProposal
} from "../services/planningService";
import {
  AUDIT_TYPES,
  PLANNING_APPROVE_ROLES,
  PLANNING_CREATE_ROLES,
  QUARTERS,
  RISK_FACTORS
} from "../constants/planning";
import "./Planning.css";

const EMPTY_FORM = {
  title: "",
  area: "",
  responsibleId: "",
  type: "Interna",
  likelihood: 2,
  impact: 2,
  quarter: "",
  year: new Date().getFullYear(),
  startDate: "",
  endDate: "",
  objective: "",
  scope: "",
  justification: ""
};

const formatDate = (value) =>
  value ? new Date(`${value}T00:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }) : "";

function Planificacion() {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const canCreate = PLANNING_CREATE_ROLES.includes(user?.role);
  const canApprove = PLANNING_APPROVE_ROLES.includes(user?.role);

  const [items, setItems] = useState([]);
  const [auditors, setAuditors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quarters, setQuarters] = useState({});
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadItems = async () => {
    try {
      setItems(await getPlanningAudits());
      setError("");
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getPlanningAudits()
      .then(setItems)
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));
    if (canCreate) {
      getAuditors().then(setAuditors).catch((err) => setError(err.message));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openProposals = items.filter((item) => item.status === "OPEN");
  const approvedProposals = items.filter((item) => item.status === "APPROVED");
  const rejectedProposals = items.filter((item) => item.status === "REJECTED");

  const updateForm = (field, value) => setForm({ ...form, [field]: value });

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsModalOpen(true);
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setForm({
      title: item.title,
      area: item.area,
      responsibleId: item.responsibleId ?? "",
      type: item.type,
      likelihood: item.likelihood ?? 2,
      impact: item.impact ?? 2,
      quarter: item.quarter,
      year: item.year,
      startDate: item.startDate,
      endDate: item.endDate,
      objective: item.objective,
      scope: item.scope || "",
      justification: item.justification || ""
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const run = async (action, successMessage) => {
    try {
      await action();
      await loadItems();
      setMessage(successMessage);
      setError("");
      return true;
    } catch (actionError) {
      setError(actionError.message);
      setMessage("");
      return false;
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    const ok = await run(
      () => (editingId ? updateAuditProposal(editingId, form) : createAuditProposal(form)),
      editingId ? "La propuesta fue actualizada." : "La propuesta fue creada y quedó abierta para revisión."
    );
    setSaving(false);
    if (ok) closeModal();
  };

  const handleApprove = (item) =>
    run(
      () => approveAuditProposal(item.id, quarters[item.id] || item.quarter),
      "La propuesta alcanzó el 100% y ahora aparece en Trimestres."
    );

  const startReject = (item) => {
    setRejectingId(item.id);
    setRejectionReason("");
    setError("");
  };

  const handleReject = async (event, item) => {
    event.preventDefault();
    const ok = await run(
      () => rejectAuditProposal(item.id, rejectionReason.trim()),
      "La propuesta fue rechazada y el motivo quedó en la bitácora."
    );
    if (ok) {
      setRejectingId(null);
      setRejectionReason("");
    }
  };

  const handleDelete = (item) => {
    if (!window.confirm(`¿Eliminar la propuesta ${item.id}? Esta acción no se puede deshacer.`)) return;
    run(() => deleteAuditProposal(item.id), "La propuesta fue eliminada.");
  };

  return (
    <div className="dashboard-layout">
      <Sidebar active="planificacion" />
      <main className="dashboard-main">
        <section className="dashboard-content planning-page clean-header-page">
          <div className="dashboard-header">
            <div>
              <span className="eyebrow">GESTIÓN DEL PORTAFOLIO</span>
              <h1>Planificación</h1>
              <p>Propón auditorías y da seguimiento a su aprobación.</p>
            </div>
            {canCreate && (
              <button className="primary-action" type="button" onClick={openCreate}>
                <Plus size={18} aria-hidden="true" />
                Nueva propuesta
              </button>
            )}
          </div>

          {message && <p className="planning-message success">{message}</p>}
          {error && <p className="planning-message error">{error}</p>}

          <div className="planning-summary">
            <div><strong>{openProposals.length}</strong><span>Propuestas abiertas</span></div>
            <div><strong>{approvedProposals.length}</strong><span>Auditorías aprobadas</span></div>
            <div><strong>{rejectedProposals.length}</strong><span>Propuestas rechazadas</span></div>
          </div>

          <div className="planning-section-heading">
            <div>
              <span className="eyebrow">TABLERO DE PROPUESTAS</span>
              <h2>Propuestas abiertas</h2>
            </div>
            <span>{openProposals.length} pendientes</span>
          </div>

          {loading ? (
            <div className="planning-empty">Cargando propuestas...</div>
          ) : openProposals.length === 0 ? (
            <div className="planning-empty">
              <Check size={22} aria-hidden="true" />
              No hay propuestas abiertas en este momento.
            </div>
          ) : (
            <div className="planning-list">
              {openProposals.map((item) => (
                <article className="planning-card" key={item.id}>
                  <div className="planning-card-icon"><ClipboardList size={22} /></div>
                  <div className="planning-card-content">
                    <div className="proposal-heading">
                      <span className="planning-id">{item.id}</span>
                      <span className={`risk-badge risk-${item.risk.toLowerCase()}`}>{item.risk}</span>
                    </div>
                    <h2>{item.title}</h2>
                    <p>{item.objective}</p>
                    {item.scope && <p><b>Alcance:</b> {item.scope}</p>}
                    {item.justification && <p><b>Justificación:</b> {item.justification}</p>}
                    <div className="proposal-meta">
                      <span><b>Tipo:</b> {item.type}</span>
                      <span><b>Área:</b> {item.area || "Sin definir"}</span>
                      <span><b>Responsable:</b> {item.responsible || "Sin asignar"}</span>
                      <span><b>Año:</b> {item.year}</span>
                      {(item.startDate || item.endDate) && (
                        <span><b>Periodo:</b> {formatDate(item.startDate) || "—"} → {formatDate(item.endDate) || "—"}</span>
                      )}
                      {item.createdBy && <span><b>Creada por:</b> {item.createdBy.name}</span>}
                    </div>
                    <div className="approval-progress">
                      <div><span>Aprobación</span><b>{item.approval || 0}%</b></div>
                      <div className="progress-track"><span style={{ width: `${item.approval || 0}%` }} /></div>
                    </div>
                  </div>
                  <div className="planning-card-actions">
                    {canApprove && (
                      <>
                        <label htmlFor={`quarter-${item.id}`}>Trimestre estimado</label>
                        <select
                          id={`quarter-${item.id}`}
                          value={quarters[item.id] || item.quarter || ""}
                          onChange={(event) => setQuarters({ ...quarters, [item.id]: event.target.value })}
                        >
                          <option value="">Sin definir</option>
                          {QUARTERS.map((quarter) => (
                            <option key={quarter.value} value={quarter.value}>{quarter.label}</option>
                          ))}
                        </select>
                        <button type="button" onClick={() => handleApprove(item)}>
                          <Check size={17} aria-hidden="true" />
                          Marcar 100% aprobada
                        </button>
                        {rejectingId === item.id ? (
                          <form className="rejection-form" onSubmit={(event) => handleReject(event, item)}>
                            <label htmlFor={`reason-${item.id}`}>Motivo del rechazo</label>
                            <textarea
                              id={`reason-${item.id}`}
                              required
                              maxLength={1000}
                              value={rejectionReason}
                              onChange={(event) => setRejectionReason(event.target.value)}
                              placeholder="Explica qué debe corregirse o por qué no procede."
                            />
                            <button type="submit" className="reject-action">Confirmar rechazo</button>
                            <button type="button" className="cancel-reject-action" onClick={() => setRejectingId(null)}>Cancelar</button>
                          </form>
                        ) : (
                          <button type="button" className="reject-action" onClick={() => startReject(item)}>
                            <XCircle size={16} aria-hidden="true" />
                            Rechazar propuesta
                          </button>
                        )}
                      </>
                    )}
                    {canCreate && (
                      <>
                        <button type="button" onClick={() => openEdit(item)}>
                          <Pencil size={16} aria-hidden="true" />
                          Editar
                        </button>
                        <button type="button" onClick={() => handleDelete(item)}>
                          <Trash2 size={16} aria-hidden="true" />
                          Eliminar
                        </button>
                      </>
                    )}
                    <PlanningHistoryButton proposal={item} />
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className="planning-section-heading rejected-section-heading">
            <div>
              <span className="eyebrow">DECISIONES REGISTRADAS</span>
              <h2>Propuestas rechazadas</h2>
            </div>
            <span>{rejectedProposals.length} rechazadas</span>
          </div>
          {rejectedProposals.length === 0 ? (
            <div className="planning-empty">Todavía no hay propuestas rechazadas.</div>
          ) : (
            <div className="planning-list">
              {rejectedProposals.map((item) => (
                <article className="planning-card rejected-card" key={item.id}>
                  <div className="planning-card-icon"><XCircle size={22} aria-hidden="true" /></div>
                  <div className="planning-card-content">
                    <div className="proposal-heading">
                      <span className="planning-id">{item.id}</span>
                      <span className="rejected-badge">Rechazada</span>
                    </div>
                    <h2>{item.title}</h2>
                    <p>{item.objective}</p>
                    <div className="proposal-meta">
                      <span><b>Área:</b> {item.area}</span>
                      <span><b>Decidió:</b> {item.rejectedBy?.name || "Sin dato"}</span>
                      {item.rejectedAt && <span><b>Fecha:</b> {formatDate(item.rejectedAt.slice(0, 10))}</span>}
                    </div>
                    <p className="rejection-reason"><b>Motivo:</b> {item.rejectionReason}</p>
                  </div>
                  <div className="planning-card-actions"><PlanningHistoryButton proposal={item} /></div>
                </article>
              ))}
            </div>
          )}

          {isModalOpen && (
            <div className="modal-backdrop">
              <form className="proposal-modal" onSubmit={handleSubmit}>
                <div className="modal-header">
                  <div>
                    <span className="eyebrow">{editingId ? `EDITAR ${editingId}` : "NUEVA AUDITORÍA"}</span>
                    <h2>{editingId ? "Editar propuesta" : "Abrir una propuesta"}</h2>
                    <p>Captura el contexto para que el comité pueda revisarla.</p>
                  </div>
                  <button type="button" className="modal-close" onClick={closeModal} aria-label="Cerrar">
                    <X size={20} />
                  </button>
                </div>
                {error && <p className="planning-message error">{error}</p>}
                <div className="proposal-form-grid">
                  <label className="full-width">Título de la propuesta
                    <input required value={form.title} onChange={(event) => updateForm("title", event.target.value)} placeholder="Revisión de controles de acceso" />
                  </label>
                  <label>Unidad o área
                    <input required value={form.area} onChange={(event) => updateForm("area", event.target.value)} placeholder="Operaciones" />
                  </label>
                  <label>Responsable
                    <select value={form.responsibleId} onChange={(event) => updateForm("responsibleId", event.target.value)}>
                      <option value="">Sin asignar</option>
                      {auditors.map((auditor) => (
                        <option key={auditor.id} value={auditor.id}>{auditor.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>Tipo de auditoría
                    <select value={form.type} onChange={(event) => updateForm("type", event.target.value)}>
                      {AUDIT_TYPES.map((type) => <option key={type}>{type}</option>)}
                    </select>
                  </label>
                  <label>Probabilidad del riesgo
                    <select value={form.likelihood} onChange={(event) => updateForm("likelihood", Number(event.target.value))}>
                      {RISK_FACTORS.map((factor) => <option key={factor.value} value={factor.value}>{factor.label}</option>)}
                    </select>
                  </label>
                  <label>Impacto del riesgo
                    <select value={form.impact} onChange={(event) => updateForm("impact", Number(event.target.value))}>
                      {RISK_FACTORS.map((factor) => <option key={factor.value} value={factor.value}>{factor.label}</option>)}
                    </select>
                  </label>
                  <label>Trimestre estimado
                    <select value={form.quarter} onChange={(event) => updateForm("quarter", event.target.value)}>
                      <option value="">Sin definir</option>
                      {QUARTERS.map((quarter) => <option key={quarter.value} value={quarter.value}>{quarter.label}</option>)}
                    </select>
                  </label>
                  <label>Año
                    <input type="number" min="2020" max="2100" required value={form.year} onChange={(event) => updateForm("year", event.target.value)} />
                  </label>
                  <label>Fecha de inicio
                    <input type="date" required={!form.quarter || Boolean(form.endDate)} value={form.startDate} onChange={(event) => updateForm("startDate", event.target.value)} />
                  </label>
                  <label>Fecha de fin
                    <input type="date" min={form.startDate || undefined} required={!form.quarter || Boolean(form.startDate)} value={form.endDate} onChange={(event) => updateForm("endDate", event.target.value)} />
                  </label>
                  <label className="full-width">Objetivo
                    <textarea required value={form.objective} onChange={(event) => updateForm("objective", event.target.value)} placeholder="¿Qué decisión o riesgo busca aclarar esta auditoría?" />
                  </label>
                  <label className="full-width">Alcance
                    <textarea required maxLength={2000} value={form.scope} onChange={(event) => updateForm("scope", event.target.value)} placeholder="¿Qué procesos, áreas y periodos se revisarán?" />
                  </label>
                  <label className="full-width">Justificación
                    <textarea required maxLength={2000} value={form.justification} onChange={(event) => updateForm("justification", event.target.value)} placeholder="¿Por qué es necesaria esta auditoría?" />
                  </label>
                </div>
                <div className="modal-actions">
                  <button type="button" className="secondary-action" onClick={closeModal}>Cancelar</button>
                  <button type="submit" className="primary-action" disabled={saving}>
                    {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Abrir propuesta"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default Planificacion;
