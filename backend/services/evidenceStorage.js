const { randomUUID } = require("node:crypto");

const BUCKET = "vera-evidence";
const MAX_BYTES = 3 * 1024 * 1024;
const MIME_EXTENSIONS = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "text/plain": "txt"
};

class EvidenceStorageError extends Error {
  constructor(message, status = 503) {
    super(message);
    this.status = status;
    this.evidenceStorage = true;
  }
}

const config = () => {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!process.env.SUPABASE_URL || !key) throw new EvidenceStorageError("Falta configurar Supabase Storage para archivos de evidencia.");
  let root;
  try { root = new URL(process.env.SUPABASE_URL); } catch {
    throw new EvidenceStorageError("La URL de Supabase no es válida.");
  }
  if (root.protocol !== "https:") throw new EvidenceStorageError("La URL de Supabase debe usar HTTPS.");
  return { root, key };
};

const headersFor = (key) => ({
  apikey: key,
  ...(key.startsWith("sb_secret_") ? {} : { Authorization: `Bearer ${key}` })
});

const pathFor = (entityType, entityId, mime) => {
  const extension = MIME_EXTENSIONS[mime];
  if (!extension) throw new EvidenceStorageError("Tipo de archivo no permitido.", 415);
  return `${entityType.toLowerCase()}/${encodeURIComponent(entityId)}/${randomUUID()}.${extension}`;
};

const hasValidSignature = (bytes, mime) => {
  const data = Buffer.from(bytes);
  if (mime === "application/pdf") return data.subarray(0, 5).toString() === "%PDF-";
  if (mime === "image/png") return data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mime === "image/jpeg") return data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  if (mime === "image/webp") return data.subarray(0, 4).toString() === "RIFF" && data.subarray(8, 12).toString() === "WEBP";
  if (mime === "text/plain") {
    try { new TextDecoder("utf-8", { fatal: true }).decode(data); return !data.includes(0); } catch { return false; }
  }
  return false;
};

const upload = async ({ entityType, entityId, mime, bytes }) => {
  if (!Buffer.isBuffer(bytes)) {
    throw new EvidenceStorageError("El cuerpo debe ser un archivo binario.", 400);
  }
  const fileBytes = Buffer.from(bytes);
  if (fileBytes.length === 0 || fileBytes.length > MAX_BYTES) {
    throw new EvidenceStorageError("El archivo debe tener entre 1 byte y 3 MB.", 400);
  }
  if (!hasValidSignature(fileBytes, mime)) throw new EvidenceStorageError("El contenido no coincide con el tipo de archivo.", 415);
  const path = pathFor(entityType, entityId, mime);
  const { root, key } = config();
  const url = new URL(`/storage/v1/object/${BUCKET}/${path}`, root);
  let response;
  try {
    response = await fetch(url, {
      method: "POST", headers: { ...headersFor(key), "Content-Type": mime, "cache-control": "max-age=3600", "x-upsert": "false" },
      body: fileBytes, signal: AbortSignal.timeout(15_000)
    });
  } catch { throw new EvidenceStorageError("No se pudo conectar con el almacén de archivos."); }
  if (!response.ok) throw new EvidenceStorageError("El almacén de archivos rechazó la carga.");
  return { bucket: BUCKET, path, mime, size: fileBytes.length };
};

const remove = async (file) => {
  const { root, key } = config();
  const url = new URL(`/storage/v1/object/${BUCKET}`, root);
  const response = await fetch(url, {
    method: "DELETE", headers: { ...headersFor(key), "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: [file.path] }), signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw new EvidenceStorageError("No se pudo retirar un archivo sin metadatos.");
};

const validFile = (file) => file && file.bucket === BUCKET &&
  /^(risk|control|audit)\/[^/]+\/[0-9a-f-]{36}\.(pdf|png|jpg|webp|txt)$/.test(file.path) &&
  MIME_EXTENSIONS[file.mime] && file.path.endsWith(`.${MIME_EXTENSIONS[file.mime]}`);

const downloadBytes = async (file) => {
  if (!validFile(file)) throw new EvidenceStorageError("Archivo de evidencia no válido.", 400);
  const { root, key } = config();
  const url = new URL(`/storage/v1/object/${BUCKET}/${file.path}`, root);
  let response;
  try { response = await fetch(url, { headers: headersFor(key), signal: AbortSignal.timeout(15_000) }); }
  catch { throw new EvidenceStorageError("No se pudo conectar con el almacén de archivos."); }
  if (!response.ok || Number(response.headers.get("content-length")) > MAX_BYTES) {
    throw new EvidenceStorageError("No se pudo leer el archivo privado.");
  }
  let bytes;
  try { bytes = Buffer.from(await response.arrayBuffer()); }
  catch { throw new EvidenceStorageError("No se pudo leer el archivo privado."); }
  if (bytes.length === 0 || bytes.length > MAX_BYTES || !hasValidSignature(bytes, file.mime)) {
    throw new EvidenceStorageError("El archivo privado no coincide con sus metadatos.");
  }
  return bytes;
};

const signedDownloadUrl = async (file) => {
  if (!validFile(file)) {
    throw new EvidenceStorageError("Archivo de evidencia no válido.", 400);
  }
  const { root, key } = config();
  const url = new URL(`/storage/v1/object/sign/${BUCKET}/${file.path}`, root);
  let response;
  try {
    response = await fetch(url, {
      method: "POST", headers: { ...headersFor(key), "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: 60 }), signal: AbortSignal.timeout(10_000)
    });
  } catch { throw new EvidenceStorageError("No se pudo conectar con el almacén de archivos."); }
  if (!response.ok) throw new EvidenceStorageError("No se pudo preparar la descarga.");
  const data = await response.json();
  if (typeof data.signedURL !== "string" || !data.signedURL.startsWith(`/object/sign/${BUCKET}/`)) {
    throw new EvidenceStorageError("El almacén devolvió una dirección de descarga no válida.");
  }
  return new URL(`/storage/v1${data.signedURL}`, root).toString();
};

module.exports = { MAX_BYTES, MIME_EXTENSIONS, EvidenceStorageError, upload, remove, signedDownloadUrl, downloadBytes };
