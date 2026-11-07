export function validateLicorBody(req, res, next) {
  const { name, price, stock } = req.body;
  if (!name || !price || stock === undefined) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: nombre, precio o stock.' });
  }
  next();
}