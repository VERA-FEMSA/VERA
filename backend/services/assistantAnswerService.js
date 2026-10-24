const { buildAssistantContext } = require("./assistantContextService");
const { getVerifiedAnswer } = require("./assistantVerifiedAnswers");
const { askAzureOpenAi, readiness } = require("./azureOpenAiService");
const { searchAssistantEvidence } = require("./assistantEvidenceSearchService");
const assistantMemory = require("../repositories/assistantMemoryRepository");
const { browseAssistant } = require("./assistantBrowseService");

const answerAssistant = async (user, question, history = [], focus = null, withEvidence = false,
  projectInstructions = "", previousBrowse = null) => {
  if (!withEvidence) {
    const browsed = await browseAssistant(user, question, focus, previousBrowse);
    if (browsed) return browsed;
  }
  if (!readiness().available) {
    const error = new Error("El asistente requiere Azure OpenAI y almacenes persistentes en producción.");
    error.status = 503;
    throw error;
  }
  if (withEvidence) {
    if ((process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") &&
        process.env.VERA_EVIDENCE_COMMENT_STORE !== "supabase") {
      const error = new Error("La búsqueda requiere evidencias persistentes.");
      error.status = 503;
      throw error;
    }
    return searchAssistantEvidence(user, question, focus);
  }
  const { context, references, sourceCatalog, brief, verifiedData, coverage, asOf } =
    await buildAssistantContext(user, question, focus);
  const verified = getVerifiedAnswer({ question, context, brief, sourceCatalog, verifiedData });
  if (verified) {
    const citations = verified.sourceIds.map((id) => sourceCatalog.find((item) => item.sourceId === id))
      .filter(Boolean);
    return { answer: verified.answer, mode: verified.mode, metric: verified.metric || null,
      citations, references: verified.references ?? (verified.metric ? [] : references),
      coverage, asOf, usage: null };
  }
  const memory = process.env.VERA_AI_MEMORY_ENABLED === "true" && !user.roleTour
    ? (await assistantMemory.list(user)).filter((item) => item.enabled).map((item) => item.content) : [];
  const { answer, sourceIds, usage } = await askAzureOpenAi({ question, context, history, memory,
    projectInstructions });
  const citations = sourceIds.map((id) => sourceCatalog.find((item) => item.sourceId === id)).filter(Boolean);
  return { answer, mode: "generated", citations, references, coverage, asOf, usage };
};

module.exports = { answerAssistant };
