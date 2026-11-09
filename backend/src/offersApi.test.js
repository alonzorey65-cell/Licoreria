import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { once } from 'node:events';
import test from 'node:test';

test('offer CRUD, permission checks and concurrent balance protection', async t => {
    const records = { store_promo_codes: new Map(), store_gift_cards: new Map() };
    let orderExists = false;
    let publicPromotion = null;
    let settings = { id: 1, business_name: 'VIP Bar', opening_hours: 'Horario no configurado', address: '', phone: '', map_url: '', currency: 'USD' };
    const mock = http.createServer(async (req, res) => {
        const url = new URL(req.url, 'http://localhost');
        res.setHeader('content-type', 'application/json');
        if (url.pathname === '/auth/v1/user') {
            res.end(JSON.stringify({ id: 'test-admin', email: 'admin@example.test' }));
            return;
        }
        if (url.pathname === '/rest/v1/reservas') {
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
                publicPromotion = { id: 1, ...JSON.parse(body)[0] };
                res.statusCode = 201;
                res.end(JSON.stringify(publicPromotion));
            } else if (req.method === 'PATCH') {
                if (url.searchParams.get('id') !== 'eq.1' || !publicPromotion) {
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
