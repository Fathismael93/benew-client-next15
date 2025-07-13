'use client';

import Link from 'next/link';

function NotFound() {
  return (
    <section className="first">
      <div className="error">
        <p>Erreur 404 !</p>
        <p>
          Page introuvable, <Link href="/">Retour à l&apos;accueil</Link>
        </p>
      </div>
    </section>
  );
}

export default NotFound;
