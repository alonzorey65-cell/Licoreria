const currencies = ['USD', 'MXN', 'COP', 'PEN', 'EUR'];

export function parseOffer(kind, body, editing = false) {
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
    const currency = typeof body.currency === 'string' ? body.currency.toUpperCase() : 'USD';
    const expiresAt = body.expiresAt || null;
    if (!/^[A-Z0-9_-]{3,40}$/.test(code) || !currencies.includes(currency)
        || (expiresAt !== null && (typeof expiresAt !== 'string' || Number.isNaN(Date.parse(expiresAt))))
        || (body.active !== undefined && typeof body.active !== 'boolean')) {
        throw new Error('Revisa el código, moneda, estado y fecha de vencimiento.');
    }

    const common = { code, currency, expires_at: expiresAt, active: body.active !== false };
    if (kind === 'promo') {
        const discountValue = Number(body.discountValue);
        const maxRedemptions = body.maxRedemptions === '' || body.maxRedemptions == null ? null : Number(body.maxRedemptions);
        if (!['percent', 'fixed'].includes(body.discountType)
            || !Number.isFinite(discountValue) || discountValue <= 0
            || (body.discountType === 'percent' && discountValue > 100)
            || (maxRedemptions !== null && (!Number.isInteger(maxRedemptions) || maxRedemptions < 1))) {
            throw new Error('Revisa el descuento y el límite de usos.');
        }
        return { ...common, discount_type: body.discountType, discount_value: discountValue, max_redemptions: maxRedemptions };
    }
    if (kind === 'gift-card') {
        const balance = Number(body.balance);
        if (body.balance === '' || !Number.isFinite(balance) || balance < 0 || (!editing && balance === 0)) {
            throw new Error('Revisa el saldo de la tarjeta.');
        }
        return { ...common, balance };
    }
    throw new Error('El tipo de código no es válido.');
}
