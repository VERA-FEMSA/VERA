import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Bot } from "lucide-react";
import AssistantDrawer from "./AssistantDrawer";
import "../pages/Asistente.css";

function AssistantQuickAccess() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  if (location.pathname === "/asistente") return null;
  return <>
    <button className="assistant-quick-access" type="button" onClick={() => setOpen(true)} aria-label="Abrir asistente de IA"><Bot size={19} aria-hidden="true" /><span>Preguntar a VERA</span></button>
    {open && <AssistantDrawer onClose={() => setOpen(false)} />}
  </>;
}

export default AssistantQuickAccess;
