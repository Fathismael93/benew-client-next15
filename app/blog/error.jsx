'use client';

export default function Error({ error, reset }) {
  return (
    <div className="templates-error">
      <h2>Erreur de chargement des articles</h2>
      <button onClick={reset}>Réessayer</button>
    </div>
  );
}
