import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { apiUrl } from '../api/apiConfig';
import { adminRequest } from '../api/adminApi';

const BusinessSettingsContext = createContext(null);
const defaults = { businessName: 'VIP Bar', openingHours: 'Horario no configurado', address: '', phone: '', mapUrl: '', currency: 'USD' };

function initialSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('businessSettings') || '{}');
    return { ...defaults, ...saved };
  } catch (error) {
    console.error('No se pudo recuperar la configuración local del negocio.', error);
    return defaults;
  }
}

export function BusinessSettingsProvider({ children }) {
  const [settings, setSettings] = useState(initialSettings);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const version = useRef(0);

  const refresh = useCallback(async () => {
    const requestVersion = ++version.current;
    try {
      const response = await fetch(apiUrl('business-settings'), { cache: 'no-store' });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || `Error al cargar configuración (${response.status}).`);
      }
      const data = await response.json();
      if (!data || typeof data.businessName !== 'string' || typeof data.currency !== 'string') {
        throw new Error('La configuración recibida no tiene el formato esperado.');
      }
      if (requestVersion === version.current) {
        setSettings(data);
        setLoaded(true);
        setError('');
      }
    } catch (loadError) {
      console.error('No se pudo sincronizar la configuración del negocio.', loadError);
      if (requestVersion === version.current) setError('No se pudo actualizar la información del negocio. Revisa la conexión y la configuración del servidor.');
    }
  }, []);

  const save = useCallback(async values => {
    ++version.current;
    const saved = await adminRequest(apiUrl('business-settings'), 'PUT', values);
    ++version.current;
    setSettings(saved);
    setLoaded(true);
    setError('');
    return saved;
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener('focus', refresh);
    const timer = window.setInterval(refresh, 30000);
    return () => {
      ++version.current;
      window.removeEventListener('focus', refresh);
      window.clearInterval(timer);
    };
  }, [refresh]);

  return <BusinessSettingsContext.Provider value={{ settings, loaded, error, refresh, save }}>{children}</BusinessSettingsContext.Provider>;
}

export function useBusinessSettings() {
  return useContext(BusinessSettingsContext);
}
