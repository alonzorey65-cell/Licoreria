import React, { useEffect, useState } from 'react';
import { apiAssetUrl, apiUrl } from '../../api/apiConfig';
import { getPromotionExpiration, isPromotionExpired } from '../../utils/promotionDates';

function PromotionImage({ image, title }) {
  const [failed, setFailed] = useState(false);
  if (!image || failed) return <div className="promotion-image-placeholder" aria-hidden="true">✦</div>;
  return <img className="promotion-image" src={apiAssetUrl(image)} alt={title} loading="lazy" onError={() => setFailed(true)} />;
}

function getRelatedProduct(promo, products) {
  const productId = promo.product_id || promo.licor_id || promo.producto_id;
  if (productId) {
    const byId = products.find(product => String(product.id) === String(productId));
    if (byId) return byId;
  }
  const text = `${promo.titulo || ''} ${promo.descuento || ''}`.toLocaleLowerCase('es');
  return products.find(product => product.name && text.includes(product.name.toLocaleLowerCase('es')));
}

export default function ClientPromos({ products = [], onProductSelect, locale = 'es' }) {
  const english = locale === 'en';
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [validity, setValidity] = useState('all');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    let inProgress = false;
    const refresh = () => {
      if (inProgress) return;
      inProgress = true;
      fetch(apiUrl('promociones'))
      .then(response => {
        if (!response.ok) throw new Error(`No se pudieron cargar las promociones (${response.status}).`);
        return response.json();
      })
      .then(data => {
        if (!Array.isArray(data)) throw new Error('La respuesta de promociones no tiene el formato esperado.');
        if (active) {
          setPromos(data);
          setError('');
        }
      })
      .catch(error => {
        console.error('Error cargando promociones.', error);
        if (active) setError('No pudimos cargar las promociones en este momento.');
      })
      .finally(() => {
        inProgress = false;
        if (active) setLoading(false);
      });
    };
    refresh();
    window.addEventListener('focus', refresh);
    const timer = window.setInterval(refresh, 30000);

    return () => {
      active = false;
      window.removeEventListener('focus', refresh);
      window.clearInterval(timer);
    };
  }, [reload]);

  const activePromos = promos.filter(promo => {
    if (promo.activa === false || promo.active === false) return false;
    return !isPromotionExpired(promo);
  });
  const promoCategories = [...new Set(activePromos.map(promo => {
    const related = getRelatedProduct(promo, products);
    return promo.categoria || promo.category || related?.category || '';
  }).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'es'));
  const visiblePromos = activePromos.filter(promo => {
    const category = promo.categoria || promo.category || getRelatedProduct(promo, products)?.category || '';
    const expiration = getPromotionExpiration(promo);
    const daysLeft = expiration ? (expiration.getTime() - Date.now()) / 86400000 : null;
    const matchesCategory = !selectedCategory || category === selectedCategory;
    const matchesValidity = validity === 'all'
      || (validity === 'week' && daysLeft !== null && daysLeft >= 0 && daysLeft <= 7)
      || (validity === 'no-date' && !expiration);
    return matchesCategory && matchesValidity;
  });

  return (
    <section className="promotions-section" id="promociones">
      <div className="section-heading">
        <div>
          <p className="store-kicker">{english ? 'SOMETHING SPECIAL TODAY' : 'ALGO ESPECIAL PARA HOY'}</p>
          <h2>{english ? 'From the house' : 'De la casa'}</h2>
        </div>
        <div className="promotion-filters" aria-label="Filtrar promociones">
          <label><span>{english ? 'Category' : 'Categoría'}</span>
            <select value={selectedCategory} onChange={event => setSelectedCategory(event.target.value)}>
              <option value="">{english ? 'All' : 'Todas'}</option>
              {promoCategories.map(category => <option value={category} key={category}>{category}</option>)}
            </select>
          </label>
          <label><span>{english ? 'Validity' : 'Vigencia'}</span>
            <select value={validity} onChange={event => setValidity(event.target.value)}>
              <option value="all">{english ? 'All active' : 'Todas las vigentes'}</option>
              <option value="week">{english ? 'Ending within 7 days' : 'Terminan en 7 días'}</option>
              <option value="no-date">{english ? 'No end date' : 'Sin fecha de término'}</option>
            </select>
          </label>
        </div>
        <span>✦ {english ? 'OFFERS' : 'PROMOCIONES'}</span>
      </div>
      {loading ? (
        <p className="promotions-empty" role="status">{english ? 'Loading current offers…' : 'Cargando las propuestas de la casa…'}</p>
      ) : error ? (
        <div className="promotions-empty is-error" role="alert">
          <p>{english ? 'Could not load offers right now.' : error}</p>
          <button type="button" className="promotion-product-link" onClick={() => { setLoading(true); setReload(value => value + 1); }}>{english ? 'Try again' : 'Reintentar'}</button>
        </div>
      ) : visiblePromos.length > 0 ? (
        <div className="promotions-grid">
          {visiblePromos.map((promo, index) => {
            const relatedProduct = getRelatedProduct(promo, products);
            const expiration = getPromotionExpiration(promo);
            return (
            <article className="promotion-card" key={promo.id}>
              <PromotionImage key={promo.imagen || promo.image || 'none'} image={promo.imagen || promo.image} title={promo.titulo} />
              <div className="promotion-copy">
                <span className="promotion-number">{english ? 'OFFER' : 'PROMOCIÓN'} 0{index + 1}</span>
                <h3>{promo.titulo}</h3>
                <p>{promo.descuento}</p>
                {expiration && !Number.isNaN(expiration.getTime()) && <small className="promotion-expiration">{english ? 'Valid until' : 'Válida hasta'} {new Intl.DateTimeFormat(english ? 'en-US' : 'es', { dateStyle: 'medium' }).format(expiration)}</small>}
                {relatedProduct && <button className="promotion-product-link" type="button" onClick={() => onProductSelect?.(relatedProduct)}>{english ? 'View' : 'Ver'} {relatedProduct.name} ↗</button>}
              </div>
              <span className="promotion-mark" aria-hidden="true">✦</span>
            </article>
            );
          })}
        </div>
      ) : (
        <p className="promotions-empty">{activePromos.length ? (english ? 'No offers match these filters.' : 'No hay promociones que coincidan con esos filtros.') : (english ? 'New offers coming soon.' : 'Pronto encontrarás nuevas propuestas de la casa.')}</p>
      )}
    </section>
  );
}
