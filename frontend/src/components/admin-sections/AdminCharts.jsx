import React, { useState } from 'react';
import { getCategoryStock, getSalesSummary, getTopProducts } from '../../utils/adminAnalytics';

function RevenueChart({ series, days }) {
  const width = 760;
  const height = 220;
  const padding = { top: 16, right: 12, bottom: 34, left: 48 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const hasRevenue = series.some(point => point.revenue > 0);
  const maxValue = hasRevenue ? Math.max(...series.map(point => point.revenue)) : 1;
  const points = series.map((point, index) => ({
    ...point,
    x: padding.left + (series.length === 1 ? chartWidth / 2 : (index * chartWidth) / (series.length - 1)),
    y: padding.top + chartHeight - (point.revenue / maxValue) * chartHeight
  }));
  const line = points.map(point => `${point.x},${point.y}`).join(' ');
  const area = `${padding.left},${padding.top + chartHeight} ${line} ${padding.left + chartWidth},${padding.top + chartHeight}`;
  const ticks = hasRevenue ? [0, maxValue / 2, maxValue] : [0];
  const currency = value => `$${Number.isInteger(value) ? Math.round(value) : value.toFixed(1)}`;

  return (
    <div className="admin-chart-frame">
      <svg className="revenue-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Ingresos de los últimos ${days} días`}>
        <defs>
          <linearGradient id="revenue-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#50e3c2" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#50e3c2" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="revenue-line" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#50e3c2" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
        </defs>
        {ticks.map((tick, index) => {
          const y = padding.top + chartHeight - (tick / maxValue) * chartHeight;
          return (
            <g key={index}>
              <line x1={padding.left} x2={padding.left + chartWidth} y1={y} y2={y} className="chart-grid-line" />
              <text x={padding.left - 10} y={y + 4} textAnchor="end" className="chart-axis-label">{currency(tick)}</text>
            </g>
          );
        })}
        <polygon points={area} fill="url(#revenue-area)" />
        <polyline points={line} fill="none" stroke="url(#revenue-line)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {points.map(point => (
          <g key={point.key}>
            <circle
              cx={point.x}
              cy={point.y}
              r="4"
              className="chart-point"
              tabIndex="0"
              aria-label={`${point.label}: $${point.revenue.toFixed(2)}, ${point.count} ventas`}
            >
              <title>{`${point.label}: $${point.revenue.toFixed(2)} · ${point.count} ventas`}</title>
            </circle>
            {(days <= 14 || point.key === series[0].key || point.key === series[series.length - 1].key || index % 5 === 0) && (
              <text x={point.x} y={height - 8} textAnchor="middle" className="chart-axis-label">{point.label}</text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

function InventoryChart({ products }) {
  const categories = getCategoryStock(products).slice(0, 8);
  const maxStock = Math.max(1, ...categories.map(category => category.stock));
  if (categories.length === 0) return <p className="chart-empty">Agrega productos para visualizar el inventario.</p>;

  return (
    <div className="inventory-chart">
      {categories.map(category => (
        <div className="inventory-chart-row" key={category.name}>
          <div className="inventory-chart-label"><span>{category.name}</span><strong>{category.stock}</strong></div>
          <div className="inventory-chart-track"><span style={{ width: `${(category.stock / maxStock) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

function TopProductsChart({ products, metric, onMetricChange }) {
  const sortedProducts = [...products].sort((left, right) => right[metric] - left[metric]).slice(0, 8);
  const maxValue = Math.max(1, ...sortedProducts.map(product => product[metric]));
  const formatValue = product => metric === 'revenue'
    ? `$${product.revenue.toFixed(2)}`
    : `${product.quantity} u.`;

  if (products.length === 0) return <p className="chart-empty">Aún no hay pedidos con productos.</p>;

  return (
    <>
      <div className="chart-toggle" role="group" aria-label="Métrica de productos más pedidos">
        <button type="button" className={metric === 'quantity' ? 'is-active' : ''} aria-pressed={metric === 'quantity'} onClick={() => onMetricChange('quantity')}>Unidades</button>
        <button type="button" className={metric === 'revenue' ? 'is-active' : ''} aria-pressed={metric === 'revenue'} onClick={() => onMetricChange('revenue')}>Ingresos</button>
      </div>
      <ol className="top-products-list top-products-chart">
        {sortedProducts.map((product, index) => (
          <li key={product.name} title={`${product.name}: ${formatValue(product)}`}>
            <span className="top-product-rank">{String(index + 1).padStart(2, '0')}</span>
            <div className="top-product-details">
              <div className="top-product-heading">
                <span className="top-product-name">{product.name}</span>
                <strong>{formatValue(product)}</strong>
              </div>
              <div className="inventory-chart-track">
                <span style={{ width: `${(product[metric] / maxValue) * 100}%` }} />
              </div>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}

export default function AdminCharts({ licores, reservas, facturas, compact = false }) {
  const [period, setPeriod] = useState(7);
  const [productMetric, setProductMetric] = useState('quantity');
  const { series, periodRevenue, saleCount } = getSalesSummary(reservas, facturas, period);
  const topProducts = getTopProducts(reservas);

  return (
    <section className={`admin-charts ${compact ? 'is-compact' : ''}`}>
      <div className="chart-panel revenue-panel">
        <div className="chart-panel-heading">
          <div>
            <p className="chart-eyebrow">MOVIMIENTO RECIENTE</p>
            <h3>Ingresos por día</h3>
            <span className="chart-period">{saleCount} ventas · ${periodRevenue.toFixed(2)} en el periodo</span>
          </div>
          <div className="chart-toggle chart-period-toggle" role="group" aria-label="Periodo del gráfico de ventas">
            {[7, 14, 30].map(days => (
              <button
                type="button"
                key={days}
                className={period === days ? 'is-active' : ''}
                aria-pressed={period === days}
                onClick={() => setPeriod(days)}
              >
                {days} días
              </button>
            ))}
          </div>
        </div>
        <RevenueChart series={series} days={period} />
        {saleCount === 0 && <p className="chart-empty">Todavía no hay ventas registradas en este periodo.</p>}
      </div>

      <div className="chart-side">
        <div className="chart-panel">
          <div className="chart-panel-heading">
            <div>
              <p className="chart-eyebrow">EXISTENCIAS</p>
              <h3>Stock por categoría</h3>
            </div>
          </div>
          <InventoryChart products={licores} />
        </div>
        <div className="chart-panel top-products-panel">
          <div className="chart-panel-heading">
            <div>
              <p className="chart-eyebrow">PEDIDOS</p>
              <h3>Productos estrella</h3>
            </div>
          </div>
          <TopProductsChart products={topProducts} metric={productMetric} onMetricChange={setProductMetric} />
        </div>
      </div>
    </section>
  );
}
