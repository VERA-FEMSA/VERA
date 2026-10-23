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
    <header className="dashboard-header"><div><span className="eyebrow">VERA · ESPACIO DE IA</span><h1>Asistente de auditoría</h1><p>Consulta auditorías, riesgos, controles, hallazgos y pendientes según tus permisos.</p></div><div className="assistant-readonly"><ShieldCheck size={17} aria-hidden="true" /> Solo lectura</div></header>
    <div className="assistant-layout"><AssistantPanel key={focus ? `${focus.type}:${focus.id}` : "general"} focus={focus} /></div>
    <details className="assistant-page-about"><summary>Alcance y privacidad del asistente</summary><p>Resume expedientes visibles, muestra fuentes citadas y prepara borradores para revisión humana. No modifica registros ni confirma decisiones. Las señales se calculan desde los almacenes activos. La pregunta, el historial reciente y un contexto reducido de registros visibles se envían al despliegue de Azure OpenAI de VERA. Comprueba siempre las fuentes antes de actuar.</p></details>
  </section></main></div>;
}

export default Asistente;
