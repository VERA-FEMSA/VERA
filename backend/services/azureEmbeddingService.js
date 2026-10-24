const { configuration } = require("./azureOpenAiService");

const DIMENSIONS = 512;
const MODEL = "text-embedding-3-small:512";
const MAX_INPUTS = 50;

const embeddingConfiguration = () => {
  if (process.env.VERA_AI_SEMANTIC_ENABLED !== "true") return null;
  const azure = configuration();
  const deployment = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT?.trim();
  if (!azure || !deployment || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(deployment)) return null;
  return { ...azure, deployment };
};

const embedTexts = async (inputs, { fetchImpl = fetch } = {}) => {
  const config = embeddingConfiguration();
  if (!config) {
    const error = new Error("La búsqueda semántica no está disponible en este entorno.");
    error.status = 503;
    throw error;
  }
  if (!Array.isArray(inputs) || !inputs.length || inputs.length > MAX_INPUTS ||
      inputs.some((input) => typeof input !== "string" || !input.trim() || input.length > 4000)) {
    const error = new Error("El texto para indexar no es válido.");
    error.status = 400;
    throw error;
  }
  let response;
  try {
    response = await fetchImpl(`${config.endpoint}/openai/v1/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": config.apiKey },
      body: JSON.stringify({ model: config.deployment, input: inputs, dimensions: DIMENSIONS }),
      signal: AbortSignal.timeout(25_000)
    });
  } catch {
    const error = new Error("No se pudo conectar con el modelo de búsqueda semántica.");
    error.status = 502;
    throw error;
  }
  if (!response.ok) {
    const error = new Error(response.status === 429
      ? "La búsqueda semántica alcanzó su límite temporal. Intenta de nuevo más tarde."
      : "El modelo de búsqueda semántica no está disponible.");
    error.status = response.status === 429 ? 429 : 502;
    throw error;
  }
  let data;
  try { data = await response.json(); } catch { /* Fall through to validation. */ }
  const rows = data?.data;
  if (!Array.isArray(rows) || rows.length !== inputs.length || rows.some((row) =>
    !Number.isInteger(row.index) || row.index < 0 || row.index >= inputs.length ||
    !Array.isArray(row.embedding) || row.embedding.length !== DIMENSIONS ||
    row.embedding.some((value) => !Number.isFinite(value)))) {
    const error = new Error("El modelo de búsqueda semántica devolvió vectores inválidos.");
    error.status = 502;
    throw error;
  }
  const ordered = Array(inputs.length);
  for (const row of rows) {
    if (ordered[row.index]) {
      const error = new Error("El modelo de búsqueda semántica devolvió vectores duplicados.");
      error.status = 502;
      throw error;
    }
    ordered[row.index] = row.embedding;
  }
  return { vectors: ordered, usage: data.usage || null };
};

module.exports = { DIMENSIONS, MODEL, embeddingConfiguration, embedTexts };
