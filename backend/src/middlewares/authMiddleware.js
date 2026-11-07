export function verifyAdminToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== 'Bearer admin-token-secret') {
    return res.status(401).json({ error: 'Acceso no autorizado' });
  }
  next();
}