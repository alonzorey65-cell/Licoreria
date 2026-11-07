import React from 'react';
import AdminCharts from './AdminCharts';
import { AdminSectionHeader } from './AdminSectionHeader';

export default function AnaliticaSection({ licores, reservas, facturas }) {
  return (
    <div className="panel-section admin-module">
      <AdminSectionHeader icon="📈" title="Analítica del negocio" description="Gráficos de ventas, inventario y productos más pedidos." />
      <p className="analytics-description">Los gráficos se actualizan con los cambios recibidos desde Supabase.</p>
      <AdminCharts licores={licores} reservas={reservas} facturas={facturas} />
    </div>
  );
}
