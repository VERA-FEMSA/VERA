import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Bot, Send, ShieldCheck } from "lucide-react";
import Sidebar from "../components/Sidebar";
import { askAssistant, getAssistantStatus } from "../services/assistantService";
import "./Asistente.css";

const SUGGESTIONS = [
  "¿Cuántas auditorías activas puedo ver?",
  "¿Qué riesgos de nivel alto hay en mi alcance?",
  "¿Qué actividades tengo pendientes?",
  "Explícame el flujo de aprobación de una auditoría."
];

function Asistente() {
  const [available, setAvailable] = useState(null);
  const [unavailableReason, setUnavailableReason] = useState(null);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getAssistantStatus()
      .then((status) => { if (active) { setAvailable(status.available); setUnavailableReason(status.reason); } })
      .catch((cause) => { if (active) { setAvailable(false); setError(cause.message); } });
    return () => { active = false; };
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    const value = question.trim();
    if (value.length < 3 || value.length > 800 || busy || !available) return;
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", text: value }]);
    setQuestion("");
    setBusy(true);
    setError("");
    try {
      const result = await askAssistant(value);
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text: result.answer,
        references: result.references || [] }]);
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };

  return <div className="dashboard-layout"><Sidebar active="asistente" /><main className="dashboard-main"><section className="dashboard-content assistant-page">
    <header className="dashboard-header"><div><span className="eyebrow">VERA · ASISTENCIA CONTEXTUAL</span><h1>Asistente de auditoría</h1><p>Consulta auditorías, riesgos, controles, hallazgos y pendientes según tus permisos.</p></div><div className="assistant-readonly"><ShieldCheck size={17} aria-hidden="true" /> Solo lectura</div></header>
    <div className="assistant-layout"><section className="assistant-chat" aria-label="Conversación con el asistente">
      {available === null && <p className="assistant-state" role="status">Comprobando disponibilidad...</p>}
      {available === false && <p className="assistant-state" role="status">{unavailableReason === "persistent-stores-required" ? "El asistente requiere activar primero los almacenes persistentes de cuentas, auditorías y riesgos en este entorno." : "El asistente todavía no está habilitado en este entorno. Un administrador debe configurar el despliegue de Azure OpenAI."}</p>}
      {available && messages.length === 0 && <div className="assistant-welcome"><Bot size={28} aria-hidden="true" /><h2>¿Qué quieres consultar?</h2><p>Respondo con información visible para tu cuenta. Si no hay datos suficientes, te lo indicaré.</p><div className="assistant-suggestions">{SUGGESTIONS.map((item) => <button key={item} type="button" onClick={() => setQuestion(item)}>{item}</button>)}</div></div>}
      <div className="assistant-messages" aria-live="polite">{messages.map((message) => <article key={message.id} className={`assistant-message ${message.role}`}><strong>{message.role === "user" ? "Tú" : "Asistente VERA"}</strong><p>{message.text}</p>{message.references?.length > 0 && <details><summary>Registros relacionados ({message.references.length})</summary><ul>{message.references.map((item) => <li key={`${item.type}:${item.id}`}><Link to={item.path}>{item.type}: {item.title} <ArrowRight size={13} aria-hidden="true" /></Link></li>)}</ul></details>}</article>)}</div>
      {busy && <p className="assistant-state" role="status">Consultando información autorizada...</p>}
      {error && <p className="assistant-error" role="alert">{error}</p>}
      <form className="assistant-form" onSubmit={submit}><label htmlFor="assistant-question">Tu pregunta</label><div><textarea id="assistant-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={800} rows={3} placeholder="Escribe una pregunta sobre VERA..." disabled={!available || busy} /><button type="submit" disabled={!available || busy || question.trim().length < 3} aria-label="Enviar pregunta"><Send size={19} aria-hidden="true" /></button></div><small>{question.length}/800 caracteres · No escribas contraseñas ni claves.</small></form>
    </section><aside className="assistant-about"><h2>Qué puede hacer</h2><p>Resume los datos que tu rol puede consultar y te lleva al módulo relacionado. El chat no modifica registros ni confirma decisiones.</p><h2>Alcance de datos</h2><p>La respuesta depende de los almacenes activos del entorno. En modo demo puede mostrar datos temporales. Comprueba los expedientes antes de tomar decisiones.</p><h2>Privacidad</h2><p>La pregunta y un contexto reducido de registros visibles se envían al despliegue de Azure OpenAI configurado por VERA.</p></aside></div>
  </section></main></div>;
}

export default Asistente;
