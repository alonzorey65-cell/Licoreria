import React, { useMemo, useState } from 'react';
import { AdminSectionHeader } from './AdminSectionHeader';
import { getSalesReport } from '../../utils/adminAnalytics';

function getLocalDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatCurrency(value, currency) {
  return new Intl.NumberFormat('es', { style: 'currency', currency }).format(value);
}

function downloadCsv(report, from, to) {
  const rows = [
    ['Fecha', 'Ventas', 'Ingresos'],
    ...report.days.map(day => [day.date, day.count, day.revenue.toFixed(2)])
  ];
  const content = `\uFEFF${rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')}`;
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `reporte_ventas_${from}_${to}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ReportsSection({ reservas, facturas, currency }) {
  const today = getLocalDateInput(new Date());
  const monthStart = new Date();
  monthStart.setDate(monthStart.getDate() - 29);
  const [from, setFrom] = useState(getLocalDateInput(monthStart));
  const [to, setTo] = useState(today);
  const report = useMemo(() => getSalesReport(reservas, facturas, from, to), [reservas, facturas, from, to]);

  return (
    <div className="panel-section admin-module">
      <AdminSectionHeader icon="📑" title="Reportes de ventas" description="Consulta ingresos por periodo y exporta el resultado diario." />
      <div className="admin-report-filters">
        <label>Desde<input type="date" value={from} max={to} onChange={event => setFrom(event.target.value)} /></label>
        <label>Hasta<input type="date" value={to} min={from} max={today} onChange={event => setTo(event.target.value)} /></label>
        <button type="button" className="admin-secondary-btn" onClick={() => downloadCsv(report, from, to)} disabled={!report.days.length}>
          Descargar CSV
        </button>
      </div>
      <div className="dashboard-grid admin-report-summary">
        <article className="dashboard-card dashboard-card-income">
          <span className="dashboard-card-label">Ingresos del periodo</span>
          <h2 className="dashboard-card-value">{formatCurrency(report.totalRevenue, currency)}</h2>
        </article>
        <article className="dashboard-card dashboard-card-total">
          <span className="dashboard-card-label">Ventas registradas</span>
          <h2 className="dashboard-card-value">{report.saleCount}</h2>
        </article>
        <article className="dashboard-card dashboard-card-tables">
          <span className="dashboard-card-label">Promedio por venta</span>
          <h2 className="dashboard-card-value">{formatCurrency(report.saleCount ? report.totalRevenue / report.saleCount : 0, currency)}</h2>
        </article>
      </div>
      <div className="table-responsive">
        <table className="table-pro admin-data-table">
          <thead><tr><th>Fecha</th><th>Ventas</th><th>Ingresos</th></tr></thead>
          <tbody>
            {report.days.map(day => (
              <tr key={day.date}>
                <td>{new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(`${day.date}T00:00:00`))}</td>
                <td>{day.count}</td>
                <td className="admin-amount">{formatCurrency(day.revenue, currency)}</td>
              </tr>
            ))}
            {!report.days.length && <tr><td colSpan="3"><div className="admin-empty-state">No hay ventas en el periodo seleccionado.</div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
