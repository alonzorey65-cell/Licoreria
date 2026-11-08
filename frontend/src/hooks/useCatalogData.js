import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchLicoresAPI, fetchMesasAPI } from '../api/clientApi';
import { getSupabaseClient } from '../api/supabaseClient';
import { API_MISCONFIGURED } from '../api/apiConfig';

export function useCatalogData() {
  const [licores, setLicores] = useState([]);
  const [mesas, setMesas] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const initialLoadCompleted = useRef(false);
  const fetchInProgress = useRef(false);

  const fetchAll = useCallback(async () => {
    if (fetchInProgress.current) return true;
    fetchInProgress.current = true;
    if (!initialLoadCompleted.current) setCatalogLoading(true);
    try {
      const [licoresData, mesasData] = await Promise.all([
        fetchLicoresAPI(),
        fetchMesasAPI()
      ]);
      setLicores(Array.isArray(licoresData) ? licoresData : []);
      setMesas(Array.isArray(mesasData) ? mesasData : []);
      setCatalogError('');
      initialLoadCompleted.current = true;
      setCatalogLoading(false);
      return true;
    } catch (error) {
      console.error('Error conectando con el backend', error);
      setCatalogError(API_MISCONFIGURED
        ? 'El servidor de la tienda no está configurado (falta VITE_API_URL en el despliegue).'
        : error.message || 'No pudimos actualizar el catálogo. Revisa tu conexión e inténtalo nuevamente.');
      initialLoadCompleted.current = true;
      setCatalogLoading(false);
      return false;
    } finally {
      fetchInProgress.current = false;
    }
  }, []);

  useEffect(() => {
    let active = true;
    let supabaseClient;
    let channel;

    fetchAll();
    window.addEventListener('focus', fetchAll);
    const refreshTimer = window.setInterval(fetchAll, 30000);

    const setupRealtime = async () => {
      try {
        supabaseClient = await getSupabaseClient();
        if (!active) return;

        channel = supabaseClient
          .channel('schema-db-changes')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'licores' }, fetchAll)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'mesas' }, fetchAll)
          .subscribe(status => {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              console.error(`La suscripción en tiempo real de Supabase terminó con estado: ${status}.`);
            }
          });
      } catch (error) {
        console.error('No se pudo iniciar la sincronización en tiempo real de Supabase.', error);
      }
    };

    setupRealtime();

    return () => {
      active = false;
      window.removeEventListener('focus', fetchAll);
      window.clearInterval(refreshTimer);
      if (supabaseClient && channel) {
        supabaseClient.removeChannel(channel);
      }
    };
  }, [fetchAll]);

  return { licores, mesas, fetchAll, catalogLoading, catalogError };
}
