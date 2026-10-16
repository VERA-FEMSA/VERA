const normalizeArea = (value) => String(value ?? "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .replace(/[¿?¡!.,;:]/g, " ").replace(/\s+/g, " ").trim();

module.exports = { normalizeArea };
