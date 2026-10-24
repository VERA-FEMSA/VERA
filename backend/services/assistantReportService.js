const { buildPortfolioReport, reportToCsv } = require("./portfolioReportService");
const { parseAuditFilters } = require("./auditSearch");
const MAX_INLINE_CSV_BYTES = 2_000_000;

const normalize = (value) => String(value || "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");

const parseReportRequest = (question) => {
  const value = normalize(question);
  if (/^(?:exporta|exportar|descarga|descargar)\s+(?:(?:el|un)\s+)?(?:reporte|informe)\s+(?:del|de)\s+portafolio(?:\s+en\s+csv|\s+csv)?$/.test(value)) {
    return { exportCsv: true };
  }
  if (/^(?:muestrame|mostrar|genera|generar|prepara|preparar)\s+(?:(?:el|un)\s+)?(?:reporte|informe)\s+(?:del|de)\s+portafolio$/.test(value)) {
    return { exportCsv: false };
  }
  return null;
};

const handleAssistantReport = async (user, question) => {
  const request = parseReportRequest(question);
  if (!request) return null;
  const report = await buildPortfolioReport(user, parseAuditFilters({}).filters);
  const counts = Object.fromEntries(["OPEN", "APPROVED", "ACTIVE", "CLOSED", "REJECTED"]
    .map((status) => [status, report.rows.filter((row) => row.audit.status === status).length]));
  const items = report.rows.slice(0, 10).map(({ audit }) => ({
    sourceId: `audits:${audit.id}`, type: "Auditoría", id: audit.id, title: audit.title,
    path: audit.status === "ACTIVE" ? `/auditorias-activas/${encodeURIComponent(audit.id)}` : "/planificacion",
    facts: [{ label: "Estado", value: audit.status }, { label: "Área", value: audit.area || "Sin área" }]
  }));
  const summary = `Reporte del portafolio visible para tu cuenta: ${report.total} auditorías; ${counts.OPEN} propuestas abiertas, ${counts.APPROVED} aprobadas, ${counts.ACTIVE} activas, ${counts.CLOSED} cerradas y ${counts.REJECTED} rechazadas.`;
  const note = report.total > items.length ? ` Muestro ${items.length} registros como muestra; el conteo abarca los ${report.total}.` : "";
  const csv = request.exportCsv ? reportToCsv(report) : null;
  const inline = csv && Buffer.byteLength(csv, "utf8") <= MAX_INLINE_CSV_BYTES;
  const answer = request.exportCsv
    ? `${summary} La descarga CSV comenzará en tu navegador.${inline ? "" : " Por su tamaño, el archivo consultará los datos actuales de nuevo; pueden haber cambiado desde este resumen."}`
    : summary + note;
  return { answer, mode: request.exportCsv ? "report-export" : "report", citations: [], references: [],
    coverage: { partial: report.total > items.length }, asOf: report.asOf, usage: null,
    browse: { type: "report", total: report.total, hasMore: report.total > items.length, items },
    ...(inline ? { downloadCsv: csv } : csv ? { downloadFromReportEndpoint: true } : {}) };
};

module.exports = { parseReportRequest, handleAssistantReport };
