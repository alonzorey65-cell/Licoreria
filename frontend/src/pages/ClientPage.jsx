import React from 'react';
import ClientCatalog from '../components/ClientCatalog';
import MainLayout from '../templates/MainLayout';
import { defaultTheme } from '../themes/theme';

export default function ClientPage({ licores, mesas, fetchAll, catalogLoading, catalogError }) {
  return (
    <MainLayout theme={defaultTheme}>
      <ClientCatalog
        licores={licores}
        mesas={mesas}
        fetchAll={fetchAll}
        catalogLoading={catalogLoading}
        catalogError={catalogError}
      />
    </MainLayout>
  );
}