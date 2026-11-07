import React from 'react';
import AppRoutes from './routes/AppRoutes';
import { useCatalogData } from './hooks/useCatalogData';

export default function App() {
  const { licores, mesas, fetchAll, catalogLoading, catalogError } = useCatalogData();

  return (
    <AppRoutes
      licores={licores}
      mesas={mesas}
      fetchAll={fetchAll}
      catalogLoading={catalogLoading}
      catalogError={catalogError}
    />
  );
}