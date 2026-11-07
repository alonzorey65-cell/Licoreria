import React from 'react';
import AdminPage from '../pages/AdminPage';
import ClientPage from '../pages/ClientPage';

export default function AppRoutes({ licores, mesas, fetchAll, catalogLoading, catalogError }) {
  // Usamos .endsWith('/admin') para que detecte la ruta sin importar si lleva /Licoreria/ adelante
  if (window.location.pathname.endsWith('/admin')) {
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