import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import AssistantDrawer from "./AssistantDrawer";
import "../pages/Asistente.css";

function AssistantQuickAccess() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => {
    if (location.pathname === "/asistente") return undefined;
    const onKeyDown = (event) => {
      if (event.defaultPrevented || !event.altKey || event.shiftKey || !(event.ctrlKey || event.metaKey) ||
          event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      setOpen(true);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [location.pathname]);
  if (location.pathname === "/asistente") return null;
  return <>
    <button className="assistant-quick-access" type="button" onClick={() => setOpen(true)}
      aria-label="Abrir asistente de IA" aria-keyshortcuts="Control+Alt+K Meta+Alt+K"
      title="Abrir asistente · Ctrl+Alt+K"><img src="/vera-logo.svg" alt="" /><span>Preguntar a VERA</span></button>
    {open && <AssistantDrawer onClose={() => setOpen(false)} />}
  </>;
}

export default AssistantQuickAccess;
