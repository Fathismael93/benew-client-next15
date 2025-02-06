'use client';

import React from 'react';

function NotFound() {
  return (
    <section className="first">
      <div className="error">
        <p>Erreur 404 !</p>
        <p>
          Page introuvable, <a href="/">Retour à l&apos;accueil</a>
        </p>
      </div>
    </section>
  );
}

export default NotFound;
