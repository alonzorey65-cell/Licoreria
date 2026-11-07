import React from 'react';
import { formatDateTime } from '../../utils/formatters';
import { AdminRowActions, AdminSectionHeader } from './AdminSectionHeader';

export default function VentasSection({
  reservas, clientProfiles = [], mesas, licores, ventaCliente, setVentaCliente, ventaMesa, setVentaMesa,
  ventaMesaId, setVentaMesaId, ventaProductoId, setVentaProductoId, ventaCantidad,
  setVentaCantidad, editingId, setEditingRecord, handleVentaSubmit, handleDeleteRecord,
  descargarCSV, onUpdateStatus
}) {
  const resetForm = () => {
    setEditingRecord('reservas', null);
    setVentaCliente('');
    setVentaMesa('');
    setVentaMesaId('');
    setVentaProductoId('');
    setVentaCantidad('1');
  };
  const profileByUserId = new Map(clientProfiles.map(profile => [profile.userId, profile]));

  return (
    <div className="panel-section admin-module">
      <AdminSectionHeader icon="🧾" title="Ventas y caja" description="Consulta pedidos del local, ajusta sus datos y descarga reportes." count={reservas.length} countLabel="ventas" />
      <div className="admin-module-toolbar">
        <p>Registra pedidos rápidos o consulta los pedidos recibidos desde la tienda.</p>
        <button type="button" onClick={descargarCSV} className="admin-secondary-btn">Descargar CSV</button>
      </div>
      <form onSubmit={handleVentaSubmit} className="form-grid-pro admin-crud-form">
        <label>Cliente<input value={ventaCliente} onChange={event => setVentaCliente(event.target.value)} placeholder="Nombre del cliente" minLength="2" required /></label>
        {editingId ? <label>Mesa<input value={ventaMesa} onChange={event => setVentaMesa(event.target.value)} required /></label> : <>
          <label>Mesa disponible<select value={ventaMesaId} onChange={event => setVentaMesaId(event.target.value)} required>
            <option value="">{mesas.some(mesa => mesa.status === 'Disponible') ? 'Selecciona una mesa' : 'No hay mesas disponibles'}</option>
            {mesas.filter(mesa => mesa.status === 'Disponible').map(mesa => <option key={mesa.id} value={mesa.id}>{mesa.number} · {mesa.seats} personas</option>)}
          </select></label>
          <label>Producto<select value={ventaProductoId} onChange={event => setVentaProductoId(event.target.value)} required>
            <option value="">Selecciona un producto</option>
            {licores.filter(product => Number(product.stock) > 0).map(product => <option key={product.id} value={product.id}>{product.name} · ${Number(product.price).toFixed(2)}</option>)}
          </select></label>
          <label>Cantidad<input type="number" min="1" step="1" value={ventaCantidad} onChange={event => setVentaCantidad(event.target.value)} required /></label>
        </>}
        <div className="admin-form-actions">
          <button type="submit" className="btn-neon" disabled={!editingId && (!mesas.some(mesa => mesa.status === 'Disponible') || !licores.some(product => Number(product.stock) > 0))}>{editingId ? 'Guardar cambios' : 'Registrar venta'}</button>
          {editingId && <button type="button" className="admin-secondary-btn" onClick={resetForm}>Cancelar edición</button>}
        </div>
      </form>
      <div className="table-responsive">
        <table className="table-pro admin-data-table">
          <thead><tr><th>Cliente</th><th>Entrega / mesa</th><th>Productos</th><th>Fecha / horario</th><th>Total</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>
            {reservas.map(reserva => {
              const total = Number(reserva.order_total ?? reserva.items?.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0) ?? 0) - Number(reserva.discount_amount || 0);
              const profile = profileByUserId.get(reserva.client_user_id);
              return <tr key={reserva.id}>
                <td><div className="admin-customer-identity">
                  {profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" loading="lazy" /> : <span aria-hidden="true">{(profile?.displayName || reserva.clientName || 'C').charAt(0).toUpperCase()}</span>}
                  <div><strong>{profile?.displayName || reserva.clientName}</strong>{profile?.email && <small className="admin-inline-note">{profile.email}</small>}</div>
                </div></td>
                <td>{reserva.fulfillment_mode === 'pickup' ? 'Recoger en el local' : /^mesa\b/i.test(String(reserva.mesaNumber || '')) ? reserva.mesaNumber : `Mesa ${reserva.mesaNumber || '—'}`}</td>
                <td>{reserva.items?.map(item => `${item.name} × ${item.qty}`).join(', ') || '—'}</td>
                <td>{formatDateTime(reserva.date)}{reserva.scheduled_for && <small className="admin-inline-note">Programado: {formatDateTime(reserva.scheduled_for)}</small>}</td>
                <td className="admin-amount">{new Intl.NumberFormat('es', { style: 'currency', currency: reserva.currency || 'USD' }).format(Math.max(0, total))}</td>
                <td>
                  <select
                    value={reserva.status || 'Recibido'}
                    aria-label={`Estado del pedido de ${reserva.clientName || 'cliente'}`}
                    onChange={event => onUpdateStatus(reserva, event.target.value)}
                  >
                    {['Recibido', 'En preparación', 'Listo', 'Entregado', 'Cancelado'].map(status => <option key={status} value={status}>{status}</option>)}
                  </select>
                </td>
                <td><AdminRowActions
                  onEdit={() => { setEditingRecord('reservas', reserva.id); setVentaCliente(reserva.clientName || ''); setVentaMesa(reserva.mesaNumber || ''); }}
                  onDelete={() => { if (window.confirm(`¿Eliminar la venta de ${reserva.clientName || 'este cliente'}?`)) handleDeleteRecord('reservas', reserva.id); }}
                /></td>
              </tr>;
            })}
            {reservas.length === 0 && <tr><td colSpan="7"><div className="admin-empty-state">Todavía no hay ventas registradas.</div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
