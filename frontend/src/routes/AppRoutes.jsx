import React from 'react';
import AdminPage from '../pages/AdminPage';
import ClientPage from '../pages/ClientPage';

export default function AppRoutes({ licores, mesas, fetchAll, catalogLoading, catalogError }) {
  const searchParams = new URLSearchParams(window.location.search);
  const normalizedPath = window.location.pathname.replace(/\/+$/, '');
  const isAdmin = searchParams.get('page') === 'admin' ||
                  normalizedPath === '/admin' ||
                  normalizedPath.endsWith('/admin');

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
