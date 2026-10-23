import { useContext, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Bot, FileText, Pencil, RotateCcw, Send, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import { askAssistant, askAssistantConversation, createAssistantConversation, createAssistantProject, deleteAssistantAttachment, deleteAssistantConversation, deleteAssistantProject, deleteAssistantProjectFile, getAssistantAttachmentDownload, getAssistantBrief, getAssistantConversation, getAssistantInsights, getAssistantProjectFileDownload, getAssistantStatus, getAuditDossier, getProposalDraft, listAssistantAttachments, listAssistantConversations, listAssistantProjectFiles, listAssistantProjects, moveAssistantConversation, renameAssistantConversation, searchAssistantEvidence, submitAssistantFeedback, updateAssistantProject, uploadAssistantAttachment, uploadAssistantProjectFile } from "../services/assistantService";
import { AssistantConversationContext } from "../contexts/AssistantConversationContext";
import AssistantMemoryPanel from "./AssistantMemoryPanel";
import "../pages/Asistente.css";

const promptsByRole = {
  AUDITOR: ["¿Qué auditorías tengo asignadas?", "¿Cuántos riesgos altos tengo?", "¿Qué actividades tengo pendientes?"],
  DIRECTOR: ["¿Qué actividades del portafolio requieren seguimiento?", "¿Cuántas auditorías activas hay?", "Resume las auditorías activas."],
  SUPER_ADMIN: ["Resume las prioridades del portafolio.", "¿Qué controles necesitan revisión?", "¿Qué propuestas están pendientes?"],
  GERENTE: ["Resume las propuestas abiertas.", "¿Qué riesgos altos hay en el portafolio?", "Prepara un borrador de seguimiento para revisión."],
  JEFATURA: ["¿Qué propuestas esperan revisión?", "Resume los riesgos altos del portafolio.", "Prepara un borrador de propuesta para revisión."]
};
const PROJECT_LIBRARY = "__project_library__";

function AssistantPanel({ focus = null }) {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const canDraftProposal = ["SUPER_ADMIN", "GERENTE", "JEFATURA"].includes(user?.role);
  const focused = Boolean(focus);
  const focusType = focus?.type;
  const focusId = focus?.id;
  const { conversations, updateConversation } = useContext(AssistantConversationContext);
  const conversationKey = focus ? `${focus.type}:${focus.id}` : "general";
  const messages = conversations[conversationKey] || [];
  const setMessages = (update) => updateConversation(conversationKey, update);
  const [available, setAvailable] = useState(null);
  const [reason, setReason] = useState(null);
  const [brief, setBrief] = useState([]);
  const [insights, setInsights] = useState(null);
  const [question, setQuestion] = useState("");
  const [withEvidence, setWithEvidence] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dossier, setDossier] = useState(null);
  const [dossierBusy, setDossierBusy] = useState(false);
  const [dossierError, setDossierError] = useState("");
  const [proposalDraft, setProposalDraft] = useState(null);
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [feedbackBusyId, setFeedbackBusyId] = useState(null);
  const [persistent, setPersistent] = useState(false);
  const [threadList, setThreadList] = useState([]);
  const [thread, setThread] = useState(null);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyStale, setHistoryStale] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [threadQuery, setThreadQuery] = useState("");
  const [exportBusy, setExportBusy] = useState(false);
  const [projectMode, setProjectMode] = useState(false);
  const [memoryMode, setMemoryMode] = useState(false);
  const [attachmentMode, setAttachmentMode] = useState(false);
  const [projectFilesMode, setProjectFilesMode] = useState(false);
  const [projectKnowledgeMode, setProjectKnowledgeMode] = useState(false);
  const [attachmentList, setAttachmentList] = useState([]);
  const [projectFiles, setProjectFiles] = useState([]);
  const [selectedAttachmentId, setSelectedAttachmentId] = useState(null);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [attachmentError, setAttachmentError] = useState("");
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [projectForm, setProjectForm] = useState(null);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectInstructions, setProjectInstructions] = useState("");
  const [confirmDeleteProject, setConfirmDeleteProject] = useState(false);

  useEffect(() => {
    let active = true;
    getAssistantStatus().then((result) => {
      if (active) { setAvailable(result.available); setReason(result.reason);
        setPersistent(Boolean(result.conversations)); setHistoryBusy(Boolean(result.conversations));
        setProjectMode(Boolean(result.projects)); setMemoryMode(Boolean(result.memory));
        setAttachmentMode(Boolean(result.attachments)); setProjectFilesMode(Boolean(result.projectFiles));
        setProjectKnowledgeMode(Boolean(result.projectKnowledge)); }
    }).catch((cause) => { if (active) { setAvailable(false); setError(cause.message); } });
    getAssistantBrief().then((result) => { if (active) setBrief(result.signals || []); })
      .catch(() => { /* Las prioridades no bloquean las preguntas. */ });
    if (!focused) getAssistantInsights().then((result) => { if (active) setInsights(result); })
      .catch(() => { /* Las prioridades no bloquean las preguntas. */ });
    return () => { active = false; };
  }, [focused]);

  useEffect(() => {
    if (!persistent) return undefined;
    let active = true;
    Promise.all([listAssistantConversations(), projectMode ? listAssistantProjects() : Promise.resolve([])])
      .then(async ([items, folders]) => {
      if (!active) return;
      setProjects(folders);
      const scoped = items.filter((item) => focusType
        ? item.focus?.type === focusType && item.focus?.id === focusId : !item.focus);
      setThreadList(scoped);
      const first = scoped.find((item) => !projectMode || !item.projectId);
      if (!first) { setThread(null); updateConversation(conversationKey, []); return; }
      const opened = await getAssistantConversation(first.id);
      if (!active) return;
      setThread(opened); setHistoryStale(Boolean(opened.stale));
      updateConversation(conversationKey, opened.messages || []);
    }).catch((cause) => { if (active) setHistoryError(cause.message); })
      .finally(() => { if (active) setHistoryBusy(false); });
    return () => { active = false; };
  }, [persistent, projectMode, conversationKey, updateConversation, focusType, focusId]);

  useEffect(() => {
    if (attachmentBusy) return undefined;
    if (!attachmentMode || !thread?.id) return undefined;
    let active = true;
    listAssistantAttachments(thread.id).then((items) => { if (active) setAttachmentList(items); })
      .catch((cause) => { if (active) setAttachmentError(cause.message); });
    return () => { active = false; };
  }, [attachmentMode, thread?.id, attachmentBusy]);

  useEffect(() => {
    if (attachmentBusy) return undefined;
    if (!projectFilesMode || !selectedProjectId) return undefined;
    let active = true;
    listAssistantProjectFiles(selectedProjectId).then((items) => { if (active) setProjectFiles(items); })
      .catch((cause) => { if (active) setAttachmentError(cause.message); });
    return () => { active = false; };
  }, [projectFilesMode, selectedProjectId, attachmentBusy]);

  const projectThreads = projectMode
    ? threadList.filter((item) => (item.projectId || null) === selectedProjectId) : threadList;
  const normalizedQuery = threadQuery.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
  const visibleThreads = normalizedQuery ? projectThreads.filter((item) =>
    item.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").includes(normalizedQuery))
    : projectThreads;
  const visibleAttachments = [...(thread ? attachmentList : []), ...projectFiles];

  const chooseProject = async (id) => {
    const projectId = id || null;
    setSelectedProjectId(projectId); setProjectFiles([]); setProjectForm(null); setConfirmDeleteProject(false); setThreadQuery("");
    setThread(null); setMessages([]); setHistoryStale(false); setSelectedAttachmentId(null);
    const first = threadList.find((item) => (item.projectId || null) === projectId);
    if (first) await openThread(first.id);
  };

  const saveProject = async (event) => {
    event.preventDefault();
    if (!projectName.trim() || historyBusy) return;
    setHistoryBusy(true); setHistoryError("");
    try {
      const saved = projectForm === "new"
        ? await createAssistantProject(projectName.trim(), projectDescription.trim(), projectInstructions.trim())
        : await updateAssistantProject(projectForm.id, projectName.trim(), projectDescription.trim(),
          projectInstructions.trim(), projectForm.version);
      setProjects((items) => projectForm === "new" ? [saved, ...items]
        : items.map((item) => item.id === saved.id ? saved : item));
      if (projectForm === "new") { setSelectedProjectId(saved.id); setProjectFiles([]); setThreadQuery(""); setThread(null); setMessages([]); setSelectedAttachmentId(null); }
      setProjectForm(null); setProjectName(""); setProjectDescription(""); setProjectInstructions("");
    } catch (cause) { setHistoryError(cause.message); }
    finally { setHistoryBusy(false); }
  };

  const removeProject = async () => {
    if (!selectedProjectId || historyBusy) return;
    setHistoryBusy(true); setHistoryError("");
    try {
      await deleteAssistantProject(selectedProjectId);
      setProjects((items) => items.filter((item) => item.id !== selectedProjectId));
      const items = await listAssistantConversations();
      setThreadList(items.filter((item) => focusType
        ? item.focus?.type === focusType && item.focus?.id === focusId : !item.focus));
      setSelectedProjectId(null); setProjectFiles([]); setThreadQuery(""); setThread(null); setMessages([]); setHistoryStale(false); setSelectedAttachmentId(null);
      setConfirmDeleteProject(false);
    } catch (cause) { setHistoryError(cause.message); }
    finally { setHistoryBusy(false); }
  };

  const moveThread = async (event) => {
    if (!thread || historyBusy) return;
    setHistoryBusy(true); setHistoryError("");
    try {
      const updated = await moveAssistantConversation(thread.id, event.target.value || null, thread.version);
      setThread(null); setMessages([]); setSelectedAttachmentId(null);
      setThreadList((items) => items.map((item) => item.id === updated.id ? updated : item));
    } catch (cause) { setHistoryError(cause.message); }
    finally { setHistoryBusy(false); }
  };

  const openThread = async (id) => {
    setSelectedAttachmentId(null); setAttachmentList([]);
    setHistoryBusy(true); setHistoryError(""); setConfirmDelete(false); setEditingTitle(false);
    try {
      const opened = await getAssistantConversation(id);
      setThread(opened); setHistoryStale(Boolean(opened.stale));
      setMessages(opened.messages || []);
    } catch (cause) { setHistoryError(cause.message); }
    finally { setHistoryBusy(false); }
  };

  const newThread = async () => {
    if (historyBusy || busy) return;
    setSelectedAttachmentId(null);
    setHistoryBusy(true); setHistoryError(""); setConfirmDelete(false); setEditingTitle(false);
    try {
      const created = await createAssistantConversation(focus ? { type: focus.type, id: focus.id } : null,
        selectedProjectId);
      setThreadQuery(""); setThread(created); setThreadList((items) => [created, ...items]);
      setHistoryStale(false); setMessages([]); setError("");
    } catch (cause) { setHistoryError(cause.message); }
    finally { setHistoryBusy(false); }
  };

  const renameThread = async (event) => {
    event.preventDefault();
    if (!thread || !draftTitle.trim() || historyBusy) return;
    setHistoryBusy(true); setHistoryError("");
    try {
      const updated = await renameAssistantConversation(thread.id, draftTitle.trim(), thread.version);
      setThread((item) => ({ ...item, ...updated }));
      setThreadList((items) => items.map((item) => item.id === updated.id ? updated : item));
      setEditingTitle(false);
    } catch (cause) { setHistoryError(cause.message); }
    finally { setHistoryBusy(false); }
  };

  const removeThread = async () => {
    if (!thread || historyBusy) return;
    setHistoryBusy(true); setHistoryError("");
    try {
      await deleteAssistantConversation(thread.id);
      setThreadList((items) => items.filter((item) => item.id !== thread.id));
      setThread(null); setMessages([]); setHistoryStale(false); setConfirmDelete(false); setSelectedAttachmentId(null);
    } catch (cause) { setHistoryError(cause.message); }
    finally { setHistoryBusy(false); }
  };

  const exportThread = async () => {
    if (!thread || historyBusy || busy || exportBusy || historyStale) return;
    setExportBusy(true); setHistoryError("");
    try {
      // Refresh ownership and scope immediately before disclosing a local copy.
      const current = await getAssistantConversation(thread.id);
      if (current.stale) {
        setHistoryStale(true); setMessages([]);
        setHistoryError("Cambió tu alcance de datos. Inicia una conversación nueva.");
        return;
      }
      const copy = {
        format: "vera-ai-conversation-v1", exportedAt: new Date().toISOString(),
        conversation: { id: current.id, title: current.title, focus: current.focus,
          projectId: current.projectId, createdAt: current.createdAt, updatedAt: current.updatedAt },
        messages: (current.messages || []).map((message) => ({
          role: message.role, text: message.text, asOf: message.asOf,
          ...(message.role === "user" ? { attachmentName: message.attachmentName || null } : {
            mode: message.mode, metric: message.metric, citations: message.citations || [],
            references: message.references || [], coverage: message.coverage || null,
            durationMs: message.durationMs
          })
        }))
      };
      const url = URL.createObjectURL(new Blob([JSON.stringify(copy, null, 2)],
        { type: "application/json;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url; link.download = `vera-conversacion-${current.id}.json`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) { setHistoryError(cause.message); }
    finally { setExportBusy(false); }
  };

  const uploadFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || attachmentBusy || historyBusy || busy) return;
    if (file.size > 2 * 1024 * 1024 || file.size === 0) {
      setAttachmentError("El archivo debe tener entre 1 byte y 2 MB."); return;
    }
    setAttachmentBusy(true); setAttachmentError("");
    try {
      const active = thread || await createAssistantConversation(focus ? { type: focus.type, id: focus.id } : null,
        selectedProjectId);
      if (!thread) { setThread(active); setThreadList((items) => [active, ...items]); setMessages([]); }
      const attached = await uploadAssistantAttachment(active.id, file);
      setAttachmentList((items) => [attached, ...items]);
      setSelectedAttachmentId(attached.id); setWithEvidence(false);
    } catch (cause) { setAttachmentError(cause.message); }
    finally { setAttachmentBusy(false); }
  };

  const uploadProjectFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selectedProjectId || attachmentBusy || historyBusy || busy) return;
    if (file.size > 2 * 1024 * 1024 || file.size === 0) {
      setAttachmentError("El archivo debe tener entre 1 byte y 2 MB."); return;
    }
    setAttachmentBusy(true); setAttachmentError("");
    try {
      const saved = await uploadAssistantProjectFile(selectedProjectId, file);
      setProjectFiles((items) => [saved, ...items]); setSelectedAttachmentId(saved.id); setWithEvidence(false);
    } catch (cause) { setAttachmentError(cause.message); }
    finally { setAttachmentBusy(false); }
  };

  const downloadFile = async (attachmentId, projectIdOverride = null) => {
    setAttachmentError("");
    try {
      const projectId = projectIdOverride || projectFiles.find((item) => item.id === attachmentId)?.projectId;
      if (!projectId && !thread) return;
      const url = projectId ? await getAssistantProjectFileDownload(projectId, attachmentId)
        : await getAssistantAttachmentDownload(thread.id, attachmentId);
      const link = document.createElement("a");
      link.href = url; link.target = "_blank"; link.rel = "noopener noreferrer";
      document.body.appendChild(link); link.click(); link.remove();
    } catch (cause) { setAttachmentError(cause.message); }
  };

  const removeFile = async (attachmentId) => {
    if (attachmentBusy) return;
    setAttachmentBusy(true); setAttachmentError("");
    try {
      const projectId = projectFiles.find((item) => item.id === attachmentId)?.projectId;
      if (projectId) {
        await deleteAssistantProjectFile(projectId, attachmentId);
        setProjectFiles((items) => items.filter((item) => item.id !== attachmentId));
      } else if (thread) {
        await deleteAssistantAttachment(thread.id, attachmentId);
        setAttachmentList((items) => items.filter((item) => item.id !== attachmentId));
      }
      if (selectedAttachmentId === attachmentId) setSelectedAttachmentId(null);
    } catch (cause) { setAttachmentError(cause.message); }
    finally { setAttachmentBusy(false); }
  };

  const submit = async (event) => {
    event.preventDefault();
    const value = question.trim();
    if (!available || busy || historyBusy || historyError || historyStale ||
        value.length < 3 || value.length > (withEvidence ? 500 : 800)) return;
    const history = messages.slice(-6).map(({ role, text }) => ({ role, text: text.slice(0, 800) }));
    if (!persistent) setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", text: value }]);
    setQuestion(""); setBusy(true); setError("");
    try {
      const selectedFocus = focus ? { type: focus.type, id: focus.id } : null;
      if (persistent) {
        const active = thread || await createAssistantConversation(selectedFocus, selectedProjectId);
        if (!thread) { setThread(active); setThreadList((items) => [active, ...items]); }
        const saved = await askAssistantConversation(active.id, value, withEvidence,
          selectedAttachmentId === PROJECT_LIBRARY ? null : selectedAttachmentId,
          selectedAttachmentId === PROJECT_LIBRARY);
        setMessages((current) => [...current, saved.userMessage, saved.message]);
        setThread((item) => ({ ...item, version: saved.version, updatedAt: new Date().toISOString() }));
        return;
      }
      const result = withEvidence
        ? await searchAssistantEvidence(value, selectedFocus)
        : await askAssistant(value, { history, focus: selectedFocus });
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text: result.answer,
        mode: result.mode, metric: result.metric,
        citations: result.citations || [], references: result.references || [], coverage: result.coverage,
        asOf: result.asOf,
        durationMs: result.durationMs, feedbackToken: result.feedbackToken || null }]);
    } catch (cause) { setError(cause.message); if (persistent) setQuestion(value); }
    finally { setBusy(false); }
  };

  const prepareDossier = async () => {
    if (dossierBusy || focus?.type !== "audit") return;
    setDossierBusy(true); setDossierError("");
    try { setDossier(await getAuditDossier(focus.id)); }
    catch (cause) { setDossierError(cause.message); }
    finally { setDossierBusy(false); }
  };

  const prepareProposalDraft = async () => {
    if (!canDraftProposal || focus?.type !== "risk" || draftBusy) return;
    setDraftBusy(true); setDraftError("");
    try { setProposalDraft(await getProposalDraft(focus.id)); }
    catch (cause) { setDraftError(cause.message); }
    finally { setDraftBusy(false); }
  };

  const useProposalDraft = () => {
    if (!proposalDraft?.reviewRequired || !canDraftProposal) return;
    sessionStorage.setItem("vera:proposal-draft", JSON.stringify({ userId: user.id,
      expiresAt: Date.now() + 10 * 60 * 1000, draft: proposalDraft.draft }));
    navigate("/planificacion");
  };

  const rateResponse = async (message, rating) => {
    if (!message.feedbackToken || message.feedbackRating || feedbackBusyId) return;
    setFeedbackBusyId(message.id); setError("");
    try {
      await submitAssistantFeedback(message.feedbackToken, rating);
      setMessages((current) => current.map((item) => item.id === message.id
        ? { ...item, feedbackRating: rating, feedbackToken: null } : item));
    } catch (cause) { setError(cause.message); }
    finally { setFeedbackBusyId(null); }
  };

  const prompts = focus
    ? [`Resume este ${focus.type === "audit" ? "expediente de auditoría" : focus.type === "risk" ? "riesgo" : "registro"} y sus relaciones.`,
      ...(focus.type === "risk" ? ["¿Cuál es el nivel y el puntaje de este riesgo?"] : []),
      "¿Qué requiere atención en este expediente?", "Prepara un borrador de próximos pasos para revisión."]
    : promptsByRole[user?.role] || ["Resume mis pendientes."];

  return <section className="assistant-chat" aria-label="Conversación con el asistente">
    {persistent && <div className="assistant-history" aria-label="Historial privado">
      {memoryMode && <AssistantMemoryPanel />}
      {projectMode && <div className="assistant-projects" aria-label="Proyectos privados">
        <div className="assistant-history-main"><label htmlFor="assistant-project">Proyecto</label>
          <select id="assistant-project" value={selectedProjectId || ""} disabled={historyBusy || busy}
            onChange={(event) => chooseProject(event.target.value)}>
            <option value="">Sin proyecto</option>
            {projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <button type="button" disabled={historyBusy || busy} onClick={() => {
            setProjectForm("new"); setProjectName(""); setProjectDescription(""); setProjectInstructions("");
          }}>Nuevo proyecto</button></div>
        {selectedProjectId && <div className="assistant-history-actions">
          <button type="button" disabled={historyBusy || busy} onClick={() => {
            const current = projects.find((item) => item.id === selectedProjectId);
            if (!current) return;
            setProjectForm(current); setProjectName(current.name); setProjectDescription(current.description);
            setProjectInstructions(current.instructions || "");
          }}>Editar proyecto</button>
          <button type="button" disabled={historyBusy || busy} onClick={() => setConfirmDeleteProject(true)}>Eliminar proyecto</button>
        </div>}
        {projectForm && <form className="assistant-history-edit" onSubmit={saveProject}>
          <label htmlFor="assistant-project-name">Nombre del proyecto</label>
          <input id="assistant-project-name" value={projectName} maxLength={80}
            onChange={(event) => setProjectName(event.target.value)} required />
          <label htmlFor="assistant-project-description">Descripción opcional</label>
          <textarea id="assistant-project-description" value={projectDescription} maxLength={500} rows={2}
            onChange={(event) => setProjectDescription(event.target.value)} />
          <label htmlFor="assistant-project-instructions">Preferencias para respuestas de este proyecto (opcional)</label>
          <textarea id="assistant-project-instructions" value={projectInstructions} maxLength={800} rows={3}
            onChange={(event) => setProjectInstructions(event.target.value)} />
          <small>Solo formato o enfoque. No añadas hechos, permisos ni claves; los expedientes autorizados siguen siendo la fuente.</small>
          <button type="submit" disabled={!projectName.trim() || historyBusy}>Guardar proyecto</button>
          <button type="button" onClick={() => setProjectForm(null)}>Cancelar</button>
        </form>}
        {confirmDeleteProject && <div className="assistant-history-confirm" role="group" aria-label="Confirmar eliminación del proyecto">
          <span>Las conversaciones se conservarán sin proyecto. Sus archivos privados se eliminarán. ¿Eliminar esta carpeta?</span>
          <button type="button" onClick={removeProject}>Sí, eliminar proyecto</button>
          <button type="button" onClick={() => setConfirmDeleteProject(false)}>Cancelar</button>
        </div>}
        {projectFilesMode && selectedProjectId && <section className="assistant-attachments" aria-label="Biblioteca privada del proyecto">
          <label htmlFor="assistant-project-file">Archivos del proyecto</label>
          <input id="assistant-project-file" type="file" accept=".pdf,.docx,.txt,.csv,.png,.jpg,.jpeg,.webp"
            disabled={historyBusy || busy || attachmentBusy || projectFiles.length >= 4}
            onChange={uploadProjectFile} />
          <small>{projectFiles.length}/4 archivos · 2 MB por archivo. Disponibles para consultar desde los chats de este proyecto; no se envían a la IA hasta que eliges uno y preguntas.</small>
        </section>}
      </div>}
      <div className="assistant-history-main"><label htmlFor="assistant-thread-query">Buscar conversaciones por título</label>
        <input id="assistant-thread-query" type="search" value={threadQuery} maxLength={80}
          onChange={(event) => setThreadQuery(event.target.value)} placeholder="Buscar en este proyecto" />
        <small role="status">{visibleThreads.length} de {projectThreads.length} conversaciones</small></div>
      <div className="assistant-history-main"><label htmlFor="assistant-thread">Conversaciones privadas</label>
        <select id="assistant-thread" value={visibleThreads.some((item) => item.id === thread?.id) ? thread.id : ""}
          disabled={historyBusy || busy || !visibleThreads.length}
          onChange={(event) => openThread(event.target.value)}><option value="">Selecciona una conversación</option>
          {visibleThreads.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select>
        <button type="button" onClick={newThread} disabled={historyBusy || busy}>Nueva conversación</button></div>
      {projectMode && thread && <div className="assistant-history-main"><label htmlFor="assistant-move-thread">Mover conversación a</label>
        <select id="assistant-move-thread" value={thread.projectId || ""} disabled={historyBusy || busy}
          onChange={moveThread}><option value="">Sin proyecto</option>
          {projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></div>}
      {thread && <div className="assistant-history-actions"><button type="button" onClick={() => {
        setDraftTitle(thread.title); setEditingTitle(true); setConfirmDelete(false);
      }} disabled={historyBusy || busy} aria-label="Renombrar conversación"><Pencil size={15} aria-hidden="true" /> Renombrar</button>
        <button type="button" onClick={exportThread} disabled={historyBusy || busy || exportBusy || historyStale}
          aria-label="Exportar conversación privada">{exportBusy ? "Preparando exportación..." : "Exportar JSON"}</button>
        <button type="button" onClick={() => { setConfirmDelete(true); setEditingTitle(false); }}
          disabled={historyBusy || busy} aria-label="Eliminar conversación"><Trash2 size={15} aria-hidden="true" /> Eliminar</button></div>}
      {thread && <small>La exportación contiene texto y fuentes privadas de esta conversación; los archivos adjuntos se descargan por separado.</small>}
      {editingTitle && <form className="assistant-history-edit" onSubmit={renameThread}><label htmlFor="assistant-thread-title">Nuevo nombre</label>
        <input id="assistant-thread-title" value={draftTitle} maxLength={80} onChange={(event) => setDraftTitle(event.target.value)} />
        <button type="submit" disabled={!draftTitle.trim() || historyBusy}>Guardar</button>
        <button type="button" onClick={() => setEditingTitle(false)}>Cancelar</button></form>}
      {confirmDelete && <div className="assistant-history-confirm" role="group" aria-label="Confirmar eliminación">
        <span>¿Eliminar esta conversación de forma permanente?</span><button type="button" onClick={removeThread}>Sí, eliminar</button>
        <button type="button" onClick={() => setConfirmDelete(false)}>Cancelar</button></div>}
      {attachmentMode && <section className="assistant-attachments" aria-label="Archivos de esta conversación">
        <label htmlFor="assistant-attachment-file">Adjuntar archivo privado</label>
        <input id="assistant-attachment-file" type="file" accept=".pdf,.docx,.txt,.csv,.png,.jpg,.jpeg,.webp"
          disabled={historyBusy || busy || attachmentBusy || attachmentList.length >= 2 || historyStale}
          onChange={uploadFile} />
        <small>Hasta 2 archivos por conversación, 4 por proyecto y 20 en total; 2 MB cada uno. PDF, DOCX, TXT, CSV o imagen. No adjuntes claves. La imagen se envía a Azure solo cuando preguntas por ella.</small>
        {visibleAttachments.length > 0 && <><label htmlFor="assistant-attachment-choice">Consultar archivo</label>
          <select id="assistant-attachment-choice" value={selectedAttachmentId || ""}
            onChange={(event) => { setSelectedAttachmentId(event.target.value || null); if (event.target.value) setWithEvidence(false); }}>
            <option value="">Ninguno: consultar VERA</option>
            {projectKnowledgeMode && projectFiles.some((item) => item.status === "ready") &&
              <option value={PROJECT_LIBRARY}>Biblioteca del proyecto · fragmentos de archivos legibles</option>}
            {visibleAttachments.map((item) => <option key={item.id} value={item.id}>{item.name}{item.projectId ? " · proyecto" : " · conversación"}</option>)}
          </select>
          <ul>{visibleAttachments.map((item) => <li key={item.id}>
            <span>{item.name} · {item.projectId ? "proyecto" : "conversación"} · {(item.size / 1024).toFixed(0)} KB{item.truncated ? " · lectura parcial" : ""}</span>
            <button type="button" onClick={() => downloadFile(item.id)}>Abrir original</button>
            <button type="button" disabled={attachmentBusy || busy} onClick={() => removeFile(item.id)}>Quitar</button>
          </li>)}</ul></>}
        {attachmentBusy && <small role="status">Procesando archivo privado...</small>}
        {attachmentError && <p className="assistant-error" role="alert">{attachmentError}</p>}
      </section>}
      {historyBusy && <small role="status">Cargando historial...</small>}
      {historyError && <p className="assistant-error" role="alert">{historyError}</p>}
      {historyStale && <p className="assistant-state" role="status">Cambió tu alcance de datos. Por protección, esta conversación ya no muestra respuestas anteriores. Inicia una conversación nueva.</p>}
    </div>}
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
    {focus?.type === "risk" && canDraftProposal && <section className="assistant-dossier" aria-label="Borrador de propuesta de auditoría">
      <div className="assistant-dossier-header"><div><h2>Propuesta a partir de este riesgo</h2><p>El borrador no crea ni aprueba una auditoría.</p></div>
        <button type="button" onClick={prepareProposalDraft} disabled={draftBusy}>{draftBusy ? "Preparando..." : "Preparar borrador"}</button></div>
      {draftError && <p className="assistant-error" role="alert">{draftError}</p>}
      {proposalDraft && <div className="assistant-proposal-draft"><small>{proposalDraft.mode === "generated" ? "Redactado con IA" : "Plantilla basada en el riesgo"} · requiere revisión humana</small>
        <h3>{proposalDraft.draft.title}</h3><p><b>Objetivo:</b> {proposalDraft.draft.objective}</p><p><b>Alcance:</b> {proposalDraft.draft.scope}</p>
        <p><b>Justificación:</b> {proposalDraft.draft.justification}</p><p><b>Área:</b> {proposalDraft.draft.area || "Por definir"}</p>
        <Link to={proposalDraft.source.path}>Fuente: {proposalDraft.source.title} <ArrowRight size={13} aria-hidden="true" /></Link>
        <button type="button" onClick={useProposalDraft}>Usar como borrador en Planificación</button></div>}
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
    {!focus && messages.length === 0 && insights?.insights?.length > 0 && <section className="assistant-insights" aria-label="Prioridades explicables"><h3>Qué revisar primero</h3><p>Orden orientativo calculado desde tus registros visibles. Confirma cada dato antes de decidir; no representa riesgo residual.</p><ol>{insights.insights.map((item) => <li key={item.key}><Link to={item.source.path}><strong>{item.title}</strong><ArrowRight size={13} aria-hidden="true" /></Link><span>{item.reason}</span><small>{item.factors.join(" · ")}</small></li>)}</ol>{insights.partial && <small>Se muestran {insights.totalShown} de {insights.evaluated} señales; abre los módulos para revisar las demás.</small>}</section>}
    <div className="assistant-messages" aria-live="polite">{messages.map((message) => <article key={message.id} className={`assistant-message ${message.role}`}>
      <strong>{message.role === "user" ? "Tú" : "Asistente VERA"}</strong><p>{message.text}</p>
      {message.role === "user" && message.attachmentName && <small className="assistant-answer-note">Archivo consultado: {message.attachmentName}</small>}
      {message.role === "assistant" && <><small className="assistant-answer-note">{message.mode === "computed" ? "Dato calculado desde registros autorizados" : message.mode?.startsWith("attachment-") ? "Respuesta sobre un archivo privado · comprueba el original" : message.mode === "document-search" ? "Respuesta con fragmentos de evidencias · comprueba el archivo" : ["no-match", "uncited", "no-text", "scope-limited"].includes(message.mode) ? "Sin respuesta documental respaldada" : "Respuesta generada · comprueba el expediente"}{Number.isFinite(message.durationMs) ? ` · ${(message.durationMs / 1000).toFixed(1)} s` : ""}</small>
        {message.asOf && <time className="assistant-answer-note" dateTime={message.asOf}>Datos consultados: {new Date(message.asOf).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}</time>}
        {message.coverage?.indexedOnly && <small className="assistant-answer-note">Se buscaron fragmentos ya indexados en {message.coverage.searchedFiles} de {message.coverage.visibleFiles} archivos visibles. Los archivos antiguos pueden requerir una consulta individual para indexarse.</small>}
        {message.mode !== "computed" && message.coverage?.partial && <small className="assistant-answer-note">{message.mode === "attachment-project" ? "La lectura de la biblioteca fue parcial; revisa los archivos originales antes de concluir." : message.mode?.startsWith("attachment-") || ["no-text", "scope-limited"].includes(message.mode) ? "La lectura del archivo fue parcial; revisa el original antes de concluir." : message.coverage.indexedOnly ? "La cantidad de archivos superó el límite de esta búsqueda; el resultado puede ser parcial." : "Se consultó una muestra de expedientes visibles; los conteos abarcan el total de tu alcance."}</small>}
        {message.metric && <div className="assistant-citations"><b>Indicador calculado</b><ul><li><Link to={message.metric.path}>{message.metric.label}: {message.metric.count} <ArrowRight size={13} aria-hidden="true" /></Link></li></ul></div>}
        {message.citations?.length > 0 && <div className="assistant-citations"><b>Registros citados</b><small>Campos consultados al responder; abre el expediente o archivo para ver su estado actual.</small><ul>{message.citations.map((item) => <li key={item.sourceId}>{item.attachmentId
          ? <button type="button" onClick={() => downloadFile(item.attachmentId, item.projectId)}>{item.type}: {item.title} <ArrowRight size={13} aria-hidden="true" /></button>
          : <Link to={item.path}>{item.type}: {item.title} <ArrowRight size={13} aria-hidden="true" /></Link>}{item.facts?.length > 0 && <span className="assistant-source-facts">{item.facts.map((fact) => `${fact.label}: ${fact.value}`).join(" · ")}</span>}{item.excerpt && <span className="assistant-source-facts">{item.pageNumber ? `Página ${item.pageNumber} · ` : ""}{item.excerpt}</span>}</li>)}</ul></div>}
        {message.citations?.length === 0 && message.mode !== "computed" && <small className="assistant-answer-note">Sin registros citados en esta respuesta.</small>}
        {message.references?.length > 0 && <details><summary>Registros relacionados ({message.references.length})</summary><ul>{message.references.map((item) => <li key={item.sourceId || `${item.type}:${item.id}`}><Link to={item.path}>{item.type}: {item.title} <ArrowRight size={13} aria-hidden="true" /></Link></li>)}</ul></details>}
        {message.feedbackToken && !message.feedbackRating && <div className="assistant-feedback" aria-label="Valora esta respuesta"><span>¿Te sirvió?</span><button type="button" onClick={() => rateResponse(message, "helpful")} disabled={Boolean(feedbackBusyId)} aria-label="Me sirvió esta respuesta"><ThumbsUp size={14} aria-hidden="true" /> Sí</button><button type="button" onClick={() => rateResponse(message, "unhelpful")} disabled={Boolean(feedbackBusyId)} aria-label="No me sirvió esta respuesta"><ThumbsDown size={14} aria-hidden="true" /> No</button></div>}
        {message.feedbackRating && <small className="assistant-answer-note" role="status">Tu valoración se registró sin guardar el texto de la respuesta.</small>}
      </>}</article>)}</div>
    {busy && <p className="assistant-state" role="status">Consultando información autorizada...</p>}
    {error && <p className="assistant-error" role="alert">{error}</p>}
    {!persistent && messages.length > 0 && <button className="assistant-clear" type="button" onClick={() => { setMessages([]); setError(""); }}><RotateCcw size={14} aria-hidden="true" /> Nueva conversación</button>}
    <form className="assistant-form" onSubmit={submit}><label htmlFor="assistant-question">Tu pregunta</label><label className="assistant-search-option"><input type="checkbox" checked={withEvidence} onChange={(event) => setWithEvidence(event.target.checked)} disabled={!available || busy || Boolean(selectedAttachmentId)} /> Buscar también en textos de evidencias visibles</label><div><textarea id="assistant-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={withEvidence ? 500 : 800} rows={3} placeholder={selectedAttachmentId === PROJECT_LIBRARY ? "Pregunta sobre fragmentos de la biblioteca..." : selectedAttachmentId ? "Pregunta sobre el archivo seleccionado..." : "Escribe una pregunta sobre VERA..."} disabled={!available || busy || historyBusy || attachmentBusy || Boolean(historyError) || historyStale} /><button type="submit" disabled={!available || busy || historyBusy || attachmentBusy || Boolean(historyError) || historyStale || question.trim().length < 3 || question.trim().length > (withEvidence ? 500 : 800)} aria-label="Enviar pregunta"><Send size={19} aria-hidden="true" /></button></div><small>{question.length}/{withEvidence ? 500 : 800} caracteres · No escribas contraseñas ni claves.</small></form>
  </section>;
}

export default AssistantPanel;
