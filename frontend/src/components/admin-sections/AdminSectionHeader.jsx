import React from 'react';

export function AdminSectionHeader({ icon, title, description, count, countLabel = 'registros' }) {
  return (
    <div className="admin-module-header">
      <div>
        <p className="admin-module-eyebrow">GESTIÓN DEL NEGOCIO</p>
        <h2>{icon} {title}</h2>
        <p>{description}</p>
      </div>
      {Number.isFinite(count) && (
        <span className="admin-record-count">{count} {countLabel}</span>
      )}
    </div>
  );
}

export function AdminRowActions({ onEdit, onDelete, deleteLabel = 'Eliminar registro' }) {
  return (
    <div className="admin-row-actions">
      {onEdit && (
        <button type="button" className="admin-action-btn is-edit" onClick={onEdit}>
          Editar
        </button>
      )}
      {onDelete && (
        <button type="button" className="admin-action-btn is-delete" onClick={onDelete}>
          {deleteLabel}
        </button>
      )}
    </div>
  );
}
