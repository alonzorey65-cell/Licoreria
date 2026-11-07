import React from 'react';
import { AdminSectionHeader } from './AdminSectionHeader';
import { formatDateTime } from '../../utils/formatters';

export default function HelpRequestsSection({ requests, onUpdateStatus }) {
  const pendingCount = requests.filter(request => request.status !== 'atendida').length;

  return (
    <div className="panel-section admin-module">
      <AdminSectionHeader
        icon="🔔"
        title="Solicitudes de ayuda"
        description="Atiende los avisos enviados desde el panel de clientes."
        count={pendingCount}
        countLabel="pendientes"
      />
      <div className="help-request-list">
        {requests.map(request => (
          <article className={`help-request-card is-${request.status}`} key={request.id}>
            <div className="help-request-heading">
              <div>
                <strong>{request.clientname}</strong>
                <span>{request.mesanumber ? `Mesa ${request.mesanumber}` : 'Sin mesa indicada'}</span>
              </div>
              <span className="help-request-status">{request.status}</span>
            </div>
            <p>{request.message}</p>
            <div className="help-request-footer">
              <small>{formatDateTime(request.created_at)}</small>
              {request.status !== 'atendida' && (
                <button type="button" className="admin-action-btn is-release" onClick={() => onUpdateStatus(request.id, 'atendida')}>
                  Marcar atendida
                </button>
              )}
            </div>
          </article>
        ))}
        {requests.length === 0 && <div className="admin-empty-state">No hay solicitudes de ayuda registradas.</div>}
      </div>
    </div>
  );
}
