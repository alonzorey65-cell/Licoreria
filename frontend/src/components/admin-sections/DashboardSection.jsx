import React from 'react';
import AdminCharts from './AdminCharts';
import { AdminSectionHeader } from './AdminSectionHeader';

export default function DashboardSection({ ingresosHoy, totalIngresos, stockCritico, mesasOcupadas, mesasDisponibles, licores, reservas, facturas, currency = 'USD' }) {
  const money = value => new Intl.NumberFormat('es', { style: 'currency', currency }).format(Number(value) || 0);
  return (
    <div className="panel-section admin-module">
      <AdminSectionHeader icon="📊" title="Resumen operativo" description="Indicadores clave e información reciente de tu negocio." />
      <div className="dashboard-grid">
        <article className="dashboard-card dashboard-card-income">
          <span className="dashboard-card-label">💵 Generado hoy</span>
          <h2 className="dashboard-card-value">{money(ingresosHoy)}</h2>
        </article>
        <article className="dashboard-card dashboard-card-total">
          <span className="dashboard-card-label">💰 Ingresos totales</span>
          <h2 className="dashboard-card-value">{money(totalIngresos)}</h2>
        </article>
        <article className={`dashboard-card ${stockCritico > 0 ? 'dashboard-card-warning' : 'dashboard-card-income'}`}>
          <span className="dashboard-card-label">⚠️ Stock crítico</span>
          <h2 className="dashboard-card-value">{stockCritico} <span>productos</span></h2>
        </article>
        <article className="dashboard-card dashboard-card-tables">
          <span className="dashboard-card-label">🪑 Mesas ocupadas</span>
          <h2 className="dashboard-card-value">{mesasOcupadas}</h2>
          <span className="dashboard-card-meta">{mesasDisponibles} disponibles</span>
        </article>
      </div>
      <AdminCharts licores={licores} reservas={reservas} facturas={facturas} compact />
    </div>
  );
}