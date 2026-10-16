import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { Bot, ShieldCheck, X } from "lucide-react";
import AssistantPanel from "./AssistantPanel";
import "../pages/Asistente.css";

function AssistantDrawer({ focus, onClose }) {
  const closeRef = useRef(null);
  const dialogRef = useRef(null);
  const location = useLocation();
  const initialRoute = useRef(`${location.pathname}${location.search}${location.hash}`);
  useEffect(() => {
    const previous = document.activeElement;
    const app = document.getElementById("root");
    const wasInert = app?.inert;
    if (app) app.inert = true;
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const items = [...dialogRef.current.querySelectorAll('a[href], button:not([disabled]), textarea:not([disabled])')];
      if (!items.length) return;
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1).focus(); }
      else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (app) app.inert = wasInert;
      previous?.focus?.();
    };
  }, [onClose]);
  useEffect(() => {
    if (`${location.pathname}${location.search}${location.hash}` !== initialRoute.current) onClose();
  }, [location.pathname, location.search, location.hash, onClose]);

  return createPortal(<div className="assistant-drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} className="assistant-drawer" role="dialog" aria-modal="true" aria-labelledby="assistant-drawer-title">
      <header className="assistant-drawer-header"><div><span><Bot size={20} aria-hidden="true" /> <b id="assistant-drawer-title">Copiloto VERA</b></span><small><ShieldCheck size={13} aria-hidden="true" /> Solo lectura{focus?.title ? ` · ${focus.title}` : ""}</small></div><button ref={closeRef} type="button" onClick={onClose} aria-label="Cerrar asistente"><X size={20} /></button></header>
      <AssistantPanel focus={focus} />
    </section>
  </div>, document.body);
}

export default AssistantDrawer;
