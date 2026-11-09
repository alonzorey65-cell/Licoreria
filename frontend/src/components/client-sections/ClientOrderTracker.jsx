import React, { useEffect, useRef, useState } from 'react';
import { formatDateTime } from '../../utils/formatters';
import { apiUrl } from '../../api/apiConfig';

const ORDER_NOTIFICATIONS_KEY = 'clientOrderNotifications';

function formatMesa(value) {
  const name = String(value || '—').trim();
  return /^mesa\b/i.test(name) ? name : `Mesa ${name}`;
}

export default function ClientOrderTracker({ activeOrder, accessToken }) {
  const [status, setStatus] = useState(activeOrder?.status || 'Recibido');
  const [trackingError, setTrackingError] = useState('');
  const [notificationError, setNotificationError] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    try {
      return localStorage.getItem(ORDER_NOTIFICATIONS_KEY) === 'true';
    } catch (error) {
      console.error('No se pudo recuperar la preferencia de notificaciones.', error);
      return false;
    }
  });
  const hasReceivedStatus = useRef(false);
  const lastKnownStatus = useRef(activeOrder?.status || 'Recibido');

  useEffect(() => {
    setStatus(activeOrder?.status || 'Recibido');
    setTrackingError('');
    hasReceivedStatus.current = false;
    lastKnownStatus.current = activeOrder?.status || 'Recibido';
    if (!activeOrder?.id || !activeOrder?.tracking_token) return undefined;

    let active = true;
    const refreshStatus = async () => {
      try {
        const url = `${apiUrl(`reservas/${encodeURIComponent(activeOrder.id)}/estado`)}?token=${encodeURIComponent(activeOrder.tracking_token)}`;
        const response = await fetch(url, {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `No se pudo consultar el pedido (${response.status}).`);
        if (active) {
          const nextStatus = result.status || 'Recibido';
          if (hasReceivedStatus.current && nextStatus !== lastKnownStatus.current && notificationsEnabled && window.Notification?.permission === 'granted') {
            try {
              new window.Notification(`Tu pedido está ${nextStatus.toLowerCase()}`, {
                body: `Pedido #${activeOrder.id} · ${formatMesa(activeOrder.mesaNumber)}`
              });
              setNotificationError('');
            } catch (notificationFailure) {
              console.error('No se pudo mostrar la notificación del pedido.', notificationFailure);
              setNotificationError('No se pudo mostrar el aviso del navegador. Puedes consultar el estado aquí.');
            }
          }
          hasReceivedStatus.current = true;
          lastKnownStatus.current = nextStatus;
          setStatus(nextStatus);
          setTrackingError('');
        }
      } catch (error) {
        console.error('No se pudo actualizar el seguimiento del pedido.', error);
        if (active) setTrackingError('No pudimos actualizar el estado. Volveremos a intentarlo.');
      }
    };

    refreshStatus();
    const timer = window.setInterval(refreshStatus, 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [activeOrder?.id, activeOrder?.tracking_token, activeOrder?.status, activeOrder?.mesaNumber, notificationsEnabled, accessToken]);

  if (!activeOrder) return null;
  const progress = ['Recibido', 'En preparación', 'Listo', 'Entregado'];
  const currentStep = progress.indexOf(status);
  const canceled = status === 'Cancelado';
  const notificationAvailable = typeof window !== 'undefined' && 'Notification' in window;

  const toggleNotifications = async () => {
    try {
      if (!notificationAvailable) return;
      if (notificationsEnabled) {
        setNotificationsEnabled(false);
        localStorage.setItem(ORDER_NOTIFICATIONS_KEY, 'false');
        return;
      }
      const permission = window.Notification.permission === 'granted'
        ? 'granted'
        : await window.Notification.requestPermission();
      if (permission !== 'granted') {
        setTrackingError(permission === 'denied'
          ? 'Las notificaciones están bloqueadas en los ajustes de tu navegador.'
          : 'No se concedió permiso para enviar notificaciones.');
        return;
      }
      setNotificationsEnabled(true);
      localStorage.setItem(ORDER_NOTIFICATIONS_KEY, 'true');
      setTrackingError('');
      setNotificationError('');
    } catch (error) {
      console.error('No se pudo configurar las notificaciones del pedido.', error);
      setTrackingError('No se pudieron activar las notificaciones en este navegador.');
    }
  };

  return (
    <section className={`order-tracker${canceled ? ' is-canceled' : ''}`} role="status" aria-live="polite">
      <p className="store-kicker">SEGUIMIENTO DEL PEDIDO</p>
      <h3>{canceled ? 'Pedido cancelado' : `Pedido ${status.toLowerCase()}`}</h3>
      <p><strong>{activeOrder.clientName}</strong> · {activeOrder.fulfillmentMode === 'pickup' ? 'Recoger en el local' : formatMesa(activeOrder.mesaNumber)}</p>
      {activeOrder.id && <p className="order-reference">Referencia #{activeOrder.id}</p>}
      <small>Registrada: {formatDateTime(activeOrder.date)}</small>
      {!activeOrder.tracking_token ? (
        <p className="order-tracker-note">El seguimiento en vivo está disponible para pedidos nuevos.</p>
      ) : (
        <>
          <ol className={`order-progress${canceled ? ' is-canceled' : ''}`} aria-label="Progreso del pedido">
            {progress.map((step, index) => (
              <li className={index <= currentStep && !canceled ? 'is-complete' : ''} key={step}>{step}</li>
            ))}
          </ol>
          {notificationAvailable && (
            <button type="button" className="order-notification-toggle" onClick={toggleNotifications} aria-pressed={notificationsEnabled}>
              {notificationsEnabled ? 'Desactivar avisos' : 'Avisarme cuando cambie'}
            </button>
          )}
        </>
      )}
      {trackingError && <small className="order-tracker-error" role="status">{trackingError}</small>}
      {notificationError && <small className="order-tracker-error" role="status">{notificationError}</small>}
      {notificationsEnabled && <small className="order-tracker-note">Los avisos requieren que esta página permanezca abierta.</small>}
    </section>
  );
}
