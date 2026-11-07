import React, { useEffect, useRef, useState } from 'react';
import { apiUrl } from '../../api/apiConfig';

export default function ClientReviewModal({ onClose, inline = false }) {
  const [cliente, setCliente] = useState('');
  const [puntuacion, setPuntuacion] = useState(5);
  const [comentario, setComentario] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dialogRef = useRef(null);

  useEffect(() => {
    if (inline) return undefined;
    dialogRef.current?.querySelector('input')?.focus();
    const handleKeyDown = event => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, inline]);

  const submitReview = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const response = await fetch(apiUrl('resenas'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cliente: cliente.trim(), puntuacion: parseInt(puntuacion, 10), comentario: comentario.trim(), fecha: new Date().toISOString() })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `La reseña no se pudo guardar (${response.status}).`);
      setFeedback({ type: 'success', message: 'Gracias por compartir tu experiencia. Recibimos tu reseña.' });
      setCliente('');
      setComentario('');
      setPuntuacion(5);
    } catch (error) {
      console.error('Error guardando la reseña.', error);
      setFeedback({ type: 'error', message: error.message || 'No pudimos enviar tu reseña. Inténtalo nuevamente.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={inline ? 'review-page' : 'review-overlay'} onMouseDown={event => { if (!inline && event.target === event.currentTarget) onClose(); }}>
      <section
        className={`review-dialog${inline ? ' is-inline' : ''}`}
        ref={dialogRef}
        role={inline ? undefined : 'dialog'}
        aria-modal={inline ? undefined : 'true'}
        aria-labelledby="review-title"
      >
        {!inline && <button className="review-close" type="button" onClick={onClose} aria-label="Cerrar">×</button>}
        <p className="store-kicker">NOS ENCANTA ESCUCHARTE</p>
        <h2 id="review-title">Cuéntanos qué tal</h2>
        <form onSubmit={submitReview}>
          <label><span>Tu nombre</span><input type="text" value={cliente} onChange={event => setCliente(event.target.value)} minLength="2" maxLength="80" required /></label>
          <label>
            <span>Tu calificación</span>
            <select value={puntuacion} onChange={event => setPuntuacion(event.target.value)}>
              <option value="5">★★★★★ · Excelente</option>
              <option value="4">★★★★ · Muy bueno</option>
              <option value="3">★★★ · Bueno</option>
              <option value="2">★★ · Regular</option>
              <option value="1">★ · Por mejorar</option>
            </select>
          </label>
          <label><span>Tu comentario</span><textarea value={comentario} onChange={event => setComentario(event.target.value)} minLength="3" maxLength="1000" required rows={4} /></label>
          {feedback && <p className={`review-feedback is-${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}>{feedback.message}</p>}
          <div className="review-actions">
            <button type="button" className="review-cancel" onClick={onClose}>Cancelar</button>
            <button type="submit" className="checkout-button" disabled={isSubmitting}>{isSubmitting ? 'Enviando…' : 'Enviar reseña'} <span aria-hidden="true">↗</span></button>
          </div>
        </form>
      </section>
    </div>
  );
}
