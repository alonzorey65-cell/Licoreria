import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ==================== CONFIGURACIÓN DE CORS ====================
const allowedOrigins = [
    'https://alonzorey65-cell.github.io',
    'http://localhost:5173',
    'http://localhost:3000'
];

app.use(cors({
    origin: function (origin, callback) {
        // Permitir solicitudes sin origen (como Postman o apps móviles)
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Bloqueado por la política CORS de la Licorería'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
    throw new Error('Faltan SUPABASE_URL o SUPABASE_KEY en el archivo .env del backend.');
}
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey || supabaseKey);
const bootstrapAdminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
if (!supabaseServiceRoleKey) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY no está configurada; las operaciones protegidas por RLS podrían fallar.');
}

async function getClientUser(req) {
    const authorization = req.get('authorization') || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!token) return null;
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user;
}

function hasVerifiedClientIdentity(user) {
    const hasGoogleIdentity = user?.app_metadata?.provider === 'google'
        || user?.app_metadata?.providers?.includes('google');
    return Boolean(
        (hasGoogleIdentity && user?.email && user.email_confirmed_at)
        || (user?.phone && user.phone_confirmed_at)
    );
}

function getClientScopedSupabase(req) {
    const token = (req.get('authorization') || '').replace(/^Bearer /, '');
    return createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false }
    });
}

