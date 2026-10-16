import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Bot, FileText, RotateCcw, Send } from "lucide-react";
import { askAssistant, getAssistantBrief, getAssistantStatus, getAuditDossier } from "../services/assistantService";
import { AssistantConversationContext } from "../contexts/AssistantConversationContext";
import "../pages/Asistente.css";

const promptsByRole = {
  AUDITOR: ["¿Qué auditorías tengo asignadas?", "¿Cuántos riesgos altos tengo?", "¿Qué actividades tengo pendientes?"],
  DIRECTOR: ["¿Qué decisiones del portafolio están pendientes?", "¿Cuántas auditorías activas hay?", "Resume las auditorías activas."],
  SUPER_ADMIN: ["Resume las prioridades del portafolio.", "¿Qué controles necesitan revisión?", "¿Qué propuestas están pendientes?"],
  GERENTE: ["Resume las propuestas abiertas.", "¿Qué riesgos altos hay en el portafolio?", "Prepara un borrador de seguimiento para revisión."],
  JEFATURA: ["¿Qué propuestas esperan revisión?", "Resume los riesgos altos del portafolio.", "Prepara un borrador de propuesta para revisión."]
};

function AssistantPanel({ focus = null }) {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const { conversations, updateConversation } = useContext(AssistantConversationContext);
  const conversationKey = focus ? `${focus.type}:${focus.id}` : "general";
  const messages = conversations[conversationKey] || [];
  const setMessages = (update) => updateConversation(conversationKey, update);
  const [available, setAvailable] = useState(null);
  const [reason, setReason] = useState(null);
  const [brief, setBrief] = useState([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dossier, setDossier] = useState(null);
  const [dossierBusy, setDossierBusy] = useState(false);
  const [dossierError, setDossierError] = useState("");

  useEffect(() => {
    let active = true;
    getAssistantStatus().then((result) => {
      if (active) { setAvailable(result.available); setReason(result.reason); }
    }).catch((cause) => { if (active) { setAvailable(false); setError(cause.message); } });
    getAssistantBrief().then((result) => { if (active) setBrief(result.signals || []); })
      .catch(() => { /* Las prioridades no bloquean las preguntas. */ });
    return () => { active = false; };
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    const value = question.trim();
    if (!available || busy || value.length < 3 || value.length > 800) return;
    const history = messages.slice(-6).map(({ role, text }) => ({ role, text: text.slice(0, 800) }));
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", text: value }]);
    setQuestion(""); setBusy(true); setError("");
    try {
      const result = await askAssistant(value, { history, focus: focus ? { type: focus.type, id: focus.id } : null });
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text: result.answer,
        mode: result.mode, metric: result.metric,
        citations: result.citations || [], references: result.references || [], coverage: result.coverage,
        asOf: result.asOf,
        durationMs: result.durationMs }]);
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };

  const prepareDossier = async () => {
    if (dossierBusy || focus?.type !== "audit") return;
    setDossierBusy(true); setDossierError("");
    try { setDossier(await getAuditDossier(focus.id)); }
    catch (cause) { setDossierError(cause.message); }
    finally { setDossierBusy(false); }
  };

  const prompts = focus
    ? [`Resume este ${focus.type === "audit" ? "expediente de auditoría" : focus.type === "risk" ? "riesgo" : "registro"} y sus relaciones.`,
      ...(focus.type === "risk" ? ["¿Cuál es el nivel y el puntaje de este riesgo?"] : []),
      "¿Qué requiere atención en este expediente?", "Prepara un borrador de próximos pasos para revisión."]
    : promptsByRole[user?.role] || ["Resume mis pendientes."];

  return <section className="assistant-chat" aria-label="Conversación con el asistente">
    {focus && <div className="assistant-focus"><b>Expediente en contexto</b><span>{focus.title || focus.id}</span><small>La respuesta usará solo los registros que tu cuenta puede consultar.</small></div>}
    {focus?.type === "audit" && <section className="assistant-dossier" aria-label="Briefing de auditoría">
      <div className="assistant-dossier-header"><div><h2>Briefing del expediente</h2><p>Estado y relaciones calculados desde registros visibles.</p></div>
        <button type="button" onClick={prepareDossier} disabled={dossierBusy || reason === "persistent-stores-required"}><FileText size={15} aria-hidden="true" /> {dossierBusy ? "Preparando..." : dossier ? "Actualizar briefing" : "Preparar briefing"}</button></div>
      {dossierError && <p className="assistant-error" role="alert">{dossierError}</p>}
      {dossier && <div className="assistant-dossier-result"><p><Link to={dossier.audit.path}><b>{dossier.audit.title}</b> <ArrowRight size={13} aria-hidden="true" /></Link></p>
        <small>{dossier.audit.facts?.map((fact) => `${fact.label}: ${fact.value}`).join(" · ")} · Datos consultados: {new Date(dossier.asOf).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}</small>
        <div className="assistant-dossier-sections">{dossier.sections.map((item) => <section key={item.key}><h3>{item.label} <span>{item.total}</span></h3>
          {item.items.length ? <ul>{item.items.map((record) => <li key={record.sourceId}><Link to={record.path}>{record.title} <ArrowRight size={12} aria-hidden="true" /></Link><small>{record.facts?.map((fact) => `${fact.label}: ${fact.value}`).join(" · ")}</small></li>)}</ul> : <p>Sin registros vinculados visibles.</p>}
          {item.shown < item.total && <small>Se muestran {item.shown} de {item.total}; abre el módulo para revisar el resto.</small>}</section>)}</div>
        {dossier.suggestion && <div className="assistant-dossier-suggestion"><b>Siguiente paso sugerido por IA · requiere revisión</b><p>{dossier.suggestion.text}</p><ul>{dossier.suggestion.citations.map((item) => <li key={item.sourceId}><Link to={item.path}>{item.type}: {item.title} <ArrowRight size={12} aria-hidden="true" /></Link></li>)}</ul></div>}
        {!dossier.suggestion && <small>Sin sugerencia de IA con fuente verificable. Los datos calculados siguen disponibles.</small>}
      </div>}
    </section>}
    {available === null && <p className="assistant-state" role="status">Comprobando disponibilidad...</p>}
    {available === false && <p className="assistant-state" role="status">{reason === "persistent-stores-required"
      ? "El asistente requiere activar los almacenes persistentes de cuentas, auditorías y riesgos en este entorno."
      : "El asistente todavía no está habilitado en este entorno. Un administrador debe configurar Azure OpenAI."}</p>}
    {available && messages.length === 0 && <div className="assistant-welcome"><Bot size={28} aria-hidden="true" />
      <h2>{focus ? "Analiza este expediente" : "¿Qué quieres consultar?"}</h2>
      <p>Respondo con datos visibles para tu cuenta. Comprueba las fuentes antes de tomar una decisión.</p>
      <div className="assistant-suggestions">{prompts.map((item) => <button key={item} type="button" onClick={() => setQuestion(item)}>{item}</button>)}</div>
      {!focus && brief.length > 0 && <section className="assistant-brief" aria-label="Prioridades actuales"><h3>Señales del portafolio</h3><p>Conteos calculados con registros visibles, sin generación de IA.</p><div>{brief.map((item) => <Link key={item.key} to={item.path}><strong>{item.count}</strong><span>{item.label}</span><ArrowRight size={14} aria-hidden="true" /></Link>)}</div></section>}
    </div>}
    <div className="assistant-messages" aria-live="polite">{messages.map((message) => <article key={message.id} className={`assistant-message ${message.role}`}>
      <strong>{message.role === "user" ? "Tú" : "Asistente VERA"}</strong><p>{message.text}</p>
      {message.role === "assistant" && <><small className="assistant-answer-note">{message.mode === "computed" ? "Dato calculado desde registros autorizados" : "Respuesta generada · comprueba el expediente"}{Number.isFinite(message.durationMs) ? ` · ${(message.durationMs / 1000).toFixed(1)} s` : ""}</small>
        {message.asOf && <time className="assistant-answer-note" dateTime={message.asOf}>Datos consultados: {new Date(message.asOf).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}</time>}
        {message.mode !== "computed" && message.coverage?.partial && <small className="assistant-answer-note">Se consultó una muestra de expedientes visibles; los conteos abarcan el total de tu alcance.</small>}
        {message.metric && <div className="assistant-citations"><b>Indicador calculado</b><ul><li><Link to={message.metric.path}>{message.metric.label}: {message.metric.count} <ArrowRight size={13} aria-hidden="true" /></Link></li></ul></div>}
        {message.citations?.length > 0 && <div className="assistant-citations"><b>Registros citados</b><small>Campos consultados al responder; abre el expediente para ver su estado actual.</small><ul>{message.citations.map((item) => <li key={item.sourceId}><Link to={item.path}>{item.type}: {item.title} <ArrowRight size={13} aria-hidden="true" /></Link>{item.facts?.length > 0 && <span className="assistant-source-facts">{item.facts.map((fact) => `${fact.label}: ${fact.value}`).join(" · ")}</span>}</li>)}</ul></div>}
        {message.citations?.length === 0 && message.mode !== "computed" && <small className="assistant-answer-note">Sin registros citados en esta respuesta.</small>}
        {message.references?.length > 0 && <details><summary>Registros relacionados ({message.references.length})</summary><ul>{message.references.map((item) => <li key={item.sourceId || `${item.type}:${item.id}`}><Link to={item.path}>{item.type}: {item.title} <ArrowRight size={13} aria-hidden="true" /></Link></li>)}</ul></details>}
      </>}</article>)}</div>
    {busy && <p className="assistant-state" role="status">Consultando información autorizada...</p>}
    {error && <p className="assistant-error" role="alert">{error}</p>}
    {messages.length > 0 && <button className="assistant-clear" type="button" onClick={() => { setMessages([]); setError(""); }}><RotateCcw size={14} aria-hidden="true" /> Nueva conversación</button>}
    <form className="assistant-form" onSubmit={submit}><label htmlFor="assistant-question">Tu pregunta</label><div><textarea id="assistant-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={800} rows={3} placeholder="Escribe una pregunta sobre VERA..." disabled={!available || busy} /><button type="submit" disabled={!available || busy || question.trim().length < 3} aria-label="Enviar pregunta"><Send size={19} aria-hidden="true" /></button></div><small>{question.length}/800 caracteres · No escribas contraseñas ni claves.</small></form>
  </section>;
}

export default AssistantPanel;
