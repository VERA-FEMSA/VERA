import { SunMoon } from "lucide-react";
import { useTheme } from "../contexts/useTheme";

function ThemeControl({ compact = false }) {
  const { preference, changePreference } = useTheme();

  return <label className={`theme-control${compact ? " theme-control--compact" : ""}`}>
    <span><SunMoon size={17} strokeWidth={1.8} aria-hidden="true" /> Apariencia</span>
    <select value={preference} onChange={(event) => changePreference(event.target.value)}>
      <option value="system">Sistema</option>
      <option value="light">Claro</option>
      <option value="dark">Oscuro</option>
    </select>
  </label>;
}

export default ThemeControl;
