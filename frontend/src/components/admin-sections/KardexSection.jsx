import React from 'react';
import { formatDateTime } from '../../utils/formatters';
import { AdminRowActions, AdminSectionHeader } from './AdminSectionHeader';

export default function KardexSection({
  kProd, setKProd, kTipo, setKTipo, kCant, setKCant, kMotivo, setKMotivo,
  editingId, setEditingRecord, handleKardexSubmit, handleDeleteRecord, kardex
}) {
  const resetForm = () => {
    setEditingRecord('kardex', null);
    setKProd('');
    setKTipo('Entrada');
    setKCant('');
    setKMotivo('');
  };

  return (
    <div className="panel-section admin-module">
      <AdminSectionHeader icon="📦" title="Kardex de almacén" description="Registra entradas, salidas y mermas para mantener el historial de movimientos." count={kardex.length} countLabel="movimientos" />
      <form onSubmit={handleKardexSubmit} className="form-grid-pro admin-crud-form">
        <label>Producto<input type="text" placeholder="Nombre del producto" value={kProd} onChange={event => setKProd(event.target.value)} required /></label>
        <label>Movimiento<select value={kTipo} onChange={event => setKTipo(event.target.value)}>
          <option value="Entrada">Entrada</option>
          <option value="Salida">Salida</option>
          <option value="Merma">Merma</option>
        </select></label>
        <label>Cantidad<input type="number" min="1" step="1" placeholder="Unidades" value={kCant} onChange={event => setKCant(event.target.value)} required /></label>
        <label>Motivo<input type="text" placeholder="Motivo o proveedor" value={kMotivo} onChange={event => setKMotivo(event.target.value)} required /></label>
        <div className="admin-form-actions">
          <button type="submit" className="btn-neon">{editingId ? 'Guardar cambios' : 'Registrar movimiento'}</button>
          {editingId && <button type="button" className="admin-secondary-btn" onClick={resetForm}>Cancelar edición</button>}
        </div>
      </form>

      <div className="table-responsive">
        <table className="table-pro admin-data-table">
          <thead><tr><th>Producto</th><th>Tipo</th><th>Cantidad</th><th>Motivo</th><th>Fecha</th><th>Acciones</th></tr></thead>
          <tbody>
            {kardex.map(movement => <tr key={movement.id}>
              <td><strong>{movement.producto}</strong></td>
              <td><span className={`admin-stock-badge ${movement.tipo === 'Entrada' ? 'is-available' : movement.tipo === 'Merma' ? 'is-low' : ''}`}>{movement.tipo}</span></td>
              <td>{movement.cantidad} u.</td>
              <td>{movement.motivo}</td>
              <td>{formatDateTime(movement.fecha)}</td>
              <td><AdminRowActions
                onEdit={() => { setEditingRecord('kardex', movement.id); setKProd(movement.producto || ''); setKTipo(movement.tipo || 'Entrada'); setKCant(movement.cantidad ?? ''); setKMotivo(movement.motivo || ''); }}
                onDelete={() => { if (window.confirm(`¿Eliminar el movimiento de ${movement.producto}?`)) handleDeleteRecord('kardex', movement.id); }}
              /></td>
            </tr>)}
            {kardex.length === 0 && <tr><td colSpan="6"><div className="admin-empty-state">No hay movimientos registrados.</div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
