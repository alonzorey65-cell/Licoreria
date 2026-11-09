import React from 'react';

export default function ClientCartCheckout({
  cart, addToCart, removeFromCart, totalCart, clientName, setClientName, selectedMesa,
  setSelectedMesa, mesas, handleCheckout, checkoutFeedback, isSubmitting, onClearCart,
  clientContact = '', setClientContact = () => {}, fulfillmentMode = 'dine_in',
  setFulfillmentMode = () => {}, reservationTime = '', setReservationTime = () => {},
  currency = 'USD', formatMoney = value => `$${Number(value).toFixed(2)}`,
  offerCode = '', setOfferCode = () => {}, giftCardCode = '', setGiftCardCode = () => {},
  appliedOffer = null, applyOffers = () => {}, useRewardsCredit = false,
  setUseRewardsCredit = () => {}, onShareOrder, shareFeedback, locale = 'es',
  isClientAuthenticated = false, onRequireSignIn = () => {}
}) {
  const english = locale === 'en';
  const itemCount = cart.reduce((total, item) => total + item.qty, 0);
  const currencyMismatch = cart.some(item => item.type === 'promotion') && currency !== 'PEN';
  const availableMesas = mesas.filter(mesa => mesa.status === 'Disponible');
  const minSchedule = new Date(Date.now() + 15 * 60 * 1000).toISOString().slice(0, 16);
  const checkoutBlockReason = !isClientAuthenticated
    ? (english ? 'Continue with Google before confirming your order.' : 'Inicia sesión con Google antes de confirmar.')
    : cart.length === 0
      ? (english ? 'Add at least one product to your order to enable confirmation.' : 'Agrega al menos un producto al pedido para habilitar la confirmación.')
      : fulfillmentMode === 'dine_in' && availableMesas.length === 0
        ? (english ? 'There are no available tables right now. Choose pickup or try again later.' : 'No hay mesas disponibles. Elige recoger en el local o inténtalo más tarde.')
        : '';

  return (
    <section className="cart-panel" id="pedido">
      <div className="cart-heading">
        <div>
          <p className="store-kicker">LISTO CUANDO TÚ LO ESTÉS</p>
          <h2>Tu pedido</h2>
        </div>
        <span className="cart-count">{itemCount}</span>
      </div>
      {cart.length > 0 && (
        <div className="cart-persistence-row">
          <p className="cart-persistence-note">{english ? 'Your cart is saved on this device.' : 'Tu carrito se guarda en este dispositivo.'}</p>
          <div>
            <button type="button" className="cart-clear-button" onClick={onShareOrder}>{english ? 'Share list' : 'Compartir lista'}</button>
            <button type="button" className="cart-clear-button" onClick={onClearCart}>{english ? 'Clear' : 'Vaciar'}</button>
          </div>
        </div>
      )}
      {shareFeedback && <p className="checkout-note" role="status">{shareFeedback}</p>}

      {cart.length === 0 ? (
        <div className="cart-empty">
          <span aria-hidden="true">♧</span>
          <p>{english ? 'Your selection starts here.' : 'Tu selección empieza aquí.'}</p>
          <small>{english ? 'Add an item from the menu to continue.' : 'Agrega algo de la carta para continuar.'}</small>
        </div>
      ) : (
        <div className="cart-items">
          {cart.map(item => (
            <div className="cart-item" key={`${item.type || 'product'}-${item.id}`}>
              <div className="cart-item-copy">
                <strong>{item.name}</strong>
                <span>{formatMoney(item.price, item.type === 'promotion' ? 'PEN' : currency)} c/u {item.type === 'promotion' ? '· Promoción' : ''}</span>
                <small>Subtotal · {formatMoney(Number(item.price) * item.qty, item.type === 'promotion' ? 'PEN' : currency)}</small>
              </div>
              <div className="cart-quantity">
                <button type="button" onClick={() => removeFromCart(item.id, item.type)} aria-label={`Quitar una unidad de ${item.name}`}>−</button>
                <span>{item.qty}</span>
                <button
                  type="button"
                  onClick={() => addToCart(item)}
                  disabled={item.qty >= item.stock || item.qty >= 50}
                  aria-label={`Agregar una unidad de ${item.name}`}
                >+</button>
              </div>
            </div>
          ))}
          <div className="cart-total">
            <span>{english ? 'Total' : 'Total'}</span>
            <strong>{currencyMismatch ? (english ? 'Select PEN' : 'Selecciona PEN') : formatMoney(totalCart)}</strong>
          </div>
          {currencyMismatch && <p className="checkout-note is-alert">{english ? 'Promotions are priced in soles. Select PEN before confirming.' : 'Las promociones se cobran en soles. Selecciona PEN antes de confirmar el pedido.'}</p>}
        </div>
      )}

      <form className="checkout-form" onSubmit={handleCheckout}>
        <label>
          <span>{english ? 'How would you like to receive your order?' : '¿Cómo quieres recibir tu pedido?'}</span>
          <select value={fulfillmentMode} onChange={event => { setFulfillmentMode(event.target.value); setSelectedMesa(''); }} required>
            <option value="dine_in">{english ? 'Dine in' : 'Consumir en mesa'}</option>
            <option value="pickup">{english ? 'Pick up at the store' : 'Recoger en el local'}</option>
          </select>
        </label>
        <label>
          <span>{english ? `Date and time ${fulfillmentMode === 'dine_in' ? 'to arrive' : 'for pickup'} (optional)` : `Fecha y hora ${fulfillmentMode === 'dine_in' ? 'de llegada' : 'para recoger'} (opcional)`}</span>
          <input type="datetime-local" value={reservationTime} min={minSchedule} onChange={event => setReservationTime(event.target.value)} />
        </label>
        <label>
          <span>{english ? 'Your name' : 'Tu nombre'}</span>
          <input
            type="text"
            placeholder={english ? 'What is your name?' : '¿Cómo te llamas?'}
            value={clientName}
            onChange={event => setClientName(event.target.value)}
            required
            minLength={2}
          />
        </label>
        <label>
          <span>{english ? 'Phone or WhatsApp (optional)' : 'Teléfono o WhatsApp (opcional)'}</span>
          <input
            type="tel"
            autoComplete="tel"
            placeholder={english ? 'For order updates' : 'Para contactarte sobre tu pedido'}
            value={clientContact}
            onChange={event => setClientContact(event.target.value)}
            maxLength="40"
          />
        </label>
        {fulfillmentMode === 'dine_in' && <>
          <label>
            <span>{english ? 'Your table' : 'Tu mesa'}</span>
            <select value={selectedMesa} onChange={event => setSelectedMesa(event.target.value)} required>
              <option value="">{availableMesas.length ? (english ? 'Choose an available table' : 'Elige una mesa disponible') : (english ? 'No tables available' : 'No hay mesas disponibles')}</option>
              {availableMesas.map(mesa => (
                <option key={mesa.id} value={mesa.id}>{mesa.number} · {mesa.seats} personas</option>
              ))}
            </select>
          </label>
          {availableMesas.length === 0 && <p className="checkout-note is-alert">{english ? 'No tables are available right now.' : 'No hay mesas disponibles en este momento.'}</p>}
        </>}
        <fieldset className="checkout-offers">
          <legend>{english ? 'Promo or gift card' : 'Promoción o tarjeta de regalo'}</legend>
          <label><span>{english ? 'Promo code' : 'Código promocional'}</span>
            <input value={offerCode} onChange={event => setOfferCode(event.target.value.toUpperCase())} maxLength="40" placeholder="Ej. BIENVENIDO" />
          </label>
          <label><span>{english ? 'Gift card code' : 'Código de tarjeta de regalo'}</span>
            <input value={giftCardCode} onChange={event => setGiftCardCode(event.target.value.toUpperCase())} maxLength="40" placeholder="Código de tarjeta" />
          </label>
          <button type="button" className="client-text-link" onClick={applyOffers} disabled={!offerCode.trim() && !giftCardCode.trim()}>{english ? 'Validate codes' : 'Validar códigos'}</button>
          {appliedOffer && <small>{english ? 'Estimated discount' : 'Descuento estimado'}: {formatMoney(appliedOffer.discount || 0)} · {english ? 'confirmed at checkout' : 'se confirma al finalizar'}</small>}
        </fieldset>
        <label className="checkout-reward-option">
          <input type="checkbox" checked={useRewardsCredit} disabled={!isClientAuthenticated} onChange={event => setUseRewardsCredit(event.target.checked)} />
          <span>{english ? 'Use available rewards credit' : 'Usar crédito de recompensas disponible'}{!isClientAuthenticated && <small>{english ? ' · Sign in first' : ' · Inicia sesión primero'}</small>}</span>
        </label>
        {!isClientAuthenticated && (
          <div className="checkout-auth-required">
            <p>{english ? 'Sign in with Google to place an order. Your order history will only be visible to your account.' : 'Inicia sesión con Google para confirmar. Solo tu cuenta podrá consultar tus pedidos.'}</p>
            <button type="button" className="client-text-link" onClick={onRequireSignIn}>{english ? 'Continue with Google' : 'Continuar con Google'}</button>
          </div>
        )}
        {checkoutFeedback && (
          <p className={`checkout-feedback is-${checkoutFeedback.type}`} role={checkoutFeedback.type === 'error' ? 'alert' : 'status'}>
            {checkoutFeedback.message}
          </p>
        )}
        {checkoutBlockReason && <p className="checkout-blocked-note" role="status">{checkoutBlockReason}</p>}
        <button className="checkout-button checkout-submit-button" type="submit" disabled={!isClientAuthenticated || isSubmitting || currencyMismatch || cart.length === 0 || (fulfillmentMode === 'dine_in' && availableMesas.length === 0)}>
          {isSubmitting ? (english ? 'Sending order…' : 'Enviando pedido…') : !isClientAuthenticated ? (english ? 'Sign in to confirm' : 'Inicia sesión para confirmar') : fulfillmentMode === 'pickup' ? (english ? 'Confirm pickup order' : 'Confirmar para recoger') : availableMesas.length === 0 ? (english ? 'No tables available' : 'Sin mesas disponibles') : (english ? 'Place order' : 'Confirmar pedido')} <span aria-hidden="true">↗</span>
        </button>
        <p className="checkout-note">{english ? 'For adults only. Please enjoy responsibly.' : 'Pedido en mesa, sin costo de envío. Venta exclusiva para mayores de edad; disfruta con responsabilidad.'}</p>
      </form>
    </section>
  );
}
