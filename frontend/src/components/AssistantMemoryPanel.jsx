import { useEffect, useState } from "react";
import { createAssistantMemory, deleteAssistantMemory, listAssistantMemories, updateAssistantMemory } from "../services/assistantService";

function AssistantMemoryPanel() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [content, setContent] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    let active = true;
    listAssistantMemories().then((data) => { if (active) setItems(data); })
      .catch((cause) => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, []);

  const save = async (event) => {
    event.preventDefault();
    if (busy || !content.trim()) return;
    setBusy(true); setError("");
    try {
      const saved = editing === "new"
        ? await createAssistantMemory(content.trim())
        : await updateAssistantMemory(editing.id, content.trim(), editing.enabled, editing.version);
      setItems((current) => editing === "new" ? [saved, ...current]
        : current.map((item) => item.id === saved.id ? saved : item));
      setEditing(null); setContent("");
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };

  const toggle = async (item) => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const saved = await updateAssistantMemory(item.id, item.content, !item.enabled, item.version);
      setItems((current) => current.map((entry) => entry.id === saved.id ? saved : entry));
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };

  const remove = async (id) => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      await deleteAssistantMemory(id);
      setItems((current) => current.filter((item) => item.id !== id));
      setConfirmDelete(null);
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };

  return <section className="assistant-memory" aria-label="Memoria personalizada">
    <button type="button" aria-expanded={open} aria-controls="assistant-memory-content"
      onClick={() => setOpen((current) => !current)}>Memoria personalizada · {items.length} notas</button>
    {open && <div id="assistant-memory-content">
      <p>Solo se guardan las preferencias que escribas aquí. Puedes pausarlas o borrarlas. No sustituyen los datos ni permisos de VERA. No escribas contraseñas ni claves.</p>
      {items.length === 0 && <p>No hay notas guardadas.</p>}
      <ul>{items.map((item) => <li key={item.id}>
        <span>{item.content} {!item.enabled && <small>(pausada)</small>}</span>
        <div className="assistant-history-actions">
          <button type="button" disabled={busy} onClick={() => toggle(item)}>{item.enabled ? "Pausar" : "Activar"}</button>
          <button type="button" disabled={busy} onClick={() => { setEditing(item); setContent(item.content); }}>Editar</button>
          <button type="button" disabled={busy} onClick={() => setConfirmDelete(item.id)}>Borrar</button>
        </div>
        {confirmDelete === item.id && <div role="group" aria-label="Confirmar eliminación de nota">
          <button type="button" disabled={busy} onClick={() => remove(item.id)}>Sí, borrar nota</button>
          <button type="button" onClick={() => setConfirmDelete(null)}>Cancelar</button>
        </div>}
      </li>)}</ul>
      {editing && <form className="assistant-history-edit" onSubmit={save}>
        <label htmlFor="assistant-memory-note">Nota para futuras conversaciones</label>
        <textarea id="assistant-memory-note" value={content} maxLength={200} rows={2} required
          onChange={(event) => setContent(event.target.value)} />
        <button type="submit" disabled={busy || !content.trim()}>Guardar nota</button>
        <button type="button" onClick={() => { setEditing(null); setContent(""); }}>Cancelar</button>
      </form>}
      {!editing && <button type="button" disabled={busy || items.length >= 8}
        onClick={() => { setEditing("new"); setContent(""); }}>Añadir nota</button>}
      {error && <p className="assistant-error" role="alert">{error}</p>}
    </div>}
  </section>;
}

export default AssistantMemoryPanel;
