import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiUrl } from '../../api/apiConfig';
import { adminRequest } from '../../api/adminApi';
import { AdminSectionHeader } from './AdminSectionHeader';

function useAdminCollection(path) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    try {
      const data = await adminRequest(apiUrl(path));
      if (!Array.isArray(data)) throw new Error(`La respuesta de ${path} no tiene el formato esperado.`);
      setItems(data);
      setError('');
    } catch (requestError) {
      console.error(`No se pudo cargar ${path}.`, requestError);
      setError(requestError.message);
    }
  }, [path]);

  useEffect(() => { refresh(); }, [refresh]);
  return { items, error, refresh };
}

function OperationFeedback({ error, notice }) {
  return (
    <>
      {error && <div className="admin-feedback is-error" role="alert">{error}</div>}
      {notice && <div className="admin-feedback is-success" role="status">{notice}</div>}
    </>
  );
}

function formatCurrency(value, currency) {
  return new Intl.NumberFormat('es', { style: 'currency', currency }).format(Number(value) || 0);
}

function localDateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function AlertsSection({ licores }) {
  const { items: lots, error } = useAdminCollection('lotes-inventario');
  const { items: availabilityRequests, error: requestsError, refresh: refreshAvailability } = useAdminCollection('availability-alerts');
  const [updatingRequestId, setUpdatingRequestId] = useState(null);
  const [requestError, setRequestError] = useState('');
  const updateAvailabilityStatus = async (request, status) => {
    setUpdatingRequestId(request.id);
    setRequestError('');
    try {
      await adminRequest(apiUrl(`availability-alerts/${request.id}`), 'PATCH', { status });
      await refreshAvailability();
    } catch (updateError) {
      console.error('No se pudo actualizar la solicitud de disponibilidad.', updateError);
      setRequestError(updateError.message);
    } finally {
      setUpdatingRequestId(null);
    }
  };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const criticalStock = licores.filter(product => Number(product.stock) <= 5);
  const expiringLots = lots.filter(lot => {
    const expires = new Date(`${lot.fecha_vencimiento}T00:00:00`);
    const daysLeft = Math.ceil((expires - today) / 86400000);
    return daysLeft <= 30 && Number(lot.cantidad_actual) > 0;
  }).sort((left, right) => left.fecha_vencimiento.localeCompare(right.fecha_vencimiento));

  return (
    <div className="panel-section admin-module">
      <AdminSectionHeader icon="🔔" title="Alertas inteligentes" description="Prioriza inventario crítico y atiende solicitudes para contactar clientes por reposición o cambios de precio." />
      <OperationFeedback error={error} />
      <OperationFeedback error={requestsError || requestError} />
      <div className="dashboard-grid">
        <article className={`dashboard-card ${criticalStock.length ? 'dashboard-card-warning' : 'dashboard-card-income'}`}>
          <span className="dashboard-card-label">Inventario crítico</span>
          <h2 className="dashboard-card-value">{criticalStock.length} <span>productos con 5 unidades o menos</span></h2>
        </article>
        <article className={`dashboard-card ${expiringLots.length ? 'dashboard-card-warning' : 'dashboard-card-income'}`}>
          <span className="dashboard-card-label">Vencimientos cercanos</span>
          <h2 className="dashboard-card-value">{expiringLots.length} <span>lotes en los próximos 30 días</span></h2>
        </article>
      </div>
      <div className="table-responsive">
        <table className="table-pro admin-data-table">
          <thead><tr><th>Prioridad</th><th>Producto / lote</th><th>Existencia</th><th>Vencimiento</th></tr></thead>
          <tbody>
            {criticalStock.map(product => <tr key={`stock-${product.id}`}>
              <td><span className="admin-stock-badge is-low">Stock bajo</span></td>
              <td><strong>{product.name}</strong></td>
              <td>{product.stock} u.</td>
              <td>Reponer inventario</td>
            </tr>)}
            {expiringLots.map(lot => {
              const days = Math.ceil((new Date(`${lot.fecha_vencimiento}T00:00:00`) - today) / 86400000);
              return <tr key={`lot-${lot.id}`}>
                <td><span className={`admin-stock-badge ${days < 0 ? 'is-low' : ''}`}>{days < 0 ? 'Vencido' : 'Por vencer'}</span></td>
                <td><strong>{lot.producto}</strong><small className="admin-inline-note">Lote {lot.codigo_lote}</small></td>
                <td>{lot.cantidad_actual} u.</td>
                <td>{new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(`${lot.fecha_vencimiento}T00:00:00`))}</td>
              </tr>;
            })}
            {!criticalStock.length && !expiringLots.length && <tr><td colSpan="4"><div className="admin-empty-state">Todo en orden: no hay alertas de stock ni vencimiento.</div></td></tr>}
          </tbody>
        </table>
      </div>
      <div className="admin-module-toolbar">
        <h3>Solicitudes de disponibilidad</h3>
        <p>Contacta manualmente a los clientes que solicitaron un aviso de reposición o precio.</p>
      </div>
      <div className="table-responsive">
        <table className="table-pro admin-data-table">
          <thead><tr><th>Tipo de aviso</th><th>Producto / precio objetivo</th><th>Contacto</th><th>Fecha</th><th>Estado</th><th>Seguimiento</th></tr></thead>
          <tbody>
            {availabilityRequests.map(request => (
              <tr key={request.id}>
                <td>{request.alert_type === 'price_or_restock' ? 'Precio o reposición' : 'Reposición'}</td>
                <td><strong>{request.producto}</strong>{request.target_price && <small className="admin-inline-note">Avisar al llegar a {Number(request.target_price).toFixed(2)}</small>}</td>
                <td>{request.contacto}</td>
                <td>{localDateTime(request.created_at)}</td>
                <td>{request.status}</td>
                <td>
                  <select
                    value={request.status}
                    disabled={updatingRequestId === request.id}
                    aria-label={`Estado de solicitud ${request.producto}`}
                    onChange={event => updateAvailabilityStatus(request, event.target.value)}
                  >
                    {['Pendiente', 'Contactado', 'Resuelto'].map(status => <option key={status} value={status}>{status}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {!availabilityRequests.length && <tr><td colSpan="6"><div className="admin-empty-state">Todavía no hay solicitudes de disponibilidad o precio.</div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PurchasesSection({ licores, proveedores, currency, onRefresh }) {
  const { items: purchases, error: loadError, refresh } = useAdminCollection('compras');
  const [supplierId, setSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [items, setItems] = useState([]);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitCost, setUnitCost] = useState('');
  const [expiry, setExpiry] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const addItem = () => {
    const product = licores.find(item => String(item.id) === productId);
    if (!product || Number(quantity) < 1 || Number(unitCost) < 0) {
      setError('Selecciona un producto e indica cantidad y costo válidos.');
      return;
    }
    setItems(current => [...current, {
      licorId: Number(product.id), producto: product.name,
      cantidad: Number(quantity), costoUnitario: Number(unitCost),
      fechaVencimiento: expiry || null
    }]);
    setProductId('');
    setQuantity('1');
    setUnitCost('');
    setExpiry('');
    setError('');
  };

  const submitPurchase = async event => {
    event.preventDefault();
    if (!supplierName.trim() || !items.length) {
      setError('Selecciona un proveedor y agrega al menos un producto.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await adminRequest(apiUrl('compras'), 'POST', {
        proveedorId: supplierId || null,
        proveedorNombre: supplierName,
        items
      });
      setItems([]);
      setSupplierId('');
      setSupplierName('');
      setNotice('Orden de compra registrada. El stock se actualizará al recibirla.');
      await refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const receivePurchase = async purchase => {
    setError('');
    setNotice('');
    try {
      await adminRequest(apiUrl(`compras/${purchase.id}/recibir`), 'POST', {});
      setNotice(`Compra #${purchase.id} recibida: stock y Kardex actualizados.`);
      await Promise.all([refresh(), onRefresh()]);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return (
    <div className="panel-section admin-module">
      <AdminSectionHeader icon="🛒" title="Compras y reposición" description="Registra órdenes a proveedores y suma al inventario al recibir la mercancía." count={purchases.length} countLabel="órdenes" />
      <OperationFeedback error={error || loadError} notice={notice} />
      <form className="form-grid-pro admin-crud-form" onSubmit={submitPurchase}>
        <label>Proveedor<select value={supplierId} onChange={event => {
          const provider = proveedores.find(item => String(item.id) === event.target.value);
          setSupplierId(event.target.value);
          setSupplierName(provider?.nombre || '');
        }}>
          <option value="">Proveedor externo / manual</option>
          {proveedores.map(provider => <option key={provider.id} value={provider.id}>{provider.nombre}</option>)}
        </select></label>
        {!supplierId && <label>Nombre del proveedor<input value={supplierName} onChange={event => setSupplierName(event.target.value)} required /></label>}
        <label>Producto<select value={productId} onChange={event => setProductId(event.target.value)} required>
          <option value="">Selecciona un producto</option>
          {licores.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}
        </select></label>
        <label>Cantidad<input type="number" min="1" step="1" value={quantity} onChange={event => setQuantity(event.target.value)} required /></label>
        <label>Costo por unidad<input type="number" min="0" step="0.01" value={unitCost} onChange={event => setUnitCost(event.target.value)} required /></label>
        <label>Vencimiento del lote (opcional)<input type="date" value={expiry} onChange={event => setExpiry(event.target.value)} /></label>
        <div className="admin-form-actions">
          <button type="button" className="admin-secondary-btn" onClick={addItem}>Añadir producto</button>
          <button type="submit" className="btn-neon" disabled={busy || !items.length}>{busy ? 'Guardando…' : 'Crear orden'}</button>
        </div>
        {!!items.length && <div className="admin-operation-draft">
          <strong>Productos en la orden</strong>
          {items.map((item, index) => <div key={`${item.licorId}-${index}`}>
            <span>{item.producto} × {item.cantidad}{item.fechaVencimiento ? ` · vence ${item.fechaVencimiento}` : ''}</span>
            <span>{formatCurrency(item.cantidad * item.costoUnitario, currency)}</span>
            <button type="button" aria-label={`Quitar ${item.producto}`} onClick={() => setItems(current => current.filter((_, itemIndex) => itemIndex !== index))}>Quitar</button>
          </div>)}
        </div>}
      </form>
      <div className="table-responsive">
        <table className="table-pro admin-data-table">
          <thead><tr><th>Orden</th><th>Proveedor</th><th>Detalle</th><th>Total</th><th>Estado</th><th>Acción</th></tr></thead>
          <tbody>{purchases.map(purchase => <tr key={purchase.id}>
            <td>#{purchase.id}<small className="admin-inline-note">{localDateTime(purchase.fecha)}</small></td>
            <td>{purchase.proveedor_nombre}</td>
            <td>{(purchase.compra_items || []).map(item => `${item.producto} × ${item.cantidad}`).join(', ')}</td>
            <td className="admin-amount">{formatCurrency(purchase.total, currency)}</td>
            <td><span className={`admin-stock-badge ${purchase.estado === 'Recibida' ? 'is-available' : ''}`}>{purchase.estado}</span></td>
            <td>{purchase.estado === 'Pendiente' && <button type="button" className="admin-secondary-btn" onClick={() => receivePurchase(purchase)}>Recibir y actualizar stock</button>}</td>
          </tr>)}
          {!purchases.length && <tr><td colSpan="6"><div className="admin-empty-state">Aún no hay órdenes de compra.</div></td></tr>}</tbody>
        </table>
      </div>
    </div>
  );
}

export function CashRegisterSection({ facturas, currency, userEmail }) {
  const { items: sessions, error, refresh } = useAdminCollection('cierres-caja');
  const [openingAmount, setOpeningAmount] = useState('');
  const [countedCash, setCountedCash] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const active = sessions.find(session => session.estado === 'Abierta');

  const cashSales = useMemo(() => {
    if (!active) return 0;
    return facturas.reduce((sum, invoice) => {
      const date = new Date(invoice.fecha);
      return date >= new Date(active.abierta_en) && /efectivo/i.test(invoice.metodo_pago || '')
        ? sum + Number(invoice.total || 0) : sum;
    }, 0);
  }, [active, facturas]);
  const salesByMethod = useMemo(() => {
    if (!active) return [];
    const totals = new Map();
    facturas.forEach(invoice => {
      if (new Date(invoice.fecha) < new Date(active.abierta_en)) return;
      const method = invoice.metodo_pago || 'No especificado';
      totals.set(method, (totals.get(method) || 0) + Number(invoice.total || 0));
    });
    return [...totals.entries()].map(([method, total]) => ({ method, total }));
  }, [active, facturas]);
  const expectedCash = Number(active?.monto_inicial || 0) + cashSales;

  const open = async event => {
    event.preventDefault();
    try {
      await adminRequest(apiUrl('cierres-caja'), 'POST', { montoInicial: Number(openingAmount) });
      setOpeningAmount('');
      setNotice('Turno de caja abierto.');
      setFormError('');
      await refresh();
    } catch (requestError) { setFormError(requestError.message); }
  };

  const close = async event => {
    event.preventDefault();
    if (!active) return;
    try {
      await adminRequest(apiUrl(`cierres-caja/${active.id}/cerrar`), 'POST', {
        efectivoDeclarado: Number(countedCash), notas
      });
      setCountedCash('');
      setNotes('');
      setNotice('Caja cerrada. Se guardó la diferencia respecto al efectivo esperado.');
      setFormError('');
      await refresh();
    } catch (requestError) { setFormError(requestError.message); }
  };

  return (
    <div className="panel-section admin-module">
      <AdminSectionHeader icon="💵" title="Cierre de caja y turnos" description="Controla el fondo inicial, ventas en efectivo y diferencias al cierre." />
      <OperationFeedback error={formError || error} notice={notice} />
      {!active ? (
        <form className="form-grid-pro admin-crud-form" onSubmit={open}>
          <label>Fondo inicial ({currency})<input type="number" min="0" step="0.01" value={openingAmount} onChange={event => setOpeningAmount(event.target.value)} required /></label>
          <div className="admin-form-actions"><button type="submit" className="btn-neon">Abrir turno</button></div>
        </form>
      ) : (
        <>
          <div className="dashboard-grid">
            <article className="dashboard-card dashboard-card-income"><span className="dashboard-card-label">Fondo inicial</span><h2 className="dashboard-card-value">{formatCurrency(active.monto_inicial, currency)}</h2></article>
            <article className="dashboard-card dashboard-card-total"><span className="dashboard-card-label">Ventas en efectivo</span><h2 className="dashboard-card-value">{formatCurrency(cashSales, currency)}</h2></article>
            <article className="dashboard-card dashboard-card-tables"><span className="dashboard-card-label">Efectivo esperado</span><h2 className="dashboard-card-value">{formatCurrency(expectedCash, currency)}</h2></article>
          </div>
          <div className="admin-payment-summary" aria-label="Ventas por método de pago en el turno">
            {salesByMethod.map(item => <article key={item.method}><span>{item.method}</span><strong>{formatCurrency(item.total, currency)}</strong></article>)}
            {!salesByMethod.length && <p className="admin-empty-state">Todavía no hay tickets POS durante este turno.</p>}
          </div>
          <p>Turno abierto por {active.abierta_por} · {localDateTime(active.abierta_en)} · Sesión de {userEmail}</p>
          <form className="form-grid-pro admin-crud-form" onSubmit={close}>
            <label>Efectivo contado ({currency})<input type="number" min="0" step="0.01" value={countedCash} onChange={event => setCountedCash(event.target.value)} required /></label>
            <label>Notas del cierre<input value={notes} onChange={event => setNotes(event.target.value)} placeholder="Diferencia, incidencias…" /></label>
            <p className="admin-cash-difference">Diferencia estimada: {formatCurrency(Number(countedCash || 0) - expectedCash, currency)}</p>
            <div className="admin-form-actions"><button type="submit" className="btn-neon">Cerrar caja</button></div>
          </form>
        </>
      )}
      <div className="table-responsive">
        <table className="table-pro admin-data-table"><thead><tr><th>Abierta</th><th>Abrió</th><th>Fondo</th><th>Cierre</th><th>Cerró</th><th>Contado</th><th>Diferencia</th></tr></thead>
          <tbody>{sessions.filter(session => session.estado === 'Cerrada').map(session => <tr key={session.id}>
            <td>{localDateTime(session.abierta_en)}</td><td>{session.abierta_por}</td>
            <td>{formatCurrency(session.monto_inicial, currency)}</td><td>{localDateTime(session.cerrada_en)}</td><td>{session.cerrada_por}</td>
            <td>{formatCurrency(session.efectivo_declarado, currency)}</td>
            <td>{formatCurrency(Number(session.efectivo_declarado || 0) - Number(session.efectivo_esperado || 0), currency)}</td>
          </tr>)}
          {!sessions.some(session => session.estado === 'Cerrada') && <tr><td colSpan="7"><div className="admin-empty-state">Todavía no hay turnos cerrados.</div></td></tr>}</tbody>
        </table>
      </div>
    </div>
  );
}

export function BookingCalendarSection({ mesas }) {
  const { items: bookings, error, refresh } = useAdminCollection('agenda');
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(() => new Date().toDateString());
  const [form, setForm] = useState({ tipo: 'Reserva', cliente: '', telefono: '', mesa_id: '', personas: '2', inicia_en: '', notas: '' });
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const updateForm = (field, value) => setForm(current => ({ ...current, [field]: value }));

  const submit = async event => {
    event.preventDefault();
    const mesa = mesas.find(item => String(item.id) === form.mesa_id);
    try {
      await adminRequest(apiUrl('agenda'), 'POST', {
        ...form, mesa_id: form.mesa_id || null, mesa_nombre: mesa?.number || null,
        personas: Number(form.personas), inicia_en: new Date(form.inicia_en).toISOString()
      });
      setForm({ tipo: 'Reserva', cliente: '', telefono: '', mesa_id: '', personas: '2', inicia_en: '', notas: '' });
      setNotice('Reserva o evento agregado a la agenda.');
      setFormError('');
      await refresh();
    } catch (requestError) { setFormError(requestError.message); }
  };

  const updateStatus = async (item, status) => {
    try {
      await adminRequest(apiUrl(`agenda/${item.id}`), 'PUT', { estado: status });
      await refresh();
    } catch (requestError) { setFormError(requestError.message); }
  };
  const remove = async item => {
    if (!window.confirm(`¿Eliminar "${item.titulo || item.cliente}" de la agenda?`)) return;
    try {
      await adminRequest(apiUrl(`agenda/${item.id}`), 'DELETE');
      await refresh();
    } catch (requestError) { setFormError(requestError.message); }
  };

  const sorted = [...bookings].sort((a, b) => a.inicia_en.localeCompare(b.inicia_en));
  const upcoming = sorted.filter(item => new Date(item.inicia_en) >= new Date() && item.estado !== 'Cancelada');
  const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const calendarStart = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1 - firstDay.getDay());
  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + index);
    return date;
  });
  const selectedBookings = sorted.filter(item => new Date(item.inicia_en).toDateString() === selectedDay);
  const changeMonth = offset => {
    const nextMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + offset, 1);
    setVisibleMonth(nextMonth);
    setSelectedDay(nextMonth.toDateString());
  };

  return (
    <div className="panel-section admin-module">
      <AdminSectionHeader icon="🗓️" title="Agenda de reservas y eventos" description="Organiza horarios, mesas y reuniones del local." count={upcoming.length} countLabel="próximos" />
      <OperationFeedback error={formError || error} notice={notice} />
      <form className="form-grid-pro admin-crud-form" onSubmit={submit}>
        <label>Tipo<select value={form.tipo} onChange={event => updateForm('tipo', event.target.value)}><option>Reserva</option><option>Evento</option></select></label>
        <label>Cliente o responsable<input value={form.cliente} onChange={event => updateForm('cliente', event.target.value)} required /></label>
        <label>Teléfono<input value={form.telefono} onChange={event => updateForm('telefono', event.target.value)} /></label>
        <label>Fecha y hora<input type="datetime-local" value={form.inicia_en} onChange={event => updateForm('inicia_en', event.target.value)} required /></label>
        <label>Personas<input type="number" min="1" value={form.personas} onChange={event => updateForm('personas', event.target.value)} required /></label>
        <label>Mesa (opcional)<select value={form.mesa_id} onChange={event => updateForm('mesa_id', event.target.value)}><option value="">Sin asignar</option>{mesas.map(table => <option key={table.id} value={table.id}>{table.number}</option>)}</select></label>
        {form.tipo === 'Evento' && <label>Nombre del evento<input value={form.titulo} onChange={event => updateForm('titulo', event.target.value)} /></label>}
        <label>Notas<input value={form.notas} onChange={event => updateForm('notas', event.target.value)} /></label>
        <div className="admin-form-actions"><button type="submit" className="btn-neon">Agregar a la agenda</button></div>
      </form>
      <section className="admin-calendar">
        <div className="admin-calendar-toolbar">
          <button type="button" className="admin-secondary-btn" aria-label="Mes anterior" onClick={() => changeMonth(-1)}>‹</button>
          <h3>{new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' }).format(visibleMonth)}</h3>
          <button type="button" className="admin-secondary-btn" aria-label="Mes siguiente" onClick={() => changeMonth(1)}>›</button>
        </div>
        <div className="admin-calendar-grid" role="grid" aria-label="Calendario de reservas">
          {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => <span className="admin-calendar-weekday" key={day}>{day}</span>)}
          {calendarDays.map(day => {
            const dayKey = day.toDateString();
            const dayBookings = sorted.filter(item => new Date(item.inicia_en).toDateString() === dayKey && item.estado !== 'Cancelada');
            return <button type="button" role="gridcell" key={dayKey}
              className={`admin-calendar-day ${day.getMonth() === visibleMonth.getMonth() ? '' : 'is-outside'} ${selectedDay === dayKey ? 'is-selected' : ''}`}
              aria-label={`${new Intl.DateTimeFormat('es', { dateStyle: 'full' }).format(day)}${dayBookings.length ? `, ${dayBookings.length} eventos` : ''}`}
              aria-pressed={selectedDay === dayKey} onClick={() => setSelectedDay(dayKey)}>
              <span>{day.getDate()}</span>{!!dayBookings.length && <i aria-hidden="true">{dayBookings.length}</i>}
            </button>;
          })}
        </div>
      </section>
      <div className="admin-calendar-list">
        <h3>{new Intl.DateTimeFormat('es', { dateStyle: 'full' }).format(new Date(selectedDay))}</h3>
        {selectedBookings.map(item => <article className={`admin-calendar-item status-${item.estado.toLowerCase()}`} key={item.id}>
          <time><strong>{new Intl.DateTimeFormat('es', { day: '2-digit' }).format(new Date(item.inicia_en))}</strong>{new Intl.DateTimeFormat('es', { month: 'short' }).format(new Date(item.inicia_en))}<small>{new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' }).format(new Date(item.inicia_en))}</small></time>
          <div><span className="admin-payment-badge">{item.tipo}</span><h3>{item.titulo || item.cliente}</h3><p>{item.cliente} · {item.personas} personas{item.mesa_nombre ? ` · ${item.mesa_nombre}` : ''}</p>{item.notas && <small>{item.notas}</small>}</div>
          <div className="admin-calendar-actions">
            <select aria-label={`Estado de ${item.titulo || item.cliente}`} value={item.estado} onChange={event => updateStatus(item, event.target.value)}>
              {['Pendiente', 'Confirmada', 'Atendida', 'Cancelada'].map(status => <option key={status}>{status}</option>)}
            </select>
            <button type="button" className="admin-action-btn is-delete" onClick={() => remove(item)}>Eliminar</button>
          </div>
        </article>)}
        {!sorted.length && <div className="admin-empty-state">No hay reservas o eventos agendados.</div>}
      </div>
    </div>
  );
}

export function LoyaltySection({ currency }) {
  const { items: customers, error, refresh } = useAdminCollection('fidelizacion');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');

  const earn = async event => {
    event.preventDefault();
    try {
      const result = await adminRequest(apiUrl('fidelizacion'), 'POST', { nombre: name, email, monto: Number(amount) });
      setNotice(`Se acreditaron puntos. Saldo actualizado: ${result.puntos ?? 0}.`);
      setName(''); setEmail(''); setAmount('');
      setFormError('');
      await refresh();
    } catch (requestError) { setFormError(requestError.message); }
  };
  const redeem = async customer => {
    try {
      await adminRequest(apiUrl(`fidelizacion/${customer.id}/canjear`), 'POST', { puntos: 100 });
      setNotice(`Se canjearon 100 puntos de ${customer.nombre}.`);
      await refresh();
    } catch (requestError) { setFormError(requestError.message); }
  };
  const visibleCustomers = customers.filter(customer => `${customer.nombre} ${customer.email || ''}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="panel-section admin-module">
      <AdminSectionHeader icon="🎁" title="Fidelización de clientes" description="El POS acredita 1 punto por cada unidad monetaria; registra aquí compras externas y canjea cada 100 puntos." count={customers.length} countLabel="clientes" />
      <OperationFeedback error={formError || error} notice={notice} />
      <form className="form-grid-pro admin-crud-form" onSubmit={earn}>
        <label>Cliente<input value={name} onChange={event => setName(event.target.value)} required minLength="2" /></label>
        <label>Correo (opcional)<input type="email" value={email} onChange={event => setEmail(event.target.value)} /></label>
        <label>Compra ({currency})<input type="number" min="1" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} required /></label>
        <div className="admin-form-actions"><button className="btn-neon" type="submit">Acreditar compra externa</button></div>
      </form>
      <input className="admin-customer-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar cliente" aria-label="Buscar clientes de fidelización" />
      <div className="table-responsive">
        <table className="table-pro admin-data-table"><thead><tr><th>Cliente</th><th>Correo</th><th>Puntos</th><th>Compra acumulada</th><th>Último movimiento</th><th>Acción</th></tr></thead>
          <tbody>{visibleCustomers.map(customer => {
            const lastMove = [...(customer.fidelizacion_movimientos || [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
            return <tr key={customer.id}>
              <td><strong>{customer.nombre}</strong></td><td>{customer.email || '—'}</td>
              <td><span className="admin-payment-badge">{customer.puntos} pts</span></td>
              <td>{formatCurrency(customer.gasto_acumulado, currency)}</td><td>{lastMove ? localDateTime(lastMove.created_at) : '—'}</td>
              <td><button type="button" className="admin-secondary-btn" disabled={Number(customer.puntos) < 100} onClick={() => redeem(customer)}>Canjear 100 pts</button></td>
            </tr>;
          })}
          {!visibleCustomers.length && <tr><td colSpan="6"><div className="admin-empty-state">{search ? 'No se encontraron clientes.' : 'Registra la primera compra para iniciar el programa.'}</div></td></tr>}</tbody>
        </table>
      </div>
    </div>
  );
}

const permissionLabels = [
  ['dashboard', 'Dashboard'], ['licores', 'Licores y stock'], ['mesas', 'Mesas'], ['ayuda', 'Ayuda clientes'],
  ['reservas', 'Ventas'], ['pos', 'Facturación POS'], ['kardex', 'Kardex'], ['analitica', 'Analítica'],
  ['proveedores', 'Proveedores'], ['empleados', 'Personal'], ['promociones', 'Promociones'],
  ['resenas', 'Reseñas'], ['categorias', 'Categorías'], ['configuracion', 'Configuración'],
  ['reportes', 'Reportes'], ['actividad', 'Historial'], ['clientes', 'Clientes'],
  ['alertas', 'Alertas'], ['compras', 'Compras'], ['caja', 'Cierre de caja'],
  ['agenda', 'Agenda'], ['fidelizacion', 'Fidelización'], ['lotes', 'Lotes y vencimientos']
];

export function PermissionsSection() {
  const { items: roles, error, refresh } = useAdminCollection('role-permissions');
  const [selectedRole, setSelectedRole] = useState('Cajero');
  const [permissions, setPermissions] = useState({});
  const [notice, setNotice] = useState('');
  const [formError, setFormError] = useState('');
  const currentRole = roles.find(item => item.role === selectedRole);

  useEffect(() => setPermissions(currentRole?.permissions || {}), [currentRole]);

  const save = async event => {
    event.preventDefault();
    try {
      await adminRequest(apiUrl(`role-permissions/${selectedRole}`), 'PUT', { permissions });
      setNotice(`Permisos de ${selectedRole} guardados.`);
      setFormError('');
      await refresh();
    } catch (requestError) { setFormError(requestError.message); }
  };

  return (
    <div className="panel-section admin-module">
      <AdminSectionHeader icon="🛡️" title="Permisos por rol" description="Configura qué secciones puede consultar cada cuenta. El backend valida cada solicitud." />
      <OperationFeedback error={formError || error} notice={notice} />
      <form className="admin-permissions-panel" onSubmit={save}>
        <label>Rol<select value={selectedRole} onChange={event => setSelectedRole(event.target.value)}>
          {roles.filter(role => role.role !== 'Administrador').map(role => <option key={role.role}>{role.role}</option>)}
        </select></label>
        <p>El rol Administrador conserva acceso total y no se puede limitar desde aquí.</p>
        <div className="admin-permission-grid">
          {permissionLabels.map(([key, label]) => <label key={key}>
            <span>{label}</span>
            <input type="checkbox" checked={Boolean(permissions[key])} onChange={event => setPermissions(current => ({ ...current, [key]: event.target.checked }))} />
          </label>)}
        </div>
        <div className="admin-form-actions"><button className="btn-neon" type="submit" disabled={!currentRole}>Guardar permisos</button></div>
      </form>
    </div>
  );
}

export function InventoryLotsSection({ licores, onRefresh }) {
  const { items: lots, error, refresh } = useAdminCollection('lotes-inventario');
  const [productId, setProductId] = useState('');
  const [code, setCode] = useState('');
  const [quantity, setQuantity] = useState('');
  const [expiry, setExpiry] = useState('');
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');

  const addLot = async event => {
    event.preventDefault();
    try {
      await adminRequest(apiUrl('lotes-inventario'), 'POST', {
        licorId: Number(productId), codigoLote: code, cantidad: Number(quantity), fechaVencimiento: expiry
      });
      setCode(''); setQuantity(''); setExpiry('');
      setNotice('Lote registrado. Se actualizó el stock y el Kardex.');
      setFormError('');
      await Promise.all([refresh(), onRefresh()]);
    } catch (requestError) { setFormError(requestError.message); }
  };

  const sortedLots = [...lots].sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento));
  return (
    <div className="panel-section admin-module">
      <AdminSectionHeader icon="🏷️" title="Lotes y vencimientos" description="Registra lotes para alertar sobre vencimientos y mantener trazabilidad." count={lots.length} countLabel="lotes" />
      <OperationFeedback error={formError || error} notice={notice} />
      <form className="form-grid-pro admin-crud-form" onSubmit={addLot}>
        <label>Producto<select value={productId} onChange={event => setProductId(event.target.value)} required><option value="">Selecciona un producto</option>{licores.map(product => <option key={product.id} value={product.id}>{product.name} · stock actual {product.stock}</option>)}</select></label>
        <label>Código del lote<input value={code} onChange={event => setCode(event.target.value)} required /></label>
        <label>Cantidad recibida<input type="number" min="1" step="1" value={quantity} onChange={event => setQuantity(event.target.value)} required /></label>
        <label>Fecha de vencimiento<input type="date" value={expiry} onChange={event => setExpiry(event.target.value)} required /></label>
        <div className="admin-form-actions"><button type="submit" className="btn-neon">Registrar lote y entrada</button></div>
      </form>
      <div className="table-responsive">
        <table className="table-pro admin-data-table"><thead><tr><th>Producto</th><th>Lote</th><th>Cantidad</th><th>Vencimiento</th><th>Estado</th></tr></thead>
          <tbody>{sortedLots.map(lot => {
            const days = Math.ceil((new Date(`${lot.fecha_vencimiento}T00:00:00`) - new Date(new Date().setHours(0, 0, 0, 0))) / 86400000);
            return <tr key={lot.id}><td><strong>{lot.producto}</strong></td><td>{lot.codigo_lote}</td><td>{lot.cantidad_actual} / {lot.cantidad_inicial}</td>
              <td>{new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(`${lot.fecha_vencimiento}T00:00:00`))}</td>
              <td><span className={`admin-stock-badge ${days < 0 || lot.cantidad_actual === 0 ? 'is-low' : days <= 30 ? '' : 'is-available'}`}>{lot.cantidad_actual === 0 ? 'Agotado' : days < 0 ? 'Vencido' : days <= 30 ? `${days} días` : 'Vigente'}</span></td></tr>;
          })}
          {!sortedLots.length && <tr><td colSpan="5"><div className="admin-empty-state">Aún no hay lotes; los vencimientos pueden añadirse al registrar una compra.</div></td></tr>}</tbody>
        </table>
      </div>
    </div>
  );
}
