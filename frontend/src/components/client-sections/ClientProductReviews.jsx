import React, { useEffect, useState } from 'react';
import { apiUrl } from '../../api/apiConfig';

export default function ClientProductReviews({ product, initialName = '' }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState(initialName);
  const [rating, setRating] = useState('5');
  const [comment, setComment] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => setName(initialName), [initialName]);

  useEffect(() => {
    let active = true;
    fetch(apiUrl(`licores/${encodeURIComponent(product.id)}/resenas`))
      .then(async response => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `No se pudieron cargar las reseñas (${response.status}).`);
        if (!Array.isArray(result)) throw new Error('La respuesta de reseñas no tiene el formato esperado.');
        return result;
      })
      .then(data => { if (active) { setReviews(data); setError(''); } })
      .catch(loadError => {
        console.error('No se pudieron cargar las reseñas del producto.', loadError);
        if (active) setError(loadError.message);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [product.id]);

  const submitReview = async event => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const response = await fetch(apiUrl('resenas'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente: name.trim(),
          puntuacion: Number(rating),
          comentario: comment.trim(),
          fecha: new Date().toISOString(),
          licor_id: product.id
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `No se pudo enviar la reseña (${response.status}).`);
      setReviews(current => [result, ...current]);
      setComment('');
      setFeedback({ type: 'success', message: 'Gracias, tu opinión quedó registrada.' });
    } catch (submitError) {
      console.error('No se pudo guardar la reseña del producto.', submitError);
      setFeedback({ type: 'error', message: submitError.message || 'No pudimos enviar tu reseña.' });
    } finally {
      setSubmitting(false);
    }
  };

  const average = reviews.length
    ? reviews.reduce((total, review) => total + Number(review.puntuacion || 0), 0) / reviews.length
    : 0;

  return (
    <section className="product-reviews">
      <div className="product-reviews-heading">
        <h3>Opiniones de clientes</h3>
        {reviews.length > 0 && <span aria-label={`${average.toFixed(1)} de 5 estrellas`}>★ {average.toFixed(1)} · {reviews.length}</span>}
      </div>
      {loading ? <p className="product-dialog-feedback" role="status">Cargando opiniones…</p>
        : error ? <p className="product-review-error" role="alert">{error}</p>
          : reviews.length ? (
            <div className="product-review-list">
              {reviews.slice(0, 3).map(review => (
                <article key={review.id}>
                  <div><strong>{review.cliente}</strong><span>{'★'.repeat(Math.max(0, Math.min(5, Number(review.puntuacion))))}</span></div>
                  <p>{review.comentario}</p>
                </article>
              ))}
            </div>
          ) : <p className="product-dialog-feedback">Aún no hay opiniones para este producto.</p>}
      <details className="product-review-form">
        <summary>Escribir una reseña</summary>
        <form onSubmit={submitReview}>
          <label><span>Tu nombre</span><input value={name} onChange={event => setName(event.target.value)} minLength="2" maxLength="80" required /></label>
          <label><span>Calificación</span>
            <select value={rating} onChange={event => setRating(event.target.value)}>
              {[5, 4, 3, 2, 1].map(value => <option value={value} key={value}>{'★'.repeat(value)} · {value}/5</option>)}
            </select>
          </label>
          <label><span>Comentario</span><textarea value={comment} onChange={event => setComment(event.target.value)} minLength="3" maxLength="1000" rows="3" required /></label>
          {feedback && <p className={`checkout-feedback is-${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}>{feedback.message}</p>}
          <button type="submit" className="checkout-button" disabled={submitting}>{submitting ? 'Enviando…' : 'Publicar reseña'}</button>
        </form>
      </details>
    </section>
  );
}
