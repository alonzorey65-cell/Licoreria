import React, { useEffect, useState } from 'react';

export default function ClientTableAvailability({ mesas, selectedMesa, onSelectMesa, onContinueToOrder }) {
  const [qrTable, setQrTable] = useState(null);
  const [qrImage, setQrImage] = useState('');
  const [qrError, setQrError] = useState('');
  const availableCount = mesas.filter(mesa => mesa.status === 'Disponible').length;

  useEffect(() => {
    let active = true;
    if (!qrTable) {
      setQrImage('');
      setQrError('');
      return () => { active = false; };
    }

    const url = new URL(window.location.href);
    url.searchParams.set('mesa', qrTable.id);
    url.searchParams.delete('producto');
    url.hash = 'catalog';
    import('qrcode')
      .then(module => module.default.toDataURL(url.toString(), { width: 280, margin: 2, errorCorrectionLevel: 'M' }))
      .then(dataUrl => { if (active) { setQrImage(dataUrl); setQrError(''); } })
      .catch(error => {
        console.error('No se pudo generar el código QR de la mesa.', error);
        if (active) setQrError('No se pudo generar el QR. Intenta de nuevo.');
      });
    return () => { active = false; };
  }, [qrTable]);

  const selectTable = (mesa) => {
    if (mesa.status !== 'Disponible') return;
    onSelectMesa(String(mesa.id));
    onContinueToOrder?.();
  };

  return (
    <section className="client-panel-card client-table-availability" id="mesas-disponibles">
      <div className="client-panel-heading">
        <div>
          <p className="store-kicker">DISPONIBILIDAD EN VIVO</p>
          <h2>Elige tu mesa</h2>
        </div>
        <span className="client-panel-count">{availableCount} libres</span>
      </div>
      <div className="client-table-grid">
        {mesas.map(mesa => {
          const available = mesa.status === 'Disponible';
          const selected = String(mesa.id) === String(selectedMesa);
          return (
            <article className={`client-table-card ${available ? 'is-available' : 'is-occupied'} ${selected ? 'is-selected' : ''}`} key={mesa.id}>
              <div>
                <strong>{mesa.number}</strong>
                <span>{mesa.seats} personas</span>
              </div>
              <span className="client-table-status">{available ? 'Disponible' : 'Ocupada'}</span>
              {available && (
                <div className="client-table-actions">
                  <button type="button" onClick={() => selectTable(mesa)} aria-pressed={selected}>
                    {selected ? 'Continuar con esta mesa' : 'Elegir esta mesa'}
                  </button>
                  <button type="button" className="client-table-qr-button" onClick={() => setQrTable(mesa)}>Mostrar QR</button>
                </div>
              )}
            </article>
          );
        })}
        {mesas.length === 0 && <p className="client-panel-empty">No hay mesas registradas en este momento.</p>}
      </div>
      <p className="client-panel-note">La disponibilidad se actualiza con los datos del local.</p>
      {qrTable && (
        <div className="product-dialog-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setQrTable(null); }}>
          <section className="table-qr-dialog" role="dialog" aria-modal="true" aria-labelledby="table-qr-title">
            <button type="button" className="product-dialog-close" onClick={() => setQrTable(null)} aria-label="Cerrar código QR">×</button>
            <p className="store-kicker">MENÚ DIGITAL</p>
            <h2 id="table-qr-title">{/^mesa\b/i.test(String(qrTable.number)) ? qrTable.number : `Mesa ${qrTable.number}`}</h2>
            <p>Escanea para abrir la carta con esta mesa seleccionada.</p>
            {qrError ? <p className="product-review-error" role="alert">{qrError}</p>
              : qrImage ? <img src={qrImage} alt={`Código QR para abrir la carta en la mesa ${qrTable.number}`} />
                : <p role="status">Generando código QR…</p>}
            {qrImage && <a className="checkout-button table-qr-download" href={qrImage} download={`menu-mesa-${qrTable.number}.png`}>Descargar QR</a>}
          </section>
        </div>
      )}
    </section>
  );
}
