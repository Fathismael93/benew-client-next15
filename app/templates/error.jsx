'use client';

export default function Error({ error, reset }) {
  return (
    <div className="templates-error">
      <h2>Erreur de chargement des templates</h2>
      <button onClick={reset}>Réessayer</button>
    </div>
  );
}
