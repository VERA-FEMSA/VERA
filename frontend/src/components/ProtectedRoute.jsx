import { Navigate } from "react-router-dom";
import AssistantQuickAccess from "./AssistantQuickAccess";

function ProtectedRoute({ children, allowedRoles  }) {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "null");

  if (!token) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}<AssistantQuickAccess /></>;
}

export default ProtectedRoute;
