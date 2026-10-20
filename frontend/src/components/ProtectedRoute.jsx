import { Navigate } from "react-router-dom";
import AssistantQuickAccess from "./AssistantQuickAccess";
import { ROLE_LABELS } from "../constants/roles";
import { endRoleTour, hasRoleTourSession } from "../services/roleTour";
import "./RoleTourBanner.css";

function ProtectedRoute({ children, allowedRoles  }) {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "null");

  if (user?.roleTour && !hasRoleTourSession()) {
    return <Navigate to="/" replace />;
  }

  if (!token || !user) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>
    {user.roleTour && <div className="role-tour-banner" role="status">
      <span><strong>Recorrido: {ROLE_LABELS[user.role] || user.role}</strong> · Datos y permisos de ese rol · Solo lectura</span>
      <button type="button" onClick={endRoleTour}>Volver a Super Admin</button>
    </div>}
    {children}
    {!user.roleTour && <AssistantQuickAccess />}
  </>;
}

export default ProtectedRoute;
