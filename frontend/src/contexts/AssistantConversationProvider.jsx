import { useCallback, useState } from "react";
import { useLocation } from "react-router-dom";
import { AssistantConversationContext } from "./AssistantConversationContext";

const MAX_CONVERSATIONS = 12;
const MAX_MESSAGES = 40;

function ConversationStore({ children }) {
  const [conversations, setConversations] = useState({});
  const updateConversation = useCallback((key, update) => {
    setConversations((current) => {
      const previous = current[key] || [];
      const messages = typeof update === "function" ? update(previous) : update;
      const next = { ...current };
      delete next[key];
      if (messages.length) next[key] = messages.slice(-MAX_MESSAGES);
      const keys = Object.keys(next);
      if (keys.length > MAX_CONVERSATIONS) delete next[keys[0]];
      return next;
    });
  }, []);
  return <AssistantConversationContext.Provider value={{ conversations, updateConversation }}>
    {children}
  </AssistantConversationContext.Provider>;
}

function AssistantConversationProvider({ children }) {
  // useLocation vuelve a renderizar este límite cuando login/logout navega.
  useLocation();
  const token = localStorage.getItem("token");
  return <ConversationStore key={token || "anonymous"}>{children}</ConversationStore>;
}

export default AssistantConversationProvider;
