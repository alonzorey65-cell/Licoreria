import React from 'react';
import { formatDateTime } from '../../utils/formatters';
import { AdminRowActions, AdminSectionHeader } from './AdminSectionHeader';

export default function PosSection({
  fCliente, setFCliente, fMesa, setFMesa, fPago, setFPago, fTotal, setFTotal,
  editingId, setEditingRecord, handleFacturaSubmit, handleDeleteRecord, facturas
}) {
  const resetForm = () => {
    setEditingRecord('facturas', null);
    setFCliente('');
    setFMesa('');
    setFTotal('');
    setFPago('Efectivo');
  };

  return (
    <div className="panel-section admin-module">
      <AdminSectionHeader icon="🖨️" title="Facturación POS" description="Registra tickets y mantén los comprobantes de pago organizados." count={facturas.length} countLabel="tickets" />
      <form onSubmit={handleFacturaSubmit} className="form-grid-pro admin-crud-form">
        <label>Cliente<input type="text" placeholder="Nombre del cliente" value={fCliente} onChange={event => setFCliente(event.target.value)} required /></label>
        <label>Mesa<input type="text" placeholder="Ej. Mesa 02" value={fMesa} onChange={event => setFMesa(event.target.value)} required /></label>
        <label>Método de pago<select value={fPago} onChange={event => setFPago(event.target.value)}>
          <option value="Efectivo">Efectivo</option>
          <option value="Tarjeta">Tarjeta</option>
          <option value="Yape/Plin">Yape / Plin</option>
          <option value="Transferencia">Transferencia</option>
        </select></label>
        <label>Total<input type="number" min="0" step="0.01" placeholder="$ 0.00" value={fTotal} onChange={event => setFTotal(event.target.value)} required /></label>
        <div className="admin-form-actions">
          <button type="submit" className="btn-neon">{editingId ? 'Guardar cambios' : 'Registrar ticket'}</button>
          {editingId && <button type="button" className="admin-secondary-btn" onClick={resetForm}>Cancelar edición</button>}
        </div>
      </form>

      <div className="table-responsive">
        <table className="table-pro admin-data-table">
          <thead><tr><th>Cliente</th><th>Mesa</th><th>Pago</th><th>Fecha</th><th>Total</th><th>Acciones</th></tr></thead>
          <tbody>
            {facturas.map(factura => <tr key={factura.id}>
              <td><strong>{factura.cliente}</strong></td>
              <td>{factura.mesa}</td>
              <td><span className="admin-payment-badge">{factura.metodo_pago}</span></td>
              <td>{formatDateTime(factura.fecha)}</td>
              <td className="admin-amount">${Number(factura.total).toFixed(2)}</td>
              <td><AdminRowActions
                onEdit={() => { setEditingRecord('facturas', factura.id); setFCliente(factura.cliente || ''); setFMesa(factura.mesa || ''); setFPago(factura.metodo_pago || 'Efectivo'); setFTotal(factura.total ?? ''); }}
                onDelete={() => { if (window.confirm(`¿Eliminar el ticket de ${factura.cliente || 'este cliente'}?`)) handleDeleteRecord('facturas', factura.id); }}
              /></td>
            </tr>)}
            {facturas.length === 0 && <tr><td colSpan="6"><div className="admin-empty-state">Todavía no hay tickets. Registra la primera venta.</div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