async function respondWithTableRows(res, table) {
    try {
        const { data, error } = await supabase.from(table).select('*');
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

async function getCheckoutDiscounts({ promoCode, giftCardCode, currency, total, clientId, useRewardsCredit = false }) {
    let remaining = Math.max(0, Number(total) || 0);
    const result = { discount: 0, promo: null, giftCard: null, rewards: null };
    const normalizedCurrency = typeof currency === 'string' ? currency.toUpperCase() : 'USD';

    if (promoCode) {
        const code = String(promoCode).trim().toUpperCase();
        const { data: promo, error } = await supabase.from('store_promo_codes').select('*').eq('code', code).maybeSingle();
        if (error) throw error;
        if (!promo) throw new Error('No encontramos ese código promocional. Revisa que esté escrito correctamente.');
        if (!promo.active) throw new Error('Ese código promocional está desactivado.');
        if (promo.expires_at && new Date(promo.expires_at) < new Date()) throw new Error('Ese código promocional ya venció.');
        if (promo.max_redemptions !== null && promo.redemption_count >= promo.max_redemptions) {
            throw new Error('Ese código promocional ya alcanzó su límite de usos.');
        }
        if (promo.discount_type === 'fixed' && promo.currency !== normalizedCurrency) {
            throw new Error(`Ese descuento es de ${promo.currency}; la tienda está usando ${normalizedCurrency}.`);
        }
        const value = promo.discount_type === 'percent'
            ? remaining * Math.min(Number(promo.discount_value), 100) / 100
            : Number(promo.discount_value);
        const amount = Math.min(remaining, value);
        result.promo = { code, amount, redemptionCount: promo.redemption_count };
        result.discount += amount;
        remaining -= amount;
    }

    if (giftCardCode) {
        const code = String(giftCardCode).trim().toUpperCase();
        const { data: giftCard, error } = await supabase.from('store_gift_cards').select('*').eq('code', code).maybeSingle();
        if (error) throw error;
        if (!giftCard || !giftCard.active || Number(giftCard.balance) <= 0
            || (giftCard.expires_at && new Date(giftCard.expires_at) < new Date())
            || giftCard.currency !== normalizedCurrency) {
            throw new Error('La tarjeta de regalo no es válida, venció o no tiene saldo.');
        }
        const amount = Math.min(remaining, Number(giftCard.balance));
        result.giftCard = { code, amount, balance: Number(giftCard.balance) };
        result.discount += amount;
        remaining -= amount;
    }

    if (clientId && useRewardsCredit) {
        const { data: account, error } = await supabase.from('customer_rewards')
            .select('credit_balance').eq('user_id', clientId).maybeSingle();
        if (error) throw error;
        if (account && Number(account.credit_balance) > 0) {
            result.rewards = {
                amount: Math.min(remaining, Number(account.credit_balance)),
                balance: Number(account.credit_balance)
            };
            result.discount += result.rewards.amount;
        }
    }
    return result;
}

async function claimCheckoutDiscounts(discounts, clientId, useRewardsCredit) {
    const claims = [];
    try {
        if (discounts.promo) {
            const count = discounts.promo.redemptionCount;
            const { data, error } = await supabase.from('store_promo_codes')
                .update({ redemption_count: count + 1 })
                .eq('code', discounts.promo.code)
                .eq('redemption_count', count)
                .select('code').maybeSingle();
            if (error) throw error;
            if (!data) throw new Error('El código promocional se acaba de agotar. Intenta de nuevo.');
            claims.push({ type: 'promo', code: discounts.promo.code, count });
        }
        if (discounts.giftCard) {
            const { data, error } = await supabase.from('store_gift_cards')
                .update({ balance: discounts.giftCard.balance - discounts.giftCard.amount })
                .eq('code', discounts.giftCard.code)
                .eq('balance', discounts.giftCard.balance)
                .select('code').maybeSingle();
            if (error) throw error;
            if (!data) throw new Error('El saldo de la tarjeta cambió. Vuelve a validar el código.');
            claims.push({ type: 'gift', code: discounts.giftCard.code, balance: discounts.giftCard.balance, amount: discounts.giftCard.amount });
        }
        if (useRewardsCredit && discounts.rewards?.amount) {
            const { data, error } = await supabase.from('customer_rewards')
                .update({ credit_balance: discounts.rewards.balance - discounts.rewards.amount })
                .eq('user_id', clientId)
                .eq('credit_balance', discounts.rewards.balance)
                .select('user_id').maybeSingle();
            if (error) throw error;
            if (!data) throw new Error('El saldo de recompensas cambió. Vuelve a intentarlo.');
            claims.push({ type: 'rewards', userId: clientId, balance: discounts.rewards.balance, amount: discounts.rewards.amount });
        }
        return claims;
    } catch (error) {
        await rollbackCheckoutDiscounts(claims);
        throw error;
    }
}

async function rollbackCheckoutDiscounts(claims) {
    for (const claim of [...claims].reverse()) {
        let query;
        if (claim.type === 'promo') {
            query = supabase.from('store_promo_codes').update({ redemption_count: claim.count })
                .eq('code', claim.code).eq('redemption_count', claim.count + 1);
        } else if (claim.type === 'gift') {
            const currentBalance = claim.balance - (claim.amount || 0);
            query = supabase.from('store_gift_cards').update({ balance: claim.balance })
                .eq('code', claim.code).eq('balance', currentBalance);
        } else {
            const currentBalance = claim.balance - (claim.amount || 0);
            query = supabase.from('customer_rewards').update({ credit_balance: claim.balance })
                .eq('user_id', claim.userId).eq('credit_balance', currentBalance);
        }
        const { error } = await query;
        if (error) throw error;
    }
}

app.get('/api/public-config', (req, res) => {
    let keyRole = '';
    if (supabaseKey.startsWith('eyJ')) {
        try {
            keyRole = JSON.parse(Buffer.from(supabaseKey.split('.')[1], 'base64url').toString('utf8')).role || '';
        } catch {
            keyRole = '';
        }
    }
    const isPublicKey = supabaseKey.startsWith('sb_publishable_') || keyRole === 'anon';
    if (!isPublicKey || supabaseKey === supabaseServiceRoleKey) {
        return res.status(503).json({ error: 'Supabase no tiene configurada una clave publicable para tiempo real.' });
    }

    res.set('Cache-Control', 'no-store');
    res.json({ supabaseUrl, publishableKey: supabaseKey });
});

const publicApiRequests = new Set([
    'GET /licores',
    'GET /mesas',
    'GET /promociones',
    'POST /reservas',
    'POST /resenas',
    'POST /solicitudes-ayuda',
    'POST /availability-alerts',
    'POST /price-alerts',
    'GET /client/orders',
    'GET /client/rewards',
    'POST /client/rewards/redeem',
    'PATCH /reservas/cliente',
    'POST /ofertas/validar'
]);

const resourcePermissions = {
    licores: 'licores',
    mesas: 'mesas',
    reservas: 'reservas',
    categorias: 'categorias',
    proveedores: 'proveedores',
    empleados: 'empleados',
    promociones: 'promociones',
    kardex: 'kardex',
    facturas: 'pos',
    resenas: 'resenas',
    'solicitudes-ayuda': 'ayuda',
    compras: 'compras',
    'lotes-inventario': 'lotes',
    'cierres-caja': 'caja',
    agenda: 'agenda',
    fidelizacion: 'fidelizacion',
    'role-permissions': 'permisos',
    'availability-alerts': 'alertas',
    'ofertas-admin': 'promociones',
    'client-profiles': 'clientes'
};

app.use('/api', async (req, res, next) => {
    if (
        publicApiRequests.has(`${req.method} ${req.path}`)
        || (req.method === 'GET' && /^\/reservas\/[^/]+\/estado$/.test(req.path))
        || (req.method === 'GET' && /^\/licores\/[^/]+\/resenas$/.test(req.path))
        || req.path === '/public-config'
    ) return next();

    const authorization = req.get('authorization') || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Inicia sesión con una cuenta autorizada.' });
    if (!supabaseServiceRoleKey) {
        return res.status(503).json({
            error: 'El backend no tiene SUPABASE_SERVICE_ROLE_KEY configurada. Las rutas administrativas necesitan esa clave para consultar empleados y permisos protegidos por RLS.'
        });
    }

    try {
        const { data: authData, error: authError } = await supabase.auth.getUser(token);
        const email = authData.user?.email?.trim().toLowerCase();
        if (authError || !email) return res.status(401).json({ error: 'La sesión no es válida o expiró.' });

        const isBootstrapAdmin = bootstrapAdminEmail && email === bootstrapAdminEmail;
        let role = isBootstrapAdmin ? 'Administrador' : null;
        if (!isBootstrapAdmin) {
            const { data: employees, error: employeeError } = await supabase
                .from('empleados')
                .select('rol,email')
                .not('email', 'is', null);
            if (employeeError) throw employeeError;
            role = employees.find(item => item.email?.trim().toLowerCase() === email)?.rol || null;
        }
        if (!role) return res.status(403).json({ error: 'Esta cuenta no está vinculada a un empleado autorizado.' });
        if (req.path === '/admin-session') {
            req.adminUser = { email, role };
            return next();
        }
        if (role === 'Administrador') {
            req.adminUser = { email, role };
            return next();
        }

        const resource = req.path.split('/').filter(Boolean)[0];
        const permission = resourcePermissions[resource];
        if (!permission) return res.status(403).json({ error: 'No tienes permiso para esta operación.' });

        const { data: roleConfig, error: roleError } = await supabase
            .from('role_permissions')
            .select('permissions')
            .eq('role', role)
            .maybeSingle();
        if (roleError) throw roleError;
        if (!roleConfig?.permissions?.[permission]) {
            return res.status(403).json({ error: `Tu rol (${role}) no tiene permiso para esta sección.` });
        }
        req.adminUser = { email, role };
        return next();
    } catch (error) {
        console.error('No se pudo validar el acceso administrativo.', error);
        return res.status(503).json({ error: 'No se pudo validar el acceso. Revisa la configuración y las migraciones de Supabase.' });
    }
});

app.get('/api/admin-session', async (req, res) => {
    if (req.adminUser.role === 'Administrador') {
        const permissions = [
            'dashboard', 'licores', 'mesas', 'ayuda', 'reservas', 'pos', 'kardex', 'analitica',
            'proveedores', 'empleados', 'promociones', 'resenas', 'categorias', 'configuracion',
            'reportes', 'actividad', 'clientes', 'alertas', 'compras', 'caja', 'agenda',
            'fidelizacion', 'lotes', 'permisos'
        ];
        return res.json({ email: req.adminUser.email, role: req.adminUser.role, permissions: Object.fromEntries(permissions.map(permission => [permission, true])) });
    }
    try {
        const { data, error } = await supabase.from('role_permissions').select('permissions').eq('role', req.adminUser.role).maybeSingle();
        if (error) throw error;
        if (!data) return res.status(403).json({ error: 'El rol no tiene permisos configurados.' });
        return res.json({ email: req.adminUser.email, role: req.adminUser.role, permissions: data.permissions });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const extensions = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
        cb(null, `${randomUUID()}${extensions[file.mimetype]}`);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
            return cb(new Error('La imagen debe ser JPG, PNG o WebP.'));
        }
        return cb(null, true);
    }
});
const parseImageUpload = (req, res, next) => upload.single('image')(req, res, error => {
    if (error) {
        const status = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        return res.status(status).json({ error: error.message });
    }
    return next();
});

// ==================== LICORES ====================
app.get('/api/licores', async (req, res) => {
    try {
        const { data, error } = await supabase.from('licores').select('*');
        if (error) throw error;
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/licores', upload.single('image'), async (req, res) => {
    try {
        const { name, price, stock, category, description, presentacion, graduacion, origen, brand } = req.body;
        const imageUrl = req.file ? `/uploads/${req.file.filename}` : '';
        const { data, error } = await supabase.from('licores').insert([{
            name, price: parseFloat(price), stock: parseInt(stock), category, image: imageUrl,
            description: description || null, presentacion: presentacion || null,
            graduacion: graduacion || null, origen: origen || null, brand: brand || null
        }]).select();
        if (error) throw error;
        res.status(201).json(data[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/licores/:id', upload.single('image'), async (req, res) => {
    try {
        const id = req.params.id;
        const { name, price, stock, category, description, presentacion, graduacion, origen, brand } = req.body;
        let updateData = {
            name, price: parseFloat(price), stock: parseInt(stock), category,
            description: description || null, presentacion: presentacion || null,
            graduacion: graduacion || null, origen: origen || null, brand: brand || null
        };
        if (req.file) updateData.image = `/uploads/${req.file.filename}`;
        const { data, error } = await supabase.from('licores').update(updateData).eq('id', id).select();
        if (error) throw error;
        if (!data.length) return res.status(404).json({ error: 'No se encontró el producto que se quiere actualizar.' });
        res.json(data[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/licores/:id', async (req, res) => {
    try {
        const { data, error } = await supabase.from('licores').delete().eq('id', req.params.id).select('id').maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'No se encontró el producto que se quiere eliminar.' });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== MESAS Y RESERVAS ====================
app.get('/api/mesas', async (req, res) => {
    try {
        const { data, error } = await supabase.from('mesas').select('*');
        if (error) throw error;
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/mesas', async (req, res) => {
    try {
        const { number, seats } = req.body;
        const { data, error } = await supabase.from('mesas').insert([{ number, seats: parseInt(seats), status: 'Disponible' }]).select();
        if (error) throw error;
        res.status(201).json(data[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/mesas/:id', async (req, res) => {
    try {
        const { data, error } = await supabase.from('mesas').delete().eq('id', req.params.id).select('id').maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'No se encontró la mesa que se quiere eliminar.' });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/mesas/liberar', async (req, res) => {
    try {
        const { error } = await supabase.from('mesas').update({ status: 'Disponible' }).eq('number', req.body.mesaNumber);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/reservas', async (req, res) => {
    try {
        const { clientName, mesaId, items } = req.body;
        if (req.body.fulfillmentMode !== undefined && !['dine_in', 'pickup'].includes(req.body.fulfillmentMode)) {
            return res.status(400).json({ error: 'La modalidad del pedido no es válida.' });
        }
        if ((req.body.promoCode && !/^[A-Za-z0-9_-]{3,40}$/.test(String(req.body.promoCode)))
            || (req.body.giftCardCode && !/^[A-Za-z0-9_-]{3,40}$/.test(String(req.body.giftCardCode)))) {
            return res.status(400).json({ error: 'Revisa los códigos promocionales.' });
        }
        if (req.body.clientContact != null && (typeof req.body.clientContact !== 'string' || req.body.clientContact.trim().length > 40)) {
            return res.status(400).json({ error: 'El teléfono o medio de contacto no es válido.' });
        }
        const fulfillmentMode = req.body.fulfillmentMode === 'pickup' ? 'pickup' : 'dine_in';
        const scheduledFor = req.body.scheduledFor ? new Date(req.body.scheduledFor) : null;
        if (typeof clientName !== 'string' || clientName.trim().length < 2
            || (fulfillmentMode === 'dine_in' && !mesaId) || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Indica tu nombre, una modalidad válida y al menos un producto.' });
        }

        if (req.body.scheduledFor && (Number.isNaN(scheduledFor.getTime()) || scheduledFor < new Date(Date.now() + 15 * 60 * 1000))) {
            return res.status(400).json({ error: 'El horario debe ser válido y tener al menos 15 minutos de anticipación.' });
        }

        const clientUser = await getClientUser(req);
        if (!hasVerifiedClientIdentity(clientUser)) {
            return res.status(401).json({ error: 'Inicia sesión con una cuenta verificada para confirmar el pedido.' });
        }
        if (!supabaseServiceRoleKey) {
            return res.status(503).json({ error: 'El backend necesita SUPABASE_SERVICE_ROLE_KEY para guardar pedidos asociados a una cuenta.' });
        }

        let mesaData = null;
        if (fulfillmentMode === 'dine_in') {
            const { data, error } = await supabase.from('mesas').select('*').eq('id', mesaId).maybeSingle();
            if (error) throw error;
            if (!data) return res.status(404).json({ error: 'Mesa no encontrada.' });
            mesaData = data;
            if (mesaData.status !== 'Disponible') {
                return res.status(409).json({ error: 'La mesa seleccionada ya no está disponible.' });
            }
            {
                const slot = scheduledFor || new Date();
                const lowerBound = new Date(slot.getTime() - 90 * 60 * 1000).toISOString();
                const upperBound = new Date(slot.getTime() + 90 * 60 * 1000).toISOString();
                const { data: conflicts, error: conflictError } = await supabase.from('reservas')
                    .select('id')
                    .eq('mesanumber', mesaData.number)
                    .neq('status', 'Cancelado')
                    .gte('scheduled_for', lowerBound)
                    .lte('scheduled_for', upperBound)
                    .limit(1);
                if (conflictError) throw conflictError;
                if (conflicts.length) return res.status(409).json({ error: 'La mesa ya está reservada en ese horario. Elige otra hora o mesa.' });
            }
        }

        const requestedIds = [...new Set(items.map(item => String(item?.id || '')))];
        if (items.some(item => !item || !Number.isInteger(Number(item.id)) || Number(item.id) <= 0
            || !Number.isInteger(Number(item.qty)) || Number(item.qty) < 1 || Number(item.qty) > 50)) {
            return res.status(400).json({ error: 'Revisa las cantidades de los productos.' });
        }
        const { data: products, error: productsError } = await supabase
            .from('licores')
            .select('id,name,price,stock')
            .in('id', requestedIds);
        if (productsError) throw productsError;
        const productsById = new Map((products || []).map(product => [String(product.id), product]));
        if (productsById.size !== requestedIds.length) return res.status(400).json({ error: 'Uno o más productos ya no existen.' });
        const verifiedItems = items.map(item => {
            const product = productsById.get(String(item.id));
            return { id: product.id, name: product.name, price: Number(product.price), qty: Number(item.qty) };
        });
        const quantityById = verifiedItems.reduce((totals, item) => {
            totals.set(String(item.id), (totals.get(String(item.id)) || 0) + item.qty);
            return totals;
        }, new Map());
        const unavailable = [...quantityById.entries()].find(([id, quantity]) => Number(productsById.get(id).stock) < quantity);
        if (unavailable) return res.status(409).json({ error: `${productsById.get(unavailable[0]).name} ya no tiene suficiente stock.` });
        const total = verifiedItems.reduce((sum, item) => sum + item.price * item.qty, 0);
        const currency = String(req.body.currency || 'USD').toUpperCase();
        if (!['USD', 'MXN', 'COP', 'PEN', 'EUR'].includes(currency)) {
            return res.status(400).json({ error: 'La moneda seleccionada no es válida.' });
        }
        const useRewardsCredit = req.body.useRewardsCredit === true;
        if (useRewardsCredit && !clientUser) {
            return res.status(401).json({ error: 'Inicia sesión para usar el crédito de recompensas.' });
        }
        const discounts = await getCheckoutDiscounts({
            promoCode: req.body.promoCode,
            giftCardCode: req.body.giftCardCode,
            currency,
            total,
            clientId: clientUser?.id,
            useRewardsCredit
        });

        const nuevaReserva = {
            clientname: clientName.trim(),
            client_contact: typeof req.body.clientContact === 'string' ? req.body.clientContact.trim() : null,
            mesanumber: mesaData?.number || null,
            items: verifiedItems,
            date: new Date().toISOString(),
            status: 'Recibido',
            tracking_token: randomUUID(),
            fulfillment_mode: fulfillmentMode,
            scheduled_for: scheduledFor?.toISOString() || null,
            client_user_id: clientUser?.id || null,
            discount_amount: discounts.discount,
            promo_discount_amount: discounts.promo?.amount || 0,
            gift_card_discount_amount: discounts.giftCard?.amount || 0,
            reward_discount_amount: useRewardsCredit ? discounts.rewards?.amount || 0 : 0,
            promo_code: req.body.promoCode ? String(req.body.promoCode).trim().toUpperCase() : null,
            gift_card_code: req.body.giftCardCode ? String(req.body.giftCardCode).trim().toUpperCase() : null,
            order_total: total,
            currency
        };
        const { data, error } = await supabase.from('reservas').insert([nuevaReserva]).select();
        if (error) throw error;
        let discountClaims;
        try {
            discountClaims = await claimCheckoutDiscounts(discounts, clientUser?.id, useRewardsCredit);
        } catch (claimError) {
            const { error: deleteError } = await supabase.from('reservas').delete().eq('id', data[0].id);
            if (deleteError) throw new Error(`${claimError.message} Además, no se pudo eliminar el pedido incompleto: ${deleteError.message}`);
            return res.status(409).json({ error: claimError.message });
        }

        if (fulfillmentMode === 'pickup') {
            return res.status(201).json({
                ...data[0],
                clientName: data[0].clientname,
                mesaNumber: data[0].mesanumber,
                fulfillmentMode,
                scheduledFor: data[0].scheduled_for
            });
        }

        if (scheduledFor) {
            return res.status(201).json({
                ...data[0],
                clientName: data[0].clientname,
                mesaNumber: data[0].mesanumber,
                fulfillmentMode,
                scheduledFor: data[0].scheduled_for
            });
        }

        const { data: updatedTable, error: tableUpdateError } = await supabase
            .from('mesas')
            .update({ status: 'Ocupada' })
            .eq('id', mesaId)
            .eq('status', 'Disponible')
            .select('id')
            .maybeSingle();

        if (tableUpdateError || !updatedTable) {
            await rollbackCheckoutDiscounts(discountClaims);
            const { error: rollbackError } = await supabase.from('reservas').delete().eq('id', data[0].id);
            if (rollbackError) {
                throw new Error(`No se pudo ocupar la mesa y falló la reversión del pedido: ${rollbackError.message}`);
            }
            if (tableUpdateError) throw tableUpdateError;
            return res.status(409).json({ error: 'La mesa dejó de estar disponible. Vuelve a elegir otra mesa.' });
        }

        res.status(201).json({
            ...data[0],
            clientName: data[0].clientname,
            mesaNumber: data[0].mesanumber,
            fulfillmentMode,
            scheduledFor: data[0].scheduled_for
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/reservas/:id/estado', async (req, res) => {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    if (!token) return res.status(404).json({ error: 'No se encontró el seguimiento del pedido.' });
    try {
        const client = await getClientUser(req);
        if (!hasVerifiedClientIdentity(client)) {
            return res.status(401).json({ error: 'Inicia sesión con la cuenta asociada a este pedido para consultar su estado.' });
        }
        const clientSupabase = getClientScopedSupabase(req);
        const { data, error } = await clientSupabase
            .from('reservas')
            .select('id,status,date,fulfillment_mode,scheduled_for,mesanumber,clientname,items,discount_amount,order_total')
            .eq('id', req.params.id)
            .eq('tracking_token', token)
            .eq('client_user_id', client.id)
            .maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'No se encontró el seguimiento del pedido.' });
        return res.json({
            ...data,
            clientName: data.clientname,
            mesaNumber: data.mesanumber,
            fulfillmentMode: data.fulfillment_mode,
            scheduledFor: data.scheduled_for
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

app.post('/api/ofertas/validar', async (req, res) => {
    const total = Number(req.body?.total);
    if (!Number.isFinite(total) || total < 0 || !['USD', 'MXN', 'COP', 'PEN', 'EUR'].includes(String(req.body?.currency || 'USD').toUpperCase())) {
        return res.status(400).json({ error: 'El total o la moneda no son válidos.' });
    }
    try {
        const discounts = await getCheckoutDiscounts({
            promoCode: req.body?.promoCode,
            giftCardCode: req.body?.giftCardCode,
            currency: req.body?.currency || 'USD',
            total
        });
        return res.json({ discount: discounts.discount, promoDiscount: discounts.promo?.amount || 0, giftCardDiscount: discounts.giftCard?.amount || 0 });
    } catch (error) {
        console.error('No se pudieron validar los códigos de la tienda.', error);
        return res.status(400).json({ error: error.message || 'No se pudieron validar los códigos.' });
    }
});

app.get('/api/ofertas-admin', async (req, res) => {
    try {
        const [promos, giftCards] = await Promise.all([
            supabase.from('store_promo_codes').select('code,discount_type,discount_value,currency,active,max_redemptions,redemption_count,expires_at').order('created_at', { ascending: false }),
            supabase.from('store_gift_cards').select('code,balance,currency,active,expires_at').order('created_at', { ascending: false })
        ]);
        if (promos.error) throw promos.error;
        if (giftCards.error) throw giftCards.error;
        return res.json({ promoCodes: promos.data, giftCards: giftCards.data });
    } catch (error) {
        console.error('No se pudieron cargar los códigos y tarjetas de regalo.', error);
        return res.status(500).json({ error: 'No se pudieron cargar códigos. Verifica la migración y la clave de servicio de Supabase.' });
    }
});

app.post('/api/ofertas-admin/promo', async (req, res) => {
    const body = req.body || {};
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
    const discountType = body.discountType;
    const discountValue = Number(body.discountValue);
    const currency = String(body.currency || 'USD').toUpperCase();
    const maxRedemptions = body.maxRedemptions === '' || body.maxRedemptions == null ? null : Number(body.maxRedemptions);
    if (!/^[A-Z0-9_-]{3,40}$/.test(code) || !['percent', 'fixed'].includes(discountType)
        || !Number.isFinite(discountValue) || discountValue <= 0 || (discountType === 'percent' && discountValue > 100)
        || !['USD', 'MXN', 'COP', 'PEN', 'EUR'].includes(currency)
        || (maxRedemptions !== null && (!Number.isInteger(maxRedemptions) || maxRedemptions < 1))) {
        return res.status(400).json({ error: 'Revisa el código, descuento, moneda y límite de usos.' });
    }
    try {
        const { data, error } = await supabase.from('store_promo_codes').insert([{
            code, discount_type: discountType, discount_value: discountValue, currency,
            max_redemptions: maxRedemptions, expires_at: body.expiresAt || null
        }]).select().single();
        if (error) throw error;
        return res.status(201).json(data);
    } catch (error) {
        console.error('No se pudo crear el código promocional.', error);
        return res.status(500).json({ error: error.code === '23505' ? 'Ese código ya existe.' : 'No se pudo crear el código promocional.' });
    }
});

app.post('/api/ofertas-admin/gift-card', async (req, res) => {
    const body = req.body || {};
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
    const balance = Number(body.balance);
    const currency = String(body.currency || 'USD').toUpperCase();
    if (!/^[A-Z0-9_-]{3,40}$/.test(code) || !Number.isFinite(balance) || balance <= 0
        || !['USD', 'MXN', 'COP', 'PEN', 'EUR'].includes(currency)) {
        return res.status(400).json({ error: 'Revisa el código, saldo y moneda de la tarjeta.' });
    }
    try {
        const { data, error } = await supabase.from('store_gift_cards').insert([{
            code, balance, currency, expires_at: body.expiresAt || null
        }]).select('code,balance,currency,active,expires_at').single();
        if (error) throw error;
        return res.status(201).json(data);
    } catch (error) {
        console.error('No se pudo crear la tarjeta de regalo.', error);
        return res.status(500).json({ error: error.code === '23505' ? 'Ese código ya existe.' : 'No se pudo crear la tarjeta de regalo.' });
    }
});

app.delete('/api/ofertas-admin/:kind/:code', async (req, res) => {
    const table = req.params.kind === 'promo' ? 'store_promo_codes' : req.params.kind === 'gift-card' ? 'store_gift_cards' : null;
    if (!table) return res.status(400).json({ error: 'El tipo de código no es válido.' });
    try {
        const { data, error } = await supabase.from(table).delete().eq('code', req.params.code).select('code').maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'No se encontró el código.' });
        return res.json({ success: true });
    } catch (error) {
        console.error('No se pudo eliminar el código de oferta.', error);
        return res.status(500).json({ error: 'No se pudo eliminar el código.' });
    }
});

app.patch('/api/reservas/cliente', async (req, res) => {
    const body = req.body || {};
    const token = typeof body.trackingToken === 'string' ? body.trackingToken : '';
    const reservationId = body.reservationId;
    if (!token || !reservationId || !['cancel', 'update'].includes(body.action)) {
        return res.status(400).json({ error: 'La solicitud de cambio o cancelación no es válida.' });
    }

    try {
        const client = await getClientUser(req);
        if (!hasVerifiedClientIdentity(client)) {
            return res.status(401).json({ error: 'Inicia sesión con la cuenta asociada al pedido para modificarlo.' });
        }
        if (!supabaseServiceRoleKey) {
            return res.status(503).json({ error: 'El backend necesita SUPABASE_SERVICE_ROLE_KEY para modificar pedidos protegidos.' });
        }
        const { data: reservation, error: lookupError } = await supabase
            .from('reservas')
            .select('id,status,tracking_token,fulfillment_mode,scheduled_for,mesanumber,items,client_contact,discount_amount,promo_discount_amount,gift_card_discount_amount,reward_discount_amount,promo_code,gift_card_code,client_user_id')
            .eq('id', reservationId)
            .eq('tracking_token', token)
            .eq('client_user_id', client.id)
            .maybeSingle();
        if (lookupError) throw lookupError;
        if (!reservation) return res.status(404).json({ error: 'No se encontró el pedido.' });
        if (reservation.status !== 'Recibido') {
            return res.status(409).json({ error: 'Solo puedes modificar o cancelar pedidos que aún no estén en preparación.' });
        }

        if (body.action === 'cancel') {
            const { data, error } = await supabase.from('reservas')
                .update({ status: 'Cancelado' })
                .eq('id', reservation.id)
                .eq('status', 'Recibido')
                .eq('tracking_token', token)
                .eq('client_user_id', client.id)
                .select()
                .maybeSingle();
            if (error) throw error;
            if (!data) return res.status(409).json({ error: 'El pedido cambió de estado y ya no se puede cancelar.' });
            try {
                if (reservation.promo_code) {
                    const { data: promo, error: promoLookupError } = await supabase.from('store_promo_codes')
                        .select('redemption_count').eq('code', reservation.promo_code).maybeSingle();
                    if (promoLookupError) throw promoLookupError;
                    if (promo) {
                        const { error } = await supabase.from('store_promo_codes')
                            .update({ redemption_count: Math.max(0, Number(promo.redemption_count) - 1) })
                            .eq('code', reservation.promo_code).eq('redemption_count', promo.redemption_count);
                        if (error) throw error;
                    }
                }
                if (reservation.gift_card_code && Number(reservation.gift_card_discount_amount) > 0) {
                    const { data: card, error: cardLookupError } = await supabase.from('store_gift_cards')
                        .select('balance').eq('code', reservation.gift_card_code).maybeSingle();
                    if (cardLookupError) throw cardLookupError;
                    if (card) {
                        const { error } = await supabase.from('store_gift_cards')
                            .update({ balance: Number(card.balance) + Number(reservation.gift_card_discount_amount) })
                            .eq('code', reservation.gift_card_code).eq('balance', card.balance);
                        if (error) throw error;
                    }
                }
                if (reservation.client_user_id && Number(reservation.reward_discount_amount) > 0) {
                    const { data: account, error: accountLookupError } = await supabase.from('customer_rewards')
                        .select('credit_balance').eq('user_id', reservation.client_user_id).maybeSingle();
                    if (accountLookupError) throw accountLookupError;
                    if (account) {
                        const { error } = await supabase.from('customer_rewards')
                            .update({ credit_balance: Number(account.credit_balance) + Number(reservation.reward_discount_amount) })
                            .eq('user_id', reservation.client_user_id).eq('credit_balance', account.credit_balance);
                        if (error) throw error;
                    }
                }
            } catch (refundError) {
                console.error('El pedido se canceló, pero no se pudo restaurar por completo el saldo de sus descuentos.', refundError);
                return res.status(500).json({ error: 'El pedido se canceló, pero hubo un problema restaurando algún código o saldo. Contacta al local.' });
            }
            if (reservation.fulfillment_mode === 'dine_in' && !reservation.scheduled_for && reservation.mesanumber) {
                const { error: tableError } = await supabase.from('mesas')
                    .update({ status: 'Disponible' }).eq('number', reservation.mesanumber);
                if (tableError) throw tableError;
            }
            return res.json({ ...data, clientName: data.clientname, mesaNumber: data.mesanumber });
        }

        const update = {};
        if (Array.isArray(body.items)) {
            if (Number(reservation.discount_amount) > 0) {
                return res.status(409).json({ error: 'Este pedido tiene un descuento aplicado. Cancélalo y crea uno nuevo para cambiar sus productos.' });
            }
            if (body.items.length === 0 || body.items.some(item =>
                !item || !Number.isInteger(Number(item.id)) || Number(item.id) <= 0
                || !Number.isInteger(Number(item.qty)) || Number(item.qty) < 1 || Number(item.qty) > 50
            )) return res.status(400).json({ error: 'Revisa los productos y cantidades del pedido.' });
            const ids = [...new Set(body.items.map(item => String(item.id)))];
            const { data: products, error: productsError } = await supabase.from('licores')
                .select('id,name,price,stock').in('id', ids);
            if (productsError) throw productsError;
            if (products.length !== ids.length) return res.status(400).json({ error: 'Uno o más productos ya no existen.' });
            const byId = new Map(products.map(product => [String(product.id), product]));
            const totals = new Map();
            for (const item of body.items) totals.set(String(item.id), (totals.get(String(item.id)) || 0) + Number(item.qty));
            const unavailableId = [...totals].find(([id, quantity]) => Number(byId.get(id).stock) < quantity)?.[0];
            if (unavailableId) return res.status(409).json({ error: `${byId.get(unavailableId).name} ya no tiene suficiente stock.` });
            update.items = body.items.map(item => {
                const product = byId.get(String(item.id));
                return { id: product.id, name: product.name, price: Number(product.price), qty: Number(item.qty) };
            });
            update.order_total = update.items.reduce((sum, item) => sum + item.price * item.qty, 0);
        }
        if (typeof body.clientContact === 'string') update.client_contact = body.clientContact.trim().slice(0, 40);
        if (body.scheduledFor !== undefined) {
            if (body.scheduledFor === null || body.scheduledFor === '') update.scheduled_for = null;
            else {
                const scheduled = new Date(body.scheduledFor);
                if (Number.isNaN(scheduled.getTime()) || scheduled < new Date(Date.now() + 15 * 60 * 1000)) {
                    return res.status(400).json({ error: 'El horario debe tener al menos 15 minutos de anticipación.' });
                }
                update.scheduled_for = scheduled.toISOString();
            }
        }
        if (!Object.keys(update).length) return res.status(400).json({ error: 'No se indicó ningún cambio.' });
        const { data, error } = await supabase.from('reservas')
            .update(update).eq('id', reservation.id).eq('status', 'Recibido').eq('tracking_token', token).eq('client_user_id', client.id)
            .select().maybeSingle();
        if (error) throw error;
        if (!data) return res.status(409).json({ error: 'El pedido cambió de estado y ya no se puede modificar.' });
        return res.json({ ...data, clientName: data.clientname, mesaNumber: data.mesanumber });
    } catch (error) {
        console.error('No se pudo modificar o cancelar el pedido del cliente.', error);
        return res.status(500).json({ error: error.message });
    }
});

app.get('/api/client/orders', async (req, res) => {
    try {
        const client = await getClientUser(req);
        if (!hasVerifiedClientIdentity(client)) return res.status(401).json({ error: 'Inicia sesión con tu cuenta verificada para ver tus pedidos.' });
        const clientSupabase = getClientScopedSupabase(req);
        const { data, error } = await clientSupabase.from('reservas')
            .select('*').eq('client_user_id', client.id).order('date', { ascending: false }).limit(50);
        if (error) throw error;
        return res.json(data.map(order => ({
            ...order,
            clientName: order.clientname,
            mesaNumber: order.mesanumber,
            fulfillmentMode: order.fulfillment_mode,
            scheduledFor: order.scheduled_for
        })));
    } catch (error) {
        console.error('No se pudo cargar el historial del cliente.', error);
        return res.status(500).json({ error: 'No se pudo cargar el historial de pedidos.' });
    }
});

app.get('/api/client/rewards', async (req, res) => {
    try {
        const client = await getClientUser(req);
        if (!hasVerifiedClientIdentity(client)) return res.status(401).json({ error: 'Inicia sesión con tu cuenta verificada para consultar tus recompensas.' });
        const clientSupabase = getClientScopedSupabase(req);
        const { data, error } = await clientSupabase.from('customer_rewards')
            .select('points,credit_balance').eq('user_id', client.id).maybeSingle();
        if (error) throw error;
        return res.json(data || { points: 0, credit_balance: 0 });
    } catch (error) {
        console.error('No se pudieron cargar las recompensas del cliente.', error);
        return res.status(500).json({ error: 'No se pudieron cargar tus recompensas.' });
    }
});

app.post('/api/client/rewards/redeem', async (req, res) => {
    try {
        const authorization = req.get('authorization') || '';
        const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
        if (!token) return res.status(401).json({ error: 'Inicia sesión para canjear tus puntos.' });
        const client = await getClientUser(req);
        const points = Number(req.body?.points);
        if (!hasVerifiedClientIdentity(client)) return res.status(401).json({ error: 'Inicia sesión con tu cuenta verificada para canjear tus puntos.' });
        if (!Number.isInteger(points) || points < 100 || points % 100 !== 0) {
            return res.status(400).json({ error: 'El canje debe ser en bloques de 100 puntos.' });
        }
        const authenticatedClient = createClient(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false, autoRefreshToken: false }
        });
        const { data, error } = await authenticatedClient.rpc('redeem_customer_points', { p_points: points });
        if (error) return res.status(409).json({ error: error.message });
        return res.json(data);
    } catch (error) {
        console.error('No se pudieron canjear los puntos del cliente.', error);
        return res.status(500).json({ error: 'No se pudieron canjear los puntos.' });
    }
});

app.get('/api/reservas', async (req, res) => {
    try {
        const { data, error } = await supabase.from('reservas').select('*');
        if (error) throw error;
        res.json(data.map(reserva => ({
            ...reserva,
            clientName: reserva.clientname,
            mesaNumber: reserva.mesanumber
        })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/client-profiles', async (req, res) => {
    try {
        const { data: reservations, error: reservationsError } = await supabase
            .from('reservas')
            .select('client_user_id')
            .not('client_user_id', 'is', null);
        if (reservationsError) throw reservationsError;

        const orderCounts = new Map();
        for (const reservation of reservations) {
            const userId = reservation.client_user_id;
            orderCounts.set(userId, (orderCounts.get(userId) || 0) + 1);
        }

        const profiles = await Promise.all([...orderCounts.entries()].map(async ([userId, orderCount]) => {
            const { data, error } = await supabase.auth.admin.getUserById(userId);
            if (error) throw error;
            const user = data.user;
            if (!user) return null;

            const metadata = user.user_metadata || {};
            const metadataName = metadata.display_name || metadata.full_name || metadata.name;
            const avatarPath = typeof metadata.avatar_path === 'string'
                && metadata.avatar_path.startsWith(`${userId}/`)
                && !metadata.avatar_path.includes('..')
                ? metadata.avatar_path
                : '';
            let avatarUrl = typeof metadata.picture === 'string' ? metadata.picture : '';
            if (avatarPath) {
                const { data: signedAvatar, error: avatarError } = await supabase.storage
                    .from('customer-avatars')
                    .createSignedUrl(avatarPath, 60 * 60);
                if (avatarError) throw avatarError;
                avatarUrl = signedAvatar.signedUrl;
            }

            return {
                userId,
                email: user.email || '',
                displayName: (typeof metadataName === 'string' && metadataName.trim()) || user.email || 'Cliente',
                avatarUrl,
                orderCount
            };
        }));

        return res.json(profiles.filter(Boolean));
    } catch (error) {
        console.error('No se pudieron cargar los perfiles privados de clientes.', error);
        return res.status(500).json({ error: 'No se pudieron cargar los perfiles de clientes.' });
    }
});

app.post('/api/availability-alerts', async (req, res) => {
    const { productId, productName, contact } = req.body || {};
    if (!productId || !productName || typeof productName !== 'string' || productName.trim().length > 120
        || typeof contact !== 'string' || contact.trim().length < 5 || contact.trim().length > 160) {
        return res.status(400).json({ error: 'Indica un medio de contacto válido y el producto que deseas consultar.' });
    }
    try {
        const { data: product, error: productError } = await supabase
            .from('licores')
            .select('id,name,stock')
            .eq('id', productId)
            .maybeSingle();
        if (productError) throw productError;
        if (!product) return res.status(404).json({ error: 'No se encontró el producto.' });
        if (Number(product.stock) > 0) return res.status(409).json({ error: 'El producto ya está disponible; actualiza la carta para comprarlo.' });

        const request = {
            licor_id: product.id,
            producto: product.name,
            contacto: contact.trim()
        };
        const { data, error } = await supabase.from('solicitudes_disponibilidad').insert([request]).select('id').single();
        if (error) throw error;
        return res.status(201).json({ id: data.id, message: 'Registramos tu solicitud. El local podrá contactarte cuando revise la reposición.' });
    } catch (error) {
        console.error('No se pudo registrar la solicitud de disponibilidad.', error);
        return res.status(500).json({ error: 'No se pudo registrar la solicitud. Inténtalo más tarde.' });
    }
});

app.post('/api/price-alerts', async (req, res) => {
    const { productId, contact } = req.body || {};
    const targetPrice = Number(req.body?.targetPrice);
    if (!productId || typeof contact !== 'string' || contact.trim().length < 5 || contact.trim().length > 160
        || !Number.isFinite(targetPrice) || targetPrice <= 0) {
        return res.status(400).json({ error: 'Indica un medio de contacto y un precio objetivo válido.' });
    }
    try {
        const { data: product, error: productError } = await supabase.from('licores')
            .select('id,name,price').eq('id', productId).maybeSingle();
        if (productError) throw productError;
        if (!product) return res.status(404).json({ error: 'No se encontró el producto.' });
        if (targetPrice >= Number(product.price)) return res.status(400).json({ error: 'El precio objetivo debe ser menor al precio actual.' });
        const { data, error } = await supabase.from('solicitudes_disponibilidad').insert([{
            licor_id: product.id,
            producto: product.name,
            contacto: contact.trim(),
            alert_type: 'price_or_restock',
            target_price: targetPrice
        }]).select('id').single();
        if (error) throw error;
        return res.status(201).json({ id: data.id, message: 'Registramos tu alerta. El local podrá contactarte si baja el precio o se repone.' });
    } catch (error) {
        console.error('No se pudo registrar la alerta de precio.', error);
        return res.status(500).json({ error: 'No se pudo registrar la alerta. Inténtalo más tarde.' });
    }
});

app.get('/api/availability-alerts', async (req, res) => respondWithTableRows(res, 'solicitudes_disponibilidad'));
app.patch('/api/availability-alerts/:id', async (req, res) => {
    const status = req.body?.status;
    if (!['Pendiente', 'Contactado', 'Resuelto'].includes(status)) {
        return res.status(400).json({ error: 'El estado de la solicitud no es válido.' });
    }
    try {
        const { data, error } = await supabase
            .from('solicitudes_disponibilidad')
            .update({ status })
            .eq('id', req.params.id)
            .select()
            .maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'No se encontró la solicitud de disponibilidad.' });
        return res.json(data);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

app.post('/api/solicitudes-ayuda', async (req, res) => {
    try {
        const { clientName, mesaId, message } = req.body;
        if (typeof clientName !== 'string' || clientName.trim().length < 2 || clientName.trim().length > 100) {
            return res.status(400).json({ error: 'Indica tu nombre (entre 2 y 100 caracteres).' });
        }
        if (typeof message !== 'string' || message.trim().length < 5 || message.trim().length > 500) {
            return res.status(400).json({ error: 'Describe lo que necesitas (entre 5 y 500 caracteres).' });
        }

        let mesaNumber = null;
        if (mesaId) {
            const { data: mesa, error: mesaError } = await supabase.from('mesas').select('number').eq('id', mesaId).maybeSingle();
            if (mesaError) throw mesaError;
            if (!mesa) return res.status(404).json({ error: 'No se encontró la mesa seleccionada.' });
            mesaNumber = mesa.number;
        }

        const { data, error } = await supabase
            .from('solicitudes_ayuda')
            .insert([{ clientname: clientName.trim(), mesanumber: mesaNumber, message: message.trim() }])
            .select()
            .single();
        if (error) throw error;
        return res.status(201).json(data);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.get('/api/solicitudes-ayuda', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('solicitudes_ayuda')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return res.json(data);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.patch('/api/solicitudes-ayuda/:id', async (req, res) => {
    const status = (req.body || {}).status;
    if (!['pendiente', 'atendiendo', 'atendida'].includes(status)) {
        return res.status(400).json({ error: 'El estado de atención no es válido.' });
    }

    try {
        const { data, error } = await supabase
            .from('solicitudes_ayuda')
            .update({ status })
            .eq('id', req.params.id)
            .select()
            .maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'No se encontró la solicitud de ayuda.' });
        return res.json(data);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ==================== CATEGORÍAS ====================
app.get('/api/categorias', async (req, res) => {
    try {
        const { data, error } = await supabase.from('categorias').select('*');
        if (error) throw error;
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/categorias', async (req, res) => {
    try {
        const { data, error } = await supabase.from('categorias').insert([{ name: req.body.name }]).select();
        if (error) throw error;
        res.status(201).json(data[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== MÓDULOS ADICIONALES ====================
app.get('/api/proveedores', async (req, res) => respondWithTableRows(res, 'proveedores'));
app.post('/api/proveedores', async (req, res) => {
    const { data, error } = await supabase.from('proveedores').insert([req.body]).select();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data[0]);
});

app.get('/api/empleados', async (req, res) => respondWithTableRows(res, 'empleados'));
app.post('/api/empleados', async (req, res) => {
    const body = req.body || {};
    const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const rol = typeof body.rol === 'string' ? body.rol.trim() : '';
    if (!nombre || !email || !['Administrador', 'Cajero', 'Almacenero', 'Garzón'].includes(rol)) {
        return res.status(400).json({ error: 'Nombre, correo y rol válido son obligatorios.' });
    }
    const { data, error } = await supabase.from('empleados').insert([{ nombre, email, rol }]).select();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data[0]);
});

app.get('/api/promociones', async (req, res) => respondWithTableRows(res, 'promociones'));
app.post('/api/promociones', parseImageUpload, async (req, res) => {
    const titulo = typeof req.body.titulo === 'string' ? req.body.titulo.trim() : '';
    const descuento = typeof req.body.descuento === 'string' ? req.body.descuento.trim() : '';
    if (!titulo || titulo.length > 120 || !descuento || descuento.length > 500) {
        return res.status(400).json({ error: 'El título es obligatorio (máximo 120 caracteres) y el detalle debe tener hasta 500 caracteres.' });
    }

    try {
        const promo = {
            titulo,
            descuento,
            vigente_hasta: req.body.vigente_hasta || null,
            licor_id: req.body.licor_id || null,
            activa: req.body.activa !== 'false'
        };
        if (req.file) promo.imagen = `/uploads/${req.file.filename}`;
        const { data, error } = await supabase.from('promociones').insert([promo]).select().single();
        if (error) throw error;
        return res.status(201).json(data);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
app.put('/api/promociones/:id', parseImageUpload, async (req, res) => {
    const titulo = typeof req.body.titulo === 'string' ? req.body.titulo.trim() : '';
    const descuento = typeof req.body.descuento === 'string' ? req.body.descuento.trim() : '';
    if (!titulo || titulo.length > 120 || !descuento || descuento.length > 500) {
        return res.status(400).json({ error: 'El título es obligatorio (máximo 120 caracteres) y el detalle debe tener hasta 500 caracteres.' });
    }

    try {
        const promo = {
            titulo,
            descuento,
            vigente_hasta: req.body.vigente_hasta || null,
            licor_id: req.body.licor_id || null,
            activa: req.body.activa !== 'false'
        };
        if (req.file) promo.imagen = `/uploads/${req.file.filename}`;
        else if (req.body.removeImage === 'true') promo.imagen = null;
        const { data, error } = await supabase
            .from('promociones')
            .update(promo)
            .eq('id', req.params.id)
            .select()
            .maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'No se encontró la promoción que se quiere actualizar.' });
        return res.json(data);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

// KARDEX
app.get('/api/kardex', async (req, res) => respondWithTableRows(res, 'kardex'));
app.post('/api/kardex', async (req, res) => {
    const { data, error } = await supabase.from('kardex').insert([req.body]).select();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data[0]);
});

// FACTURAS / TICKETS POS
app.get('/api/facturas', async (req, res) => respondWithTableRows(res, 'facturas'));
app.post('/api/facturas', async (req, res) => {
    const body = req.body || {};
    const total = Number(body.total);
    if (typeof body.cliente !== 'string' || body.cliente.trim().length < 2 || !Number.isFinite(total) || total < 0) {
        return res.status(400).json({ error: 'Cliente y total válido son obligatorios.' });
    }
    const { data, error } = await supabase.rpc('registrar_factura_con_puntos', {
        p_cliente: body.cliente.trim(),
        p_mesa: body.mesa || '',
        p_metodo_pago: body.metodo_pago || 'Efectivo',
        p_total: total,
        p_fecha: body.fecha || new Date().toISOString()
    });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
});

// RESEÑAS
app.get('/api/resenas', async (req, res) => respondWithTableRows(res, 'reseñas'));
app.get('/api/licores/:id/resenas', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('reseñas')
            .select('id,cliente,puntuacion,comentario,fecha')
            .eq('licor_id', req.params.id)
            .order('fecha', { ascending: false })
            .limit(30);
        if (error) throw error;
        return res.json(data);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
app.post('/api/resenas', async (req, res) => {
    const body = req.body || {};
    const cliente = typeof body.cliente === 'string' ? body.cliente.trim() : '';
    const comentario = typeof body.comentario === 'string' ? body.comentario.trim() : '';
    const puntuacion = Number(body.puntuacion);
    if (cliente.length < 2 || cliente.length > 80 || comentario.length < 3 || comentario.length > 1000
        || !Number.isInteger(puntuacion) || puntuacion < 1 || puntuacion > 5) {
        return res.status(400).json({ error: 'Revisa el nombre, comentario y calificación antes de enviar.' });
    }
    try {
        const review = { cliente, comentario, puntuacion, fecha: body.fecha || new Date().toISOString() };
        if (body.licor_id) review.licor_id = body.licor_id;
        const { data, error } = await supabase.from('reseñas').insert([review]).select().single();
        if (error) throw error;
        return res.status(201).json(data);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

app.get('/api/compras', async (req, res) => {
    try {
        const { data, error } = await supabase.from('compras').select('*, compra_items(*)').order('fecha', { ascending: false });
        if (error) throw error;
        return res.json(data);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

app.post('/api/compras', async (req, res) => {
    const { proveedorId, proveedorNombre, items } = req.body || {};
    if (typeof proveedorNombre !== 'string' || !proveedorNombre.trim() || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Selecciona un proveedor e incluye al menos un producto.' });
    }
    if (items.some(item => !item || typeof item !== 'object' ||
        !Number.isInteger(Number(item.licorId)) || Number(item.licorId) <= 0 ||
        !Number.isInteger(Number(item.cantidad)) || Number(item.cantidad) <= 0 ||
        !Number.isFinite(Number(item.costoUnitario)) || Number(item.costoUnitario) < 0 ||
        (item.fechaVencimiento && Number.isNaN(Date.parse(item.fechaVencimiento))))) {
        return res.status(400).json({ error: 'Revisa productos, cantidades, costos y fechas de vencimiento.' });
    }
    try {
        const productIds = [...new Set(items.map(item => Number(item.licorId)))];
        const { data: products, error: productsError } = await supabase.from('licores').select('id,name').in('id', productIds);
        if (productsError) throw productsError;
        const productsById = new Map(products.map(product => [String(product.id), product]));
        if (productsById.size !== productIds.length) return res.status(400).json({ error: 'Uno o más productos ya no existen.' });
        const total = items.reduce((sum, item) => sum + Number(item.cantidad) * Number(item.costoUnitario), 0);
        const { data: purchase, error: purchaseError } = await supabase.from('compras').insert([{
            proveedor_id: proveedorId || null,
            proveedor_nombre: proveedorNombre.trim(),
            total,
            created_by: req.adminUser.email
        }]).select().single();
        if (purchaseError) throw purchaseError;

        const lines = items.map(item => ({
            compra_id: purchase.id,
            licor_id: Number(item.licorId),
            producto: productsById.get(String(item.licorId)).name,
            cantidad: Number(item.cantidad),
            costo_unitario: Number(item.costoUnitario),
            fecha_vencimiento: item.fechaVencimiento || null
        }));
        const { error: itemsError } = await supabase.from('compra_items').insert(lines);
        if (itemsError) {
            const { error: rollbackError } = await supabase.from('compras').delete().eq('id', purchase.id);
            if (rollbackError) throw new Error(`No se guardaron los productos y tampoco se pudo revertir la compra: ${rollbackError.message}`);
            throw itemsError;
        }
        return res.status(201).json({ ...purchase, compra_items: lines });
    } catch (error) {
        console.error('No se pudo registrar la compra.', error);
        return res.status(500).json({ error: error.message });
    }
});

app.post('/api/compras/:id/recibir', async (req, res) => {
    try {
        const { data, error } = await supabase.rpc('recibir_compra', { p_compra_id: req.params.id });
        if (error) throw error;
        return res.json(data);
    } catch (error) {
        console.error('No se pudo recibir la compra.', error);
        return res.status(409).json({ error: error.message });
    }
});

app.get('/api/lotes-inventario', async (req, res) => {
    try {
        const { data, error } = await supabase.from('lotes_inventario').select('*').order('fecha_vencimiento', { ascending: true });
        if (error) throw error;
        return res.json(data);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

app.post('/api/lotes-inventario', async (req, res) => {
    const { licorId, codigoLote, cantidad, fechaVencimiento } = req.body || {};
    if (!Number.isInteger(Number(licorId)) || Number(licorId) <= 0 || !Number.isInteger(Number(cantidad)) || Number(cantidad) <= 0 ||
        typeof codigoLote !== 'string' || !codigoLote.trim() || Number.isNaN(Date.parse(fechaVencimiento || ''))) {
        return res.status(400).json({ error: 'Indica producto, código de lote, cantidad y vencimiento válidos.' });
    }
    try {
        const { data, error } = await supabase.rpc('registrar_lote_inventario', {
            p_licor_id: licorId,
            p_codigo_lote: codigoLote.trim(),
            p_cantidad: Number(cantidad),
            p_fecha_vencimiento: fechaVencimiento
        });
        if (error) throw error;
        return res.status(201).json(data);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

app.get('/api/cierres-caja', async (req, res) => {
    try {
        const { data, error } = await supabase.from('cierres_caja').select('*').order('abierta_en', { ascending: false });
        if (error) throw error;
        return res.json(data);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

app.post('/api/cierres-caja', async (req, res) => {
    const montoInicial = Number(req.body?.montoInicial);
    if (!Number.isFinite(montoInicial) || montoInicial < 0) return res.status(400).json({ error: 'El monto inicial debe ser cero o mayor.' });
    try {
        const { data: openSession, error: openError } = await supabase.from('cierres_caja').select('id').eq('estado', 'Abierta').maybeSingle();
        if (openError) throw openError;
        if (openSession) return res.status(409).json({ error: 'Ya hay una caja abierta. Ciérrala antes de iniciar otro turno.' });
        const { data, error } = await supabase.from('cierres_caja').insert([{
            abierta_por: req.adminUser.email,
            monto_inicial: montoInicial
        }]).select().single();
        if (error?.code === '23505') return res.status(409).json({ error: 'Ya hay una caja abierta. Ciérrala antes de iniciar otro turno.' });
        if (error) throw error;
        return res.status(201).json(data);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

app.post('/api/cierres-caja/:id/cerrar', async (req, res) => {
    const efectivo = Number(req.body?.efectivoDeclarado);
    if (!Number.isFinite(efectivo) || efectivo < 0) return res.status(400).json({ error: 'El efectivo contado debe ser cero o mayor.' });
    try {
        const { data: session, error: sessionError } = await supabase.from('cierres_caja').select('abierta_en,monto_inicial')
            .eq('id', req.params.id).eq('estado', 'Abierta').maybeSingle();
        if (sessionError) throw sessionError;
        if (!session) return res.status(404).json({ error: 'La caja no existe o ya fue cerrada.' });
        const { data: invoices, error: invoicesError } = await supabase.from('facturas').select('total,metodo_pago')
            .gte('fecha', session.abierta_en);
        if (invoicesError) throw invoicesError;
        const cashSales = invoices.filter(invoice => /efectivo/i.test(invoice.metodo_pago || ''))
            .reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
        const efectivoEsperado = Number(session.monto_inicial) + cashSales;
        const { data, error } = await supabase.from('cierres_caja').update({
            estado: 'Cerrada',
            cerrada_por: req.adminUser.email,
            cerrada_en: new Date().toISOString(),
            efectivo_declarado: efectivo,
            efectivo_esperado: efectivoEsperado,
            notas: typeof req.body.notas === 'string' ? req.body.notas.trim() : null
        }).eq('id', req.params.id).eq('estado', 'Abierta').select().maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'La caja no existe o ya fue cerrada.' });
        return res.json(data);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

app.get('/api/agenda', async (req, res) => {
    try {
        const { data, error } = await supabase.from('agenda_reservas').select('*').order('inicia_en', { ascending: true });
        if (error) throw error;
        return res.json(data);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

app.post('/api/agenda', async (req, res) => {
    const booking = req.body || {};
    const startsAt = new Date(booking.inicia_en);
    const endsAt = booking.termina_en ? new Date(booking.termina_en) : new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);
    if (!['Reserva', 'Evento'].includes(booking.tipo) || typeof booking.cliente !== 'string' || !booking.cliente.trim() ||
        Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt ||
        !Number.isInteger(Number(booking.personas)) || Number(booking.personas) < 1) {
        return res.status(400).json({ error: 'Revisa el tipo, nombre, fecha y cantidad de personas.' });
    }
    try {
        if (booking.mesa_id && booking.tipo === 'Reserva') {
            const { data: table, error: tableError } = await supabase.from('mesas').select('seats').eq('id', booking.mesa_id).maybeSingle();
            if (tableError) throw tableError;
            if (!table) return res.status(404).json({ error: 'No se encontró la mesa seleccionada.' });
            if (Number(booking.personas) > Number(table.seats)) return res.status(400).json({ error: 'La cantidad de personas supera la capacidad de esa mesa.' });
            const { data: conflicts, error: conflictError } = await supabase.from('agenda_reservas').select('id')
                .eq('mesa_id', booking.mesa_id).neq('estado', 'Cancelada').lt('inicia_en', endsAt.toISOString())
                .or(`termina_en.is.null,termina_en.gt.${startsAt.toISOString()}`);
            if (conflictError) throw conflictError;
            if (conflicts.length) return res.status(409).json({ error: 'La mesa ya está reservada en ese horario.' });
        }
        const { data, error } = await supabase.from('agenda_reservas').insert([{
            tipo: booking.tipo,
            cliente: booking.cliente.trim(),
            telefono: booking.telefono || null,
            titulo: booking.titulo || null,
            mesa_id: booking.mesa_id || null,
            mesa_nombre: booking.mesa_nombre || null,
            personas: Number(booking.personas),
            inicia_en: startsAt.toISOString(),
            termina_en: endsAt.toISOString(),
            estado: booking.estado || 'Confirmada',
            notas: booking.notas || null
        }]).select().single();
        if (error) throw error;
        return res.status(201).json(data);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

app.put('/api/agenda/:id', async (req, res) => {
    const booking = req.body || {};
    const fields = ['tipo', 'cliente', 'telefono', 'titulo', 'mesa_id', 'mesa_nombre', 'personas', 'inicia_en', 'termina_en', 'estado', 'notas'];
    const update = Object.fromEntries(fields.filter(field => Object.hasOwn(booking, field)).map(field => [field, booking[field]]));
    try {
        const { data, error } = await supabase.from('agenda_reservas').update(update).eq('id', req.params.id).select().maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'No se encontró el evento o reserva.' });
        return res.json(data);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

app.delete('/api/agenda/:id', async (req, res) => {
    try {
        const { data, error } = await supabase.from('agenda_reservas').delete().eq('id', req.params.id).select('id').maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'No se encontró el evento o reserva.' });
        return res.json({ success: true });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

app.get('/api/fidelizacion', async (req, res) => {
    try {
        const { data, error } = await supabase.from('fidelizacion_clientes').select('*, fidelizacion_movimientos(*)').order('puntos', { ascending: false });
        if (error) throw error;
        return res.json(data);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

app.post('/api/fidelizacion', async (req, res) => {
    const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : '';
    const monto = Number(req.body?.monto);
    if (nombre.length < 2 || !Number.isFinite(monto) || monto <= 0) return res.status(400).json({ error: 'Indica cliente y monto positivo para acreditar puntos.' });
    const puntos = Math.floor(monto);
    if (puntos < 1) return res.status(400).json({ error: 'El monto debe ser al menos una unidad monetaria para generar un punto.' });
    try {
        let query = supabase.from('fidelizacion_clientes').select('*');
        query = req.body.email ? query.ilike('email', String(req.body.email).trim()) : query.ilike('nombre', nombre);
        const { data: current, error: lookupError } = await query.maybeSingle();
        if (lookupError) throw lookupError;
        let customer = current;
        if (!customer) {
            const { data, error } = await supabase.from('fidelizacion_clientes').insert([{
                nombre,
                email: req.body.email || null
            }]).select().single();
            if (error) throw error;
            customer = data;
        }
        const { data, error } = await supabase.rpc('registrar_movimiento_puntos', {
            p_cliente_id: customer.id,
            p_tipo: 'Ganados',
            p_puntos: puntos,
            p_monto: monto,
            p_descripcion: `Compra acreditada por ${monto.toFixed(2)}`
        });
        if (error) throw error;
        return res.status(201).json(data);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

app.post('/api/fidelizacion/:id/canjear', async (req, res) => {
    const puntos = Number(req.body?.puntos);
    if (!Number.isInteger(puntos) || puntos < 100 || puntos % 100 !== 0) return res.status(400).json({ error: 'El canje debe ser en bloques de 100 puntos.' });
    try {
        const { data, error } = await supabase.rpc('registrar_movimiento_puntos', {
            p_cliente_id: req.params.id,
            p_tipo: 'Canjeados',
            p_puntos: puntos,
            p_monto: 0,
            p_descripcion: `Canje de ${puntos} puntos`
        });
        if (error) throw error;
        return res.json(data);
    } catch (error) {
        return res.status(409).json({ error: error.message });
    }
});

app.get('/api/role-permissions', async (req, res) => {
    try {
        const { data, error } = await supabase.from('role_permissions').select('*').order('role');
        if (error) throw error;
        return res.json(data);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

app.put('/api/role-permissions/:role', async (req, res) => {
    const role = req.params.role;
    const permissions = req.body?.permissions;
    if (!['Administrador', 'Cajero', 'Almacenero', 'Garzón'].includes(role) || !permissions || typeof permissions !== 'object' || Array.isArray(permissions)) {
        return res.status(400).json({ error: 'El rol o el mapa de permisos no es válido.' });
    }
    if (role === 'Administrador') return res.status(400).json({ error: 'El rol Administrador conserva acceso total.' });
    try {
        const { data, error } = await supabase.from('role_permissions').upsert({ role, permissions, updated_at: new Date().toISOString() }).select().single();
        if (error) throw error;
        return res.json(data);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

const editableResources = {
    mesas: { table: 'mesas', fields: ['number', 'seats', 'status'] },
    reservas: { table: 'reservas', fields: ['clientname', 'mesanumber', 'items', 'date', 'status'], aliases: { clientName: 'clientname', mesaNumber: 'mesanumber' } },
    categorias: { table: 'categorias', fields: ['name'] },
    proveedores: { table: 'proveedores', fields: ['nombre', 'contacto', 'producto_principal'] },
    empleados: { table: 'empleados', fields: ['nombre', 'email', 'rol'] },
    promociones: { table: 'promociones', fields: ['titulo', 'descuento'] },
    kardex: { table: 'kardex', fields: ['producto', 'tipo', 'cantidad', 'motivo', 'fecha'] },
    facturas: { table: 'facturas', fields: ['cliente', 'mesa', 'metodo_pago', 'total', 'fecha'] },
    resenas: { table: 'reseñas', fields: ['cliente', 'puntuacion', 'comentario', 'fecha'] }
};

app.put('/api/:resource/:id', async (req, res) => {
    const resource = editableResources[req.params.resource];
    if (!resource) return res.status(404).json({ error: 'El recurso solicitado no admite edición.' });

    const fieldMap = Object.fromEntries(resource.fields.map(field => [field, field]));
    Object.assign(fieldMap, resource.aliases || {});
    const updateData = Object.fromEntries(
        Object.entries(fieldMap)
            .filter(([field]) => req.body && Object.hasOwn(req.body, field))
            .map(([field, column]) => [column, req.body[field]])
    );
    if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: 'No se enviaron campos válidos para actualizar.' });
    }
    if (resource.table === 'empleados') {
        if (typeof updateData.email === 'string') updateData.email = updateData.email.trim().toLowerCase();
        if (typeof updateData.rol === 'string' && !['Administrador', 'Cajero', 'Almacenero', 'Garzón'].includes(updateData.rol)) {
            return res.status(400).json({ error: 'El rol seleccionado no es válido.' });
        }
    }
    if (resource.table === 'reservas' && updateData.status
        && !['Recibido', 'En preparación', 'Listo', 'Entregado', 'Cancelado'].includes(updateData.status)) {
        return res.status(400).json({ error: 'El estado del pedido no es válido.' });
    }

    try {
        const { data, error } = await supabase
            .from(resource.table)
            .update(updateData)
            .eq('id', req.params.id)
            .select()
            .maybeSingle();
        if (error) return res.status(500).json({ error: error.message });
        if (!data) return res.status(404).json({ error: 'No se encontró el registro que se quiere actualizar.' });
        return res.json(data);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

app.delete('/api/:resource/:id', async (req, res) => {
    const resource = editableResources[req.params.resource];
    if (!resource) return res.status(404).json({ error: 'El recurso solicitado no admite eliminación.' });

    try {
        const { data, error } = await supabase
            .from(resource.table)
            .delete()
            .eq('id', req.params.id)
            .select('id')
            .maybeSingle();
        if (error) return res.status(500).json({ error: error.message });
        if (!data) return res.status(404).json({ error: 'No se encontró el registro que se quiere eliminar.' });
        return res.json({ success: true });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Backend corporativo avanzado en http://localhost:${PORT}`));