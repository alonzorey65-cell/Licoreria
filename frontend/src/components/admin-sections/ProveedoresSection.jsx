import React from 'react';
import { AdminRowActions, AdminSectionHeader } from './AdminSectionHeader';

export default function ProveedoresSection({
  provNombre, setProvNombre, provContacto, setProvContacto, provProducto, setProvProducto,
  editingId, setEditingRecord, handleProveedorSubmit, handleDeleteRecord, proveedores
}) {
  const resetForm = () => {
    setEditingRecord('proveedores', null);
    setProvNombre('');
    setProvContacto('');
    setProvProducto('');
  };

  return (
    <div className="panel-section admin-module">
      <AdminSectionHeader icon="🚚" title="Proveedores" description="Centraliza los contactos y productos principales de tus proveedores." count={proveedores.length} />
      <form onSubmit={handleProveedorSubmit} className="form-grid-pro admin-crud-form">
        <label>Empresa<input type="text" placeholder="Nombre del proveedor" value={provNombre} onChange={event => setProvNombre(event.target.value)} required /></label>
        <label>Contacto<input type="text" placeholder="Teléfono o contacto" value={provContacto} onChange={event => setProvContacto(event.target.value)} required /></label>
        <label>Producto principal<input type="text" placeholder="Ej. Whiskys" value={provProducto} onChange={event => setProvProducto(event.target.value)} required /></label>
        <div className="admin-form-actions">
          <button type="submit" className="btn-neon">{editingId ? 'Guardar cambios' : 'Agregar proveedor'}</button>
          {editingId && <button type="button" className="admin-secondary-btn" onClick={resetForm}>Cancelar edición</button>}
        </div>
      </form>

      <div className="table-responsive">
        <table className="table-pro admin-data-table">
          <thead><tr><th>Proveedor</th><th>Contacto</th><th>Producto principal</th><th>Acciones</th></tr></thead>
          <tbody>
            {proveedores.map(proveedor => <tr key={proveedor.id}>
              <td><strong>{proveedor.nombre}</strong></td>
              <td>{proveedor.contacto}</td>
              <td><span className="admin-payment-badge">{proveedor.producto_principal}</span></td>
              <td><AdminRowActions
                onEdit={() => { setEditingRecord('proveedores', proveedor.id); setProvNombre(proveedor.nombre || ''); setProvContacto(proveedor.contacto || ''); setProvProducto(proveedor.producto_principal || ''); }}
                onDelete={() => { if (window.confirm(`¿Eliminar al proveedor ${proveedor.nombre}?`)) handleDeleteRecord('proveedores', proveedor.id); }}
              /></td>
            </tr>)}
            {proveedores.length === 0 && <tr><td colSpan="4"><div className="admin-empty-state">Todavía no hay proveedores registrados.</div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
