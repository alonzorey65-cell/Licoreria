import React from 'react';
import { AdminRowActions, AdminSectionHeader } from './AdminSectionHeader';

export default function MesasSection({
  mesas, mesaNum, setMesaNum, seats, setSeats, editingId, setEditingRecord,
  handleMesaSubmit, handleLiberarMesa, handleEliminarMesa
}) {
  const resetForm = () => {
    setEditingRecord('mesas', null);
    setMesaNum('');
    setSeats('');
  };

  return (
    <div className="panel-section admin-module">
      <AdminSectionHeader icon="🪑" title="Mesas y salón" description="Organiza la capacidad del salón y controla su disponibilidad." count={mesas.length} countLabel="mesas" />
      <form onSubmit={handleMesaSubmit} className="form-grid-pro admin-crud-form">
        <label>Nombre o ubicación<input type="text" placeholder="Ej. Mesa 05 · Terraza" value={mesaNum} onChange={event => setMesaNum(event.target.value)} required /></label>
        <label>Capacidad<input type="number" min="1" step="1" placeholder="Cantidad de personas" value={seats} onChange={event => setSeats(event.target.value)} required /></label>
        <div className="admin-form-actions">
          <button type="submit" className="btn-neon">{editingId ? 'Guardar cambios' : 'Crear mesa'}</button>
          {editingId && <button type="button" className="admin-secondary-btn" onClick={resetForm}>Cancelar edición</button>}
        </div>
      </form>

      <div className="table-responsive">
        <table className="table-pro admin-data-table">
          <thead><tr><th>Mesa</th><th>Capacidad</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>
            {mesas.map(mesa => (
              <tr key={mesa.id}>
                <td><strong>{mesa.number}</strong></td>
                <td>{mesa.seats} personas</td>
                <td><span className={`admin-stock-badge ${mesa.status === 'Disponible' ? 'is-available' : 'is-occupied'}`}>{mesa.status}</span></td>
                <td><div className="admin-row-actions">
                  <AdminRowActions
                    onEdit={() => { setEditingRecord('mesas', mesa.id); setMesaNum(mesa.number); setSeats(mesa.seats); }}
                    onDelete={() => { if (window.confirm(`¿Eliminar ${mesa.number}?`)) handleEliminarMesa(mesa.id); }}
                  />
                  {mesa.status === 'Ocupada' && <button type="button" className="admin-action-btn is-release" onClick={() => handleLiberarMesa(mesa.number)}>Liberar mesa</button>}
                </div></td>
              </tr>
            ))}
            {mesas.length === 0 && <tr><td colSpan="4"><div className="admin-empty-state">No hay mesas registradas. Crea una para comenzar.</div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
