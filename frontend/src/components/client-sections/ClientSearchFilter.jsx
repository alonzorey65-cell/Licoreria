import React from 'react';

export default function ClientSearchFilter({
  searchTerm, setSearchTerm, categories, selectedCategory, setSelectedCategory,
  showFavorites, setShowFavorites, onlyAvailable, setOnlyAvailable, sortBy, setSortBy,
  gridDensity, setGridDensity, brands = [], selectedBrand = '', setSelectedBrand = () => {},
  minPrice = '', setMinPrice = () => {}, maxPrice = '', setMaxPrice = () => {},
  minGraduation = '', setMinGraduation = () => {}, onClear, locale = 'es'
}) {
  const english = locale === 'en';
  return (
    <div className="catalog-tools">
      <label className="catalog-search">
        <span aria-hidden="true">⌕</span>
        <input
          type="search"
          placeholder={english ? 'Search by name...' : 'Busca por nombre...'}
          aria-label={english ? 'Search products by name' : 'Buscar licores por nombre'}
          value={searchTerm}
          onChange={event => setSearchTerm(event.target.value)}
        />
      </label>
      <div className="catalog-filter-row">
        <div className="catalog-categories" aria-label="Filtrar por categoría">
          {categories.map(category => (
            <button
              key={category}
              type="button"
              className={`category-pill ${selectedCategory === category ? 'is-selected' : ''}`}
              onClick={() => setSelectedCategory(category)}
              aria-pressed={selectedCategory === category}
            >
              {category}
            </button>
          ))}
          <button
            type="button"
            className={`category-pill favorites-filter ${showFavorites ? 'is-selected' : ''}`}
            onClick={() => setShowFavorites(current => !current)}
            aria-pressed={showFavorites}
          >
            {english ? '♥ Favorites' : '♥ Favoritos'}
          </button>
          <button
            type="button"
            className={`category-pill ${onlyAvailable ? 'is-selected' : ''}`}
            onClick={() => setOnlyAvailable(current => !current)}
            aria-pressed={onlyAvailable}
          >
            {english ? '✓ In stock' : '✓ Disponibles'}
          </button>
        </div>
      </div>
      <div className="catalog-advanced-filters" aria-label="Filtros avanzados">
        <label>
          <span>Marca</span>
          <select value={selectedBrand} onChange={event => setSelectedBrand(event.target.value)} aria-label="Filtrar por marca">
            <option value="">Todas las marcas</option>
            {brands.map(brand => <option value={brand} key={brand}>{brand}</option>)}
          </select>
        </label>
        <label>
          <span>Precio desde</span>
          <input type="number" min="0" step="0.01" value={minPrice} onChange={event => setMinPrice(event.target.value)} aria-label="Precio mínimo" placeholder="$0" />
        </label>
        <label>
          <span>Precio hasta</span>
          <input type="number" min="0" step="0.01" value={maxPrice} onChange={event => setMaxPrice(event.target.value)} aria-label="Precio máximo" placeholder="Sin límite" />
        </label>
        <label>
          <span>Alcohol desde (%)</span>
          <input type="number" min="0" max="100" step="0.1" value={minGraduation} onChange={event => setMinGraduation(event.target.value)} aria-label="Graduación alcohólica mínima" placeholder="Cualquiera" />
        </label>
      </div>
      <div className="catalog-options">
        <label className="catalog-sort">
          <span>{english ? 'Sort' : 'Ordenar'}</span>
          <select value={sortBy} onChange={event => setSortBy(event.target.value)} aria-label="Ordenar productos">
            <option value="featured">{english ? 'Featured' : 'Destacados'}</option>
            <option value="price-asc">{english ? 'Price: low to high' : 'Precio: menor a mayor'}</option>
            <option value="price-desc">{english ? 'Price: high to low' : 'Precio: mayor a menor'}</option>
            <option value="name">{english ? 'Name: A–Z' : 'Nombre: A–Z'}</option>
            <option value="stock">{english ? 'Most available' : 'Más disponibles'}</option>
          </select>
        </label>
        <div className="catalog-density" role="group" aria-label="Tamaño de las tarjetas">
          <button type="button" className={gridDensity === 'comfortable' ? 'is-active' : ''} onClick={() => setGridDensity('comfortable')} aria-label="Vista cómoda" aria-pressed={gridDensity === 'comfortable'}>▦</button>
          <button type="button" className={gridDensity === 'compact' ? 'is-active' : ''} onClick={() => setGridDensity('compact')} aria-label="Vista compacta" aria-pressed={gridDensity === 'compact'}>☷</button>
        </div>
        {(searchTerm || selectedCategory !== 'Todos' || showFavorites || onlyAvailable || selectedBrand || minPrice || maxPrice || minGraduation) && (
          <button type="button" className="catalog-clear" onClick={onClear}>{english ? 'Clear filters' : 'Limpiar filtros'}</button>
        )}
      </div>
    </div>
  );
}
