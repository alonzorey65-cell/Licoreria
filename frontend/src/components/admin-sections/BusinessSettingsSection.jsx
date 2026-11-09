import React, { useEffect, useState } from 'react';
import { AdminSectionHeader } from './AdminSectionHeader';

export default function BusinessSettingsSection({ settings, settingsLoaded, settingsError, onRefresh, adminTheme, onSave, onThemeChange, onSaveLogo, onRemoveLogo }) {
  const [form, setForm] = useState(settings);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [logoInputKey, setLogoInputKey] = useState(0);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoFeedback, setLogoFeedback] = useState(null);

  useEffect(() => {
    if (!dirty) setForm(settings);
  }, [settings, dirty]);

  const updateField = (field, value) => {
    setSaved(false);
    setDirty(true);
    setForm(current => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const success = await onSave(form);
      setSaved(success);
      if (success) setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  const handleLogo = async remove => {
    if (!remove && !logoFile) return;
    if (!remove && (!['image/jpeg', 'image/png', 'image/webp'].includes(logoFile.type) || logoFile.size > 5 * 1024 * 1024)) {
      setLogoFeedback({ type: 'error', message: 'Elige una imagen JPG, PNG o WebP de hasta 5 MB.' });
      return;
    }
    setLogoBusy(true);
    setLogoFeedback(null);
    try {
      if (remove) await onRemoveLogo();
      else await onSaveLogo(logoFile);
      setLogoFile(null);
      setLogoInputKey(current => current + 1);
      setLogoFeedback({ type: 'success', message: remove ? 'Logo quitado para todos los clientes.' : 'Logo guardado para todos los clientes.' });
    } catch (error) {
      console.error('No se pudo actualizar el logo del negocio.', error);
      setLogoFeedback({ type: 'error', message: error.message || 'No se pudo actualizar el logo.' });
    } finally {
      setLogoBusy(false);
    }
  };

  return (
    <div className="panel-section admin-module">
      <AdminSectionHeader icon="⚙️" title="Configuración del negocio" description="Personaliza los datos visibles del local, horarios, moneda y apariencia." />
      {settingsError && <p className="admin-form-error" role="alert">{settingsError} <button type="button" className="admin-secondary-btn" onClick={onRefresh}>Reintentar</button></p>}
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
          Moneda predeterminada del negocio
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
          <button type="submit" className="btn-neon" disabled={!settingsLoaded || Boolean(settingsError) || saving}>{saving ? 'Guardando…' : 'Guardar configuración'}</button>
          {saved && <span className="admin-settings-saved" role="status">Configuración guardada.</span>}
        </div>
      </form>
      <section className="admin-business-logo" aria-labelledby="admin-business-logo-title">
        <h3 id="admin-business-logo-title">Logo de la licorería</h3>
        <p>Visible para todos los clientes. Formatos JPG, PNG o WebP, hasta 5 MB.</p>
        {settings.logoUrl && <img className="admin-business-logo-preview" src={settings.logoUrl} alt="Logo actual del negocio" onError={() => setLogoFeedback({ type: 'error', message: 'No se pudo cargar el logo actual. Revisa la conexión o vuelve a subirlo.' })} />}
        <label>Seleccionar imagen
          <input key={logoInputKey} type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { setLogoFile(event.target.files?.[0] || null); setLogoFeedback(null); }} />
        </label>
        <div className="admin-form-actions">
          <button type="button" className="btn-neon" disabled={!settingsLoaded || Boolean(settingsError) || !logoFile || logoBusy} onClick={() => handleLogo(false)}>{logoBusy ? 'Guardando…' : 'Guardar logo'}</button>
          {settings.logoUrl && <button type="button" className="admin-secondary-btn" disabled={logoBusy || Boolean(settingsError)} onClick={() => handleLogo(true)}>Quitar logo</button>}
        </div>
        {logoFeedback && <p className={logoFeedback.type === 'error' ? 'admin-form-error' : 'admin-settings-saved'} role={logoFeedback.type === 'error' ? 'alert' : 'status'}>{logoFeedback.message}</p>}
      </section>
      <p className="admin-settings-note">Los datos del negocio se comparten entre dispositivos. Cambiar la moneda no convierte los importes. El tema es una preferencia de este navegador.</p>
    </div>
  );
}
