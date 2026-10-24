import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Bot, X } from "lucide-react";
import { askEvidenceFile, indexEvidenceImage } from "../services/evidenceService";

function EvidenceAssistantDialog({ evidence, onClose }) {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const isImage = ["image/png", "image/jpeg", "image/webp"].includes(evidence.file?.mime);
  const canIndex = isImage && ["SUPER_ADMIN", "GERENTE", "AUDITOR", "JEFATURA"].includes(user?.role);
  const input = useRef(null);
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ocrResult, setOcrResult] = useState(null);

  useEffect(() => {
    input.current?.focus();
    const onKeyDown = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const submit = async (event) => {
    event.preventDefault();
    const value = question.trim();
    if (busy || value.length < 3 || value.length > 500) return;
    setBusy(true); setError(""); setResult(null);
    try { setResult(await askEvidenceFile(evidence.id, value)); }
    catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };

  const indexImage = async () => {
    if (!canIndex || busy) return;
    setBusy(true); setError("");
    try { setOcrResult(await indexEvidenceImage(evidence.id)); }
    catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };

  return <div className="modal-backdrop evidence-ai-backdrop" role="presentation" onMouseDown={(event) => {
    if (event.target === event.currentTarget) onClose();
  }}><section className="proposal-modal evidence-ai-modal" role="dialog" aria-modal="true" aria-labelledby="evidence-ai-title">
    <header className="modal-header"><div><span className="eyebrow"><Bot size={15} aria-hidden="true" /> CONSULTA DE EVIDENCIA</span>
      <h2 id="evidence-ai-title">Preguntar sobre {evidence.title}</h2>
      <p>VERA busca fragmentos de este archivo privado y muestra las fuentes que respaldan la respuesta.</p></div>
      <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar consulta de evidencia"><X size={20} /></button></header>
    {isImage && <div className="evidence-ai-ocr"><p>La extracción de texto es opcional: al pulsar el botón, VERA envía esta imagen privada al recurso Azure OpenAI configurado. Comprueba siempre el texto contra la imagen original.</p>
      {canIndex && <button type="button" className="secondary-action" onClick={indexImage} disabled={busy}>{busy ? "Extrayendo..." : "Extraer texto de imagen con IA"}</button>}
      {!canIndex && <small>Tu rol puede consultar una imagen ya indexada, pero no iniciar la extracción.</small>}
      {ocrResult && <small role="status">{ocrResult.status === "ready" ? `${ocrResult.chunks} ${ocrResult.chunks === 1 ? "fragmento" : "fragmentos"} de imagen ${ocrResult.chunks === 1 ? "disponible" : "disponibles"} para consulta.${ocrResult.truncated ? " El texto fue recortado." : ""}` : "No se identificó texto legible en la imagen."}</small>}</div>}
    <form onSubmit={submit}><label htmlFor="evidence-ai-question">Pregunta sobre el contenido</label>
      <textarea ref={input} id="evidence-ai-question" value={question} onChange={(event) => setQuestion(event.target.value)}
        rows={3} maxLength={500} placeholder="¿Qué hallazgos menciona el informe?" />
      <div className="modal-actions"><span>{question.length}/500 caracteres</span><button className="primary-action" type="submit" disabled={busy || question.trim().length < 3}>{busy ? "Consultando..." : "Consultar archivo"}</button></div></form>
    {error && <p className="evidence-feedback error" role="alert">{error}</p>}
    {result && <section className="evidence-ai-result" aria-label="Respuesta sobre evidencia"><h3>Respuesta {result.mode === "generated" ? "con fragmentos citados" : "sin contenido suficiente"}</h3>
      <p>{result.answer}</p>
      <small>Datos consultados: {new Date(result.asOf).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}
        {Number.isFinite(result.durationMs) ? ` · ${(result.durationMs / 1000).toFixed(1)} s` : ""}</small>
      {result.coverage?.partial && <small>Se usaron {result.coverage.includedChunks} de {result.coverage.indexedChunks} fragmentos indexados; no representa el archivo completo.</small>}
      {result.coverage?.indexStatusUnavailable && <small>El estado de lectura no pudo guardarse; comprueba el original antes de reutilizar esta respuesta.</small>}
      {result.citations?.length > 0 && <div className="evidence-ai-citations"><b>Fragmentos citados</b><ul>{result.citations.map((item) => <li key={item.sourceId}>
        <Link to={item.path} onClick={onClose}>{item.title}{item.pageNumber ? ` · página ${item.pageNumber}` : ""} <ArrowRight size={13} aria-hidden="true" /></Link>
        <blockquote>{item.excerpt}</blockquote></li>)}</ul></div>}
    </section>}
    <p className="evidence-ai-note">La respuesta es un borrador de IA. Comprueba el archivo original antes de decidir. Los PDF escaneados aún requieren OCR de páginas.</p>
  </section></div>;
}

export default EvidenceAssistantDialog;
