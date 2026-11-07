import React from 'react';

export default function ClientBanner({ onExplore }) {
  return (
    <section className="store-hero">
      <div className="store-hero-copy">
        <span className="store-kicker">UNA NOCHE PARA DISFRUTAR</span>
        <h1>Tu próxima<br /><em>gran elección.</em></h1>
        <p>Descubre nuestra selección, encuentra tu favorito y nosotros lo llevamos a tu mesa.</p>
        <button className="store-hero-link" type="button" onClick={onExplore}>Explorar la carta <span aria-hidden="true">↓</span></button>
      </div>
      <div className="store-hero-art" aria-hidden="true">
        <span className="hero-art-orbit hero-art-orbit-one"></span>
        <span className="hero-art-orbit hero-art-orbit-two"></span>
        <span className="hero-art-bottle">V</span>
        <span className="hero-art-caption">BUEN GUSTO<br />EN CADA COPA</span>
      </div>
      <div className="store-hero-foot">
        <span>SELECCIÓN DE LA CASA</span>
        <span>Buenos momentos, bien elegidos</span>
      </div>
    </section>
  );
}
