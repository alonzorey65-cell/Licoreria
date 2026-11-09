export function getPromotionExpiration(promo) {
  const date = promo.vigente_hasta || promo.fecha_fin || promo.expires_at || promo.fechaExpiracion;
  if (!date) return null;
  const text = String(date);
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(text) ? new Date(`${text}T23:59:59.999`) : new Date(text);
}

export function isPromotionExpired(promo, now = new Date()) {
  const expiration = getPromotionExpiration(promo);
  return Boolean(expiration && !Number.isNaN(expiration.getTime()) && expiration < now);
}
