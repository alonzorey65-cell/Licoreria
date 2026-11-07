import React, { useState } from 'react';

function getBusinessIdentity() {
  try {
    const settings = JSON.parse(localStorage.getItem('businessSettings') || '{}');
    return {
      name: typeof settings.businessName === 'string' && settings.businessName.trim() ? settings.businessName.trim() : 'CASA VINO',
      hours: typeof settings.openingHours === 'string' && settings.openingHours.trim() ? settings.openingHours.trim() : ''
    };
  } catch (error) {
    console.error('No se pudo recuperar el nombre y horario del negocio.', error);
    return { name: 'CASA VINO', hours: '' };
  }
}

export function ClientBusinessInfo() {
  const [settings] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('businessSettings') || '{}');
    } catch (error) {
      console.error('No se pudieron recuperar los datos de contacto del negocio.', error);
      return {};
    }
  });
  const mapUrl = (() => {
    try {
      const url = new URL(settings.mapUrl);
      return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
    } catch {
      return '';
    }
  })();
  const phone = typeof settings.phone === 'string' ? settings.phone.trim() : '';
  const whatsapp = phone.replace(/\D/g, '');
  const address = typeof settings.address === 'string' ? settings.address.trim() : '';
  if (!phone && !address && !mapUrl) return null;

  return (
    <footer className="client-business-info">
      <p className="store-kicker">VISÍTANOS</p>
      {address && <span>{address}</span>}
      {phone && <a href={`tel:${phone.replace(/[^\d+]/g, '')}`}>{phone}</a>}
      {whatsapp && <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">WhatsApp ↗</a>}
      {mapUrl && <a href={mapUrl} target="_blank" rel="noreferrer">Cómo llegar ↗</a>}
    </footer>
  );
}

const clientViews = [
  { id: 'catalog', label: 'La carta' },
  { id: 'favorites', label: '♥ Favoritos' },
  { id: 'promos', label: 'Promociones' },
  { id: 'tables', label: 'Mesas' },
  { id: 'orders', label: 'Mis pedidos' },
  { id: 'account', label: 'Mi cuenta' },
  { id: 'compare', label: 'Comparar' },
  { id: 'order', label: 'Mi carrito' },
  { id: 'help', label: 'Ayuda' },
  { id: 'reviews', label: 'Reseñas' }
];

export const clientThemes = [
  { id: 'vino', label: 'Vino clásico', swatch: '#612c37' },
  { id: 'bosque', label: 'Bosque', swatch: '#315746' },
  { id: 'oceano', label: 'Océano', swatch: '#28546b' },
  { id: 'noche', label: 'Noche', swatch: '#17202e' },
  { id: 'lavanda', label: 'Lavanda', swatch: '#67528c' }
];

export default function ClientHeader({
  cartCount = 0, activeView, onNavigate, theme, onThemeChange,
  accessibility = { largeText: false, reduceMotion: false }, onToggleAccessibility,
  locale = 'es', currency = 'USD', onStorePreferencesChange = () => {}
}) {
  const [businessIdentity] = useState(getBusinessIdentity);
  const scrollNavigationOnWheel = event => {
    const navigation = event.currentTarget;
    if (navigation.scrollWidth <= navigation.clientWidth || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    navigation.scrollLeft += event.deltaY;
  };

  return (
    <header className="store-header">
      <a className="store-brand" href="/" aria-label="VIP Bar, inicio">
        <span className="store-brand-mark" aria-hidden="true">V</span>
        <span>
          <strong>{businessIdentity.name}</strong>
          <small>BAR · LICORERÍA</small>
          {businessIdentity.hours && <small className="store-brand-hours">{businessIdentity.hours}</small>}
        </span>
      </a>
      <nav className="store-nav" aria-label="Navegación principal" onWheel={scrollNavigationOnWheel}>
        {clientViews.map(view => (
          <button
            type="button"
            key={view.id}
            className={(activeView === view.id || (view.id === 'catalog' && activeView === 'favorites')) ? 'is-active' : ''}
            onClick={() => onNavigate(view.id)}
            aria-current={activeView === view.id ? 'page' : undefined}
          >
            {locale === 'en' ? ({
              catalog: 'Menu', favorites: '♥ Favorites', promos: 'Promotions', tables: 'Tables',
              orders: 'My orders', account: 'Account', compare: 'Compare', order: 'My cart',
              help: 'Help', reviews: 'Reviews'
            }[view.id] || view.label) : view.label}{view.id === 'order' && cartCount > 0 ? ` · ${cartCount}` : ''}
          </button>
        ))}
      </nav>
      <label className="store-theme-picker">
        <span aria-hidden="true">◐</span>
        <span className="store-theme-label">Tema</span>
        <select value={theme} onChange={event => onThemeChange(event.target.value)} aria-label="Cambiar tema de la tienda">
          {clientThemes.map(option => <option value={option.id} key={option.id}>{option.label}</option>)}
        </select>
      </label>
      <label className="store-preference-picker">
        <span className="store-theme-label">{locale === 'en' ? 'Language' : 'Idioma'}</span>
        <select value={locale} onChange={event => onStorePreferencesChange({ locale: event.target.value })} aria-label="Cambiar idioma">
          <option value="es">Español</option>
          <option value="en">English</option>
        </select>
      </label>
      <label className="store-preference-picker">
        <span className="store-theme-label">{locale === 'en' ? 'Currency (no conversion)' : 'Moneda (sin conversión)'}</span>
        <select value={currency} onChange={event => onStorePreferencesChange({ currency: event.target.value })} aria-label="Cambiar moneda">
          <option value="USD">USD</option>
          <option value="MXN">MXN</option>
          <option value="COP">COP</option>
          <option value="PEN">PEN</option>
          <option value="EUR">EUR</option>
        </select>
      </label>
      <div className="store-accessibility" role="group" aria-label="Opciones de accesibilidad">
        <button type="button" onClick={() => onToggleAccessibility('largeText')} aria-pressed={accessibility.largeText} aria-label="Alternar texto grande">A+</button>
        <button type="button" onClick={() => onToggleAccessibility('reduceMotion')} aria-pressed={accessibility.reduceMotion} aria-label="Alternar movimiento reducido">◌</button>
      </div>
      <button className="store-header-cta" type="button" onClick={() => onNavigate('catalog')}>{locale === 'en' ? 'View menu' : 'Ver carta'} <span aria-hidden="true">↗</span></button>
    </header>
  );
}
