import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

test('promotion stock is reserved and restored transactionally', { skip: !process.env.PGLITE_MODULE }, async t => {
    const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
    const db = new PGlite();
    t.after(() => db.close());
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated;
      CREATE TABLE public.promociones (id bigint PRIMARY KEY, titulo text, precio numeric(12,2), activa boolean, vigente_hasta date);
      CREATE TABLE public.reservas (id bigint PRIMARY KEY, items jsonb, status text, currency text);
    `);
    await db.exec(await readFile(new URL('../migrations/20261108_promotion_order_stock.sql', import.meta.url), 'utf8'));
    await db.exec("INSERT INTO public.promociones VALUES (1,'Combo',140,true,NULL,1), (2,'Vencida',50,true,'2000-01-01',4)");
    const order = (id, price = 140, qty = 1, promo = 1, currency = 'PEN') => db.query(
        "INSERT INTO public.reservas VALUES ($1,$2,'Recibido',$3)",
        [id, JSON.stringify([{ type: 'promotion', id: promo, qty, price }]), currency]);
    const stock = async id => (await db.query('SELECT stock FROM public.promociones WHERE id = $1', [id])).rows[0].stock;
    await assert.rejects(order(1, 1));
    await assert.rejects(order(2, 140, 1, 1, 'USD'));
    await assert.rejects(order(3, 50, 1, 2));
    assert.equal(await stock(1), 1);
    const results = await Promise.allSettled([order(4), order(5)]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(await stock(1), 0);
    const winner = (await db.query('SELECT id FROM public.reservas')).rows[0].id;
    await assert.rejects(db.query("UPDATE public.reservas SET items = '[]' WHERE id = $1", [winner]));
    await db.query("UPDATE public.reservas SET status = 'Cancelado' WHERE id = $1", [winner]);
    await db.query("UPDATE public.reservas SET status = 'Cancelado' WHERE id = $1", [winner]);
    assert.equal(await stock(1), 1);
    await assert.rejects(db.query("UPDATE public.reservas SET status = 'Recibido' WHERE id = $1", [winner]));
    await db.query('DELETE FROM public.reservas WHERE id = $1', [winner]);
    assert.equal(await stock(1), 1);
    await order(6);
    await db.query('DELETE FROM public.reservas WHERE id = 6');
    assert.equal(await stock(1), 1);
    await order(7);
    await db.query("UPDATE public.reservas SET status = 'Entregado' WHERE id = 7");
    await assert.rejects(db.query('DELETE FROM public.reservas WHERE id = 7'));
    assert.equal(await stock(1), 0);
    await db.exec("INSERT INTO public.reservas VALUES (8,'[]','Recibido','PEN')");
    await assert.rejects(db.query('UPDATE public.reservas SET items = $1 WHERE id = 8', [
        JSON.stringify([{ type: 'promotion', id: 1, qty: 1, price: 140 }])
    ]));
});
