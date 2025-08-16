'use client';

// eslint-disable-next-line no-unused-vars
export default function Error({ error, reset }) {
  return (
    <div className="templates-error">
      <h2>Erreur de chargement des details de l&apos;application</h2>
      <button onClick={reset}>Réessayer</button>
    </div>
  );
}
