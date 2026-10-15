const path = require("node:path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const users = require("../repositories/supabaseUserRepository");
const planning = require("../repositories/supabasePlanningRepository");

const main = async () => {
  const [accounts, proposals] = await Promise.all([users.getAll(), planning.getAll()]);
  const knownIds = new Set(accounts.map((account) => account.id));
  const missing = [];
  for (const proposal of proposals) {
    const links = {
      responsibleId: proposal.responsibleId,
      createdBy: proposal.createdBy?.id,
      approvedBy: proposal.approvedBy?.id,
      startedBy: proposal.startedBy?.id,
      closedBy: proposal.closedBy?.id,
      rejectedBy: proposal.rejectedBy?.id
    };
    for (const [field, id] of Object.entries(links)) {
      if (id && !knownIds.has(Number(id))) missing.push({ proposalId: proposal.id, field, userId: id });
    }
  }
  console.log(`Cuentas: ${accounts.length}; propuestas: ${proposals.length}; referencias sin cuenta: ${missing.length}.`);
  if (missing.length) {
    for (const item of missing) console.error(`${item.proposalId}: ${item.field}=${item.userId}`);
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error.userStorage || error.planningStorage ? error.message : "No se pudo revisar la relación de responsables.");
  process.exitCode = 1;
});
