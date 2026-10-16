const assert = require("node:assert/strict");
const test = require("node:test");
const config = require("../../vercel.json");

test("Vercel envía la API al backend antes del frontend", () => {
  assert.deepEqual(config.rewrites[0], {
    source: "/api/(.*)",
    destination: { service: "backend" }
  });
  assert.deepEqual(config.rewrites[1], {
    source: "/(.*)",
    destination: { service: "frontend" }
  });
});

test("Vercel sirve rutas directas de React desde index.html", () => {
  assert.equal(config.services.frontend.framework, "vite");
  assert.deepEqual(config.services.frontend.rewrites, [{
    source: "/(.*)",
    destination: "/index.html"
  }]);
});
