import {
  BrowserRouter,
  Routes,
  Route
} from "react-router-dom";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Usuarios from "./pages/Usuarios";
import Registro from "./pages/Registro";
import Auditoria from "./pages/Auditoria";
import Planificacion from "./pages/Planificacion";
import AuditoriasActivas from "./pages/AuditoriasActivas";
import Riesgos from "./pages/Riesgos";
import Controles from "./pages/Controles";
import Notificaciones from "./pages/Notificaciones";
import Evidencias from "./pages/Evidencias";
import Trimestres, { TrimestreDetalle } from "./pages/Trimestres";
import ProtectedRoute from "./components/ProtectedRoute";
import { USER_ADMIN_ROLES } from "./constants/roles";


function App() {
  return (
    <BrowserRouter>
      <Routes>

        <Route
          path="/"
          element={<Login />}
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        
        <Route path="/registro" element={<Registro />} />

        <Route
          path="/usuarios"
          element={
            <ProtectedRoute allowedRoles={USER_ADMIN_ROLES}>
              <Usuarios />
            </ProtectedRoute>
          }
        />

        <Route
          path="/auditoria"
          element={
            <ProtectedRoute allowedRoles={["SUPER_ADMIN"]}>
              <Auditoria />
            </ProtectedRoute>
          }
        />
        <Route
          path="/planificacion"
          element={
            <ProtectedRoute>
              <Planificacion />
            </ProtectedRoute>
          }
        />

        <Route
          path="/trimestres"
          element={
            <ProtectedRoute>
              <Trimestres />
            </ProtectedRoute>
          }
        />

        <Route
          path="/auditorias-activas"
          element={
            <ProtectedRoute>
              <AuditoriasActivas />
            </ProtectedRoute>
          }
        />

        <Route path="/riesgos" element={<ProtectedRoute><Riesgos /></ProtectedRoute>} />
        <Route path="/controles" element={<ProtectedRoute><Controles /></ProtectedRoute>} />
        <Route path="/notificaciones" element={<ProtectedRoute><Notificaciones /></ProtectedRoute>} />
        <Route path="/evidencias" element={<ProtectedRoute><Evidencias /></ProtectedRoute>} />

        <Route
          path="/trimestres/:quarterId"
          element={
            <ProtectedRoute>
              <TrimestreDetalle />
            </ProtectedRoute>
          }
        />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
