export function parsePromotionPrice(value) {
    if (value === undefined) return undefined;
    if (value === null || (typeof value === 'string' && value.trim() === '')) return null;
    if (typeof value !== 'string' && typeof value !== 'number') {
        throw new Error('El precio debe ser un importe válido en soles.');
    }
    const text = String(value).trim();
    if (!/^\d{1,10}(\.\d{1,2})?$/.test(text)) {
        throw new Error('El precio debe ser un importe en soles de hasta 10 dígitos y 2 decimales.');
    }
    return Number(text);
}
