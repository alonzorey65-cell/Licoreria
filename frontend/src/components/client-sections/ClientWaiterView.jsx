import React, { useEffect, useState } from 'react';
import { apiUrl } from '../../api/apiConfig';

export default function ClientWaiterView({ selectedMesa, mesas, clientName, activeOrder, expanded = false }) {
  const [showInstructions, setShowInstructions] = useState(expanded);
  const [name, setName] = useState(clientName || activeOrder?.clientName || '');
  const [mesaId, setMesaId] = useState('');
  const [message, setMessage] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const tableIdFromOrder = mesas.find(mesa => String(mesa.number) === String(activeOrder?.mesaNumber))?.id;

  useEffect(() => {
    setName(clientName || activeOrder?.clientName || '');
  }, [clientName, activeOrder?.clientName]);

  useEffect(() => {
    setMesaId(selectedMesa || (tableIdFromOrder ? String(tableIdFromOrder) : ''));
  }, [selectedMesa, tableIdFromOrder]);

  const handleSubmit = async event => {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setFeedback(null);
    try {
      const response = await fetch(apiUrl('solicitudes-ayuda'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientName: name.trim(), mesaId: mesaId || null, message: message.trim() })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `No se pudo enviar el aviso (${response.status}).`);

      setMessage('');
      setFeedback({ type: 'success', text: 'Tu solicitud fue registrada para que el personal pueda atenderla.' });
    } catch (error) {
      console.error('No se pudo enviar la solicitud de ayuda.', error);
      setFeedback({ type: 'error', text: error.message || 'No pudimos enviar el aviso. Inténtalo nuevamente.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="waiter-help">
      {!expanded && (
        <button className="waiter-button" type="button" aria-expanded={showInstructions} onClick={() => setShowInstructions(current => !current)}>
          <span aria-hidden="true">♧</span>
          {showInstructions ? 'Cerrar solicitud' : '¿Necesitas ayuda?'}
        </button>
      )}
      {showInstructions && (
        <form className="waiter-help-form" onSubmit={handleSubmit}>
          <label>
            <span>Tu nombre</span>
            <input value={name} onChange={event => setName(event.target.value)} minLength="2" maxLength="100" required />
          </label>
          <label>
            <span>Mesa (opcional)</span>
            <select value={mesaId} onChange={event => setMesaId(event.target.value)}>
              <option value="">No indicar mesa</option>
              {mesas.map(mesa => <option key={mesa.id} value={mesa.id}>{mesa.number}</option>)}
            </select>
          </label>
          <label>
            <span>¿En qué podemos ayudarte?</span>
            <textarea value={message} onChange={event => setMessage(event.target.value)} minLength="5" maxLength="500" rows="3" required />
          </label>
          {feedback && <p className={`waiter-feedback is-${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}>{feedback.text}</p>}
          <button className="checkout-button waiter-submit" type="submit" disabled={isSubmitting || name.trim().length < 2 || message.trim().length < 5}>
            {isSubmitting ? 'Enviando aviso…' : 'Avisar al personal'}
          </button>
        </form>
      )}
    </section>
  );
}
