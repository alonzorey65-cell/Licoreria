import React, { useEffect, useRef, useState } from 'react';
import '../styles/ClientStorefront.css';
import { apiUrl } from '../api/apiConfig';
import { validateCheckout } from '../validators/checkoutValidator';

// Importación de subsecciones del cliente
import ClientHeader, { clientThemes, ClientBusinessInfo } from './client-sections/ClientHeader';
import ClientBanner from './client-sections/ClientBanner';
import ClientPromos from './client-sections/ClientPromos';
import ClientSearchFilter from './client-sections/ClientSearchFilter';
import ClientProductGrid from './client-sections/ClientProductGrid';
import ClientCartCheckout from './client-sections/ClientCartCheckout';
import ClientOrderTracker from './client-sections/ClientOrderTracker';
import ClientWaiterView from './client-sections/ClientWaiterView';
import ClientReviewModal from './client-sections/ClientReviewModal';
import ClientOrderHistory from './client-sections/ClientOrderHistory';
import ClientTableAvailability from './client-sections/ClientTableAvailability';
import ClientAccount from './client-sections/ClientAccount';
import { getSupabaseClient, hasVerifiedCustomerIdentity } from '../api/supabaseClient';
import { useBusinessSettings } from '../hooks/BusinessSettingsContext';

const FAVORITES_KEY = 'clientFavoriteProducts';
const CLIENT_THEME_KEY = 'clientTheme';
const CLIENT_CART_KEY = 'clientCart';
const GUEST_CART_KEY = 'clientGuestCart';
const CLIENT_ACCESSIBILITY_KEY = 'clientAccessibility';

function getStorePreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem('clientStorePreferences') || '{}');
    return {
      locale: saved.locale === 'en' ? 'en' : 'es',
      currency: ['USD', 'MXN', 'COP', 'PEN', 'EUR'].includes(saved.currency) ? saved.currency : null
    };
  } catch (error) {
    console.error('No se pudieron recuperar las preferencias de idioma y moneda.', error);
    return { locale: 'es', currency: null };
  }
}

function formatMoney(value, currency, locale) {
  try {
    return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'es', { style: 'currency', currency }).format(Number(value) || 0);
  } catch (error) {
    console.error('No se pudo formatear el precio en la moneda seleccionada.', error);
    return `${currency} ${(Number(value) || 0).toFixed(2)}`;
  }
}

function getSavedCart(userId) {
  if (!userId) return null;
  try {
    const storedCart = localStorage.getItem(`${CLIENT_CART_KEY}:${userId}`);
    if (storedCart === null) return null;
    const savedCart = JSON.parse(storedCart);
    return Array.isArray(savedCart) ? savedCart.filter(item => item && item.id && Number(item.qty) > 0) : [];
  } catch (error) {
    console.error('No se pudo recuperar el carrito guardado.', error);
    return [];
  }
}

function getGuestCart() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(GUEST_CART_KEY) || '[]');
    return Array.isArray(saved) ? saved.filter(item => item && item.id && Number(item.qty) > 0) : [];
  } catch (error) {
    console.error('No se pudo recuperar el carrito de esta pestaña.', error);
    return [];
  }
}

function getSavedAccessibility() {
  try {
    const saved = JSON.parse(localStorage.getItem(CLIENT_ACCESSIBILITY_KEY) || '{}');
    return { largeText: saved.largeText === true, reduceMotion: saved.reduceMotion === true };
  } catch (error) {
    console.error('No se pudieron recuperar las preferencias de accesibilidad.', error);
    return { largeText: false, reduceMotion: false };
  }
}

function getSavedTheme() {
  try {
    const savedTheme = localStorage.getItem(CLIENT_THEME_KEY);
    return clientThemes.some(theme => theme.id === savedTheme) ? savedTheme : 'vino';
  } catch (error) {
    console.error('No se pudo recuperar el tema de la tienda.', error);
    return 'vino';
  }
}

function getSavedFavorites() {
  try {
    const favorites = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
    return Array.isArray(favorites) ? favorites.map(String) : [];
  } catch (error) {
    console.error('No se pudieron recuperar los favoritos.', error);
    return [];
  }
}

function getCustomerProfileName(user) {
  const metadata = user?.user_metadata || {};
  const name = metadata.display_name || metadata.full_name || metadata.name;
  return typeof name === 'string' ? name.trim() : '';
}

