import React from 'react';
import AdminPage from '../pages/AdminPage';
import ClientPage from '../pages/ClientPage';

export default function AppRoutes({ licores, mesas, fetchAll, catalogLoading, catalogError }) {
  // Verificamos si la URL incluye ?page=admin
  const searchParams = new URLSearchParams(window.location.search);
  const isAdmin = searchParams.get('page') === 'admin' || window.location.pathname.endsWith('/admin');

  if (isAdmin) {
    return <AdminPage licores={licores} mesas={mesas} fetchAll={fetchAll} />;
  }

  return (
    <ClientPage
      licores={licores}
      mesas={mesas}
      fetchAll={fetchAll}
      catalogLoading={catalogLoading}
      catalogError={catalogError}
    />
  );
}