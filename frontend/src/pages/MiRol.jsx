import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import { ASSIGNABLE_ROLES, ROLE_LABELS } from "../constants/roles";
import { createRoleRequest, getMyRoleRequests } from "../services/userService";
import "./Dashboard.css";
import "./Usuarios.css";

const STATUS_LABELS = { PENDING: "En revisión", APPROVED: "Autorizada", REJECTED: "Rechazada" };

function MiRol() {
  const [currentRole, setCurrentRole] = useState("");
  const [requests, setRequests] = useState([]);
  const [role, setRole] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    const data = await getMyRoleRequests();
    setCurrentRole(data.currentRole);
    setRequests(data.requests);
    const cached = JSON.parse(localStorage.getItem("user") || "null");
    if (cached && cached.role !== data.currentRole) {
      localStorage.setItem("user", JSON.stringify({ ...cached, role: data.currentRole }));
    }
  };

  useEffect(() => {
    let active = true;
    getMyRoleRequests().then((data) => {
      if (!active) return;
      setCurrentRole(data.currentRole);
      setRequests(data.requests);
      const cached = JSON.parse(localStorage.getItem("user") || "null");
      if (cached && cached.role !== data.currentRole) {
        localStorage.setItem("user", JSON.stringify({ ...cached, role: data.currentRole }));
      }
    }).catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const pending = requests.some((request) => request.status === "PENDING");
  const available = ASSIGNABLE_ROLES.filter((item) => item !== currentRole);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);
    try {
      await createRoleRequest(role, reason.trim());
      setRole("");
      setReason("");
      await load();
      setMessage("Solicitud enviada. Una cuenta SUPER_ADMIN revisará el motivo y registrará la decisión.");
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return <div className="dashboard-layout">
    <Sidebar active="mi-rol" />
    <main className="dashboard-main">
      <div className="topbar"><div></div></div>
      <section className="dashboard-content">
        <div className="dashboard-header"><div>
          <span className="eyebrow">ACCESO PERSONAL</span>
          <h1>Mi rol en VERA</h1>
          <p>Tu cuenta puede entrar desde que se crea. Solo un cambio de rol requiere autorización.</p>
        </div></div>

        {loading && <p className="users-muted">Consultando tu rol...</p>}
        {error && <p className="users-msg error" role="alert">{error}</p>}
        {message && <p className="users-msg success" role="status">{message}</p>}

        {!loading && <div className="users-card">
          <h2>Rol actual: {ROLE_LABELS[currentRole] || currentRole}</h2>
          {currentRole === "SUPER_ADMIN" ?
            <p className="users-muted">Esta cuenta ya tiene el rol máximo.</p> :
            pending ? <p className="users-muted">Tienes una solicitud en revisión. Podrás enviar otra cuando se resuelva.</p> :
              <form className="role-request-form" onSubmit={submit}>
                <label htmlFor="requested-role">Rol que solicitas</label>
                <select id="requested-role" value={role} onChange={(event) => setRole(event.target.value)} required>
                  <option value="">Selecciona un rol</option>
                  {available.map((item) => <option value={item} key={item}>{ROLE_LABELS[item]}</option>)}
                </select>
                <label htmlFor="role-reason">¿Para qué necesitas este acceso?</label>
                <textarea id="role-reason" value={reason} onChange={(event) => setReason(event.target.value)}
                  minLength={10} maxLength={500} rows={4} required
                  placeholder="Describe las tareas concretas que necesitas realizar." />
                <p className="users-muted">La solicitud no cambia tus permisos hasta que SUPER_ADMIN la autorice.</p>
                <button className="users-primary" type="submit" disabled={saving || !role || reason.trim().length < 10}>
                  {saving ? "Enviando..." : "Solicitar cambio de rol"}
                </button>
              </form>}
        </div>}

        {!loading && requests.length > 0 && <div className="users-card">
          <h2>Mis solicitudes</h2>
          <ul className="users-list">{requests.map((request) => <li className="users-row" key={request.id}>
            <div className="users-identity"><strong>{ROLE_LABELS[request.requestedRole]}</strong>
              <span>{request.reason}</span>
              <span>{new Date(request.createdAt).toLocaleString("es-MX")}</span>
            </div>
            <span className="users-badge">{STATUS_LABELS[request.status] || request.status}</span>
          </li>)}</ul>
        </div>}
      </section>
    </main>
  </div>;
}

export default MiRol;
