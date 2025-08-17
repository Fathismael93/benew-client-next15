'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { captureException } from '@/instrumentation';
import { trackError } from '@/utils/analytics';
import './error.scss';

/**
 * Composant de gestion d'erreurs pour la page du blog
 * Gère les erreurs spécifiques au chargement des articles
 * Production-ready avec retry logic et monitoring complet
 */
export default function BlogError({ error, reset }) {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const MAX_RETRIES = 3;

  useEffect(() => {
    // Capture dans Sentry avec contexte spécifique blog
    if (error) {
      const errorContext = {
        tags: {
          component: 'blog_error_boundary',
          error_type: 'blog_loading_error',
          page: 'blog_list',
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
      trackError(error?.message || 'Blog loading error', '/blog', 'warning');

      // Log en dev
      if (process.env.NODE_ENV === 'development') {
        console.error('[BlogError] Erreur de chargement:', error);
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
          error_type: 'blog_error',
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
        error_type: 'blog_error',
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
      <div className="blog-error">
        <div className="error-container">
          {/* Icône d'erreur */}
          <div className="error-icon">⚠️</div>

          {/* Titre */}
          <h2 className="error-title">Erreur de chargement</h2>

          {/* Message principal */}
          <p className="error-message">
            Une erreur est survenue lors du chargement des articles du blog.
            Veuillez réessayer ou revenir plus tard.
          </p>

          {/* Détails de l'erreur (dev uniquement) */}
          {process.env.NODE_ENV === 'development' && error && (
            <div className="error-details">
              <strong>Détails techniques:</strong>
              <br />
              {error.name}: {error.message?.substring(0, 150)}
            </div>
          )}

          {/* Info sur les tentatives */}
          {retryCount > 0 && (
            <div className="retry-info">
              Tentative {retryCount} sur {MAX_RETRIES}
              {!canRetry && ' - Maximum de tentatives atteint'}
            </div>
          )}

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
                  <>
                    🔄 Réessayer
                    {retryCount > 0 &&
                      ` (${MAX_RETRIES - retryCount} restantes)`}
                  </>
                )}
              </button>
            )}

            <Link href="/" className="home-button">
              🏠 Retour à l&apos;accueil
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
