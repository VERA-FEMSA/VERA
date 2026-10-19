import { Link } from "react-router-dom";
import { PRIVACY_NOTICE_VERSION } from "../constants/privacyNotice";
import PublicSiteShell from "../components/PublicSiteShell";
import { useDocumentTitle } from "../contexts/useDocumentTitle";

function PrivacyNotice() {
  useDocumentTitle("Aviso de privacidad");
  return <PublicSiteShell mainId="privacy-main">
      <article className="public-overview__notice">
        <p className="public-eyebrow">PRIVACIDAD · VERSIÓN {PRIVACY_NOTICE_VERSION}</p>
        <h1>Aviso de privacidad</h1>
        <p>Este aviso explica el uso de datos personales en el entorno de demostración de VERA. Las cuentas nuevas pueden registrarse con contraseña o con Microsoft o Google y reciben inicialmente el rol Auditor. No se requiere aprobación de la cuenta. Las cuentas existentes conservan sus métodos de acceso. No ingreses datos reales o confidenciales de FEMSA ni datos personales sensibles en expedientes de prueba.</p>

        <h2>Responsable y contacto</h2>
        <p>Carlos Sánchez Gutiérrez, Valle Primavera 2994, Monterrey, Nuevo León, México. Contacto para privacidad: <a href="mailto:carlos.sanchez.gtz.it@gmail.com?subject=VERA%20-%20privacidad">carlos.sanchez.gtz.it@gmail.com</a>.</p>

        <h2>Datos y finalidades</h2>
        <p>Tratamos el nombre, correo electrónico, identificador de cuenta, proveedor de acceso, rol, estado de la cuenta, fecha y hora de actividad, dirección IP y datos técnicos de seguridad. Si creas una cuenta con contraseña, la guardamos como hash y exigimos una aplicación de autenticación al iniciar sesión. No enviamos un código por correo ni comprobamos que controles la dirección que escribas; tampoco vinculamos esa cuenta automáticamente con Google o Microsoft solo porque coincida el correo. Si eliges Google o Microsoft, recibimos identidad básica y correo; no solicitamos acceso a tus mensajes, Drive ni archivos personales.</p>
        <p>Usamos estos datos para identificar y registrar cuentas, aplicar permisos, tramitar solicitudes de cambio de rol, mantener sesiones, prevenir abusos, documentar cambios y ofrecer las funciones de auditoría del prototipo. El contenido de demostración que introduzcas se usa para mostrar y relacionar expedientes. Las preguntas enviadas voluntariamente al asistente, junto con contexto autorizado de la aplicación, se procesan mediante Azure OpenAI para generar respuestas; comprueba siempre su contenido. No usamos estos datos para publicidad.</p>

        <h2>Proveedores</h2>
        <p>Vercel aloja la aplicación; Supabase almacena cuentas y registros y gestiona el acceso federado nuevo; Azure OpenAI procesa las consultas del asistente. Google o Microsoft participan solo cuando eliges iniciar sesión con uno de ellos. Estos servicios pueden tratar datos fuera de México conforme a sus condiciones aplicables. No vendemos datos personales.</p>

        <h2>Conservación</h2>
        <p>Al recibir una solicitud de cancelación y validar la identidad, gestionaremos la eliminación de la cuenta dentro de 30 días, salvo los datos que deban bloquearse o conservarse por una obligación legal o para atender responsabilidades derivadas del tratamiento. La eliminación requiere una operación supervisada en VERA y Supabase; no ocurre automáticamente al enviar el correo. Las bitácoras de seguridad se revisarán cada 90 días para decidir qué registros siguen siendo necesarios y cuáles pueden suprimirse o desidentificarse.</p>

        <h2>Tus opciones y derechos</h2>
        <p>Puedes solicitar acceso, rectificación, cancelación u oposición (ARCO), limitar el uso de tus datos o revocar el consentimiento cuando corresponda. Escribe al correo de privacidad con tu nombre, un medio de respuesta, el derecho que deseas ejercer y los datos a los que se refiere. Confirmaremos tu identidad por un medio adecuado antes de entregar o modificar información; no envíes contraseñas ni códigos. Comunicaremos la determinación dentro del plazo legal y, cuando proceda, ejecutaremos la medida en el plazo aplicable. También puedes pedir que no se utilicen tus datos para fines no indispensables; actualmente VERA no realiza comunicaciones promocionales.</p>

        <h2>Cambios</h2>
        <p>Las modificaciones de este aviso se publicarán en esta misma dirección con una nueva versión y fecha. Si un cambio exige una decisión adicional de tu parte, la solicitaremos antes de aplicar la nueva finalidad.</p>
        <p className="public-overview__notice-end"><Link to="/acerca">Conoce VERA</Link> · <Link to="/registro">Crear cuenta</Link></p>
      </article>
  </PublicSiteShell>;
}

export default PrivacyNotice;
