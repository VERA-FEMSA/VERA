import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardList,
  CalendarRange,
  Activity,
  FileChartColumn,
  UserCog,
  ShieldCheck,
  ShieldAlert,
  ClipboardCheck,
  BellRing,
  Files,
  ScrollText,
  LogOut
} from "lucide-react";
import { ROLE_LABELS, USER_ADMIN_ROLES } from "../constants/roles";
import "../pages/Dashboard.css";
import "./Sidebar.css";

const ICON_SIZE = 20;
const ICON_STROKE = 1.75;

// Menú lateral compartido por todas las pantallas.
// active: "dashboard" | "planificacion" | "trimestres" | "auditorias-activas" | "reportes" | "usuarios" | "roles" | "auditoria"
function Sidebar({ active }) {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "null");

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  };

  const canSeeReports = user?.role !== "AUDITOR";
  const canSeeUsers = USER_ADMIN_ROLES.includes(user?.role);
  const canSeeRoles = user?.role === "SUPER_ADMIN";

  // path: a dónde lleva el botón. Las pantallas que aún no existen no llevan path.
  const items = [
    { id: "dashboard", label: "Panel de Portafolio", Icon: LayoutDashboard, path: "/dashboard", show: true },
    { id: "dashboard", label: "Panel de Portafolio", Icon: LayoutDashboard, path: "/dashboard", show: true },
    { id: "planificacion", label: "Planificación", Icon: ClipboardList, path: "/planificacion", show: true },
    { id: "trimestres", label: "Trimestres", Icon: CalendarRange, path: "/trimestres", show: true },
    { id: "auditorias-activas", label: "Auditorías activas y riesgos", Icon: Activity, path: "/auditorias-activas", show: true },
    { id: "riesgos", label: "Registro de riesgos", Icon: ShieldAlert, path: "/riesgos", show: true },
    { id: "controles", label: "Mapa de controles", Icon: ClipboardCheck, path: "/controles", show: true },
    { id: "notificaciones", label: "Pendientes", Icon: BellRing, path: "/notificaciones", show: true },
    { id: "evidencias", label: "Evidencias", Icon: Files, path: "/evidencias", show: true },
    { id: "reportes", label: "Reportes", Icon: FileChartColumn, show: canSeeReports },
    { id: "usuarios", label: "Usuarios", Icon: UserCog, path: "/usuarios", show: canSeeUsers },
    { id: "auditoria", label: "Registro de actividad", Icon: ScrollText, path: "/auditoria", show: canSeeRoles },
    { id: "reportes", label: "Reportes", Icon: FileChartColumn, show: canSeeReports },
    { id: "usuarios", label: "Usuarios", Icon: UserCog, path: "/usuarios", show: canSeeUsers },
    { id: "auditoria", label: "Registro de actividad", Icon: ScrollText, path: "/auditoria", show: canSeeRoles },
    { id: "roles", label: "Roles y permisos", Icon: ShieldCheck, show: false }
  ];

  return (
    <aside className="sidebar">
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

      <div className="nav-title">NAVEGACIÓN</div>

      <nav>
        {items
          .filter((item) => item.show)
          .map(({ id, label, Icon, path }) => (
            <button
              key={id}
              className={`nav-item${active === id ? " active" : ""}`}
              onClick={path ? () => navigate(path) : undefined}
            >
              <Icon size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="user-info">
          <div className="avatar">{user?.name?.charAt(0)}</div>

          <div>
            <strong>{user?.name}</strong>
            <span>{ROLE_LABELS[user?.role] || user?.role}</span>
          </div>
        </div>

        <button className="logout-button" onClick={logout}>
          <LogOut size={18} strokeWidth={ICON_STROKE} aria-hidden="true" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
