'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { captureException } from '@/instrumentation';
import { trackError } from '@/utils/analytics';
import './error.scss';

/**
 * Composant de gestion d'erreurs pour la page de présentation
 * Gère les erreurs spécifiques au chargement de la page présentation
 * Production-ready avec retry logic et monitoring complet
 */
export default function PresentationError({ error, reset }) {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const MAX_RETRIES = 3;

  useEffect(() => {
    if (error) {
      // Capture dans Sentry avec contexte spécifique présentation
      const errorContext = {
        tags: {
          component: 'presentation_error_boundary',
          error_type: 'presentation_loading_error',
          page: 'presentation',
          severity: 'warning',
        },
        level: 'warning',
        extra: {
          errorName: error?.name || 'Unknown',
          errorMessage: error?.message || 'No message',
          retryCount,
          maxRetries: MAX_RETRIES,
          timestamp: new Date().toISOString(),
          userAgent:
            typeof window !== 'undefined'
              ? window.navigator.userAgent
              : 'unknown',
          url: typeof window !== 'undefined' ? window.location.href : 'unknown',
        },
      };

      // Capture dans Sentry
      captureException(error, errorContext);

      // Track dans Analytics
      trackError(
        `Presentation error: ${error?.message || 'Unknown'}`,
        '/presentation',
        'warning',
      );

      // Log en console (dev uniquement)
      if (process.env.NODE_ENV === 'development') {
        console.error('[PresentationError] Erreur de chargement:', error);
        console.log('Retry count:', retryCount);
      }
    }
  }, [error, retryCount]);

  /**
   * Handler pour le retry avec logique exponentielle
   */
  const handleRetry = async () => {
    if (retryCount >= MAX_RETRIES) {
      // Track max retries atteint
      if (typeof window !== 'undefined' && window.dataLayer) {
        window.dataLayer.push({
          event: 'error_max_retries',
          error_type: 'presentation_error',
          retry_count: retryCount,
        });
      }
      return;
    }

    setIsRetrying(true);
    setRetryCount((prev) => prev + 1);

    // Track tentative de retry
    if (typeof window !== 'undefined' && window.dataLayer) {
      window.dataLayer.push({
        event: 'error_retry_attempt',
        error_type: 'presentation_error',
        retry_number: retryCount + 1,
      });
    }

    // Délai exponentiel avant retry (1s, 2s, 4s)
    const delay = Math.min(1000 * Math.pow(2, retryCount), 4000);

    setTimeout(() => {
      setIsRetrying(false);
      reset(); // Fonction Next.js pour réinitialiser
    }, delay);
  };

  // Déterminer si on peut encore réessayer
  const canRetry = retryCount < MAX_RETRIES;

  return (
    <section className="first">
      <div className="presentation-error">
        <div className="error-container">
          {/* Titre */}
          <h2 className="error-title">Erreur de chargement</h2>

          {/* Message principal */}
          <p className="error-message">
            Une erreur est survenue lors du chargement de la page de
            présentation. Veuillez réessayer ou revenir plus tard.
          </p>

          {/* Boutons d'action */}
          <div className="button-group">
            {canRetry && (
              <button
                onClick={handleRetry}
                disabled={isRetrying}
                className="retry-button"
              >
                {isRetrying ? (
                  <>
                    <span className="spinner"></span>
                    Nouvelle tentative...
                  </>
                ) : (
                  'Réessayer'
                )}
              </button>
            )}

            <Link href="/" className="home-button">
              Retour à l&apos;accueil
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
