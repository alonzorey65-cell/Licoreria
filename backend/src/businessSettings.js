const currencies = ['USD', 'MXN', 'COP', 'PEN', 'EUR'];

export function parseBusinessSettings(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Los datos de configuración no son válidos.');
    const limits = { businessName: 80, openingHours: 120, address: 200, phone: 40, mapUrl: 500 };
    const values = {};
    for (const [field, max] of Object.entries(limits)) {
        if (typeof input[field] !== 'string' || input[field].trim().length > max) {
            throw new Error(`El campo ${field} no es válido.`);
        }
        values[field] = input[field].trim();
    }
    if (!values.businessName || !values.openingHours || !currencies.includes(input.currency)) {
        throw new Error('Nombre, horario y moneda válida son obligatorios.');
    }
    if (values.mapUrl) {
        try {
            const url = new URL(values.mapUrl);
            if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid protocol');
        } catch {
            throw new Error('El enlace de ubicación debe ser una URL HTTP o HTTPS válida.');
        }
    }
    return {
        business_name: values.businessName,
        opening_hours: values.openingHours,
        address: values.address,
        phone: values.phone,
        map_url: values.mapUrl,
        currency: input.currency
    };
}

export function formatBusinessSettings(row) {
    return {
        businessName: row.business_name,
        openingHours: row.opening_hours,
        address: row.address,
        phone: row.phone,
        mapUrl: row.map_url,
        currency: row.currency,
        logoUrl: row.logo_url || ''
    };
}
