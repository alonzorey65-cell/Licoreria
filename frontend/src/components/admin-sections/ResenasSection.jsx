import React from 'react';
import { formatDateTime } from '../../utils/formatters';
import { AdminRowActions, AdminSectionHeader } from './AdminSectionHeader';

export default function ResenasSection({
  resenas, resenaCliente, setResenaCliente, resenaComentario, setResenaComentario,
  resenaPuntuacion, setResenaPuntuacion, editingId, setEditingRecord,
  handleResenaSubmit, handleDeleteRecord
}) {
  const resetForm = () => {
    setEditingRecord('resenas', null);
    setResenaCliente('');
    setResenaComentario('');
    setResenaPuntuacion('5');
  };

  return (
    <div className="panel-section admin-module">
      <AdminSectionHeader icon="⭐" title="Reseñas de clientes" description="Consulta, registra y modera las opiniones recibidas." count={resenas.length} countLabel="reseñas" />
      <form onSubmit={handleResenaSubmit} className="form-grid-pro admin-crud-form">
        <label>Cliente<input type="text" placeholder="Nombre del cliente" value={resenaCliente} onChange={event => setResenaCliente(event.target.value)} required /></label>
        <label>Puntuación<select value={resenaPuntuacion} onChange={event => setResenaPuntuacion(event.target.value)}>
          <option value="5">5 estrellas</option><option value="4">4 estrellas</option><option value="3">3 estrellas</option><option value="2">2 estrellas</option><option value="1">1 estrella</option>
        </select></label>
        <label className="admin-wide-field">Comentario<textarea rows="3" placeholder="Escribe el comentario" value={resenaComentario} onChange={event => setResenaComentario(event.target.value)} required /></label>
        <div className="admin-form-actions">
          <button type="submit" className="btn-neon">{editingId ? 'Guardar cambios' : 'Registrar reseña'}</button>
          {editingId && <button type="button" className="admin-secondary-btn" onClick={resetForm}>Cancelar edición</button>}
        </div>
      </form>

      <div className="admin-review-grid">
        {resenas.map(review => {
          const rating = Math.min(5, Math.max(0, Number(review.puntuacion) || 0));
          return <article className="admin-review-card" key={review.id}>
            <div className="admin-review-heading">
              <div><h3>{review.cliente}</h3><span>{formatDateTime(review.fecha)}</span></div>
              <strong className="admin-review-rating" aria-label={`${rating} de 5 estrellas`}>{'★'.repeat(rating)}<span>{'★'.repeat(5 - rating)}</span></strong>
            </div>
            <p>{review.comentario}</p>
            <AdminRowActions
              onEdit={() => { setEditingRecord('resenas', review.id); setResenaCliente(review.cliente || ''); setResenaComentario(review.comentario || ''); setResenaPuntuacion(String(rating || 5)); }}
              onDelete={() => { if (window.confirm(`¿Eliminar la reseña de ${review.cliente}?`)) handleDeleteRecord('resenas', review.id); }}
            />
          </article>;
        })}
        {resenas.length === 0 && <div className="admin-empty-state">Todavía no hay reseñas de clientes.</div>}
      </div>
    </div>
  );
}
