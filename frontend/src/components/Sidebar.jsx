import { useEffect, useRef, useState } from "react";
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
  ChevronLeft,
  ChevronRight,
  Search,
  ShieldAlert,
  ScrollText,
  SunMoon,
  UserCog,
  UserRoundPen,
  X
} from "lucide-react";
import { ROLE_LABELS, USER_VIEW_ROLES } from "../constants/roles";
import { managedAuth } from "../services/managedAuth";
import ThemeControl from "./ThemeControl";
import GlobalSearch from "./GlobalSearch";
import "../pages/Dashboard.css";
import "./Sidebar.css";

const ICON_SIZE = 20;
const ICON_STROKE = 1.75;
const PREVIEW_ROLES = ["AUDITOR", "JEFATURA", "GERENTE", "DIRECTOR"];
const NAV_STORAGE_KEY = "vera:navigation-collapsed";
const PREVIEW_ACTIONS = {
  AUDITOR: "Consulta sus auditorías asignadas y registra evidencias y hallazgos autorizados.",
  JEFATURA: "Consulta el portafolio y puede proponer auditorías y registrar evidencias.",
  GERENTE: "Puede gestionar riesgos y controles y decidir sobre propuestas de auditoría.",
  DIRECTOR: "Consulta el portafolio y las cuentas; no modifica riesgos ni aprueba propuestas."
};

