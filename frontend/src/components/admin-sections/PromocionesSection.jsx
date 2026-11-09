import React, { useEffect, useState } from 'react';
import { AdminRowActions, AdminSectionHeader } from './AdminSectionHeader';
import { apiAssetUrl, apiUrl } from '../../api/apiConfig';
import { adminRequest } from '../../api/adminApi';
import { isPromotionExpired } from '../../utils/promotionDates';

function generateOfferCode(prefix) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const randomValues = new Uint8Array(8);
  window.crypto.getRandomValues(randomValues);
  const suffix = Array.from(randomValues, value => alphabet[value & 31]).join('');
  return `${prefix}-${suffix}`;
}

function dateTimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function offerStatus(item) {
  if (!item.active) return 'Inactiva';
  if (item.expires_at && new Date(item.expires_at) < new Date()) return 'Vencida';
  return 'Activa';
}

function OfferCodesManager({ currency = 'PEN' }) {
  const [offers, setOffers] = useState({ promoCodes: [], giftCards: [] });
  const [promo, setPromo] = useState(() => ({ code: generateOfferCode('PROMO'), discountType: 'percent', discountValue: '', currency, maxRedemptions: '', expiresAt: '' }));
  const [gift, setGift] = useState(() => ({ code: generateOfferCode('REGALO'), balance: '', currency, expiresAt: '' }));
  const [editingPromo, setEditingPromo] = useState(null);
  const [editingGift, setEditingGift] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!editingPromo) setPromo(current => ({ ...current, currency }));
    if (!editingGift) setGift(current => ({ ...current, currency }));
  }, [currency, editingPromo, editingGift]);

  const reset = kind => {
    if (kind === 'promo') {
      setEditingPromo(null);
      setPromo({ code: generateOfferCode('PROMO'), discountType: 'percent', discountValue: '', currency, maxRedemptions: '', expiresAt: '', active: true });
    } else {
      setEditingGift(null);
      setGift({ code: generateOfferCode('REGALO'), balance: '', currency, expiresAt: '', active: true });
    }
  };

  const edit = (kind, item) => {
    setError('');
    setNotice('');
    if (kind === 'promo') {
      setEditingPromo({ code: item.code, expectedValue: item.redemption_count });
      setPromo({ code: item.code, discountType: item.discount_type, discountValue: item.discount_value, currency: item.currency, maxRedemptions: item.max_redemptions ?? '', expiresAt: dateTimeLocal(item.expires_at), active: item.active });
    } else {
      setEditingGift({ code: item.code, expectedValue: item.balance });
      setGift({ code: item.code, balance: item.balance, currency: item.currency, expiresAt: dateTimeLocal(item.expires_at), active: item.active });
    }
  };

  const refresh = async () => {
    const data = await adminRequest(apiUrl('ofertas-admin'));
    setOffers(data);
  };

  useEffect(() => {
    refresh().catch(loadError => {
      console.error('No se pudieron cargar los códigos promocionales.', loadError);
      setError(loadError.message);
    });
  }, []);

  const submit = async (event, kind) => {
    event.preventDefault();
    const isPromo = kind === 'promo';
    const values = isPromo ? promo : gift;
    const editing = isPromo ? editingPromo : editingGift;
    setBusy(true);
    setError('');
    setNotice('');
    let saved = false;
    try {
      const resource = isPromo ? 'promo' : 'gift-card';
      const payload = { ...values, expiresAt: values.expiresAt ? new Date(values.expiresAt).toISOString() : null };
      if (editing) payload.expectedValue = editing.expectedValue;
      await adminRequest(apiUrl(`ofertas-admin/${resource}${editing ? `/${encodeURIComponent(editing.code)}` : ''}`), editing ? 'PUT' : 'POST', payload);
      saved = true;
      reset(kind);
      await refresh();
      setNotice(editing ? 'Cambios guardados.' : isPromo
        ? (values.discountType === 'percent'
          ? 'Código promocional creado. El porcentaje se puede usar en cualquier moneda.'
          : `Código promocional creado para ${values.currency}.`)
        : `Tarjeta de regalo creada para ${values.currency}.`);
    } catch (requestError) {
      console.error('No se pudo guardar la oferta.', requestError);
      setError(saved ? 'Se guardó el código, pero no se pudo actualizar la lista. Usa «Actualizar lista».' : requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (kind, code) => {
    if (!window.confirm(kind === 'gift-card'
      ? `¿Eliminar la tarjeta ${code}? Su saldo dejará de estar disponible.`
      : `¿Eliminar el código ${code}? Los clientes ya no podrán utilizarlo.`)) return;
    setError('');
    setNotice('');
    setBusy(true);
    let deleted = false;
    try {
      await adminRequest(apiUrl(`ofertas-admin/${kind}/${encodeURIComponent(code)}`), 'DELETE');
      deleted = true;
      if ((kind === 'promo' && editingPromo?.code === code) || (kind === 'gift-card' && editingGift?.code === code)) reset(kind === 'promo' ? 'promo' : 'gift');
      await refresh();
      setNotice(`Se eliminó ${code}.`);
    } catch (requestError) {
      console.error('No se pudo eliminar la oferta.', requestError);
      setError(deleted ? 'Se eliminó el código, pero no se pudo actualizar la lista. Usa «Actualizar lista».' : requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const refreshList = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await refresh();
      setNotice('Lista actualizada. Si estabas editando, cancela y vuelve a seleccionar el código para usar los datos actuales.');
    } catch (requestError) {
      console.error('No se pudieron actualizar los códigos.', requestError);
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="admin-offer-codes">
      <AdminSectionHeader icon="🎟️" title="Códigos y tarjetas de regalo" description="Crea códigos de descuento y tarjetas con saldo para que los clientes los apliquen al pedido." />
      {error && <p className="admin-form-error" role="alert">{error}</p>}
      {notice && <p className="admin-settings-saved" role="status">{notice}</p>}
      <div><button className="admin-secondary-btn" type="button" onClick={refreshList} disabled={busy}>Actualizar lista</button></div>
      <div className="admin-offer-code-forms">
        <form className="form-grid-pro admin-crud-form" onSubmit={event => submit(event, 'promo')}>
          <h3>{editingPromo ? 'Editar código promocional' : 'Código promocional'}</h3>
          <label>Código promocional<div className="admin-generated-code"><input value={promo.code} onChange={event => setPromo(current => ({ ...current, code: event.target.value.toUpperCase() }))} required minLength="3" maxLength="40" pattern="[A-Za-z0-9_-]+" readOnly={Boolean(editingPromo)} />{!editingPromo && <button className="admin-action-btn" type="button" onClick={() => setPromo(current => ({ ...current, code: generateOfferCode('PROMO') }))}>Generar otro</button>}</div></label>
          <label>Tipo de descuento<select value={promo.discountType} onChange={event => setPromo(current => ({ ...current, discountType: event.target.value }))}><option value="percent">Porcentaje</option><option value="fixed">Monto fijo</option></select></label>
          <label>Descuento<input type="number" value={promo.discountValue} onChange={event => setPromo(current => ({ ...current, discountValue: event.target.value }))} min="0.01" max={promo.discountType === 'percent' ? '100' : undefined} step="0.01" required /></label>
          <label>Moneda<select value={promo.currency} onChange={event => setPromo(current => ({ ...current, currency: event.target.value }))}>{['USD', 'MXN', 'COP', 'PEN', 'EUR'].map(code => <option key={code}>{code}</option>)}</select></label>
          <label>Usos máximos<input type="number" value={promo.maxRedemptions} onChange={event => setPromo(current => ({ ...current, maxRedemptions: event.target.value }))} min="1" placeholder="Sin límite" /></label>
          <label>Válido hasta<input type="datetime-local" value={promo.expiresAt} onChange={event => setPromo(current => ({ ...current, expiresAt: event.target.value }))} /></label>
          <label className="admin-checkbox-label"><input type="checkbox" checked={promo.active !== false} onChange={event => setPromo(current => ({ ...current, active: event.target.checked }))} /> Código activo</label>
          <div className="admin-form-actions"><button className="btn-neon" type="submit" disabled={busy}>{busy ? 'Guardando…' : editingPromo ? 'Guardar código' : 'Crear código'}</button>{editingPromo && <button className="admin-secondary-btn" type="button" onClick={() => reset('promo')} disabled={busy}>Cancelar edición</button>}</div>
        </form>
        <form className="form-grid-pro admin-crud-form" onSubmit={event => submit(event, 'gift')}>
          <h3>{editingGift ? 'Editar tarjeta de regalo' : 'Tarjeta de regalo'}</h3>
          <label>Código de tarjeta<div className="admin-generated-code"><input value={gift.code} onChange={event => setGift(current => ({ ...current, code: event.target.value.toUpperCase() }))} required minLength="3" maxLength="40" pattern="[A-Za-z0-9_-]+" readOnly={Boolean(editingGift)} />{!editingGift && <button className="admin-action-btn" type="button" onClick={() => setGift(current => ({ ...current, code: generateOfferCode('REGALO') }))}>Generar otro</button>}</div></label>
          <label>Saldo disponible<input type="number" value={gift.balance} onChange={event => setGift(current => ({ ...current, balance: event.target.value }))} min={editingGift ? '0' : '0.01'} step="0.01" required /></label>
          <label>Moneda<select value={gift.currency} onChange={event => setGift(current => ({ ...current, currency: event.target.value }))}>{['USD', 'MXN', 'COP', 'PEN', 'EUR'].map(code => <option key={code}>{code}</option>)}</select></label>
          <label>Válida hasta<input type="datetime-local" value={gift.expiresAt} onChange={event => setGift(current => ({ ...current, expiresAt: event.target.value }))} /></label>
          <label className="admin-checkbox-label"><input type="checkbox" checked={gift.active !== false} onChange={event => setGift(current => ({ ...current, active: event.target.checked }))} /> Tarjeta activa</label>
          <div className="admin-form-actions"><button className="btn-neon" type="submit" disabled={busy}>{busy ? 'Guardando…' : editingGift ? 'Guardar tarjeta' : 'Crear tarjeta'}</button>{editingGift && <button className="admin-secondary-btn" type="button" onClick={() => reset('gift')} disabled={busy}>Cancelar edición</button>}</div>
        </form>
      </div>
      <div className="admin-offer-code-lists">
        <div><h3>Códigos promocionales</h3>{offers.promoCodes.map(item => <article key={item.code}>
          <strong>{item.code}</strong><span>{item.discount_type === 'percent' ? `${item.discount_value}%` : `${item.currency} ${item.discount_value}`}</span>
          <small>{item.redemption_count} usos{item.max_redemptions ? ` / ${item.max_redemptions}` : ''}</small>
          <small>{offerStatus(item)}</small>
          <button type="button" className="admin-action-btn" disabled={busy} onClick={() => edit('promo', item)}>Editar</button>
          <button type="button" className="admin-action-btn is-delete" disabled={busy} onClick={() => remove('promo', item.code)}>Eliminar</button>
        </article>)}{offers.promoCodes.length === 0 && <p>No hay códigos promocionales.</p>}</div>
        <div><h3>Tarjetas</h3>{offers.giftCards.map(item => <article key={item.code}>
          <strong>{item.code}</strong><span>{item.currency} {Number(item.balance).toFixed(2)}</span>
          <small>{offerStatus(item)}</small>
          <button type="button" className="admin-action-btn" disabled={busy} onClick={() => edit('gift', item)}>Editar</button>
          <button type="button" className="admin-action-btn is-delete" disabled={busy} onClick={() => remove('gift-card', item.code)}>Eliminar</button>
        </article>)}{offers.giftCards.length === 0 && <p>No hay tarjetas de regalo.</p>}</div>
      </div>
    </section>
  );
}

export default function PromocionesSection({
  promoTitulo, setPromoTitulo, promoDesc, setPromoDesc, promoPrecio, setPromoPrecio,
  promoStock, setPromoStock, setPromoExpectedStock, currency = 'PEN',
  promoVigenteHasta, setPromoVigenteHasta, promoLicorId, setPromoLicorId,
  promoActiva, setPromoActiva, licores = [],
  promoImageFile, setPromoImageFile, promoImageUrl, setPromoImageUrl,
  setPromoRemoveImage, editingId,
  setEditingRecord, handlePromoSubmit, handleDeleteRecord, promos
}) {
  const [filePreview, setFilePreview] = useState('');

  useEffect(() => {
    if (!promoImageFile) {
      setFilePreview('');
      return undefined;
    }

    const previewUrl = URL.createObjectURL(promoImageFile);
    setFilePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [promoImageFile]);

  const resetForm = () => {
    setEditingRecord('promociones', null);
    setPromoTitulo('');
    setPromoDesc('');
    setPromoPrecio('');
    setPromoStock('0');
    setPromoExpectedStock(null);
    setPromoVigenteHasta('');
    setPromoLicorId('');
    setPromoActiva(true);
    setPromoImageFile(null);
    setPromoImageUrl('');
    setPromoRemoveImage(false);
  };

  return (
    <div className="panel-section admin-module">
      <AdminSectionHeader icon="📢" title="Promociones" description="Crea y actualiza las ofertas que verá tu equipo y tus clientes." count={promos.length} countLabel="promociones" />
      <form onSubmit={handlePromoSubmit} className="form-grid-pro admin-crud-form">
        <label>Título<input type="text" placeholder="Ej. Happy hour de tequila" value={promoTitulo} onChange={event => setPromoTitulo(event.target.value)} required /></label>
        <label>Detalle de la promoción<input type="text" placeholder="Ej. 2x1 de 8 a 10 p. m." value={promoDesc} onChange={event => setPromoDesc(event.target.value)} required /></label>
        <label>Precio de la promoción (S/)<input type="number" placeholder="Ej. 140.00" value={promoPrecio} onChange={event => setPromoPrecio(event.target.value)} min="0" max="9999999999.99" step="0.01" /><small>Para recibir pedidos, configura precio y stock.</small></label>
        <label>Stock de promociones<input type="number" value={promoStock} onChange={event => setPromoStock(event.target.value)} min="0" max="999999999" step="1" required /><small>Stock independiente de los productos.</small></label>
        <label>Válida hasta<input type="date" value={promoVigenteHasta} onChange={event => setPromoVigenteHasta(event.target.value)} /></label>
        <label>Producto relacionado
          <select value={promoLicorId} onChange={event => setPromoLicorId(event.target.value)}>
            <option value="">Sin producto específico</option>
            {licores.map(product => <option value={product.id} key={product.id}>{product.name}</option>)}
          </select>
        </label>
        <label className="admin-checkbox-label"><input type="checkbox" checked={promoActiva} onChange={event => setPromoActiva(event.target.checked)} /> Promoción activa</label>
        <label className="admin-promo-image-input">
          Imagen promocional
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={event => {
              setPromoImageFile(event.target.files?.[0] || null);
              setPromoRemoveImage(false);
            }}
            aria-describedby="promo-image-help"
          />
          <small id="promo-image-help">JPG, PNG o WebP · máximo 5 MB</small>
        </label>
        {(filePreview || promoImageUrl) && (
          <div className="admin-promo-preview">
            <img src={filePreview || apiAssetUrl(promoImageUrl)} alt="Vista previa de la promoción" />
            <button type="button" className="admin-secondary-btn" onClick={() => { setPromoImageFile(null); setPromoImageUrl(''); setPromoRemoveImage(true); }}>
              Quitar imagen
            </button>
          </div>
        )}
        <div className="admin-form-actions">
          <button type="submit" className="btn-neon">{editingId ? 'Guardar cambios' : 'Crear promoción'}</button>
          {editingId && <button type="button" className="admin-secondary-btn" onClick={resetForm}>Cancelar edición</button>}
        </div>
      </form>

      <div className="admin-promo-grid">
        {promos.map(promo => <article key={promo.id} className="admin-promo-card">
          <span className="admin-promo-icon" aria-hidden="true">✦</span>
          {(promo.imagen || promo.image) && <img className="admin-promo-thumbnail" src={apiAssetUrl(promo.imagen || promo.image)} alt="" loading="lazy" />}
          <h3>{promo.titulo}</h3>
          <p>{promo.descuento}</p>
          {promo.precio != null && <strong>Precio: {new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(Number(promo.precio))}</strong>}
          <small>Stock: {promo.stock ?? 'no disponible'}</small>
          {promo.vigente_hasta && <small>Válida hasta {new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(`${promo.vigente_hasta}T00:00:00`))}</small>}
          <small>{promo.activa === false ? 'Inactiva' : isPromotionExpired(promo) ? 'Vencida · no visible al cliente' : 'Activa'}{promo.licor_id ? ` · ${licores.find(product => String(product.id) === String(promo.licor_id))?.name || 'Producto asociado'}` : ''}</small>
          <AdminRowActions
            onEdit={() => {
              setEditingRecord('promociones', promo.id);
              setPromoTitulo(promo.titulo || '');
              setPromoDesc(promo.descuento || '');
              setPromoPrecio(promo.precio == null ? '' : String(promo.precio));
              setPromoStock(promo.stock == null ? '0' : String(promo.stock));
              setPromoExpectedStock(promo.stock ?? null);
              setPromoVigenteHasta(promo.vigente_hasta || '');
              setPromoLicorId(promo.licor_id ? String(promo.licor_id) : '');
              setPromoActiva(promo.activa !== false);
              setPromoImageFile(null);
              setPromoImageUrl(promo.imagen || promo.image || '');
              setPromoRemoveImage(false);
            }}
            onDelete={() => { if (window.confirm(`¿Eliminar la promoción ${promo.titulo}?`)) handleDeleteRecord('promociones', promo.id); }}
          />
        </article>)}
        {promos.length === 0 && <div className="admin-empty-state">No hay promociones activas. Crea una desde el formulario.</div>}
      </div>
      <OfferCodesManager currency={currency} />
    </div>
  );
}
