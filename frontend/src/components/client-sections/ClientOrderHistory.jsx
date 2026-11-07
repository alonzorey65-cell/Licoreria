import React, { useState } from 'react';
import { apiUrl } from '../../api/apiConfig';

function getOrderTotal(order) {
  return (Array.isArray(order.items) ? order.items : []).reduce(
    (total, item) => total + Number(item.price || 0) * Number(item.qty || 0),
    0
  );
}

function formatMesa(value) {
  const name = String(value || '—').trim();
  return /^mesa\b/i.test(name) ? name : `Mesa ${name}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

export default function ClientOrderHistory({ orders, onSelectOrder, onRepeatOrder, onOrderUpdated, accessToken, formatMoney = value => `$${Number(value).toFixed(2)}`, locale = 'es' }) {
  const english = locale === 'en';
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [editItems, setEditItems] = useState([]);
  const [busyOrderId, setBusyOrderId] = useState(null);
  const [feedback, setFeedback] = useState('');

  const printReceipt = order => {
    const printWindow = window.open('', '_blank', 'width=700,height=800');
    if (!printWindow) {
      setFeedback('El navegador bloqueó la ventana del comprobante. Permite ventanas emergentes para imprimir.');
      return;
    }
    const rows = (Array.isArray(order.items) ? order.items : []).map(item => (
      `<tr><td>${escapeHtml(item.name)}</td><td>${Number(item.qty) || 0}</td><td>${escapeHtml(formatMoney(Number(item.price) * Number(item.qty), order.currency || 'USD'))}</td></tr>`
    )).join('');
    printWindow.document.write(`<!doctype html><html lang="es"><meta charset="utf-8"><title>Comprobante de pedido</title>
      <style>body{font:15px Arial,sans-serif;max-width:680px;margin:36px auto;color:#222}h1{font-size:22px}table{width:100%;border-collapse:collapse;margin:22px 0}th,td{text-align:left;padding:9px;border-bottom:1px solid #ddd}footer{margin-top:30px;color:#666;font-size:12px}@media print{button{display:none}}</style>
      <h1>Comprobante de pedido #${escapeHtml(order.id || '')}</h1>
      <p>Cliente: ${escapeHtml(order.clientName || order.clientname || '')}</p>
      <p>Date: ${escapeHtml(new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'es', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(order.date || order.created_at)))}</p>
      <p>Modalidad: ${escapeHtml(order.fulfillmentMode === 'pickup' ? 'Recoger en el local' : formatMesa(order.mesaNumber || order.mesanumber))}</p>
      <table><thead><tr><th>Producto</th><th>Cantidad</th><th>Subtotal</th></tr></thead><tbody>${rows}</tbody></table>
      <p><strong>Total: ${escapeHtml(formatMoney(Number(order.order_total ?? getOrderTotal(order)) - Number(order.discount_amount || 0), order.currency || 'USD'))}</strong></p>
      <footer>Comprobante informativo del pedido. No sustituye una factura fiscal.</footer>
      <script>window.onload=()=>window.print()</script></html>`);
    printWindow.document.close();
  };

  const saveChanges = async order => {
    setBusyOrderId(order.id);
    setFeedback('');
    try {
      const response = await fetch(apiUrl('reservas/cliente'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ action: 'update', reservationId: order.id, trackingToken: order.tracking_token, items: editItems.filter(item => item.qty > 0) })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'No se pudo actualizar el pedido.');
      onOrderUpdated?.(result);
      setEditingOrderId(null);
      setFeedback('Actualizamos tu pedido.');
    } catch (error) {
      console.error('No se pudo modificar el pedido del cliente.', error);
      setFeedback(error.message);
    } finally {
      setBusyOrderId(null);
    }
  };

  const cancelOrder = async order => {
    if (!window.confirm('¿Quieres cancelar este pedido?')) return;
    setBusyOrderId(order.id);
    setFeedback('');
    try {
      const response = await fetch(apiUrl('reservas/cliente'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ action: 'cancel', reservationId: order.id, trackingToken: order.tracking_token })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'No se pudo cancelar el pedido.');
      onOrderUpdated?.(result);
      setFeedback(`Se canceló el pedido #${order.id}.`);
    } catch (error) {
      console.error('No se pudo cancelar el pedido del cliente.', error);
      setFeedback(error.message);
    } finally {
      setBusyOrderId(null);
    }
  };

  return (
    <section className="client-panel-card client-order-history" id="mis-pedidos">
      <div className="client-panel-heading">
        <div>
          <p className="store-kicker">{english ? 'YOUR ACTIVITY' : 'TU ACTIVIDAD'}</p>
          <h2>{english ? 'My orders' : 'Mis pedidos'}</h2>
        </div>
        <span className="client-panel-count">{orders.length}</span>
      </div>
      <p className="client-panel-note">{english ? 'This history is private to your verified account and syncs across devices.' : 'Este historial es privado de tu cuenta verificada y se sincroniza entre dispositivos.'}</p>
      {feedback && <p className="checkout-feedback is-success" role="status">{feedback}</p>}
      {orders.length === 0 ? (
        <p className="client-panel-empty">{english ? 'There are no orders linked to this account yet.' : 'Todavía no hay pedidos asociados a esta cuenta.'}</p>
      ) : (
        <div className="client-order-list">
          {orders.map((order, index) => (
            <article className="client-order-item" key={order.id || `${order.date}-${index}`}>
              <div className="client-order-item-heading">
                <strong>{english ? 'Order' : 'Pedido'} #{order.id || (english ? 'local' : 'local')}</strong>
                <span>{order.status || (english ? 'Confirmed' : 'Confirmado')}</span>
              </div>
              <p>{order.clientName || order.clientname} · {order.fulfillmentMode === 'pickup' ? 'Recoger en el local' : formatMesa(order.mesaNumber || order.mesanumber)}</p>
              <small>{new Intl.DateTimeFormat(english ? 'en-US' : 'es', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(order.date || order.created_at))}</small>
              <div className="client-order-item-footer">
                <span>{Array.isArray(order.items) ? order.items.reduce((count, item) => count + Number(item.qty || 0), 0) : 0} {english ? 'items' : 'productos'}</span>
                <strong>{formatMoney(Number(order.order_total ?? getOrderTotal(order)) - Number(order.discount_amount || 0), order.currency || 'USD')}</strong>
              </div>
              <div className="client-order-actions" aria-label={english ? 'Order actions' : 'Acciones del pedido'}>
                <button type="button" className="client-order-reopen is-primary" onClick={() => onSelectOrder(order)}>
                  {english ? 'Track order' : 'Ver seguimiento'}
                </button>
                <button type="button" className="client-order-reopen" onClick={() => onRepeatOrder(order)}>
                  {english ? 'Repeat order' : 'Repetir pedido'}
                </button>
                <button type="button" className="client-order-reopen" onClick={() => printReceipt(order)}>{english ? 'Print receipt' : 'Imprimir comprobante'}</button>
                {order.status === 'Recibido' && order.tracking_token && <>
                  <button type="button" className="client-order-reopen" onClick={() => { setEditingOrderId(order.id); setEditItems((order.items || []).map(item => ({ id: item.id, qty: Number(item.qty) }))); }}>
                    {english ? 'Edit order' : 'Modificar pedido'}
                  </button>
                  <button type="button" className="client-order-reopen is-danger" disabled={busyOrderId === order.id} onClick={() => cancelOrder(order)}>
                    {english ? 'Cancel order' : 'Cancelar pedido'}
                  </button>
                </>}
              </div>
              {editingOrderId === order.id && (
                <div className="client-order-edit">
                  {editItems.map(item => (
                    <label key={item.id}>
                      <span>{order.items.find(original => String(original.id) === String(item.id))?.name || 'Producto'}</span>
                      <input type="number" min="0" max="50" value={item.qty} onChange={event => {
                        const qty = Number(event.target.value);
                        setEditItems(current => current.map(currentItem => currentItem.id === item.id ? { ...currentItem, qty } : currentItem));
                      }} />
                    </label>
                  ))}
                  <div className="client-order-edit-actions">
                    <button type="button" className="checkout-button" disabled={busyOrderId === order.id || !editItems.some(item => item.qty > 0)} onClick={() => saveChanges(order)}>
                      {busyOrderId === order.id ? 'Guardando…' : 'Guardar cambios'}
                    </button>
                    <button type="button" className="client-text-link" onClick={() => setEditingOrderId(null)}>Descartar</button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
