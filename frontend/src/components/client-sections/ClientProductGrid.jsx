import React, { useEffect, useState } from 'react';
import { apiAssetUrl } from '../../api/apiConfig';
import ClientProductReviews from './ClientProductReviews';

function ProductImage({ image, name }) {
  const [failed, setFailed] = useState(false);

  if (!image || failed) {
    return <div className="product-image-placeholder" aria-hidden="true">V</div>;
  }

  return <img src={apiAssetUrl(image)} alt={name} loading="lazy" onError={() => setFailed(true)} />;
}

function firstValue(product, keys) {
  const value = keys.map(key => product[key]).find(item => item !== undefined && item !== null && String(item).trim());
  return value ? String(value).trim() : '';
}

export default function ClientProductGrid({
  filteredLicores, addToCart, cart = [], favorites = [], toggleFavorite, className = '',
  onAvailabilityRequest, clientName = '', emptyMessage = 'No encontramos esa botella',
  currency = 'USD', locale = 'es', comparisonIds = [], onToggleCompare = () => {},
  onPriceAlert, clientContact = ''
}) {
  const english = locale === 'en';
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [contact, setContact] = useState('');
  const [requestFeedback, setRequestFeedback] = useState(null);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [shareFeedback, setShareFeedback] = useState('');

  useEffect(() => {
    const sharedProductId = new URLSearchParams(window.location.search).get('producto');
    if (sharedProductId && filteredLicores.length) {
      const sharedProduct = filteredLicores.find(product => String(product.id) === sharedProductId);
      if (sharedProduct && String(selectedProduct?.id) !== sharedProductId) setSelectedProduct(sharedProduct);
    }
  }, [filteredLicores, selectedProduct?.id]);

  useEffect(() => {
    if (!selectedProduct) return undefined;
    const handleKeyDown = event => {
      if (event.key === 'Escape') closeDetails();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedProduct]);

  const closeDetails = () => {
    setSelectedProduct(null);
    setContact('');
    setRequestFeedback(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('producto');
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  };

  const shareProduct = async product => {
    const url = new URL(window.location.href);
    url.searchParams.set('producto', product.id);
    url.hash = 'catalog-product-list';
    const shareData = { title: product.name, text: `Mira ${product.name} en nuestra tienda`, url: url.toString() };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        setShareFeedback('Enlace compartido.');
      } else {
        await navigator.clipboard.writeText(shareData.url);
        setShareFeedback('Enlace copiado.');
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('No se pudo compartir el producto.', error);
        setShareFeedback('No se pudo compartir. Inténtalo otra vez.');
      }
    }
  };

  const submitAvailabilityRequest = async event => {
    event.preventDefault();
    if (!selectedProduct || !onAvailabilityRequest || isSubmittingRequest) return;
    setIsSubmittingRequest(true);
    setRequestFeedback(null);
    try {
      const result = await onAvailabilityRequest(selectedProduct, contact);
      setRequestFeedback({ type: 'success', message: result.message });
      setContact('');
    } catch (error) {
      setRequestFeedback({ type: 'error', message: error.message || 'No pudimos registrar la solicitud.' });
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  if (filteredLicores.length === 0) {
    return (
      <>
      <div className="catalog-empty">
        <span aria-hidden="true">✦</span>
        <h3>{emptyMessage}</h3>
        <p>{emptyMessage.toLocaleLowerCase().includes('favorit')
          ? (english ? 'Mark products with ♥ and they will appear here.' : 'Marca con ♥ los productos que quieras guardar y aparecerán aquí.')
          : (english ? 'Try another name or choose a different category.' : 'Prueba con otro nombre o elige una categoría diferente.')}</p>
      </div>
      {selectedProduct && <ProductDetailsDialog {...{ selectedProduct, closeDetails, shareProduct, shareFeedback, contact, setContact, requestFeedback, isSubmittingRequest, submitAvailabilityRequest, addToCart, clientName, onPriceAlert, clientContact, currency, locale }} />}
      </>
    );
  }

  return (
    <>
      <div className={`product-grid ${className}`}>
        {filteredLicores.map(licor => {
          const quantityInCart = cart.find(item => item.id === licor.id)?.qty || 0;
          const limitReached = quantityInCart >= licor.stock;
          return (
            <article className="product-card" key={licor.id}>
              <div className="product-image-wrap">
                <ProductImage image={licor.image} name={licor.name} />
                <button
                  type="button"
                  className={`product-favorite ${favorites.includes(String(licor.id)) ? 'is-favorite' : ''}`}
                  onClick={() => toggleFavorite(licor.id)}
                  aria-label={favorites.includes(String(licor.id)) ? `Quitar ${licor.name} de favoritos` : `Agregar ${licor.name} a favoritos`}
                  aria-pressed={favorites.includes(String(licor.id))}
                >♥</button>
                <button
                  type="button"
                  className={`product-compare-toggle${comparisonIds.includes(String(licor.id)) ? ' is-selected' : ''}`}
                  onClick={() => onToggleCompare(licor.id)}
                  aria-label={comparisonIds.includes(String(licor.id)) ? (english ? `Remove ${licor.name} from comparison` : `Quitar ${licor.name} de comparación`) : (english ? `Compare ${licor.name}` : `Comparar ${licor.name}`)}
                  aria-pressed={comparisonIds.includes(String(licor.id))}
                  disabled={!comparisonIds.includes(String(licor.id)) && comparisonIds.length >= 3}
                >⇄</button>
                {licor.category && <span className="product-category">{licor.category}</span>}
                <span className={`product-stock ${licor.stock > 5 ? '' : licor.stock > 0 ? 'is-low' : 'is-empty'}`}>
                  {licor.stock > 0 ? `${licor.stock} ${english ? 'available' : 'disponibles'}` : (english ? 'Out of stock' : 'Agotado')}
                </span>
              </div>
              <div className="product-details">
                <div>
                  <p className="product-overline">{english ? 'HOUSE SELECTION' : 'SELECCIÓN DE LA CASA'}</p>
                  <h3>{licor.name}</h3>
                  <button type="button" className="product-details-link" onClick={() => { setSelectedProduct(licor); setRequestFeedback(null); setShareFeedback(''); }}>
                    {english ? 'View details' : 'Ver detalles'}
                  </button>
                </div>
                <div className="product-buy-row">
                  <strong className="product-price">{new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'es', { style: 'currency', currency }).format(Number(licor.price) || 0)}</strong>
                  <button
                    type="button"
                    className="product-add"
                    onClick={() => addToCart(licor)}
                    disabled={licor.stock <= 0 || limitReached}
                  >
                    {licor.stock <= 0 ? (english ? 'Out of stock' : 'Agotado') : limitReached ? (english ? 'Cart limit' : 'Límite en carrito') : (english ? 'Add +' : 'Agregar +')}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {selectedProduct && <ProductDetailsDialog {...{ selectedProduct, closeDetails, shareProduct, shareFeedback, contact, setContact, requestFeedback, isSubmittingRequest, submitAvailabilityRequest, addToCart, clientName, onPriceAlert, clientContact, currency, locale }} />}
    </>
  );
}

function ProductDetailsDialog({
  selectedProduct, closeDetails, shareProduct, shareFeedback, contact, setContact,
  requestFeedback, isSubmittingRequest, submitAvailabilityRequest, addToCart, clientName,
  onPriceAlert, clientContact, currency = 'USD', locale = 'es'
}) {
  const english = locale === 'en';
  const [targetPrice, setTargetPrice] = useState('');
  const [alertContact, setAlertContact] = useState(clientContact);
  const [priceAlertFeedback, setPriceAlertFeedback] = useState(null);
  const [sendingPriceAlert, setSendingPriceAlert] = useState(false);
  const details = [
    [english ? 'Size' : 'Presentación', ['size', 'tamano', 'presentacion', 'presentation']],
    [english ? 'Alcohol' : 'Graduación', ['graduacion', 'alcohol_content', 'alcoholContent', 'abv']],
    [english ? 'Origin' : 'Origen', ['origen', 'origin']]
  ].map(([label, keys]) => ({ label, value: firstValue(selectedProduct, keys) })).filter(item => item.value);
  const description = firstValue(selectedProduct, ['description', 'descripcion', 'detalle']);

  return (
    <div className="product-dialog-overlay" onMouseDown={event => { if (event.target === event.currentTarget) closeDetails(); }}>
      <section className="product-dialog" role="dialog" aria-modal="true" aria-labelledby="product-dialog-title">
        <button type="button" className="product-dialog-close" onClick={closeDetails} aria-label="Cerrar detalles">×</button>
        <div className="product-dialog-image"><ProductImage image={selectedProduct.image} name={selectedProduct.name} /></div>
        <div className="product-dialog-content">
          <p className="store-kicker">{selectedProduct.category || (english ? 'HOUSE SELECTION' : 'SELECCIÓN DE LA CASA')}</p>
          <h2 id="product-dialog-title">{selectedProduct.name}</h2>
          {firstValue(selectedProduct, ['brand', 'marca']) && <p className="product-dialog-brand">{firstValue(selectedProduct, ['brand', 'marca'])}</p>}
          <strong className="product-dialog-price">{new Intl.NumberFormat(english ? 'en-US' : 'es', { style: 'currency', currency }).format(Number(selectedProduct.price) || 0)}</strong>
          {description && <p className="product-dialog-description">{description}</p>}
          {details.length > 0 && <dl className="product-dialog-specs">{details.map(detail => <div key={detail.label}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}</dl>}
          {details.length === 0 && !description && <p className="product-dialog-description">{english ? 'Ask the staff if you need more information about this product.' : 'Consulta con el personal si deseas más información sobre este producto.'}</p>}
          <button type="button" className="product-share-button" onClick={() => shareProduct(selectedProduct)}>{english ? 'Share product' : 'Compartir producto'} ↗</button>
          {shareFeedback && <p className="product-dialog-feedback" role="status">{shareFeedback}</p>}
          {Number(selectedProduct.stock) > 0 ? (
            <>
              <p className="product-dialog-stock">{selectedProduct.stock} {english ? 'available' : 'disponibles'}</p>
              <button type="button" className="checkout-button" onClick={() => { addToCart(selectedProduct); closeDetails(); }}>{english ? 'Add to cart' : 'Agregar al carrito'}</button>
              <form className="availability-request-form" onSubmit={async event => {
                event.preventDefault();
                if (!onPriceAlert || sendingPriceAlert) return;
                setSendingPriceAlert(true);
                setPriceAlertFeedback(null);
                try {
                  const result = await onPriceAlert(selectedProduct, alertContact, targetPrice);
                  setPriceAlertFeedback({ type: 'success', message: result.message });
                  setTargetPrice('');
                } catch (error) {
                  setPriceAlertFeedback({ type: 'error', message: error.message || 'No se pudo registrar la alerta.' });
                } finally {
                  setSendingPriceAlert(false);
                }
              }}>
                <p>Recibe un aviso del local si baja de precio o se repone.</p>
                <label><span>Correo o teléfono</span><input value={alertContact} onChange={event => setAlertContact(event.target.value)} minLength="5" maxLength="160" required /></label>
                <label><span>Avísame si baja a</span><input type="number" min="0.01" max={Number(selectedProduct.price) - 0.01} step="0.01" value={targetPrice} onChange={event => setTargetPrice(event.target.value)} placeholder={String(selectedProduct.price)} required /></label>
                {priceAlertFeedback && <p className={`checkout-feedback is-${priceAlertFeedback.type}`} role={priceAlertFeedback.type === 'error' ? 'alert' : 'status'}>{priceAlertFeedback.message}</p>}
                <button type="submit" className="client-text-link" disabled={sendingPriceAlert}>{sendingPriceAlert ? 'Registrando…' : 'Crear alerta de precio'}</button>
              </form>
            </>
          ) : (
            <form className="availability-request-form" onSubmit={submitAvailabilityRequest}>
              <p>¿Quieres que el local te contacte cuando revise la reposición?</p>
              <label>
                <span>Correo o teléfono</span>
                <input value={contact} onChange={event => setContact(event.target.value)} minLength="5" maxLength="160" required />
              </label>
              {requestFeedback && <p className={`checkout-feedback is-${requestFeedback.type}`} role={requestFeedback.type === 'error' ? 'alert' : 'status'}>{requestFeedback.message}</p>}
              <button type="submit" className="checkout-button" disabled={isSubmittingRequest}>
                {isSubmittingRequest ? 'Registrando…' : 'Solicitar aviso'}
              </button>
            </form>
          )}
          <ClientProductReviews product={selectedProduct} initialName={clientName} />
        </div>
      </section>
    </div>
  );
}
