import { useState } from 'react';

export function useCart() {
  const [cart, setCart] = useState([]);

  const addToCart = (licor) => {
    if (licor.stock <= 0) return;
    setCart(prev => {
      const exist = prev.find(item => item.id === licor.id);
      if (exist) {
        return prev.map(item => item.id === licor.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { ...licor, qty: 1 }];
    });
  };

  const removeFromCart = (id) => {
    setCart(prev => {
      const exist = prev.find(item => item.id === id);
      if (exist.qty === 1) {
        return prev.filter(item => item.id !== id);
      }
      return prev.map(item => item.id === id ? { ...item, qty: item.qty - 1 } : item);
    });
  };

  const clearCart = () => setCart([]);
  const totalCart = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  return { cart, addToCart, removeFromCart, clearCart, totalCart };
}