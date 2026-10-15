import { useEffect, useState } from "react";
import { Inbox } from "lucide-react";
import Sidebar from "../components/Sidebar";
import {
  getUsers,
  updateUserRole,
  updateUserStatus,
  approveRequest,
  rejectRequest
} from "../services/userService";
import { ROLE_LABELS, ASSIGNABLE_ROLES, DEFAULT_ROLE } from "../constants/roles";
import { USER_STATUS } from "../constants/accountRules";
import "./Dashboard.css";
import "./Usuarios.css";

const formatDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("es-MX", {
        day: "numeric",
        month: "short",
        year: "numeric"
      })
    : "";

function Usuarios() {
  const currentUser = JSON.parse(localStorage.getItem("user") || "null");
  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Rol elegido en el selector antes de guardar o aprobar: { [id]: "GERENTE" }
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  // Mensaje por fila: { [id]: { type: "success" | "error", text } }
  const [feedback, setFeedback] = useState({});
  // Mensaje general del recuadro de solicitudes
  const [requestNotice, setRequestNotice] = useState(null);

  useEffect(() => {
    getUsers()
      .then((data) => setUsers(data))
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Para el botón "Reintentar"
  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await getUsers();
      setUsers(data);
      setLoadError("");
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const pendingUsers = users.filter((u) => u.status === USER_STATUS.PENDING);
  const accounts = users.filter((u) => u.status !== USER_STATUS.PENDING);

  // ---------- reglas de la interfaz (el backend valida lo mismo) ----------

  const isSelf = (user) => user.id === currentUser?.id;

  const isProtected = (user) => user.role === "SUPER_ADMIN" && !isSuperAdmin;

  const canEdit = (user) => !isSelf(user) && !isProtected(user);

  const replaceUser = (updated) => {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
  };

  const clearDraft = (id) => {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const showRowMessage = (id, type, text) => {
    setFeedback((prev) => ({ ...prev, [id]: { type, text } }));
  };

  // ---------- acciones sobre cuentas ----------

  const handleSaveRole = async (user) => {
    const role = drafts[user.id];
    setSavingId(user.id);

    try {
      const updated = await updateUserRole(user.id, role);
      replaceUser(updated);
      clearDraft(user.id);
      showRowMessage(user.id, "success", `Rol cambiado a ${ROLE_LABELS[role]}.`);
    } catch (err) {
      clearDraft(user.id); // el selector regresa al rol anterior
      showRowMessage(user.id, "error", err.message);
    } finally {
      setSavingId(null);
    }
  };

  const handleToggleStatus = async (user) => {
    const enable = user.status === USER_STATUS.DISABLED;

    if (!enable) {
      const ok = window.confirm(
        `${user.name} ya no podrá iniciar sesión. ¿Deshabilitar la cuenta?`
      );
      if (!ok) return;
    }

    setSavingId(user.id);

    try {
      const updated = await updateUserStatus(user.id, enable);
      replaceUser(updated);
      showRowMessage(
        user.id,
        "success",
        enable ? "Cuenta habilitada." : "Cuenta deshabilitada."
      );
    } catch (err) {
      showRowMessage(user.id, "error", err.message);
    } finally {
      setSavingId(null);
    }
  };

  // ---------- acciones sobre solicitudes (solo Super Admin) ----------

  const handleApprove = async (user) => {
    const role = drafts[user.id] ?? DEFAULT_ROLE;
    setSavingId(user.id);

    try {
      const updated = await approveRequest(user.id, role);
      replaceUser(updated); // pasa de la lista de solicitudes a la de cuentas
      clearDraft(user.id);
      showRowMessage(user.id, "success", `Solicitud aprobada como ${ROLE_LABELS[role]}.`);
      setRequestNotice(null);
    } catch (err) {
      setRequestNotice({ type: "error", text: err.message });
    } finally {
      setSavingId(null);
    }
  };

  const handleReject = async (user) => {
    const ok = window.confirm(
      `Se eliminará la solicitud de ${user.name} (${user.email}). ¿Rechazarla?`
    );
    if (!ok) return;

    setSavingId(user.id);

    try {
      await rejectRequest(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      setRequestNotice({ type: "success", text: `Solicitud de ${user.name} rechazada.` });
    } catch (err) {
      setRequestNotice({ type: "error", text: err.message });
    } finally {
      setSavingId(null);
    }
  };

  // ---------- vista ----------

  return (
    <div className="dashboard-layout">
      <Sidebar active="usuarios" />

      <main className="dashboard-main">
        <div className="topbar">
          <div></div>
        </div>

        <section className="dashboard-content">
          <div className="dashboard-header">
            <div>
              <span className="eyebrow">GOBIERNO DE ACCESOS</span>
              <h1>Administración de usuarios</h1>
              <p>
                Asigna el rol que define la información y las acciones
                disponibles para cada cuenta.
              </p>
            </div>
          </div>

          {loading && <p className="users-muted">Cargando cuentas...</p>}

          {loadError && (
            <p className="users-msg error">
              {loadError}{" "}
              <button className="users-link" onClick={loadUsers}>
                Reintentar
              </button>
            </p>
          )}

          {!loading && !loadError && isSuperAdmin && (
            <div className="users-card users-requests">
              <div className="users-requests-head">
                <h2>Solicitudes pendientes</h2>
                {pendingUsers.length > 0 && (
                  <span className="users-count">{pendingUsers.length}</span>
                )}
              </div>
              <p className="users-muted">
                Personas que crearon su cuenta y esperan acceso. Al aprobar, elige
                el rol con el que entrarán.
              </p>

              {requestNotice && (
                <p className={`users-msg ${requestNotice.type} users-notice`}>
                  {requestNotice.text}
                </p>
              )}

              {pendingUsers.length === 0 ? (
                <div className="users-empty">
                  <Inbox size={20} strokeWidth={1.75} aria-hidden="true" />
                  No hay solicitudes por revisar.
                </div>
              ) : (
                <ul className="users-list">
                  {pendingUsers.map((user) => {
                    const busy = savingId === user.id;

                    return (
                      <li key={user.id} className="users-row pending">
                        <div className="users-identity">
                          <strong>{user.name}</strong>
                          <span>{user.email}</span>
                          <span>Solicitó acceso el {formatDate(user.requestedAt)}</span>
                        </div>

                        <div className="users-controls">
                          <select
                            aria-label={`Rol para ${user.name}`}
                            value={drafts[user.id] ?? DEFAULT_ROLE}
                            disabled={busy}
                            onChange={(e) =>
                              setDrafts((prev) => ({ ...prev, [user.id]: e.target.value }))
                            }
                          >
                            {ASSIGNABLE_ROLES.map((role) => (
                              <option key={role} value={role}>
                                {ROLE_LABELS[role]}
                              </option>
                            ))}
                          </select>

                          <button
                            className="users-primary"
                            disabled={busy}
                            onClick={() => handleApprove(user)}
                          >
                            Aprobar
                          </button>

                          <button
                            className="users-danger"
                            disabled={busy}
                            onClick={() => handleReject(user)}
                          >
                            Rechazar
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {!loading && !loadError && (
            <div className="users-card">
              <h2>Cuentas VERA</h2>
              <p className="users-muted">
                Cambia el rol de una cuenta o deshabilítala para quitarle el acceso.
              </p>

              <ul className="users-list">
                {accounts.map((user) => {
                  const editable = canEdit(user);
                  const disabled = user.status === USER_STATUS.DISABLED;
                  const selectedRole = drafts[user.id] ?? user.role;
                  const changed = selectedRole !== user.role;
                  const busy = savingId === user.id;
                  const message = feedback[user.id];

                  return (
                    <li
                      key={user.id}
                      className={`users-row${disabled ? " inactive" : ""}`}
                    >
                      <div className="users-identity">
                        <strong>
                          {user.name}
                          {isSelf(user) && <span className="users-tag">Tú</span>}
                          {disabled && (
                            <span className="users-tag off">Deshabilitada</span>
                          )}
                        </strong>
                        <span>{user.email}</span>
                        {message && (
                          <span className={`users-msg ${message.type}`}>
                            {message.text}
                          </span>
                        )}
                      </div>

                      <div className="users-controls">
                        <select
                          aria-label={`Rol de ${user.name}`}
                          value={selectedRole}
                          disabled={!editable || busy}
                          onChange={(e) =>
                            setDrafts((prev) => ({ ...prev, [user.id]: e.target.value }))
                          }
                        >
                          {!ASSIGNABLE_ROLES.includes(user.role) && (
                            <option value={user.role}>{ROLE_LABELS[user.role]}</option>
                          )}
                          {ASSIGNABLE_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </option>
                          ))}
                        </select>

                        <span
                          className={`users-badge${
                            user.role === "DIRECTOR" || user.role === "SUPER_ADMIN"
                              ? " strong"
                              : ""
                          }`}
                        >
                          {ROLE_LABELS[user.role] || user.role}
                        </span>

                        {editable && (
                          <>
                            <button
                              className="users-primary"
                              disabled={!changed || busy}
                              onClick={() => handleSaveRole(user)}
                            >
                              {busy && changed ? "Guardando..." : "Guardar"}
                            </button>

                            <button
                              className="users-secondary"
                              disabled={busy}
                              onClick={() => handleToggleStatus(user)}
                            >
                              {disabled ? "Habilitar" : "Deshabilitar"}
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default Usuarios;
