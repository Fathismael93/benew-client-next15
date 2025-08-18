'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import './error.scss';

/**
 * Error Boundary simplifié pour la page de détail d'application
 * Se concentre uniquement sur l'interface utilisateur et les interactions de base
 * Le monitoring et la classification d'erreurs sont gérés côté server component
 */
export default function ApplicationDetailError({ error, reset }) {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const params = useParams();
  const templateId = params?.id;
  const appId = params?.appID;
  const MAX_RETRIES = 3;

  // Log simple pour suivi des interactions utilisateur (tracking uniquement)
  useEffect(() => {
    if (error && typeof window !== 'undefined' && window.dataLayer) {
      window.dataLayer.push({
        event: 'error_boundary_shown',
        page: 'application_detail',
        template_id: templateId || 'unknown',
        app_id: appId || 'unknown',
        error_name: error?.name || 'Unknown',
      });
    }
  }, [error, templateId, appId]);

  /**
   * Gestion du retry avec délai simple
   */
  const handleRetry = async () => {
    if (retryCount >= MAX_RETRIES || isRetrying) return;

    setIsRetrying(true);
    setRetryCount((prev) => prev + 1);

    // Track retry attempt (analytics uniquement)
    if (typeof window !== 'undefined' && window.dataLayer) {
      window.dataLayer.push({
        event: 'error_retry_attempt',
        page: 'application_detail',
        template_id: templateId,
        app_id: appId,
        retry_number: retryCount + 1,
      });
    }

    // Délai simple (1s, 2s, 3s)
    const delay = Math.min(1000 * (retryCount + 1), 3000);

    setTimeout(() => {
      setIsRetrying(false);
      reset();
    }, delay);
  };

  const canRetry = retryCount < MAX_RETRIES;
  const isMaxRetriesReached = retryCount >= MAX_RETRIES;

  return (
    <section className="first">
      <div className="application-detail-error">
        <div className="error-container">
          {/* Icône d'erreur */}
          <div className="error-icon">⚠️</div>

          {/* Titre */}
          <h2 className="error-title">Erreur de chargement</h2>

          {/* Message principal */}
          <p className="error-message">
            Nous rencontrons des difficultés pour charger cette application.
            {canRetry
              ? ' Veuillez réessayer ou revenir plus tard.'
              : ' Veuillez revenir plus tard.'}
          </p>

          {/* Indicateur de tentatives */}
          {retryCount > 0 && (
            <div className="retry-indicator">
              {isMaxRetriesReached ? (
                <span className="max-retries">
                  Nombre maximum de tentatives atteint ({MAX_RETRIES})
                </span>
              ) : (
                <span className="retry-count">
                  Tentative {retryCount} sur {MAX_RETRIES}
                </span>
              )}
            </div>
          )}

          {/* Actions utilisateur */}
          <div className="error-actions">
            {canRetry && (
              <button
                onClick={handleRetry}
                disabled={isRetrying}
                className="retry-button"
                aria-label={`Réessayer${retryCount > 0 ? ` (${MAX_RETRIES - retryCount} tentatives restantes)` : ''}`}
              >
                {isRetrying ? (
                  <>
                    <span className="spinner" aria-hidden="true"></span>
                    Nouvelle tentative...
                  </>
                ) : (
                  <>
                    🔄 Réessayer
                    {retryCount > 0 && ` (${MAX_RETRIES - retryCount})`}
                  </>
                )}
              </button>
            )}

            <Link href={`/templates/${templateId}`} className="template-button">
              🔙 Retour au template
            </Link>

            <Link href="/templates" className="templates-button">
              📋 Tous les templates
            </Link>

            <Link href="/" className="home-button">
              🏠 Accueil
            </Link>
          </div>

          {/* Message d'aide */}
          <div className="help-text">
            <p>
              Si le problème persiste, vous pouvez{' '}
              <Link href="/contact" className="contact-link">
                nous contacter
              </Link>{' '}
              pour obtenir de l&apos;aide.
            </p>
          </div>

          {/* Debug info (dev uniquement) */}
          {process.env.NODE_ENV === 'development' && error && (
            <details className="debug-info">
              <summary>Informations techniques (dev)</summary>
              <div className="debug-content">
                <p>
                  <strong>Erreur :</strong> {error.name}
                </p>
                <p>
                  <strong>Message :</strong> {error.message}
                </p>
                <p>
                  <strong>Template ID :</strong> {templateId}
                </p>
                <p>
                  <strong>App ID :</strong> {appId}
                </p>
                <p>
                  <strong>Tentatives :</strong> {retryCount}/{MAX_RETRIES}
                </p>
              </div>
            </details>
          )}
        </div>
      </div>
    </section>
  );
}
