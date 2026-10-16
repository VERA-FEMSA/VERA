import { useSearchParams } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import Sidebar from "../components/Sidebar";
import AssistantPanel from "../components/AssistantPanel";
import "./Asistente.css";

function Asistente() {
  const [params] = useSearchParams();
  const type = params.get("type");
  const id = params.get("id");
  const focus = type && id ? { type, id, title: id } : null;
  return <div className="dashboard-layout"><Sidebar active="asistente" /><main className="dashboard-main"><section className="dashboard-content assistant-page">
    <header className="dashboard-header"><div><span className="eyebrow">VERA · COPILOTO CONTEXTUAL</span><h1>Asistente de auditoría</h1><p>Consulta auditorías, riesgos, controles, hallazgos y pendientes según tus permisos.</p></div><div className="assistant-readonly"><ShieldCheck size={17} aria-hidden="true" /> Solo lectura</div></header>
    <div className="assistant-layout"><AssistantPanel key={focus ? `${focus.type}:${focus.id}` : "general"} focus={focus} /><aside className="assistant-about"><h2>Qué puede hacer</h2><p>Resume expedientes visibles, muestra fuentes citadas y prepara borradores para revisión humana. No modifica registros ni confirma decisiones.</p><h2>Alcance de datos</h2><p>Las señales se calculan con los almacenes activos. Comprueba siempre los expedientes antes de actuar.</p><h2>Privacidad</h2><p>La pregunta, el historial reciente de esta sesión y un contexto reducido de registros visibles se envían al despliegue de Azure OpenAI de VERA.</p></aside></div>
  </section></main></div>;
}

export default Asistente;
