import React from 'react';

export default function TicketModal({ factura, onClose }) {
  if (!factura) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 text-slate-100 p-6 rounded-3xl max-w-sm w-full shadow-2xl space-y-6">
        
        {/* Encabezado del Ticket */}
        <div className="text-center border-b border-slate-800 pb-4">
          <h2 className="text-xl font-black tracking-widest text-cyan-400">VIP BAR & LICORERÍA</h2>
          <p className="text-xs text-slate-400 mt-1">RUC: 20601234567 | Av. Cyberpunk 777</p>
          <p className="text-xs text-slate-500 mt-0.5">{factura.fecha}</p>
        </div>

        {/* Datos del Cliente y Mesa */}
        <div className="space-y-1 text-sm border-b border-slate-800 pb-4">
          <div className="flex justify-between"><span className="text-slate-400">Cliente:</span><span className="font-bold">{factura.cliente}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Ubicación:</span><span className="font-bold">{factura.mesa}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Método de Pago:</span><span className="font-bold text-purple-400">{factura.metodo_pago}</span></div>
        </div>

        {/* Total */}
        <div className="flex justify-between items-center text-lg font-black pt-2">
          <span>TOTAL PAGADO:</span>
          <span className="text-emerald-400 text-2xl">${factura.total}</span>
        </div>

        <p className="text-center text-xs text-slate-500 italic">¡Gracias por tu consumo! Disfruta la noche con responsabilidad.</p>

        {/* Botones de Acción */}
        <div className="flex gap-3 pt-2">
          <button onClick={() => window.print()} className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)]">
            🖨️ Imprimir Ticket
          </button>
          <button onClick={onClose} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 rounded-xl transition-all">
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}