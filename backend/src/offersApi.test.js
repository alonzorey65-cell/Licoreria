import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { once } from 'node:events';
import test from 'node:test';

test('offer CRUD, permission checks and concurrent balance protection', async t => {
    const records = { store_promo_codes: new Map(), store_gift_cards: new Map() };
    let orderExists = false;
    let publicPromotion = null;
    let product = null;
    const storedImages = new Map();
    let failImageUpload = false;
    let orderRecord = null;
    let settings = { id: 1, business_name: 'VIP Bar', opening_hours: 'Horario no configurado', address: '', phone: '', map_url: '', currency: 'USD' };
    const mock = http.createServer(async (req, res) => {
        const url = new URL(req.url, 'http://localhost');
        res.setHeader('content-type', 'application/json');
        if (url.pathname === '/auth/v1/user') {
            res.end(JSON.stringify({ id: 'test-admin', email: 'admin@example.test', email_confirmed_at: '2026-01-01T00:00:00Z', app_metadata: { provider: 'google' } }));
            return;
        }
        if (url.pathname.startsWith('/storage/v1/object/')) {
            if (req.method === 'POST') {
                const chunks = [];
                for await (const chunk of req) chunks.push(chunk);
                if (failImageUpload) {
                    res.writeHead(500);
                    res.end(JSON.stringify({ message: 'storage unavailable' }));
                    return;
                }
                storedImages.set(url.pathname, Buffer.concat(chunks));
                res.end(JSON.stringify({ Key: url.pathname }));
            } else if (req.method === 'DELETE') {
                let body = '';
                for await (const chunk of req) body += chunk;
                for (const prefix of JSON.parse(body).prefixes) storedImages.delete(`/storage/v1/object/catalog-images/${prefix}`);
                res.end('[]');
            } else if (req.method === 'GET' && url.pathname.startsWith('/storage/v1/object/public/catalog-images/')) {
                const objectPath = url.pathname.replace('/object/public/', '/object/');
                const image = storedImages.get(objectPath);
                if (!image) {
                    res.writeHead(404);
                    res.end('{}');
                } else {
                    res.writeHead(200, { 'content-type': 'image/jpeg' });
                    res.end(image);
                }
            } else {
                res.writeHead(404);
                res.end('{}');
            }
            return;
        }
        if (url.pathname === '/rest/v1/licores') {
            if (req.method === 'GET') {
                res.end(JSON.stringify(product ? [product] : []));
                return;
            }
            let body = '';
            for await (const chunk of req) body += chunk;
            if (req.method === 'POST') {
                product = { id: 1, ...JSON.parse(body)[0] };
                res.statusCode = 201;
                res.end(JSON.stringify([product]));
            } else if (req.method === 'PATCH') {
                if (url.searchParams.get('id') !== 'eq.1' || !product) {
                    res.end('[]');
                } else {
                    product = { ...product, ...JSON.parse(body) };
                    res.end(JSON.stringify([product]));
                }
            }
            return;
        }
        if (url.pathname === '/rest/v1/reservas') {
            if (req.method === 'POST') {
                let body = '';
                for await (const chunk of req) body += chunk;
                orderRecord = { id: 1, ...JSON.parse(body)[0] };
                res.statusCode = 201;
                res.end(JSON.stringify([orderRecord]));
                return;
            }
            res.end(JSON.stringify(orderExists ? [{ id: 1 }] : []));
            return;
        }
        if (url.pathname === '/rest/v1/mesas' && req.method === 'PATCH') {
            res.end(JSON.stringify(url.searchParams.get('number') === 'eq.10' ? [{ id: 10 }] : []));
            return;
        }
        if (url.pathname === '/rest/v1/promociones') {
            let body = '';
            for await (const chunk of req) body += chunk;
            if (req.method === 'POST') {
                publicPromotion = { id: 1, stock: 0, ...JSON.parse(body)[0] };
                res.statusCode = 201;
                res.end(JSON.stringify(publicPromotion));
            } else if (req.method === 'PATCH') {
                if (url.searchParams.get('id') !== 'eq.1' || !publicPromotion
                    || (url.searchParams.has('stock') && url.searchParams.get('stock') !== `eq.${publicPromotion.stock}`)) {
                    res.end('[]');
                } else {
                    publicPromotion = { ...publicPromotion, ...JSON.parse(body) };
                    res.end(JSON.stringify([publicPromotion]));
                }
            } else {
                res.end(JSON.stringify(publicPromotion ? [publicPromotion] : []));
            }
            return;
        }
        if (url.pathname === '/rest/v1/business_settings') {
            if (req.method === 'POST') {
                let body = '';
                for await (const chunk of req) body += chunk;
                settings = { ...settings, ...JSON.parse(body) };
            }
            res.end(JSON.stringify(settings));
            return;
        }
        const table = url.pathname.split('/').pop();
        const collection = records[table];
        if (!collection) {
            res.writeHead(404);
            res.end('{}');
            return;
        }
        let body = '';
        for await (const chunk of req) body += chunk;
        const code = url.searchParams.get('code')?.replace(/^eq\./, '');
        const current = collection.get(code);
        const objectResponse = (req.headers.accept || '').includes('application/vnd.pgrst.object');
        let result;
        if (req.method === 'POST') {
            const value = JSON.parse(body);
            result = Array.isArray(value) ? value[0] : value;
            if (table === 'store_promo_codes') result.redemption_count = 0;
            collection.set(result.code, result);
            res.statusCode = 201;
        } else if (req.method === 'PATCH') {
            const balance = url.searchParams.get('balance')?.replace(/^eq\./, '');
            const count = url.searchParams.get('redemption_count')?.replace(/^eq\./, '');
            if (current && (balance === undefined || Number(balance) === Number(current.balance))
                && (count === undefined || Number(count) === Number(current.redemption_count))) {
                result = { ...current, ...JSON.parse(body) };
                collection.set(code, result);
            }
        } else if (req.method === 'DELETE') {
            if (current) { result = current; collection.delete(code); }
        } else {
            result = [...collection.values()];
        }
        if (result === undefined) result = objectResponse ? null : [];
        else if (!Array.isArray(result) && !objectResponse) result = [result];
        res.end(JSON.stringify(result));
    });
    mock.listen(0, '127.0.0.1');
    await once(mock, 'listening');
    t.after(() => mock.close());

    const reserve = http.createServer();
    reserve.listen(0, '127.0.0.1');
    await once(reserve, 'listening');
    const port = reserve.address().port;
    await new Promise(resolve => reserve.close(resolve));
    const backend = spawn(process.execPath, ['server.js'], {
        cwd: new URL('..', import.meta.url),
        env: {
            ...process.env,
            PORT: String(port),
            SUPABASE_URL: `http://127.0.0.1:${mock.address().port}`,
            SUPABASE_KEY: 'test-public-key',
            SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
            ADMIN_EMAIL: 'admin@example.test'
        },
        stdio: ['ignore', 'pipe', 'pipe']
    });
    t.after(() => backend.kill());
    const base = `http://127.0.0.1:${port}/api`;
    let ready = false;
    for (let i = 0; i < 50 && !ready; i += 1) {
        try { ready = (await fetch(`${base}/public-config`)).status > 0; }
        catch { await new Promise(resolve => setTimeout(resolve, 100)); }
    }
    assert.ok(ready, 'backend failed to start');
    const request = async (path, method = 'GET', body, authenticated = true) => {
        const response = await fetch(`${base}${path}`, {
            method,
            headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: 'Bearer test-token' } : {}) },
            ...(body ? { body: JSON.stringify(body) } : {})
        });
        return { status: response.status, data: await response.json() };
    };

    assert.equal((await request('/ofertas-admin', 'GET', null, false)).status, 401);
    assert.equal((await request('/mesas/liberar', 'POST', { mesaNumber: 10 }, false)).status, 401);
    assert.equal((await request('/mesas/liberar', 'POST', { mesaNumber: 10 })).status, 200);
    assert.equal((await request('/mesas/liberar', 'POST', { mesaNumber: 999 })).status, 404);
    assert.equal((await request('/business-settings', 'GET', null, false)).data.businessName, 'VIP Bar');
    const newSettings = { businessName: 'Mi local', openingHours: 'Todos los días', address: 'Calle 1', phone: '+51 123', mapUrl: 'https://maps.example', currency: 'PEN' };
    assert.equal((await request('/business-settings', 'PUT', newSettings, false)).status, 401);
    assert.equal((await request('/business-settings', 'PUT', { ...newSettings, currency: 'BAD' })).status, 400);
    assert.equal((await request('/business-settings', 'PUT', newSettings)).data.currency, 'PEN');
    assert.equal((await request('/business-settings', 'GET', null, false)).data.businessName, 'Mi local');
    const productForm = () => {
        const form = new FormData();
        form.set('name', 'Botella');
        form.set('price', '10');
        form.set('stock', '3');
        form.set('category', 'Ron');
        return form;
    };
    const imageForm = productForm();
    imageForm.set('image', new Blob(['image bytes'], { type: 'image/jpeg' }), 'bottle.jpg');
    assert.equal((await fetch(`${base}/licores`, { method: 'POST', body: imageForm })).status, 401);
    const createdProduct = await fetch(`${base}/licores`, {
        method: 'POST', headers: { Authorization: 'Bearer test-token' }, body: imageForm
    });
    assert.equal(createdProduct.status, 201);
    const productImage = (await createdProduct.json()).image;
    assert.match(productImage, /\/storage\/v1\/object\/public\/catalog-images\/products\/.*\.jpg$/);
    assert.equal(storedImages.size, 1);
    assert.equal(await (await fetch(productImage)).text(), 'image bytes');
    assert.equal((await request('/licores', 'GET', null, false)).data[0].image, productImage);
    const updatedProduct = await fetch(`${base}/licores/1`, {
        method: 'PUT', headers: { Authorization: 'Bearer test-token' }, body: productForm()
    });
    assert.equal((await updatedProduct.json()).image, productImage);
    const missingProduct = productForm();
    missingProduct.set('image', new Blob(['image bytes'], { type: 'image/png' }), 'missing.png');
    assert.equal((await fetch(`${base}/licores/999`, {
        method: 'PUT', headers: { Authorization: 'Bearer test-token' }, body: missingProduct
    })).status, 404);
    assert.equal(storedImages.size, 1, 'failed product update removes uploaded image');
    const invalidImage = productForm();
    invalidImage.set('image', new Blob(['bad'], { type: 'text/plain' }), 'bad.txt');
    assert.equal((await fetch(`${base}/licores`, {
        method: 'POST', headers: { Authorization: 'Bearer test-token' }, body: invalidImage
    })).status, 400);
    const oversizedImage = productForm();
    oversizedImage.set('image', new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: 'image/jpeg' }), 'large.jpg');
    assert.equal((await fetch(`${base}/licores`, {
        method: 'POST', headers: { Authorization: 'Bearer test-token' }, body: oversizedImage
    })).status, 413);
    failImageUpload = true;
    const failedImage = productForm();
    failedImage.set('image', new Blob(['image bytes'], { type: 'image/jpeg' }), 'bottle.jpg');
    const failedUpload = await fetch(`${base}/licores/1`, {
        method: 'PUT', headers: { Authorization: 'Bearer test-token' }, body: failedImage
    });
    assert.equal(failedUpload.status, 500);
    assert.match((await failedUpload.json()).error, /No se pudo guardar la imagen/);
    assert.equal(product.image, productImage);
    failImageUpload = false;
    const publicPromo = { titulo: 'Dos unidades', descuento: 'Promoción de prueba', precio: '140.50' };
    assert.equal((await request('/promociones', 'POST', publicPromo, false)).status, 401);
    assert.equal((await request('/promociones', 'POST', { ...publicPromo, precio: '-1' })).status, 400);
    assert.equal((await request('/promociones', 'POST', publicPromo)).data.precio, 140.5);
    assert.equal((await request('/promociones', 'GET', null, false)).data[0].precio, 140.5);
    assert.equal((await request('/promociones/1', 'PUT', { ...publicPromo, precio: '99.99' })).data.precio, 99.99);
    assert.equal((await request('/promociones/1', 'PUT', { titulo: 'Actualizada', descuento: 'Detalle' })).data.precio, 99.99);
    assert.equal((await request('/promociones/1', 'PUT', { ...publicPromo, precio: '' })).data.precio, null);
    assert.equal((await request('/promociones/1', 'PUT', { ...publicPromo, precio: '1.999' })).status, 400);
    const form = new FormData();
    form.set('titulo', 'Con formulario');
    form.set('descuento', 'Dos unidades');
    form.set('precio', '140.00');
    const formResponse = await fetch(`${base}/promociones/1`, {
        method: 'PUT', headers: { Authorization: 'Bearer test-token' }, body: form
    });
    assert.equal(formResponse.status, 200);
    assert.equal((await formResponse.json()).precio, 140);
    assert.equal((await request('/promociones/1', 'PUT', { ...publicPromo, stock: 5 })).status, 400);
    assert.equal((await request('/promociones/1', 'PUT', { ...publicPromo, stock: 5, expectedStock: 1 })).status, 409);
    assert.equal((await request('/promociones/1', 'PUT', { ...publicPromo, stock: 5, expectedStock: 0 })).data.stock, 5);
    const promoImageForm = new FormData();
    promoImageForm.set('titulo', publicPromo.titulo);
    promoImageForm.set('descuento', publicPromo.descuento);
    promoImageForm.set('precio', publicPromo.precio);
    promoImageForm.set('image', new Blob(['promo bytes'], { type: 'image/webp' }), 'promo.webp');
    const updatedPromo = await fetch(`${base}/promociones/1`, {
        method: 'PUT', headers: { Authorization: 'Bearer test-token' }, body: promoImageForm
    });
    assert.equal(updatedPromo.status, 200);
    const promoImage = (await updatedPromo.json()).imagen;
    assert.match(promoImage, /\/storage\/v1\/object\/public\/catalog-images\/promotions\/.*\.webp$/);
    assert.equal(await (await fetch(promoImage)).text(), 'promo bytes');
    assert.equal((await request('/promociones', 'GET', null, false)).data[0].imagen, promoImage);
    assert.equal(storedImages.size, 2);
    const conflictingPromo = new FormData();
    conflictingPromo.set('titulo', publicPromo.titulo);
    conflictingPromo.set('descuento', publicPromo.descuento);
    conflictingPromo.set('stock', '6');
    conflictingPromo.set('expectedStock', '0');
    conflictingPromo.set('image', new Blob(['image bytes'], { type: 'image/png' }), 'conflict.png');
    assert.equal((await fetch(`${base}/promociones/1`, {
        method: 'PUT', headers: { Authorization: 'Bearer test-token' }, body: conflictingPromo
    })).status, 409);
    assert.equal(storedImages.size, 2, 'stock conflict removes uploaded image');
    const order = { clientName: 'Cliente', fulfillmentMode: 'pickup', currency: 'PEN', items: [{ type: 'promotion', id: 1, qty: 2, price: 140.5, name: 'Precio falso' }] };
    assert.equal((await request('/reservas', 'POST', { ...order, currency: 'USD' })).status, 400);
    assert.equal((await request('/reservas', 'POST', { ...order, items: [{ ...order.items[0], price: 1 }] })).status, 409);
    assert.equal((await request('/reservas', 'POST', { ...order, items: [{ ...order.items[0], qty: 6 }] })).status, 409);
    const placed = await request('/reservas', 'POST', order);
    assert.equal(placed.status, 201);
    assert.equal(placed.data.order_total, 281);
    assert.equal(placed.data.items[0].name, 'Dos unidades');
    assert.equal(placed.data.items[0].type, 'promotion');
    assert.equal(orderRecord.items[0].price, 140.5);
    const newPromoForm = new FormData();
    newPromoForm.set('titulo', 'Nueva promoción');
    newPromoForm.set('descuento', 'Detalle');
    newPromoForm.set('image', new Blob(['new promo'], { type: 'image/png' }), 'promo.png');
    const createdPromo = await fetch(`${base}/promociones`, {
        method: 'POST', headers: { Authorization: 'Bearer test-token' }, body: newPromoForm
    });
    assert.equal(createdPromo.status, 201);
    assert.match((await createdPromo.json()).imagen, /\/catalog-images\/promotions\/.*\.png$/);
    assert.equal(storedImages.size, 3);
    const promo = { code: 'PROMO-TEST', discountType: 'percent', discountValue: 20, currency: 'PEN', maxRedemptions: '', expiresAt: '' };
    const gift = { code: 'REGALO-TEST', balance: 50, currency: 'PEN', expiresAt: '' };
    assert.equal((await request('/ofertas-admin/promo', 'POST', promo)).status, 201);
    assert.equal((await request('/ofertas-admin/gift-card', 'POST', gift)).status, 201);
    assert.equal((await request('/ofertas-admin')).data.giftCards.length, 1);
    assert.equal((await request('/ofertas-admin/promo/PROMO-TEST', 'PUT', { ...promo, discountValue: 30, expectedValue: 0, active: false })).data.discount_value, 30);
    assert.equal((await request('/ofertas-admin/gift-card/REGALO-TEST', 'PUT', { ...gift, balance: 25, expectedValue: 50 })).data.balance, 25);
    assert.equal((await request('/ofertas-admin/gift-card/REGALO-TEST', 'PUT', { ...gift, balance: 40, expectedValue: 50 })).status, 409);
    orderExists = true;
    assert.equal((await request('/ofertas-admin/gift-card/REGALO-TEST', 'DELETE')).status, 409);
    orderExists = false;
    assert.equal((await request('/ofertas-admin/gift-card/REGALO-TEST', 'DELETE')).status, 200);
    assert.equal((await request('/ofertas-admin/promo/PROMO-TEST', 'DELETE')).status, 200);
});
