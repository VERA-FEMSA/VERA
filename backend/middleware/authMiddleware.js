const jwt = require("jsonwebtoken");
const userRepository = require("../repositories/userRepository");
const { USER_STATUS } = require("../config/accountRules");
const { getJwtSecret } = require("../config/jwtSecret");

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      message: "Token requerido"
    });
  }

  const token = authHeader.split(" ")[1];

  let decoded;
  try {
    decoded = jwt.verify(token, getJwtSecret());
  } catch {
    return res.status(401).json({ message: "Token inválido o expirado" });
  }
  if (decoded.purpose) return res.status(401).json({ message: "Token inválido" });

  try {
    // HU-01: se lee el usuario actual para que un cambio de rol
    // o una desactivación apliquen de inmediato, sin esperar a que expire el token.
    const user = await userRepository.findById(decoded.id);
    if (!user || user.status !== USER_STATUS.ACTIVE) {
      return res.status(401).json({ message: "Tu cuenta está deshabilitada o ya no existe." });
    }

    req.user = { id: user.id, username: user.username, role: user.role };
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  verifyToken
};
