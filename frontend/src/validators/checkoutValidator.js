export function validateCheckout(clientName, selectedMesa, cart, fulfillmentMode = 'dine_in') {
  if (!clientName || clientName.trim().length < 2) {
    return { valid: false, message: 'Por favor ingresa un nombre válido.' };
  }
  if (fulfillmentMode === 'dine_in' && !selectedMesa) {
    return { valid: false, message: 'Debes seleccionar una mesa disponible.' };
  }
  if (!cart || cart.length === 0) {
    return { valid: false, message: 'El carrito de compras está vacío.' };
  }
  return { valid: true };
}