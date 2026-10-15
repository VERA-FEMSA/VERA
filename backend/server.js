const express = require("express");
const cors = require("cors");
const { rateLimit } = require("express-rate-limit");
const path = require("node:path");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
require("./config/storeModes").validateStoreModes();

const { getJwtSecret } = require("./config/jwtSecret");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const auditRoutes = require("./routes/auditRoutes");
const planningRoutes = require("./routes/planningRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const riskRoutes = require("./routes/riskRoutes");
const controlRoutes = require("./routes/controlRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const evidenceRoutes = require("./routes/evidenceRoutes");

const app = express();

app.set("trust proxy", 1); // 1 = one proxy hop in front of your app

app.use(cors());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false
}));
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/planning", planningRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/risks", riskRoutes);
app.use("/api/controls", controlRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/evidence", evidenceRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "VERA API funcionando correctamente"
  });
});

app.use((error, req, res, next) => {
  if (error.planningStorage) return res.status(error.status).json({ message: error.message });
  if (error.userStorage) return res.status(error.status).json({ message: error.message });
  if (error.domainStorage) return res.status(error.status).json({ message: error.message });
  next(error);
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  getJwtSecret();
  app.listen(PORT, () => {
    console.log(`VERA backend ejecutándose en http://localhost:${PORT}`);
  });
}

module.exports = app;
