import { useState } from "react";
import { useLocation } from "react-router-dom";
import AssistantDrawer from "./AssistantDrawer";
import "../pages/Asistente.css";

function AssistantQuickAccess() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  if (location.pathname === "/asistente") return null;
  return <>
    <button className="assistant-quick-access" type="button" onClick={() => setOpen(true)} aria-label="Abrir asistente de IA"><img src="/vera-logo.svg" alt="" /><span>Preguntar a VERA</span></button>
    {open && <AssistantDrawer onClose={() => setOpen(false)} />}
  </>;
}

export default AssistantQuickAccess;
