import React from 'react';
import { formatDateTime } from '../../utils/formatters';
import { AdminSectionHeader } from './AdminSectionHeader';

export default function ActivitySection({ activities, onClear }) {
  return (
    <div className="panel-section admin-module">
      <AdminSectionHeader icon="🕘" title="Historial de actividad" description="Acciones administrativas realizadas desde este navegador." count={activities.length} countLabel="eventos" />
      <div className="admin-module-toolbar">
        <p>El historial es local a este navegador; no representa auditoría compartida entre usuarios o dispositivos.</p>
        <button type="button" className="admin-secondary-btn" onClick={onClear} disabled={!activities.length}>Limpiar historial</button>
      </div>
      <div className="table-responsive">
        <table className="table-pro admin-data-table">
          <thead><tr><th>Fecha y hora</th><th>Actividad</th></tr></thead>
          <tbody>
            {activities.map(activity => (
              <tr key={activity.id}>
                <td>{formatDateTime(activity.createdAt)}</td>
                <td>{activity.description}</td>
              </tr>
            ))}
            {!activities.length && <tr><td colSpan="2"><div className="admin-empty-state">No hay actividad registrada todavía.</div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
