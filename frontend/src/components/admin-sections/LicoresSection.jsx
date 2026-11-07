import React from 'react';
import { apiAssetUrl } from '../../api/apiConfig';
import { AdminRowActions, AdminSectionHeader } from './AdminSectionHeader';

export default function LicoresSection({
  licores, categorias, name, setName, price, setPrice, stock, setStock, category, setCategory,
  productDescription, setProductDescription, productPresentation, setProductPresentation,
  productGraduation, setProductGraduation, productOrigin, setProductOrigin, productBrand, setProductBrand,
  imageFile, setImageFile, editingId, setEditingId, handleLicorSubmit, handleEliminarLicor
}) {
  const resetForm = () => {
    setEditingId(null);
    setName('');
    setPrice('');
    setStock('');
    setCategory('');
    setProductDescription('');
    setProductPresentation('');
    setProductGraduation('');
    setProductOrigin('');
    setProductBrand('');
    setImageFile(null);
  };

  return (
    <div className="panel-section admin-module">
      <AdminSectionHeader icon="🍷" title="Licores e inventario" description="Mantén el catálogo, los precios y las existencias actualizados." count={licores.length} countLabel="productos" />
      <form onSubmit={handleLicorSubmit} className="form-grid-pro admin-crud-form">
        <label>Nombre del producto<input type="text" placeholder="Ej. Ron añejo" value={name} onChange={event => setName(event.target.value)} required /></label>
        <label>Precio<input type="number" min="0" step="0.01" placeholder="$ 0.00" value={price} onChange={event => setPrice(event.target.value)} required /></label>
        <label>Existencias<input type="number" min="0" step="1" placeholder="Unidades" value={stock} onChange={event => setStock(event.target.value)} required /></label>
        <label>Categoría<select value={category} onChange={event => setCategory(event.target.value)} required>
          <option value="">Selecciona una categoría</option>
          {categorias.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}
        </select></label>
        <label>Descripción<textarea value={productDescription} onChange={event => setProductDescription(event.target.value)} maxLength="800" rows="3" /></label>
        <label>Marca<input type="text" value={productBrand} onChange={event => setProductBrand(event.target.value)} maxLength="80" /></label>
        <label>Presentación<input type="text" placeholder="Ej. 750 ml" value={productPresentation} onChange={event => setProductPresentation(event.target.value)} maxLength="80" /></label>
        <label>Graduación<input type="text" placeholder="Ej. 40% vol." value={productGraduation} onChange={event => setProductGraduation(event.target.value)} maxLength="40" /></label>
        <label>Origen<input type="text" placeholder="Ej. México" value={productOrigin} onChange={event => setProductOrigin(event.target.value)} maxLength="80" /></label>
        <label className="admin-file-field">Imagen del producto<input key={editingId ?? 'new'} type="file" accept="image/*" onChange={event => setImageFile(event.target.files?.[0] || null)} /></label>
        <div className="admin-form-actions">
          <button type="submit" className="btn-neon">{editingId ? 'Guardar cambios' : 'Agregar producto'}</button>
          {editingId && <button type="button" className="admin-secondary-btn" onClick={resetForm}>Cancelar edición</button>}
        </div>
      </form>

      <div className="table-responsive">
        <table className="table-pro admin-data-table">
          <thead><tr><th>Producto</th><th>Categoría</th><th>Precio</th><th>Stock</th><th>Acciones</th></tr></thead>
          <tbody>
            {licores.map(item => (
              <tr key={item.id}>
                <td><div className="admin-product-cell">
                  {item.image ? <img src={apiAssetUrl(item.image)} alt="" width="44" height="44" /> : <span className="admin-product-placeholder" aria-hidden="true">🍷</span>}
                  <strong>{item.name}</strong>
                </div></td>
                <td>{item.category}</td>
                <td className="admin-amount">${Number(item.price).toFixed(2)}</td>
                <td><span className={`admin-stock-badge ${item.stock <= 5 ? 'is-low' : ''}`}>{item.stock} u.</span></td>
                <td><AdminRowActions
                  onEdit={() => { setEditingId(item.id); setName(item.name); setPrice(item.price); setStock(item.stock); setCategory(item.category); setProductDescription(item.description || ''); setProductPresentation(item.presentacion || ''); setProductGraduation(item.graduacion || ''); setProductOrigin(item.origen || ''); setProductBrand(item.brand || ''); setImageFile(null); }}
                  onDelete={() => { if (window.confirm(`¿Eliminar ${item.name}?`)) handleEliminarLicor(item.id); }}
                /></td>
              </tr>
            ))}
            {licores.length === 0 && <tr><td colSpan="5"><div className="admin-empty-state">Todavía no hay productos. Agrega el primero desde el formulario.</div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
