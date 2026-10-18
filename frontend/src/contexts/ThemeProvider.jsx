import { useCallback, useEffect, useMemo, useState } from "react";
import { ThemeContext } from "./ThemeContext";

const STORAGE_KEY = "vera:appearance";

function savedPreference() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return ["light", "dark", "contrast"].includes(value) ? value : "system";
  } catch {
    return "system";
  }
}

function systemPrefersDark() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(savedPreference);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) return undefined;
    const update = () => setSystemDark(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const theme = preference === "system" ? (systemDark ? "dark" : "light") : preference === "contrast" ? "dark" : preference;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    if (preference === "contrast") document.documentElement.dataset.contrast = "high";
    else delete document.documentElement.dataset.contrast;
    document.documentElement.style.colorScheme = theme;
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.setAttribute("content", theme === "dark" ? "#0d1923" : "#f4f6f7");
  }, [preference, theme]);

  const changePreference = useCallback((next) => {
    if (!["system", "light", "dark", "contrast"].includes(next)) return;
    setPreference(next);
    try {
      if (next === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Appearance remains usable for this session if storage is unavailable.
    }
  }, []);

  const value = useMemo(() => ({ preference, theme, changePreference }), [preference, theme, changePreference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export default ThemeProvider;
