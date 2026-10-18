import { SunMoon } from "lucide-react";
import { useId } from "react";
import { useTheme } from "../contexts/useTheme";

function ThemeControl({ compact = false }) {
  const { preference, changePreference } = useTheme();
  const id = useId();

  return <div className={`theme-control${compact ? " theme-control--compact" : ""}`}>
    <label htmlFor={id}><SunMoon size={17} strokeWidth={1.8} aria-hidden="true" /> Apariencia</label>
    <select id={id} aria-label="Apariencia" value={preference} onChange={(event) => changePreference(event.target.value)}>
      <option value="system">Sistema</option>
      <option value="light">Claro</option>
      <option value="dark">Oscuro</option>
      <option value="contrast">Contraste</option>
      <option value="femsa">FEMSA</option>
    </select>
  </div>;
}

export default ThemeControl;
