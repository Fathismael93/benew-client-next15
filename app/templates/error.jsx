'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { captureException } from '@/instrumentation';
import { trackError } from '@/utils/analytics';
import './error.scss';

/**
 * Composant de gestion d'erreurs pour la page des templates
 * Gère les erreurs spécifiques au chargement des templates
 * Production-ready avec retry logic et monitoring complet
 */
export default function TemplatesError({ error, reset }) {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const MAX_RETRIES = 3;

  useEffect(() => {
    // Capture dans Sentry avec contexte spécifique templates
    if (error) {
      const errorContext = {
        tags: {
          component: 'templates_error_boundary',
          error_type: determineErrorType(error),
          page: 'templates_list',
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
        error?.message || 'Templates loading error',
        '/templates',
        'warning',
      );

      // Log en console (dev uniquement)
      if (process.env.NODE_ENV === 'development') {
        console.error('[TemplatesError] Erreur de chargement:', error);
        console.log('Retry count:', retryCount);
      }
    }
  }, [error, retryCount]);

  /**
   * Détermine le type d'erreur pour un meilleur tracking
   */
  const determineErrorType = (err) => {
    if (!err) return 'unknown';

    const message = err.message?.toLowerCase() || '';

    if (message.includes('network') || message.includes('fetch')) {
      return 'network_error';
    }
    if (
      message.includes('database') ||
      message.includes('postgres') ||
      message.includes('pool')
    ) {
      return 'database_error';
    }
    if (message.includes('timeout')) {
      return 'timeout_error';
    }
    if (message.includes('cloudinary')) {
      return 'image_loading_error';
    }

    return 'templates_loading_error';
  };

  /**
   * Obtient un message user-friendly selon le type d'erreur
   */
  const getUserFriendlyMessage = () => {
    const errorType = determineErrorType(error);

    switch (errorType) {
      case 'network_error':
        return 'Problème de connexion réseau. Vérifiez votre connexion internet.';
      case 'database_error':
        return 'Impossible de récupérer les templates depuis notre serveur.';
      case 'timeout_error':
        return 'Le chargement a pris trop de temps. Le serveur est peut-être surchargé.';
      case 'image_loading_error':
        return 'Problème de chargement des images des templates.';
      default:
        return 'Une erreur inattendue est survenue lors du chargement des templates.';
    }
  };

  /**
   * Handler pour le retry avec logique exponentielle
   */
  const handleRetry = async () => {
    if (retryCount >= MAX_RETRIES) {
      // Track max retries atteint
      if (typeof window !== 'undefined' && window.dataLayer) {
        window.dataLayer.push({
          event: 'error_max_retries',
          error_type: 'templates_error',
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
        error_type: 'templates_error',
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
      <div className="templates-error">
        <div className="error-container">
          {/* Icône d'erreur */}
          <div className="error-icon">⚠️</div>

          {/* Titre */}
          <h2 className="error-title">Erreur de chargement</h2>

          {/* Message principal */}
          <p className="error-message">{getUserFriendlyMessage()}</p>

          {/* Message générique en complément */}
          <p className="error-submessage">
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
                className="btn btn-primary"
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

            <Link href="/" className="btn btn-secondary">
              🏠 Retour à l&apos;accueil
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
