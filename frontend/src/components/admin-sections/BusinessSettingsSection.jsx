import React, { useState } from 'react';
import { AdminSectionHeader } from './AdminSectionHeader';

export default function BusinessSettingsSection({ settings, adminTheme, onSave, onThemeChange }) {
  const [form, setForm] = useState(settings);
  const [saved, setSaved] = useState(false);

  const updateField = (field, value) => {
    setSaved(false);
    setForm(current => ({ ...current, [field]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setSaved(onSave({ ...form, theme: adminTheme }));
  };

  return (
    <div className="panel-section admin-module">
      <AdminSectionHeader icon="⚙️" title="Configuración del negocio" description="Personaliza los datos visibles del local, horarios, moneda y apariencia." />
      <form className="form-grid-pro admin-crud-form admin-settings-form" onSubmit={handleSubmit}>
        <label>
          Nombre del negocio
          <input
            value={form.businessName}
            onChange={event => updateField('businessName', event.target.value)}
            maxLength="80"
            required
          />
        </label>
        <label>
          Horario de atención
          <input
            value={form.openingHours}
            onChange={event => updateField('openingHours', event.target.value)}
            maxLength="120"
            placeholder="Ej. Lun–Dom, 16:00–02:00"
            required
          />
        </label>
        <label>
          Dirección del local
          <input value={form.address || ''} onChange={event => updateField('address', event.target.value)} maxLength="200" placeholder="Dirección visible para tus clientes" />
        </label>
        <label>
          Teléfono o WhatsApp
          <input type="tel" value={form.phone || ''} onChange={event => updateField('phone', event.target.value)} maxLength="40" placeholder="+52 55 1234 5678" />
        </label>
        <label>
          Enlace de ubicación
          <input type="url" value={form.mapUrl || ''} onChange={event => updateField('mapUrl', event.target.value)} maxLength="500" placeholder="https://maps.google.com/..." />
        </label>
        <label>
          Moneda para reportes
          <select value={form.currency} onChange={event => updateField('currency', event.target.value)}>
            <option value="USD">Dólar estadounidense (USD)</option>
            <option value="MXN">Peso mexicano (MXN)</option>
            <option value="COP">Peso colombiano (COP)</option>
            <option value="PEN">Sol peruano (PEN)</option>
            <option value="EUR">Euro (EUR)</option>
          </select>
        </label>
        <label>
          Tema del panel
          <select value={adminTheme} onChange={event => onThemeChange(event.target.value)}>
            <option value="glass">Aurora</option>
            <option value="wine">Vino</option>
            <option value="light">Claro</option>
          </select>
        </label>
        <div className="admin-form-actions">
          <button type="submit" className="btn-neon">Guardar configuración</button>
          {saved && <span className="admin-settings-saved" role="status">Configuración guardada.</span>}
        </div>
      </form>
      <p className="admin-settings-note">Estas preferencias se guardan en este navegador y no sincronizan con otros dispositivos.</p>
    </div>
  );
}
