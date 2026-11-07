import React from 'react';
import { AdminRowActions, AdminSectionHeader } from './AdminSectionHeader';

export default function EmpleadosSection({
  empNombre, setEmpNombre, empEmail, setEmpEmail, empRol, setEmpRol, editingId, setEditingRecord,
  handleEmpleadoSubmit, handleDeleteRecord, empleados
}) {
  const resetForm = () => {
    setEditingRecord('empleados', null);
    setEmpNombre('');
    setEmpEmail('');
    setEmpRol('Cajero');
  };

  return (
    <div className="panel-section admin-module">
      <AdminSectionHeader icon="👥" title="Personal y roles" description="Administra el equipo y las funciones de cada colaborador." count={empleados.length} countLabel="colaboradores" />
      <form onSubmit={handleEmpleadoSubmit} className="form-grid-pro admin-crud-form">
        <label>Nombre del colaborador<input type="text" placeholder="Nombre completo" value={empNombre} onChange={event => setEmpNombre(event.target.value)} required /></label>
        <label>Correo de acceso<input type="email" placeholder="empleado@negocio.com" value={empEmail} onChange={event => setEmpEmail(event.target.value)} required /></label>
        <label>Rol<select value={empRol} onChange={event => setEmpRol(event.target.value)}>
          <option value="Administrador">Administrador</option>
          <option value="Cajero">Cajero</option>
          <option value="Almacenero">Almacenero</option>
          <option value="Garzón">Garzón / Mozo</option>
        </select></label>
        <div className="admin-form-actions">
          <button type="submit" className="btn-neon">{editingId ? 'Guardar cambios' : 'Agregar colaborador'}</button>
          {editingId && <button type="button" className="admin-secondary-btn" onClick={resetForm}>Cancelar edición</button>}
        </div>
      </form>

      <div className="table-responsive">
        <table className="table-pro admin-data-table">
          <thead><tr><th>Colaborador</th><th>Correo de acceso</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>
            {empleados.map(employee => <tr key={employee.id}>
              <td><strong>{employee.nombre}</strong></td>
              <td>{employee.email || 'Sin correo asignado'}</td>
              <td><span className="admin-payment-badge">{employee.rol}</span></td>
              <td><span className="admin-stock-badge is-available">Activo</span></td>
              <td><AdminRowActions
                onEdit={() => { setEditingRecord('empleados', employee.id); setEmpNombre(employee.nombre || ''); setEmpEmail(employee.email || ''); setEmpRol(employee.rol || 'Cajero'); }}
                onDelete={() => { if (window.confirm(`¿Eliminar a ${employee.nombre}?`)) handleDeleteRecord('empleados', employee.id); }}
              /></td>
            </tr>)}
            {empleados.length === 0 && <tr><td colSpan="5"><div className="admin-empty-state">Todavía no hay colaboradores registrados.</div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
