import React from 'react';
import '../styles/Tables.css';

export default function TableReservations({ mesas }) {
  return (
    <div>
      <h2>Estado de Mesas en Tiempo Real</h2>
      <p style={{color: 'var(--text-muted)'}}>Visualiza qué mesas están listas para recibir clientes o cuáles están ocupadas.</p>
      
      <div className="tables-grid">
        {mesas.map(m => (
          <div key={m.id} className={`table-box ${m.status.toLowerCase()}`}>
            <h3>{m.number}</h3>
            <p>Capacidad: {m.seats} personas</p>
            <span style={{marginTop: '10px', display: 'inline-block'}}>
              <span className="status-dot"></span>
              <strong>{m.status}</strong>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}