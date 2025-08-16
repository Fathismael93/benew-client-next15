'use client';

export default function Error({ error, reset }) {
  return (
    <div className="templates-error">
      <h2>Erreur de chargement du formulaire de contact</h2>
      <button onClick={reset}>Réessayer</button>
    </div>
  );
}