function Sidebar({ active }) {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 750px)").matches);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(NAV_STORAGE_KEY) === "true"; }
    catch { return false; }
  });
  const [previewRole, setPreviewRole] = useState(null);
  const mobileToggleRef = useRef(null);
  const sidebarRef = useRef(null);
  const previewCloseRef = useRef(null);
  const previewOpenerRef = useRef(null);

  useEffect(() => {
    document.documentElement.dataset.navCollapsed = collapsed ? "true" : "false";
    try { localStorage.setItem(NAV_STORAGE_KEY, String(collapsed)); }
    catch { /* The layout still works when local storage is unavailable. */ }
  }, [collapsed]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 750px)");
    const update = () => { setIsMobile(media.matches); if (!media.matches) setMobileOpen(false); };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!mobileOpen || !isMobile) return undefined;
    sidebarRef.current?.querySelector(".nav-item")?.focus();
    const onKeyDown = (event) => {
      if (document.querySelector("dialog[open], .role-preview-dialog")) return;
      if (event.key === "Escape") { setMobileOpen(false); mobileToggleRef.current?.focus(); }
      if (event.key !== "Tab") return;
      const focusable = [mobileToggleRef.current, ...sidebarRef.current.querySelectorAll("button, select, a[href]")]
        .filter((element) => element && element.getClientRects().length > 0 && !element.disabled);
      const index = focusable.indexOf(document.activeElement);
      if (event.shiftKey && index <= 0) { event.preventDefault(); focusable.at(-1)?.focus(); }
      else if (!event.shiftKey && index === focusable.length - 1) { event.preventDefault(); focusable[0]?.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen, isMobile]);

  useEffect(() => {
    if (!previewRole) return undefined;
    previewCloseRef.current?.focus();
    const onKeyDown = (event) => {
      if (document.querySelector("dialog[open]")) return;
      if (event.key === "Escape") { event.preventDefault(); setPreviewRole(null); }
      if (event.key === "Tab") { event.preventDefault(); previewCloseRef.current?.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previewOpenerRef.current?.isConnected) previewOpenerRef.current.focus();
    };
  }, [previewRole]);

  const openPreviewRole = (role) => {
    previewOpenerRef.current = document.activeElement?.closest(".global-search-dialog")
      ? document.querySelector(".global-search-trigger") : document.activeElement;
    setPreviewRole(role);
  };

  const revealAppearance = () => {
    setCollapsed(false);
    if (isMobile) setMobileOpen(true);
    requestAnimationFrame(() => sidebarRef.current?.querySelector(".theme-control select")?.focus());
  };

  const logout = async () => {
    try { if (managedAuth) await managedAuth.auth.signOut(); }
    catch { /* Local VERA logout still proceeds if the identity provider is unavailable. */ }
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  };

  const canSeeUsers = USER_VIEW_ROLES.includes(user?.role);
  const canSeeAuditLog = user?.role === "SUPER_ADMIN";
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
    { id: "mi-rol", label: "Mi rol y solicitudes", Icon: UserRoundPen, path: "/mi-rol" },
    ...(canSeeUsers ? [{ id: "usuarios", label: "Usuarios", Icon: UserCog, path: "/usuarios" }] : []),
    ...(canSeeAuditLog ? [{ id: "auditoria", label: "Registro de actividad", Icon: ScrollText, path: "/auditoria" }] : [])
  ];
  const groups = [
    { label: "Portafolio y auditorías", ids: ["dashboard", "planificacion", "trimestres", "auditorias-activas", "auditorias"] },
    { label: "Riesgos y evidencia", ids: ["riesgos", "controles", "evidencias"] },
    { label: "Seguimiento", ids: ["notificaciones", "actividad"] },
    { label: "Asistencia", ids: ["asistente"] },
    { label: "Cuenta y administración", ids: ["mi-rol", "usuarios", "auditoria"] }
  ].map((group) => ({ ...group, items: group.ids.map((id) => items.find((item) => item.id === id)).filter(Boolean) }));
  const previewRoles = user?.role === "SUPER_ADMIN" ? PREVIEW_ROLES.map((role) => ({ role, label: ROLE_LABELS[role] })) : [];
  const goTo = (path) => { navigate(path); setMobileOpen(false); };

  return (
    <>
      <button
        type="button"
        className="mobile-nav-toggle"
        ref={mobileToggleRef}
        onClick={() => setMobileOpen((open) => !open)}
        aria-label={mobileOpen ? "Cerrar menú de navegación" : "Abrir menú de navegación"}
        aria-expanded={mobileOpen}
        aria-controls="vera-sidebar"
      >
        {mobileOpen ? <X size={22} /> : <Menu size={22} />}
      </button>
      {mobileOpen && <div className="sidebar-backdrop" aria-hidden="true" onClick={() => setMobileOpen(false)} />}
      <aside id="vera-sidebar" ref={sidebarRef} className={`sidebar${mobileOpen ? " sidebar-open" : ""}`}
        role={isMobile && mobileOpen ? "dialog" : undefined} aria-modal={isMobile && mobileOpen ? "true" : undefined}
        aria-label="Navegación de VERA" inert={isMobile && !mobileOpen ? true : undefined}>
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <img src="/vera-logo.svg" alt="VERA" style={{ width: 32, height: 32 }} />
          </div>

          <div className="brand-copy">
            <h2>VERA</h2>
            <p>
              VERIFICACIÓN · EVIDENCIA ·
              <br />
              RIESGO · AUDITORÍA
            </p>
          </div>
          <button type="button" className="sidebar-collapse-toggle" onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expandir menú lateral" : "Contraer menú lateral"} aria-expanded={!collapsed}
            aria-controls="vera-sidebar" title={collapsed ? "Expandir menú" : "Contraer menú"}>
            {collapsed ? <ChevronRight size={18} aria-hidden="true" /> : <ChevronLeft size={18} aria-hidden="true" />}
          </button>
        </div>
        <div className="sidebar-navigation">
          <div className="nav-title">NAVEGACIÓN</div>
          <nav aria-label="Módulos principales">
            {groups.map((group) => group.items.length > 0 && <section className="nav-group" key={group.label}
              aria-label={group.label}>
              <h3 className="nav-group-title">{group.label}</h3>
              {group.items.map(({ id, label, Icon, path }) => <button type="button" key={id}
                className={`nav-item${active === id ? " active" : ""}`}
                onClick={() => goTo(path)} aria-label={label} aria-current={active === id ? "page" : undefined}
                title={collapsed && !isMobile ? label : undefined}>
                <Icon size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" />
                <span>{label}</span>
              </button>)}
            </section>)}
          </nav>
          {previewRoles.length > 0 && <div className="role-preview-launcher">
            <strong>VER VISTA DE OTRO ROL</strong>
            <div className="role-preview-buttons">
              {previewRoles.map(({ role, label }) => <button type="button" key={role}
                onClick={() => openPreviewRole(role)} aria-label={`Ver vista de ${label}`}
                title={collapsed && !isMobile ? `Ver vista de ${label}` : undefined}>
                <span className="role-preview-full">Ver vista de {label}</span>
                <span className="role-preview-short" aria-hidden="true">{label.charAt(0)}</span>
              </button>)}
            </div>
          </div>}
        </div>

        <div className="sidebar-bottom">
          <div className="appearance-expanded"><ThemeControl /></div>
          <button type="button" className="appearance-rail-button" onClick={revealAppearance}
            aria-label="Apariencia" title="Apariencia"><SunMoon size={20} aria-hidden="true" /></button>
          <div className="user-info" title={collapsed && !isMobile ? `${user?.name} · ${ROLE_LABELS[user?.role] || user?.role}` : undefined}>
            <div className="avatar">{user?.name?.charAt(0)}</div>

            <div className="user-info-details">
              <strong>{user?.name}</strong>
              <span>{ROLE_LABELS[user?.role] || user?.role}</span>
            </div>
          </div>

          <button type="button" className="logout-button" onClick={logout} aria-label="Cerrar sesión"
            title={collapsed && !isMobile ? "Cerrar sesión" : undefined}>
            <LogOut size={18} strokeWidth={ICON_STROKE} aria-hidden="true" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>
      <GlobalSearch groups={groups} previewRoles={previewRoles} onNavigate={goTo}
        onPreviewRole={openPreviewRole} onRevealAppearance={revealAppearance} onLogout={logout}
        onOpen={() => setMobileOpen(false)} disabled={Boolean(previewRole)} />
      {previewRole && <div className="role-preview-backdrop" role="presentation" onClick={() => setPreviewRole(null)}>
        <section className="role-preview-dialog" role="dialog" aria-modal="true"
          aria-label={`Vista previa de ${ROLE_LABELS[previewRole]}`} onClick={(event) => event.stopPropagation()}>
          <button type="button" className="role-preview-close" ref={previewCloseRef} onClick={() => setPreviewRole(null)} aria-label="Cerrar vista previa"><X size={20} /></button>
          <span className="eyebrow">VISTA PREVIA · SIN CAMBIAR PERMISOS</span>
          <h2>{ROLE_LABELS[previewRole]}</h2>
          <p>{PREVIEW_ACTIONS[previewRole]}</p>
          <h3>Navegación de este rol</h3>
          <ul>{items.filter((item) => item.id !== "usuarios" && item.id !== "auditoria")
            .map((item) => <li key={item.id}>{item.label}</li>)}
            {previewRole === "DIRECTOR" && <li>Usuarios (consulta)</li>}
          </ul>
          <p className="role-preview-note">Esta vista muestra la navegación y el alcance general. Tu sesión SUPER_ADMIN conserva sus permisos reales; no se ejecutan acciones como otra persona.</p>
        </section>
      </div>}
    </>
  );
}

export default Sidebar;
