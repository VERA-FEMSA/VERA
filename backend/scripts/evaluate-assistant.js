// Evaluación manual con casos sintéticos. No consulta Supabase ni almacena prompts.
require("dotenv").config();
const { askAzureOpenAi, readiness } = require("../services/azureOpenAiService");
const { cases, context, assess } = require("./assistant-evaluation-cases");

const percentile = (values, fraction) => values.length
  ? [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1] : null;

const main = async () => {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--list") {
    cases.forEach((item) => process.stdout.write(JSON.stringify({ case: item.id, checks: item.checks }) + "\n"));
    return;
  }
  const requested = args.length === 1 && args[0].startsWith("--case=") ? args[0].slice(7) : null;
  if (args.length > 1 || (args.length === 1 && !requested) ||
      (requested && !cases.some((item) => item.id === requested))) {
    process.stderr.write("Uso: npm run ai:eval -- [--list | --case=ID]\n");
    process.exitCode = 2;
    return;
  }
  if (!readiness().available) {
    process.stderr.write("IA no configurada para esta evaluación. Define VERA_AI_ENABLED y variables Azure de servidor.\n");
    process.exitCode = 2;
    return;
  }
  const selected = requested ? cases.filter((item) => item.id === requested) : cases;
  const durations = [];
  const tokens = { prompt: 0, completion: 0 };
  let passed = 0;
  for (const item of selected) {
    const start = Date.now();
    try {
      const result = await askAzureOpenAi({ question: item.question, context: item.context || context,
        history: item.history || [] });
      const durationMs = Date.now() - start;
      durations.push(durationMs);
      const evaluation = assess(item, result);
      if (evaluation.passed) passed += 1;
      tokens.prompt += result.usage?.prompt_tokens || 0;
      tokens.completion += result.usage?.completion_tokens || 0;
      process.stdout.write(JSON.stringify({ case: item.id, status: evaluation.passed ? "PASS" : "FAIL",
        checks: evaluation.checks, durationMs, promptTokens: result.usage?.prompt_tokens ?? null,
        completionTokens: result.usage?.completion_tokens ?? null }) + "\n");
    } catch (error) {
      process.stdout.write(JSON.stringify({ case: item.id, status: "ERROR", durationMs: Date.now() - start,
        errorStatus: Number.isInteger(error.status) ? error.status : null }) + "\n");
    }
  }
  process.stdout.write(JSON.stringify({ summary: "ai-eval-v2", passed, total: selected.length,
    p50Ms: percentile(durations, 0.5), p95Ms: percentile(durations, 0.95),
    promptTokens: tokens.prompt, completionTokens: tokens.completion }) + "\n");
  if (passed !== selected.length) process.exitCode = 1;
};

main().catch(() => { process.stderr.write("No se pudo completar la evaluación.\n"); process.exitCode = 1; });
