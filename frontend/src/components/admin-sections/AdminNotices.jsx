import React, { useEffect, useRef, useState } from 'react';
import { countNewAdminNotices, getAdminNoticeIds } from '../../utils/adminNoticeData';

export default function AdminNotices({ permissions, orders, helpRequests, products, onNavigate }) {
  const pendingOrders = orders.filter(order => order.status === 'Recibido').length;
  const pendingHelp = helpRequests.filter(request => request.status !== 'atendida').length;
  const lowStock = products.filter(product => Number(product.stock) <= 5).length;
  const [enabled, setEnabled] = useState(false);
  const [noticeError, setNoticeError] = useState('');
  const previous = useRef(null);
  const [orderIds, helpIds, stockIds] = getAdminNoticeIds(permissions, orders, helpRequests, products);

  useEffect(() => {
    const current = [orderIds, helpIds, stockIds].map(ids => new Set(ids ? ids.split(',') : []));
    if (enabled && previous.current && window.Notification?.permission === 'granted') {
      const labels = ['nuevos pedidos', 'nuevas solicitudes de ayuda', 'productos con stock bajo'];
      const changes = countNewAdminNotices(current, previous.current);
      const summary = changes.map((count, index) => count ? `${count} ${labels[index]}` : '').filter(Boolean);
      if (summary.length) {
        try {
          new window.Notification('Avisos del negocio', { body: summary.join(' · ') });
          setNoticeError('');
        } catch (error) {
          console.error('No se pudo mostrar el aviso del navegador.', error);
          setNoticeError('Este navegador no pudo mostrar el aviso. Revisa los avisos dentro del panel.');
        }
      }
    }
    previous.current = current;
  }, [orderIds, helpIds, stockIds, enabled]);

  const enableNotifications = async () => {
    try {
      if (!('Notification' in window)) {
        setNoticeError('Este navegador no admite notificaciones.');
        return;
      }
      const permission = await window.Notification.requestPermission();
      if (permission !== 'granted') {
        setNoticeError('No se concedió permiso para mostrar avisos en el navegador.');
        return;
      }
      setEnabled(true);
      setNoticeError('');
    } catch (error) {
      console.error('No se pudieron activar los avisos del navegador.', error);
      setNoticeError('No se pudieron activar los avisos del navegador.');
    }
  };
  const alerts = [
    permissions.reservas && pendingOrders > 0 && { id: 'reservas', label: `${pendingOrders} pedidos por atender` },
    permissions.ayuda && pendingHelp > 0 && { id: 'ayuda', label: `${pendingHelp} solicitudes de ayuda` },
    permissions.alertas && lowStock > 0 && { id: 'alertas', label: `${lowStock} productos con stock bajo` }
  ].filter(Boolean);

  return (
    <section className="admin-notices" aria-label="Avisos pendientes" aria-live="polite">
      <strong>Avisos pendientes</strong>
      {alerts.map(alert => (
        <button key={alert.id} type="button" className="admin-secondary-btn" onClick={() => onNavigate(alert.id)}>
          {alert.label} ↗
        </button>
      ))}
      {!alerts.length && <span>Los avisos de las secciones disponibles aparecen aquí.</span>}
      <button type="button" className="admin-secondary-btn" onClick={enabled ? () => setEnabled(false) : enableNotifications}>
        {enabled ? 'Desactivar avisos del navegador' : 'Activar avisos del navegador'}
      </button>
      {enabled && <small>Los avisos requieren que esta página permanezca abierta.</small>}
      {noticeError && <span role="alert">{noticeError}</span>}
    </section>
  );
}
