import React from 'react';
import { AdminRowActions, AdminSectionHeader } from './AdminSectionHeader';

export default function CategoriasSection({
  nuevaCat, setNuevaCat, editingId, setEditingRecord,
  handleCategoriaSubmit, handleDeleteRecord, categorias
}) {
  const resetForm = () => {
    setEditingRecord('categorias', null);
    setNuevaCat('');
  };

  return (
    <div className="panel-section admin-module">
      <AdminSectionHeader icon="🏷️" title="Categorías" description="Ordena el catálogo y administra las categorías de tus productos." count={categorias.length} />
      <form onSubmit={handleCategoriaSubmit} className="form-grid-pro admin-crud-form admin-category-form">
        <label>Nombre de la categoría<input type="text" placeholder="Ej. Ron" value={nuevaCat} onChange={event => setNuevaCat(event.target.value)} required /></label>
        <div className="admin-form-actions">
          <button type="submit" className="btn-neon">{editingId ? 'Guardar cambios' : 'Crear categoría'}</button>
          {editingId && <button type="button" className="admin-secondary-btn" onClick={resetForm}>Cancelar edición</button>}
        </div>
      </form>

      <div className="admin-category-grid">
        {categorias.map(category => <article className="admin-category-card" key={category.id}>
          <span className="admin-category-icon" aria-hidden="true">#</span>
          <strong>{category.name}</strong>
          <AdminRowActions
            onEdit={() => { setEditingRecord('categorias', category.id); setNuevaCat(category.name || ''); }}
            onDelete={() => { if (window.confirm(`¿Eliminar la categoría ${category.name}?`)) handleDeleteRecord('categorias', category.id); }}
          />
        </article>)}
        {categorias.length === 0 && <div className="admin-empty-state">Todavía no hay categorías. Crea una para clasificar el inventario.</div>}
      </div>
    </div>
  );
}
