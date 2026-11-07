import React from 'react';
import AdminPage from '../pages/AdminPage';
import ClientPage from '../pages/ClientPage';

export default function AppRoutes({ licores, mesas, fetchAll, catalogLoading, catalogError }) {
  if (window.location.pathname === '/admin') {
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
