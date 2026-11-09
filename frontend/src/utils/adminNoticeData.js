export function getAdminNoticeIds(permissions, orders, helpRequests, products) {
  return [
    permissions.reservas ? orders.filter(item => item.status === 'Recibido').map(item => String(item.id)).sort().join(',') : '',
    permissions.ayuda ? helpRequests.filter(item => item.status !== 'atendida').map(item => String(item.id)).sort().join(',') : '',
    permissions.alertas ? products.filter(item => Number(item.stock) <= 5).map(item => String(item.id)).sort().join(',') : ''
  ];
}

export function countNewAdminNotices(current, previous) {
  return current.map((ids, index) => [...ids].filter(id => !previous[index].has(id)).length);
}