export default function ClientCatalog({ licores, mesas, fetchAll, catalogLoading = false, catalogError = '' }) {
  const [cart, setCart] = useState(getGuestCart);
  const [clientName, setClientName] = useState('');
  const [clientContact, setClientContact] = useState('');
  const [savedPreferences, setStorePreferences] = useState(getStorePreferences);
  const { settings: businessSettings, error: settingsError, refresh: refreshSettings } = useBusinessSettings();
  const storePreferences = { ...savedPreferences, currency: savedPreferences.currency || businessSettings.currency };
  const [clientSession, setClientSession] = useState(null);
  const [reservationTime, setReservationTime] = useState('');
  const [fulfillmentMode, setFulfillmentMode] = useState('dine_in');
  const [offerCode, setOfferCode] = useState('');
  const [giftCardCode, setGiftCardCode] = useState('');
  const [appliedOffer, setAppliedOffer] = useState(null);
  const [appliedCodes, setAppliedCodes] = useState(null);
  const [useRewardsCredit, setUseRewardsCredit] = useState(false);
  const [comparisonIds, setComparisonIds] = useState([]);
  const [shareFeedback, setShareFeedback] = useState('');
  const sharedCartLoaded = useRef(false);
  const [selectedMesa, setSelectedMesa] = useState(() => new URLSearchParams(window.location.search).get('mesa') || '');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [showFavorites, setShowFavorites] = useState(() => window.location.hash === '#favorites');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minGraduation, setMinGraduation] = useState('');
  const [sortBy, setSortBy] = useState('featured');
  const [gridDensity, setGridDensity] = useState('comfortable');
  const [theme, setTheme] = useState(getSavedTheme);
  const [accessibility, setAccessibility] = useState(getSavedAccessibility);
  const [favorites, setFavorites] = useState(getSavedFavorites);
  const [orderHistory, setOrderHistory] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [clientOrdersError, setClientOrdersError] = useState('');
  const [activeView, setActiveView] = useState(() => {
    const savedView = window.location.hash.slice(1);
    return ['promos', 'tables', 'orders', 'order', 'help', 'reviews', 'favorites', 'account', 'compare'].includes(savedView) ? savedView : 'catalog';
  });
  const [checkoutFeedback, setCheckoutFeedback] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshingCatalog, setIsRefreshingCatalog] = useState(false);
  const clientUserId = useRef(null);

  useEffect(() => {
    let active = true;
    let requestId = 0;
    let authSubscription;

    const clearCustomerData = clearCart => {
      setOrderHistory([]);
      setActiveOrder(null);
      setClientOrdersError('');
      setClientName('');
      setClientContact('');
      setUseRewardsCredit(false);
      if (clearCart) setCart([]);
    };

    const loadCustomerOrders = async session => {
      const currentRequestId = ++requestId;
      const userId = session?.user?.id;
      if (!session?.access_token || !hasVerifiedCustomerIdentity(session.user) || !userId) {
        const hadCustomer = clientUserId.current !== null;
        clientUserId.current = null;
        setClientSession(null);
        clearCustomerData(hadCustomer);
        return;
      }

      const changedCustomer = clientUserId.current !== null && clientUserId.current !== userId;
      if (changedCustomer) clearCustomerData(true);
      if (clientUserId.current !== userId) {
        const savedCart = getSavedCart(userId);
        if (savedCart) setCart(current => {
          if (changedCustomer || current.length === 0) return savedCart;
          const merged = [...savedCart];
          for (const item of current) {
            const index = merged.findIndex(entry => String(entry.id) === String(item.id) && (entry.type === 'promotion') === (item.type === 'promotion'));
            if (index < 0) merged.push(item);
            else merged[index] = { ...item, qty: Math.min(Number(merged[index].qty) + Number(item.qty), Number(item.stock) || 0, 50) };
          }
          return merged.filter(item => item.qty > 0);
        });
        else if (changedCustomer) setCart([]);
      }
      clientUserId.current = userId;
      setClientSession(session);
      setClientContact(session.user.phone || '');
      const profileName = getCustomerProfileName(session.user);
      if (profileName) setClientName(profileName);

      try {
        const response = await fetch(apiUrl('client/orders'), {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'No se pudo cargar tu historial.');
        if (!active || currentRequestId !== requestId || clientUserId.current !== userId) return;
        const ownedOrders = Array.isArray(result) ? result : [];
        setOrderHistory(ownedOrders);
        setActiveOrder(current => ownedOrders.find(order => String(order.id) === String(current?.id)) || ownedOrders[0] || null);
        setClientOrdersError('');
      } catch (error) {
        console.error('No se pudo cargar el historial privado del cliente.', error);
        if (active && currentRequestId === requestId && clientUserId.current === userId) {
          setOrderHistory([]);
          setActiveOrder(null);
          setClientOrdersError(error.message || 'No se pudo cargar tu historial privado.');
        }
      }
    };

    const initializeClientSession = async () => {
      try {
        const client = await getSupabaseClient();
        if (!active) return;
        const { data: authState } = client.auth.onAuthStateChange((_event, session) => {
          void loadCustomerOrders(session);
        });
        authSubscription = authState.subscription;
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        await loadCustomerOrders(data.session);
      } catch (error) {
        console.error('No se pudo inicializar la sesión segura del cliente.', error);
        if (active) {
          clientUserId.current = null;
          setClientSession(null);
          clearCustomerData(false);
          setClientOrdersError('No se pudo verificar tu cuenta. Vuelve a iniciar sesión con Google.');
        }
      }
    };

    try {
      localStorage.removeItem('clientOrderHistory');
      localStorage.removeItem('clientProfile');
      localStorage.removeItem(CLIENT_CART_KEY);
      sessionStorage.removeItem('clientActiveOrder');
    } catch (error) {
      console.error('No se pudo limpiar el historial local compartido de pedidos.', error);
    }

    void initializeClientSession();
    return () => {
      active = false;
      requestId += 1;
      authSubscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    } catch (error) {
      console.error('No se pudieron guardar los favoritos en este dispositivo.', error);
    }
  }, [favorites]);

  useEffect(() => {
    try {
      localStorage.setItem(CLIENT_THEME_KEY, theme);
    } catch (error) {
      console.error('No se pudo guardar el tema de la tienda.', error);
    }
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(CLIENT_ACCESSIBILITY_KEY, JSON.stringify(accessibility));
    } catch (error) {
      console.error('No se pudieron guardar las preferencias de accesibilidad.', error);
    }
  }, [accessibility]);

  useEffect(() => {
    if (!clientSession?.user?.id) return;
    try {
      localStorage.setItem(`${CLIENT_CART_KEY}:${clientSession.user.id}`, JSON.stringify(cart));
    } catch (error) {
      console.error('No se pudo guardar el carrito de esta cuenta.', error);
    }
  }, [cart, clientSession?.user?.id]);

  useEffect(() => {
    try {
      if (clientSession?.user?.id) sessionStorage.removeItem(GUEST_CART_KEY);
      else sessionStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart));
    } catch (error) {
      console.error('No se pudo guardar el carrito de esta pestaña.', error);
    }
  }, [cart, clientSession?.user?.id]);

  useEffect(() => {
    try {
      localStorage.setItem('clientStorePreferences', JSON.stringify(savedPreferences));
    } catch (error) {
      console.error('No se pudieron guardar las preferencias de idioma y moneda.', error);
    }
  }, [savedPreferences]);

  useEffect(() => {
    const sharedBasket = new URLSearchParams(window.location.search).get('lista');
    if (!sharedBasket || sharedCartLoaded.current || !licores.length) return;
    sharedCartLoaded.current = true;
    try {
      const requestedItems = sharedBasket.split(',').map(pair => {
        const [id, quantity] = pair.split(':');
        return { id, quantity: Number(quantity) };
      });
      setCart(current => {
        const merged = new Map(current.map(item => [String(item.id), { ...item }]));
        requestedItems.forEach(({ id, quantity }) => {
          const product = licores.find(item => String(item.id) === id);
          if (!product || !Number.isInteger(quantity) || quantity < 1) return;
          const existing = merged.get(id);
          merged.set(id, { ...product, qty: Math.min((existing?.qty || 0) + quantity, Number(product.stock) || 0) });
        });
        return [...merged.values()].filter(item => item.qty > 0);
      });
      const url = new URL(window.location.href);
      url.searchParams.delete('lista');
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    } catch (error) {
      console.error('No se pudo abrir la lista compartida.', error);
    }
  }, [licores]);

  useEffect(() => {
    if (!selectedMesa || !mesas.length) return;
    const requestedTable = mesas.find(mesa => String(mesa.id) === String(selectedMesa) || String(mesa.number) === String(selectedMesa));
    if (requestedTable?.status === 'Disponible') setSelectedMesa(String(requestedTable.id));
    else setSelectedMesa('');
  }, [mesas, selectedMesa]);

  useEffect(() => {
    if (!licores.length) return;
    setCart(current => current.reduce((items, item) => {
      if (item.type === 'promotion') return [...items, item];
      const currentProduct = licores.find(product => String(product.id) === String(item.id));
      const quantity = Math.min(Number(item.qty) || 0, Number(currentProduct?.stock) || 0);
      if (!currentProduct || quantity < 1) return items;
      return [...items, { ...currentProduct, qty: quantity }];
    }, []));
  }, [licores]);

  const changeTheme = nextTheme => {
    if (clientThemes.some(option => option.id === nextTheme)) setTheme(nextTheme);
  };

  const handlePriceAlert = async (product, contact, targetPrice) => {
    const response = await fetch(apiUrl('price-alerts'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: product.id, contact: contact.trim(), targetPrice: Number(targetPrice) })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `No se pudo registrar la alerta (${response.status}).`);
    return result;
  };

  const refreshCatalog = async () => {
    if (isRefreshingCatalog) return;
    setIsRefreshingCatalog(true);
    try {
      await fetchAll();
    } finally {
      setIsRefreshingCatalog(false);
    }
  };

  const toggleAccessibility = preference => {
    setAccessibility(current => ({ ...current, [preference]: !current[preference] }));
  };

  const handleAvailabilityRequest = async (product, contact) => {
    const response = await fetch(apiUrl('availability-alerts'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: product.id, productName: product.name, contact: contact.trim() })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `No se pudo registrar la solicitud (${response.status}).`);
    return result;
  };

  const toggleFavorite = (id) => {
    const normalizedId = String(id);
    setFavorites(current => current.includes(normalizedId)
      ? current.filter(favoriteId => favoriteId !== normalizedId)
      : [...current, normalizedId]);
  };

  const selectHistoryOrder = (order) => {
    setActiveOrder(order);
  };

  const navigateToView = (view) => {
    if (view === 'favorites') {
      setShowFavorites(true);
      setSelectedCategory('Todos');
    }
    if (view === 'catalog') setShowFavorites(false);
    setActiveView(view);
    window.history.replaceState(null, '', `#${view}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const setFavoriteFilter = value => {
    const nextValue = typeof value === 'function' ? value(showFavorites) : value;
    setShowFavorites(nextValue);
    if (activeView === 'favorites' && !nextValue) {
      setActiveView('catalog');
      window.history.replaceState(null, '', '#catalog');
    }
  };

  const openProductFromPromotion = product => {
    setSearchTerm('');
    setSelectedCategory('Todos');
    setShowFavorites(false);
    setOnlyAvailable(false);
    navigateToView('catalog');
    const url = new URL(window.location.href);
    url.searchParams.set('producto', product.id);
    url.hash = 'catalog-product-list';
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  };

  const addToCart = (licor) => {
    if (licor.stock <= 0) {
      alert('Lo sentimos, este producto está agotado.');
      return;
    }
    setCart(current => {
      const exist = current.find(item => item.id === licor.id && (item.type === 'promotion') === (licor.type === 'promotion'));
      if (exist?.qty >= licor.stock) return current;
      if (exist) return current.map(item => item === exist ? { ...item, qty: item.qty + 1 } : item);
      return [...current, { ...licor, qty: 1 }];
    });
  };

  const removeFromCart = (id, type) => {
    setCart(current => {
      const exist = current.find(item => item.id === id && (item.type === 'promotion') === (type === 'promotion'));
      if (!exist) return current;
      if (exist.qty === 1) return current.filter(item => item !== exist);
      return current.map(item => item === exist ? { ...item, qty: item.qty - 1 } : item);
    });
  };

  const addPromotion = promo => {
    if (promo.precio == null || Number(promo.stock) <= 0) return;
    const item = { type: 'promotion', id: promo.id, name: promo.titulo, price: Number(promo.precio), stock: Number(promo.stock) };
    setCart(current => {
      const existing = current.find(entry => entry.type === 'promotion' && String(entry.id) === String(item.id));
      if (existing) {
        return current.map(entry => entry === existing ? { ...item, qty: Math.min(existing.qty + 1, item.stock, 50) } : entry);
      }
      return [...current, { ...item, qty: 1 }];
    });
    setAppliedOffer(null);
    setCheckoutFeedback({ type: 'success', message: `Promoción "${promo.titulo}" agregada al pedido. El precio y stock se confirman al finalizar.` });
    navigateToView('order');
  };

  const totalCart = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const validation = validateCheckout(clientName, selectedMesa, cart, fulfillmentMode);
    if (!validation.valid) {
      setCheckoutFeedback({ type: 'error', message: validation.message });
      return;
    }

    if (fulfillmentMode === 'dine_in') {
      const selectedTable = mesas.find(mesa => String(mesa.id) === String(selectedMesa));
      if (!selectedTable || selectedTable.status !== 'Disponible') {
        setCheckoutFeedback({ type: 'error', message: 'Esa mesa ya no está disponible. Actualiza la página y elige otra.' });
        await fetchAll();
        return;
      }
    }

    const unavailableItem = cart.find(item => {
      if (item.type === 'promotion') return false;
      const currentProduct = licores.find(product => product.id === item.id);
      return !currentProduct || Number(currentProduct.stock) < item.qty;
    });
    if (unavailableItem) {
      setCheckoutFeedback({ type: 'error', message: `${unavailableItem.name} ya no tiene suficiente stock. Revisa tu carrito.` });
      await fetchAll();
      return;
    }
    if (cart.some(item => item.type === 'promotion') && storePreferences.currency !== 'PEN') {
      setCheckoutFeedback({ type: 'error', message: 'Las promociones se cobran en soles. Cambia la moneda a PEN antes de confirmar.' });
      return;
    }

    setIsSubmitting(true);
    setCheckoutFeedback(null);
    try {
      const authenticatedClient = await getSupabaseClient();
      const { data: currentAuth, error: currentAuthError } = await authenticatedClient.auth.getSession();
      if (currentAuthError) throw currentAuthError;
      const verifiedSession = currentAuth.session;
      if (!verifiedSession?.access_token || !hasVerifiedCustomerIdentity(verifiedSession.user)) {
        setClientSession(null);
        setCheckoutFeedback({ type: 'error', message: 'Inicia sesión con Google para confirmar el pedido y proteger tu historial.' });
        navigateToView('account');
        return;
      }
      setClientSession(verifiedSession);
      const headers = { 'Content-Type': 'application/json' };
      let accessToken = verifiedSession.access_token;
      if (!accessToken) {
        try {
          const client = await getSupabaseClient();
          const { data, error } = await client.auth.getSession();
          if (error) throw error;
          accessToken = data.session?.access_token;
          if (data.session) setClientSession(data.session);
        } catch (sessionError) {
          console.error('No se pudo recuperar una sesión de cliente; el pedido continuará como invitado.', sessionError);
        }
      }
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
      const response = await fetch(apiUrl('reservas'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          clientName: clientName.trim(),
          clientContact: clientContact.trim(),
          mesaId: fulfillmentMode === 'dine_in' ? selectedMesa : null,
          items: cart,
          fulfillmentMode,
          scheduledFor: reservationTime ? new Date(reservationTime).toISOString() : null,
          promoCode: appliedCodes?.promoCode || offerCode.trim(),
          giftCardCode: appliedCodes?.giftCardCode || giftCardCode.trim(),
          useRewardsCredit,
          currency: storePreferences.currency
        })
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || `No se pudo confirmar el pedido (${response.status}).`);
      }

      const nuevaReserva = result;
      setActiveOrder(nuevaReserva);
      const nextOrderHistory = [
        nuevaReserva,
        ...orderHistory.filter(order => String(order.id) !== String(nuevaReserva.id))
      ].slice(0, 20);
      setOrderHistory(nextOrderHistory);
      setCart([]);
      setSelectedMesa('');
      setOfferCode('');
      setGiftCardCode('');
      setAppliedOffer(null);
      setAppliedCodes(null);
      setCheckoutFeedback({ type: 'success', message: '¡Pedido confirmado! Conserva esta página para consultar tu reserva.' });
      if (!await fetchAll()) {
        setCheckoutFeedback({ type: 'success', message: '¡Pedido confirmado! No pudimos actualizar el catálogo; vuelve a cargar la página para ver los últimos datos.' });
      }
    } catch (error) {
      console.error('No se pudo confirmar el pedido del cliente.', error);
      setCheckoutFeedback({ type: 'error', message: error.message || 'Hubo un problema al enviar tu pedido. Inténtalo nuevamente.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredLicores = licores.filter(l => {
    const matchesName = String(l.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = selectedCategory === 'Todos' || l.category === selectedCategory;
    const matchesFavorites = !showFavorites || favorites.includes(String(l.id));
    const matchesAvailability = !onlyAvailable || Number(l.stock) > 0;
    const brand = String(l.brand || l.marca || '');
    const alcoholValue = Number.parseFloat(String(l.graduacion || l.alcohol_content || l.alcoholContent || l.abv || '').replace(',', '.'));
    const matchesBrand = !selectedBrand || brand === selectedBrand;
    const matchesMinPrice = !minPrice || Number(l.price) >= Number(minPrice);
    const matchesMaxPrice = !maxPrice || Number(l.price) <= Number(maxPrice);
    const matchesGraduation = !minGraduation || (Number.isFinite(alcoholValue) && alcoholValue >= Number(minGraduation));
    return matchesName && matchesCat && matchesFavorites && matchesAvailability && matchesBrand && matchesMinPrice && matchesMaxPrice && matchesGraduation;
  }).sort((left, right) => {
    if (sortBy === 'price-asc') return Number(left.price) - Number(right.price);
    if (sortBy === 'price-desc') return Number(right.price) - Number(left.price);
    if (sortBy === 'name') return String(left.name).localeCompare(String(right.name), 'es');
    if (sortBy === 'stock') return Number(right.stock) - Number(left.stock);
    return 0;
  });
  const recommendedCategory = cart[0]?.category || (selectedCategory !== 'Todos' ? selectedCategory : null);
  const recommendedBrand = cart[0]?.brand || cart[0]?.marca;
  const cartIds = new Set(cart.filter(item => item.type !== 'promotion').map(item => String(item.id)));
  const recommendations = recommendedCategory || recommendedBrand
    ? licores.filter(product => {
      const sameBrand = recommendedBrand && String(product.brand || product.marca || '') === String(recommendedBrand);
      const sameCategory = recommendedCategory && product.category === recommendedCategory;
      return (sameBrand || sameCategory) && Number(product.stock) > 0 && !cartIds.has(String(product.id));
    }).slice(0, 4)
    : [];

  const categories = ['Todos', ...new Set(licores.map(l => l.category).filter(Boolean))];
  const brands = [...new Set(licores.map(product => String(product.brand || product.marca || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'es'));
  const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const money = (value, currencyOverride = storePreferences.currency) => formatMoney(value, currencyOverride, storePreferences.locale);
  const toggleComparison = id => setComparisonIds(current => current.includes(String(id))
    ? current.filter(itemId => itemId !== String(id))
    : current.length >= 3 ? current : [...current, String(id)]);
  const comparisonProducts = licores.filter(product => comparisonIds.includes(String(product.id)));
  const shareOrderList = async () => {
    if (!cart.length) return;
    if (cart.some(item => item.type === 'promotion')) {
      setShareFeedback('No se pueden compartir listas que contienen promociones. Compártelas desde la sección Promociones.');
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set('lista', cart.map(item => `${item.id}:${item.qty}`).join(','));
    url.hash = 'catalog';
    try {
      if (navigator.share) await navigator.share({ title: 'Mi lista de productos', text: 'Mira esta selección de la tienda.', url: url.toString() });
      else await navigator.clipboard.writeText(url.toString());
      setShareFeedback('Enlace de la lista listo para compartir.');
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('No se pudo compartir la lista de productos.', error);
        setShareFeedback('No se pudo compartir la lista. Inténtalo otra vez.');
      }
    }
  };
  const applyOffers = async () => {
    const codes = { promoCode: offerCode.trim(), giftCardCode: giftCardCode.trim() };
    try {
      if (cart.some(item => item.type === 'promotion') && storePreferences.currency !== 'PEN') {
        throw new Error('Las promociones se cobran en soles. Cambia la moneda a PEN antes de validar códigos.');
      }
      const response = await fetch(apiUrl('ofertas/validar'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...codes, total: totalCart, currency: storePreferences.currency })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'No se pudieron validar los códigos.');
      setAppliedOffer(result);
      setAppliedCodes(codes);
      setOfferCode('');
      setGiftCardCode('');
      setCheckoutFeedback({ type: 'success', message: 'Los códigos se validaron. El descuento final se confirmará al procesar el pedido.' });
    } catch (error) {
      console.error('No se pudieron validar los códigos promocionales.', error);
      setAppliedOffer(null);
      setAppliedCodes(null);
      setCheckoutFeedback({ type: 'error', message: error.message });
    }
  };

  const updateOfferCode = value => {
    setOfferCode(value);
    setAppliedOffer(null);
    setAppliedCodes(null);
  };
  const updateGiftCardCode = value => {
    setGiftCardCode(value);
    setAppliedOffer(null);
    setAppliedCodes(null);
  };

  const checkoutPanel = (
    <ClientCartCheckout
      cart={cart}
      addToCart={addToCart}
      removeFromCart={removeFromCart}
      onClearCart={() => {
        setCart([]);
        setAppliedOffer(null);
        setAppliedCodes(null);
      }}
      totalCart={totalCart}
      clientName={clientName}
      setClientName={setClientName}
      clientContact={clientContact}
      setClientContact={setClientContact}
      fulfillmentMode={fulfillmentMode}
      setFulfillmentMode={setFulfillmentMode}
      reservationTime={reservationTime}
      setReservationTime={setReservationTime}
      currency={storePreferences.currency}
      locale={storePreferences.locale}
      formatMoney={money}
      offerCode={offerCode}
      setOfferCode={updateOfferCode}
      giftCardCode={giftCardCode}
      setGiftCardCode={updateGiftCardCode}
      appliedOffer={appliedOffer}
      applyOffers={applyOffers}
      useRewardsCredit={useRewardsCredit}
      setUseRewardsCredit={setUseRewardsCredit}
      onShareOrder={shareOrderList}
      shareFeedback={shareFeedback}
      selectedMesa={selectedMesa}
      setSelectedMesa={setSelectedMesa}
      mesas={mesas}
      handleCheckout={handleCheckout}
      checkoutFeedback={checkoutFeedback}
      isSubmitting={isSubmitting}
      isClientAuthenticated={Boolean(clientSession?.access_token && hasVerifiedCustomerIdentity(clientSession.user))}
      onRequireSignIn={() => navigateToView('account')}
    />
  );

  const activeViewInfo = {
    catalog: ['TU SELECCIÓN', 'La carta', 'Explora productos y agrega tus favoritos al pedido.'],
    favorites: ['TUS FAVORITOS', 'Productos guardados', 'Aquí tienes los productos que marcaste como favoritos.'],
    promos: ['BENEFICIOS DE LA CASA', 'Promociones', 'Descubre las propuestas disponibles en el local.'],
    tables: ['DISPONIBILIDAD EN VIVO', 'Mesas', 'Consulta el estado de cada mesa y selecciona dónde te atenderemos.'],
    orders: ['TU ACTIVIDAD', 'Mis pedidos', 'Consulta tus pedidos y vuelve a abrir su seguimiento.'],
    order: ['RESUMEN DE COMPRA', 'Tu pedido', 'Revisa tu selección y confirma cuando esté lista.'],
    help: ['ATENCIÓN EN EL LOCAL', '¿Necesitas ayuda?', 'Envía un aviso directamente al personal.'],
    reviews: ['TU OPINIÓN CUENTA', 'Reseñas', 'Cuéntanos cómo fue tu experiencia en CASA VINO.'],
    account: ['TU CUENTA', 'Mi cuenta', 'Accede a tus pedidos desde distintos dispositivos y consulta recompensas.'],
    compare: ['COMPARA TU SELECCIÓN', 'Comparar productos', 'Revisa precio, marca, categoría y graduación antes de elegir.']
  }[activeView];
  const translatedViewInfo = storePreferences.locale === 'en'
    ? {
      catalog: ['YOUR SELECTION', 'Menu', 'Browse products and add your favorites to your order.'],
      favorites: ['YOUR FAVORITES', 'Saved products', 'Here are the products you marked as favorites.'],
      promos: ['HOUSE BENEFITS', 'Promotions', 'Discover the offers available at the store.'],
      tables: ['LIVE AVAILABILITY', 'Tables', 'Check availability and select where you would like to be served.'],
      orders: ['YOUR ACTIVITY', 'My orders', 'View your orders and reopen their tracking.'],
      order: ['ORDER SUMMARY', 'Your order', 'Review your selection and confirm when ready.'],
      help: ['IN-STORE SUPPORT', 'Need help?', 'Send a request directly to the staff.'],
      reviews: ['YOUR OPINION MATTERS', 'Reviews', 'Tell us about your experience.'],
      account: ['YOUR ACCOUNT', 'My account', 'Access your orders across devices and check rewards.'],
      compare: ['COMPARE YOUR SELECTION', 'Compare products', 'Review price, brand, category and alcohol content.']
    }[activeView]
    : activeViewInfo;

  return (
    <div className="client-storefront" data-theme={theme} data-view={activeView} data-text-size={accessibility.largeText ? 'large' : 'normal'} data-reduce-motion={accessibility.reduceMotion ? 'true' : 'false'}>
      <div className="store-shell">
        <ClientHeader
          cartCount={itemCount}
          activeView={activeView}
          onNavigate={navigateToView}
          theme={theme}
          onThemeChange={changeTheme}
          accessibility={accessibility}
          onToggleAccessibility={toggleAccessibility}
          locale={storePreferences.locale}
          currency={savedPreferences.currency}
          onStorePreferencesChange={next => setStorePreferences(current => ({ ...current, ...next }))}
        />
        {settingsError && (
          <div className="store-feedback is-error" role="alert">
            <span>{settingsError}</span>
            <button type="button" onClick={refreshSettings}>Reintentar</button>
          </div>
        )}
        {catalogError && (
          <div className="store-feedback is-error" role="alert">
            <span>{catalogError}</span>
            <button type="button" onClick={fetchAll}>Reintentar</button>
          </div>
        )}

        {activeView === 'catalog' || activeView === 'favorites' ? (
          <>
            <ClientBanner onExplore={() => document.getElementById('catalog-product-list')?.scrollIntoView({ behavior: 'smooth' })} />
            <div className="store-catalog-layout client-view-layout" id="catalogo">
              <main className="store-catalog" id="catalog-product-list">
                <div className="section-heading catalog-heading">
                  <div>
                    <p className="store-kicker">{storePreferences.locale === 'en' ? 'FIND YOUR FAVORITE' : 'ENCUENTRA TU FAVORITO'}</p>
                    <h2>{activeView === 'favorites' ? (storePreferences.locale === 'en' ? 'Your favorites' : 'Tus favoritos') : (storePreferences.locale === 'en' ? 'Menu' : 'La carta')}</h2>
                  </div>
                  <div className="catalog-heading-actions">
                            <span>{filteredLicores.length} {storePreferences.locale === 'en' ? (filteredLicores.length === 1 ? 'product' : 'products') : (filteredLicores.length === 1 ? 'producto' : 'productos')}</span>
                            <button type="button" className="catalog-refresh" onClick={refreshCatalog} disabled={isRefreshingCatalog} aria-label={storePreferences.locale === 'en' ? 'Refresh menu' : 'Actualizar catálogo'}>
                              {isRefreshingCatalog ? (storePreferences.locale === 'en' ? 'Refreshing…' : 'Actualizando…') : `${storePreferences.locale === 'en' ? 'Refresh' : 'Actualizar'} ↻`}
                    </button>
                  </div>
                </div>
                <ClientSearchFilter
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                  categories={categories}
                  selectedCategory={selectedCategory}
                  setSelectedCategory={setSelectedCategory}
                  showFavorites={showFavorites}
                  setShowFavorites={setFavoriteFilter}
                  onlyAvailable={onlyAvailable}
                  setOnlyAvailable={setOnlyAvailable}
                  brands={brands}
                  selectedBrand={selectedBrand}
                  setSelectedBrand={setSelectedBrand}
                  minPrice={minPrice}
                  setMinPrice={setMinPrice}
                  maxPrice={maxPrice}
                  setMaxPrice={setMaxPrice}
                  minGraduation={minGraduation}
                  setMinGraduation={setMinGraduation}
                  sortBy={sortBy}
                  setSortBy={setSortBy}
                  gridDensity={gridDensity}
                  setGridDensity={setGridDensity}
                  locale={storePreferences.locale}
                  onClear={() => { setSearchTerm(''); setSelectedCategory('Todos'); setShowFavorites(activeView === 'favorites'); setOnlyAvailable(false); setSelectedBrand(''); setMinPrice(''); setMaxPrice(''); setMinGraduation(''); }}
                />
                {catalogLoading ? (
                  <div className="catalog-loading" role="status">{storePreferences.locale === 'en' ? 'Preparing the menu…' : 'Preparando la carta…'}</div>
                ) : (
                  <ClientProductGrid
                    className={gridDensity === 'compact' ? 'is-compact' : ''}
                    emptyMessage={activeView === 'favorites' ? (storePreferences.locale === 'en' ? 'No favorites yet' : 'Todavía no tienes favoritos') : undefined}
                    filteredLicores={filteredLicores}
                    addToCart={addToCart}
                    cart={cart}
                    favorites={favorites}
                    toggleFavorite={toggleFavorite}
                    onAvailabilityRequest={handleAvailabilityRequest}
                    clientName={clientName}
                    currency={storePreferences.currency}
                    locale={storePreferences.locale}
                    comparisonIds={comparisonIds}
                    onToggleCompare={toggleComparison}
                    onPriceAlert={handlePriceAlert}
                    clientContact={clientContact}
                  />
                )}
                {comparisonIds.length > 0 && (
                  <button type="button" className="checkout-button compare-selected-button" onClick={() => navigateToView('compare')}>
                    {storePreferences.locale === 'en' ? 'Compare selection' : 'Comparar selección'} ({comparisonIds.length}/3)
                  </button>
                )}
                {recommendations.length > 0 && (
                  <section className="client-recommendations">
                    <div className="section-heading">
                      <div><p className="store-kicker">TAMBIÉN TE PUEDE GUSTAR</p><h2>De la misma categoría</h2></div>
                    </div>
                    <ClientProductGrid
                      className="is-compact"
                      filteredLicores={recommendations}
                      addToCart={addToCart}
                      cart={cart}
                      favorites={favorites}
                      toggleFavorite={toggleFavorite}
                      onAvailabilityRequest={handleAvailabilityRequest}
                      clientName={clientName}
                      currency={storePreferences.currency}
                      locale={storePreferences.locale}
                      comparisonIds={comparisonIds}
                      onToggleCompare={toggleComparison}
                      onPriceAlert={handlePriceAlert}
                      clientContact={clientContact}
                    />
                  </section>
                )}
              </main>
              <aside className="store-order-column">
                {checkoutPanel}
                <ClientOrderTracker activeOrder={activeOrder} accessToken={clientSession?.access_token} />
              </aside>
            </div>
          </>
        ) : (
          <main className={`client-view-page client-view-${activeView}`}>
            <header className="client-view-heading">
              <p className="store-kicker">{translatedViewInfo[0]}</p>
              <h1>{translatedViewInfo[1]}</h1>
              <p>{translatedViewInfo[2]}</p>
            </header>

            {activeView === 'promos' && (
              <div className="client-view-content">
                <ClientPromos products={licores} onProductSelect={openProductFromPromotion} onAddPromotion={addPromotion} locale={storePreferences.locale} />
                <button className="checkout-button client-view-cta" type="button" onClick={() => navigateToView('catalog')}>
                  Explorar la carta <span aria-hidden="true">↗</span>
                </button>
              </div>
            )}
            {activeView === 'tables' && (
              <div className="client-view-content">
                <ClientTableAvailability
                  mesas={mesas}
                  selectedMesa={selectedMesa}
                  onSelectMesa={setSelectedMesa}
                  onContinueToOrder={() => navigateToView('order')}
                />
              </div>
            )}
            {activeView === 'account' && (
              <div className="client-view-content">
                <ClientAccount currency={storePreferences.currency} locale={storePreferences.locale} onSessionChange={session => {
                  const nextUserId = session?.user?.id || null;
                  if (clientUserId.current && clientUserId.current !== nextUserId) {
                    setOrderHistory([]);
                    setActiveOrder(null);
                    setCart([]);
                    setClientName('');
                    setClientContact('');
                    setUseRewardsCredit(false);
                  }
                  if (!nextUserId) clientUserId.current = null;
                  setClientSession(session);
                  const profileName = getCustomerProfileName(session?.user);
                  if (profileName) setClientName(profileName);
                  if (!session) {
                    setOrderHistory([]);
                    setActiveOrder(null);
                    setClientName('');
                    setClientContact('');
                    setUseRewardsCredit(false);
                    setCart([]);
                  }
                }} />
              </div>
            )}
            {activeView === 'compare' && (
              <div className="client-view-content">
                {comparisonProducts.length < 2 ? (
                  <section className="client-panel-card">
                    <h2>Elige al menos dos productos</h2>
                    <p className="client-panel-note">En la carta puedes marcar hasta tres productos para compararlos.</p>
                    <button className="checkout-button" type="button" onClick={() => navigateToView('catalog')}>Volver a la carta</button>
                  </section>
                ) : (
                  <div className="product-comparison">
                    <table>
                      <thead><tr><th>Característica</th>{comparisonProducts.map(product => <th key={product.id}>{product.name}</th>)}</tr></thead>
                      <tbody>
                        <tr><th>Precio</th>{comparisonProducts.map(product => <td key={product.id}>{money(product.price)}</td>)}</tr>
                        <tr><th>Marca</th>{comparisonProducts.map(product => <td key={product.id}>{product.brand || product.marca || '—'}</td>)}</tr>
                        <tr><th>Categoría</th>{comparisonProducts.map(product => <td key={product.id}>{product.category || '—'}</td>)}</tr>
                        <tr><th>Graduación</th>{comparisonProducts.map(product => <td key={product.id}>{product.graduacion || product.alcohol_content || product.abv || '—'}</td>)}</tr>
                        <tr><th>Disponibilidad</th>{comparisonProducts.map(product => <td key={product.id}>{Number(product.stock) > 0 ? `${product.stock} disponibles` : 'Agotado'}</td>)}</tr>
                      </tbody>
                    </table>
                    <button type="button" className="client-text-link" onClick={() => setComparisonIds([])}>Limpiar comparación</button>
                  </div>
                )}
              </div>
            )}
            {activeView === 'orders' && (
              <div className="client-view-content">
                {!hasVerifiedCustomerIdentity(clientSession?.user) && (
                  <section className="client-panel-card client-orders-signin">
                    <p className="store-kicker">HISTORIAL PRIVADO</p>
                    <h2>Inicia sesión para ver tus pedidos</h2>
                    <p>Tu historial solo aparece cuando inicias sesión. No guardamos los pedidos en una lista compartida en este dispositivo.</p>
                    <button className="checkout-button" type="button" onClick={() => navigateToView('account')}>Iniciar sesión con Google</button>
                  </section>
                )}
                {clientOrdersError && <p className="checkout-feedback is-error" role="alert">{clientOrdersError}</p>}
                {hasVerifiedCustomerIdentity(clientSession?.user) && <ClientOrderTracker activeOrder={activeOrder} accessToken={clientSession.access_token} />}
                {hasVerifiedCustomerIdentity(clientSession?.user) && <ClientOrderHistory orders={orderHistory} onSelectOrder={selectHistoryOrder} accessToken={clientSession.access_token} formatMoney={money} locale={storePreferences.locale} onOrderUpdated={updatedOrder => {
                  setOrderHistory(current => current.map(order => String(order.id) === String(updatedOrder.id) ? updatedOrder : order));
                  if (String(activeOrder?.id) === String(updatedOrder.id)) setActiveOrder(updatedOrder);
                  if (updatedOrder.status === 'Cancelado') setActiveOrder(updatedOrder);
                }} onRepeatOrder={order => {
                  const repeatItems = (Array.isArray(order.items) ? order.items : []).reduce((items, item) => {
                    if (item.type === 'promotion') return items;
                    const product = licores.find(current => String(current.id) === String(item.id));
                    if (!product || Number(product.stock) < 1) return items;
                    return [...items, { ...product, qty: Math.min(Number(item.qty) || 1, Number(product.stock) || 0) }];
                  }, []);
                  if (!repeatItems.length) {
                    setCheckoutFeedback({ type: 'error', message: 'No hay productos de ese pedido disponibles para repetir.' });
                    return;
                  }
                  const omitted = (Array.isArray(order.items) ? order.items.length : 0) - repeatItems.length;
                  setCart(repeatItems);
                  setCheckoutFeedback(omitted > 0
                    ? { type: 'success', message: `Pedido listo. Se omitieron ${omitted} producto(s) que ya no están disponibles.` }
                    : { type: 'success', message: 'Pedido listo para confirmar. Verifica la mesa antes de enviarlo.' });
                  navigateToView('order');
                }} />}
              </div>
            )}
            {activeView === 'order' && (
              <div className="client-view-content client-view-order-content">
                {checkoutPanel}
                <ClientOrderTracker activeOrder={activeOrder} accessToken={clientSession?.access_token} />
                <button className="client-text-link" type="button" onClick={() => navigateToView('tables')}>Ver disponibilidad de mesas</button>
              </div>
            )}
            {activeView === 'help' && (
              <div className="client-view-content">
                <ClientWaiterView
                  selectedMesa={selectedMesa}
                  mesas={mesas}
                  clientName={clientName}
                  activeOrder={activeOrder}
                  expanded
                />
              </div>
            )}
            {activeView === 'reviews' && (
              <div className="client-view-content">
                <ClientReviewModal onClose={() => navigateToView('catalog')} inline />
              </div>
            )}
          </main>
        )}
        <ClientBusinessInfo />
      </div>
      {itemCount > 0 && (
        <button className="mobile-cart-dock" type="button" onClick={() => navigateToView('order')} aria-label="Abrir mi pedido">
          <span>{itemCount} {itemCount === 1 ? 'producto' : 'productos'}</span>
          <strong>{cart.some(item => item.type === 'promotion') && storePreferences.currency !== 'PEN' ? 'Ver pedido · Selecciona PEN' : `Ver pedido · ${money(totalCart)}`}</strong>
          <span aria-hidden="true">↑</span>
        </button>
      )}
    </div>
  );
}