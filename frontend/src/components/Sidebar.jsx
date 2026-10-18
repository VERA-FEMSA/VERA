import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  BellRing,
  Bot,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  Files,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  ShieldAlert,
  ScrollText,
  UserCog,
  X
} from "lucide-react";
import { ROLE_LABELS, USER_VIEW_ROLES } from "../constants/roles";
import { managedAuth } from "../services/managedAuth";
import "../pages/Dashboard.css";
import "./Sidebar.css";

const ICON_SIZE = 20;
const ICON_STROKE = 1.75;

function Sidebar({ active }) {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const [mobileOpen, setMobileOpen] = useState(false);

  const logout = async () => {
    try { if (managedAuth) await managedAuth.auth.signOut(); }
    catch { /* Local VERA logout still proceeds if the identity provider is unavailable. */ }
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  };

  const canSeeUsers = USER_VIEW_ROLES.includes(user?.role);
  const canSeeAuditLog = USER_VIEW_ROLES.includes(user?.role);
  const items = [
    { id: "dashboard", label: "Panel de Portafolio", Icon: LayoutDashboard, path: "/dashboard" },
    { id: "planificacion", label: "Planificación", Icon: ClipboardList, path: "/planificacion" },
    { id: "trimestres", label: "Trimestres", Icon: CalendarRange, path: "/trimestres" },
    { id: "auditorias-activas", label: "Auditorías activas y riesgos", Icon: Activity, path: "/auditorias-activas" },
    { id: "auditorias", label: "Buscar auditorías", Icon: Search, path: "/auditorias" },
    { id: "riesgos", label: "Registro de riesgos", Icon: ShieldAlert, path: "/riesgos" },
    { id: "controles", label: "Mapa de controles", Icon: ClipboardCheck, path: "/controles" },
    { id: "notificaciones", label: "Pendientes", Icon: BellRing, path: "/notificaciones" },
    { id: "actividad", label: "Actividad reciente", Icon: Activity, path: "/actividad" },
    { id: "asistente", label: "Asistente de IA", Icon: Bot, path: "/asistente" },
    { id: "evidencias", label: "Evidencias", Icon: Files, path: "/evidencias" },
    ...(canSeeUsers ? [{ id: "usuarios", label: "Usuarios", Icon: UserCog, path: "/usuarios" }] : []),
    ...(canSeeAuditLog ? [{ id: "auditoria", label: "Registro de actividad", Icon: ScrollText, path: "/auditoria" }] : [])
  ];

  return (
    <>
      <button
        type="button"
        className="mobile-nav-toggle"
        onClick={() => setMobileOpen((open) => !open)}
        aria-label={mobileOpen ? "Cerrar menú de navegación" : "Abrir menú de navegación"}
        aria-expanded={mobileOpen}
        aria-controls="vera-sidebar"
      >
        {mobileOpen ? <X size={22} /> : <Menu size={22} />}
      </button>
      {mobileOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Cerrar menú de navegación"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside id="vera-sidebar" className={`sidebar${mobileOpen ? " sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <img src="/vera-logo.svg" alt="VERA" style={{ width: 32, height: 32 }} />
          </div>

          <div>
            <h2>VERA</h2>
            <p>
              VERIFICACIÓN · EVIDENCIA ·
              <br />
              RIESGO · AUDITORÍA
            </p>
          </div>
        </div>

        <div className="sidebar-navigation">
          <div className="nav-title">NAVEGACIÓN</div>
          <nav aria-label="Módulos principales">
            {items.map(({ id, label, Icon, path }) => (
              <button
                type="button"
                key={id}
                className={`nav-item${active === id ? " active" : ""}`}
                onClick={() => {
                  navigate(path);
                  setMobileOpen(false);
                }}
              >
                <Icon size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </nav>

        </div>

        <div className="sidebar-bottom">
          <div className="user-info">
            <div className="avatar">{user?.name?.charAt(0)}</div>

            <div>
              <strong>{user?.name}</strong>
              <span>{ROLE_LABELS[user?.role] || user?.role}</span>
            </div>
          </div>

          <button type="button" className="logout-button" onClick={logout}>
            <LogOut size={18} strokeWidth={ICON_STROKE} aria-hidden="true" />
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
