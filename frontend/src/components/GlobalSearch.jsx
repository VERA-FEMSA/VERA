import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import "./GlobalSearch.css";

function normalize(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function visiblePageActions() {
  return [...document.querySelectorAll(".dashboard-main button, .dashboard-main a[href]")]
    .filter((element) => !element.disabled && element.getClientRects().length > 0)
    .map((element, index) => ({
      key: `page-${index}`,
      label: (element.getAttribute("aria-label") || element.getAttribute("title") || element.innerText || "").replace(/\s+/g, " ").trim().slice(0, 90),
      element,
      group: "En esta pantalla"
    }))
    .filter(({ label }) => label.length > 1);
}

function GlobalSearch({ groups, previewRoles, onNavigate, onPreviewRole, onRevealAppearance, onLogout, onOpen, disabled }) {
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);
  const inputRef = useRef(null);
  const resultsRef = useRef(null);
  const focusAfterCloseRef = useRef(null);
  const skipRestoreRef = useRef(false);
  const [query, setQuery] = useState("");
  const [pageActions, setPageActions] = useState([]);

  const openSearch = useCallback(() => {
    if (disabled) return;
    onOpen();
    setPageActions(visiblePageActions());
    setQuery("");
    if (!dialogRef.current?.open) dialogRef.current?.showModal();
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [disabled, onOpen]);

  useEffect(() => {
    const onShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openSearch();
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, [openSearch]);

  const commands = [
    ...groups.flatMap(({ label, items }) => items.map((item) => ({ key: item.id, label: item.label, group: label, kind: "navigate", path: item.path }))),
    ...previewRoles.map(({ role, label }) => ({ key: `role-${role}`, label: `Recorrer vista de ${label}`, group: "Vistas de rol", kind: "preview", role })),
    { key: "appearance", label: "Apariencia", group: "Cuenta", kind: "appearance" },
    { key: "logout", label: "Cerrar sesión", group: "Cuenta", kind: "logout" },
    ...pageActions.map((action) => ({ ...action, kind: "focus" }))
  ];
  const search = normalize(query.trim());
  const results = search ? commands.filter(({ label, group }) => normalize(`${label} ${group}`).includes(search)) : commands;

  const choose = (key) => {
    const result = commands.find((item) => item.key === key);
    if (!result) return;
    if (result.kind === "focus") focusAfterCloseRef.current = result.element;
    else skipRestoreRef.current = true;
    dialogRef.current?.close();
    if (result.kind === "navigate") onNavigate(result.path);
    if (result.kind === "preview") onPreviewRole(result.role);
    if (result.kind === "appearance") onRevealAppearance();
    if (result.kind === "logout") onLogout();
  };

  const onClose = () => {
    setQuery("");
    if (skipRestoreRef.current) {
      skipRestoreRef.current = false;
      focusAfterCloseRef.current = null;
      return;
    }
    const target = focusAfterCloseRef.current;
    focusAfterCloseRef.current = null;
    requestAnimationFrame(() => {
      if (target?.isConnected) {
        target.scrollIntoView({ block: "nearest" });
        target.focus();
      } else triggerRef.current?.focus();
    });
  };

  return <>
    <header className="global-shell-header">
      <button type="button" className="global-search-trigger" ref={triggerRef} onClick={openSearch}
        aria-label="Buscar secciones y acciones" aria-keyshortcuts="Control+K Meta+K">
        <Search size={19} aria-hidden="true" />
        <span>Buscar secciones y acciones</span>
        <kbd>Ctrl K</kbd>
      </button>
    </header>
    <dialog ref={dialogRef} className="global-search-dialog" aria-label="Buscar secciones y acciones" onClose={onClose}>
      <div className="global-search-input-row">
        <Search size={20} aria-hidden="true" />
        <input ref={inputRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)}
          aria-label="Buscar secciones y acciones" placeholder="Escribe una sección o acción"
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") { event.preventDefault(); resultsRef.current?.querySelector("button")?.focus(); }
            if (event.key === "Enter" && results.length) { event.preventDefault(); choose(results[0].key); }
          }} />
        <button type="button" className="global-search-close" onClick={() => dialogRef.current?.close()} aria-label="Cerrar búsqueda"><X size={20} /></button>
      </div>
      <p className="global-search-count" aria-live="polite">{results.length} {results.length === 1 ? "resultado" : "resultados"}</p>
      <div className="global-search-results" ref={resultsRef}>
        {results.length ? results.map((result) => <button key={result.key} type="button" className="global-search-result"
          data-command-key={result.key} onClick={(event) => choose(event.currentTarget.dataset.commandKey)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") { event.preventDefault(); event.currentTarget.nextElementSibling?.focus(); }
            if (event.key === "ArrowUp") { event.preventDefault(); (event.currentTarget.previousElementSibling || inputRef.current)?.focus(); }
          }}>
          <span>{result.label}</span><small>{result.group}{result.kind === "focus" ? " · localizar control" : ""}</small>
        </button>) : <p className="global-search-empty">No hay opciones que coincidan. Prueba con otra palabra.</p>}
      </div>
      <p className="global-search-help">Seleccionar un control de la pantalla lo enfoca; no ejecuta su acción.</p>
    </dialog>
  </>;
}

export default GlobalSearch;
