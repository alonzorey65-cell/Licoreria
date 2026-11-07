import React, { useMemo, useState } from 'react';
import { formatDateTime } from '../../utils/formatters';
import { AdminSectionHeader } from './AdminSectionHeader';
import { getCustomerSummary } from '../../utils/adminAnalytics';

function formatCurrency(value, currency) {
  return new Intl.NumberFormat('es', { style: 'currency', currency }).format(value);
}

export default function CustomersSection({ reservas, facturas, currency, profiles = [], profilesError = '' }) {
  const [search, setSearch] = useState('');
  const [expandedCustomer, setExpandedCustomer] = useState(null);
  const customers = useMemo(
    () => getCustomerSummary(reservas, facturas).filter(customer => customer.name.toLowerCase().includes(search.trim().toLowerCase())),
    [reservas, facturas, search]
  );
  const visibleProfiles = useMemo(
    () => profiles.filter(profile => `${profile.displayName} ${profile.email}`.toLowerCase().includes(search.trim().toLowerCase())),
    [profiles, search]
  );

  return (
    <div className="panel-section admin-module">
      <AdminSectionHeader icon="🧑‍🤝‍🧑" title="Clientes" description="Consulta clientes recurrentes y su historial de compras registrado." count={customers.length} countLabel="clientes" />
      <div className="admin-module-toolbar">
        <p>La lista se construye a partir del nombre de cliente en ventas y facturas.</p>
        <input
          className="admin-customer-search"
          type="search"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Buscar cliente"
          aria-label="Buscar cliente"
        />
      </div>
      <h3 className="admin-customer-profiles-title">Perfiles de clientes con cuenta</h3>
      {profilesError && <p className="admin-form-error" role="alert">No se cargaron los perfiles. Verifica que aplicaste la migración de perfiles de cliente y reinicia el backend. {profilesError}</p>}
      <div className="table-responsive">
        <table className="table-pro admin-data-table">
          <thead><tr><th>Perfil</th><th>Correo</th><th>Pedidos asociados</th></tr></thead>
          <tbody>
            {visibleProfiles.map(profile => (
              <tr key={profile.userId}>
                <td><div className="admin-customer-identity">
                  {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" loading="lazy" /> : <span aria-hidden="true">{profile.displayName.charAt(0).toUpperCase()}</span>}
                  <strong>{profile.displayName}</strong>
                </div></td>
                <td>{profile.email || '—'}</td>
                <td>{profile.orderCount}</td>
              </tr>
            ))}
            {!visibleProfiles.length && <tr><td colSpan="3"><div className="admin-empty-state">{profiles.length ? 'No hay perfiles que coincidan con la búsqueda.' : 'Los perfiles aparecerán cuando haya pedidos asociados a cuentas de cliente.'}</div></td></tr>}
          </tbody>
        </table>
      </div>
      <div className="table-responsive">
        <table className="table-pro admin-data-table">
          <thead><tr><th>Cliente</th><th>Pedidos</th><th>Facturas</th><th>Total registrado</th><th>Última compra</th><th>Detalle</th></tr></thead>
          <tbody>
            {customers.map(customer => (
              <React.Fragment key={customer.key}>
                <tr>
                  <td><strong>{customer.name}</strong></td>
                  <td>{customer.orderCount}</td>
                  <td>{customer.invoiceCount}</td>
                  <td className="admin-amount">{formatCurrency(customer.total, currency)}</td>
                  <td>{formatDateTime(customer.lastPurchase)}</td>
                  <td>
                    <button
                      type="button"
                      className="admin-action-btn is-edit"
                      aria-expanded={expandedCustomer === customer.key}
                      onClick={() => setExpandedCustomer(current => current === customer.key ? null : customer.key)}
                    >
                      {expandedCustomer === customer.key ? 'Ocultar' : 'Ver historial'}
                    </button>
                  </td>
                </tr>
                {expandedCustomer === customer.key && (
                  <tr className="admin-customer-history-row">
                    <td colSpan="6">
                      <div className="admin-customer-history">
                        {customer.purchases.map(purchase => (
                          <article key={purchase.id}>
                            <strong>{purchase.type} · {formatDateTime(purchase.date)}</strong>
                            <span>{purchase.description}</span>
                            <b>{formatCurrency(purchase.total, currency)}</b>
                          </article>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {!customers.length && <tr><td colSpan="6"><div className="admin-empty-state">{search ? 'No se encontraron clientes con ese nombre.' : 'Todavía no hay clientes registrados.'}</div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
