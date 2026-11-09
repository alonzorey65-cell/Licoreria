import React from 'react';
import AppRoutes from './routes/AppRoutes';
import { useCatalogData } from './hooks/useCatalogData';
import { BusinessSettingsProvider } from './hooks/BusinessSettingsContext';

export default function App() {
  const { licores, mesas, fetchAll, catalogLoading, catalogError } = useCatalogData();

  return (
    <BusinessSettingsProvider><AppRoutes
      licores={licores}
      mesas={mesas}
      fetchAll={fetchAll}
      catalogLoading={catalogLoading}
      catalogError={catalogError}
    /></BusinessSettingsProvider>
  );
}