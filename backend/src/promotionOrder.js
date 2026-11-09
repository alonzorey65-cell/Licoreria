export function parsePromotionStock(value) {
    if (value === undefined) return undefined;
    if (!/^\d{1,9}$/.test(String(value))) throw new Error('El stock debe ser un número entero entre 0 y 999999999.');
    return Number(value);
}

export function validatePromotionItem(item, promo, today) {
    if (!promo || promo.activa !== true || promo.precio == null || promo.stock == null
        || (promo.vigente_hasta && promo.vigente_hasta < today)) {
        throw new Error('Una promoción ya no está disponible o venció. Actualiza el carrito.');
    }
    if (Number(promo.stock) < Number(item.qty)) throw new Error(`${promo.titulo} ya no tiene stock suficiente.`);
    if (item.price == null || Number(item.price) !== Number(promo.precio)) {
        throw new Error(`El precio de ${promo.titulo} cambió. Vuelve a agregarla desde Promociones.`);
    }
    return { type: 'promotion', id: promo.id, name: promo.titulo, price: Number(promo.precio), qty: Number(item.qty) };
}
