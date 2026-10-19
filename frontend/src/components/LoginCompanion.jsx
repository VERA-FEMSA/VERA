import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, Maximize2, Play, QrCode, X } from "lucide-react";

const ACCESS_URL = "https://www.vera-digital-systems.com/";
const VIDEO_URL = "https://www.youtube.com/shorts/X2RuivSwSVo";

function LoginCompanion({ compact = false }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const [active, setActive] = useState(null);

  useEffect(() => {
    const layout = window.matchMedia("(max-width: 900px)");
    const closeOnLayoutChange = () => dialogRef.current?.close();
    layout.addEventListener("change", closeOnLayoutChange);
    return () => layout.removeEventListener("change", closeOnLayoutChange);
  }, []);

  const open = (kind) => {
    setActive(kind);
    dialogRef.current?.showModal();
  };

  return <>
    {compact ? <div className="login-companion login-companion--compact" aria-label="Accesos rápidos">
      <button type="button" onClick={() => open("qr")}><QrCode size={17} aria-hidden="true" /> Abrir en el celular</button>
      <button type="button" onClick={() => open("video")}><Play size={16} aria-hidden="true" /> Ver VERA en video</button>
    </div> : <div className="login-companion" aria-label="Acceso móvil y presentación">
      <button className="login-companion__mobile" type="button" onClick={() => open("qr")} aria-haspopup="dialog">
        <img src="/access-qr.svg" width="94" height="94" alt="" />
        <div>
          <span className="login-companion__label">ACCESO MÓVIL</span>
          <strong>Continúa en tu teléfono.</strong>
          <span>Escanea para abrir VERA.</span>
          <span className="login-companion__expand">Ampliar QR <Maximize2 size={14} aria-hidden="true" /></span>
        </div>
      </button>
      <button className="login-companion__film" type="button" onClick={() => open("video")}>
        <span className="login-companion__film-mark" aria-hidden="true"><Play size={20} fill="currentColor" /></span>
        <span><small>INTRODUCCIÓN</small><strong>VERA en video</strong><span>Una mirada breve a la plataforma</span></span>
        <ArrowUpRight size={17} aria-hidden="true" />
      </button>
    </div>}

    <dialog ref={dialogRef} className="login-companion__dialog" onClose={() => setActive(null)} aria-labelledby={titleId}>
      <div className="login-companion__dialog-header">
        <div>
          <span className="login-companion__label">VERA DIGITAL SYSTEMS</span>
          <h2 id={titleId}>{active === "video" ? "VERA en video" : "Abre VERA en tu teléfono"}</h2>
        </div>
        <button type="button" className="login-companion__close" onClick={() => dialogRef.current?.close()} aria-label="Cerrar ventana"><X size={20} aria-hidden="true" /></button>
      </div>
      {active === "video" ? <>
        <div className="login-companion__player">
          <iframe title="Tráiler de VERA en YouTube" src="https://www.youtube-nocookie.com/embed/X2RuivSwSVo?autoplay=1&playsinline=1&rel=0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
        </div>
        <a className="login-companion__fallback" href={VIDEO_URL} target="_blank" rel="noopener noreferrer">Abrir en YouTube <ArrowUpRight size={15} aria-hidden="true" /></a>
      </> : <>
        <p>Escanea este código con la cámara de tu teléfono para abrir el inicio de sesión.</p>
        <img className="login-companion__qr" src="/access-qr.svg" width="300" height="300" alt="Código QR que abre www.vera-digital-systems.com" />
        <a className="login-companion__fallback" href={ACCESS_URL} target="_blank" rel="noopener noreferrer">www.vera-digital-systems.com <ArrowUpRight size={15} aria-hidden="true" /></a>
      </>}
    </dialog>
  </>;
}

export default LoginCompanion;
