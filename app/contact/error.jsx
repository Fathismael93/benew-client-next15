'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { captureException } from '@/instrumentation';
import { trackError } from '@/utils/analytics';
import './error.scss';

/**
 * Composant de gestion d'erreurs pour la page de contact
 * Gère les erreurs spécifiques au chargement du formulaire de contact
 * Production-ready avec retry logic et monitoring complet
 */
export default function ContactError({ error, reset }) {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [errorType, setErrorType] = useState('unknown');
  const MAX_RETRIES = 3;

  useEffect(() => {
    if (error) {
      const detectedErrorType = determineErrorType(error);
      setErrorType(detectedErrorType);

      // Capture dans Sentry avec contexte spécifique contact
      const errorContext = {
        tags: {
          component: 'contact_error_boundary',
          error_type: detectedErrorType,
          page: 'contact',
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
          referrer:
            typeof document !== 'undefined' ? document.referrer : 'unknown',
        },
      };

      // Capture dans Sentry
      captureException(error, errorContext);

      // Track dans Analytics
      trackError(
        `Contact form error: ${error?.message || 'Unknown'}`,
        '/contact',
        'warning',
      );

      // Log en console (dev uniquement)
      if (process.env.NODE_ENV === 'development') {
        console.error('[ContactError] Erreur de chargement:', error);
        console.log('Retry count:', retryCount);
      }
    }
  }, [error, retryCount]);

  /**
   * Détermine le type d'erreur pour un meilleur tracking et UX
   */
  const determineErrorType = (err) => {
    if (!err) return 'unknown';

    const message = err.message?.toLowerCase() || '';

    // Erreurs réseau
    if (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('connexion')
    ) {
      return 'network_error';
    }

    // Erreurs de formulaire
    if (
      message.includes('form') ||
      message.includes('validation') ||
      message.includes('input')
    ) {
      return 'form_error';
    }

    // Erreurs d'email
    if (
      message.includes('email') ||
      message.includes('sendgrid') ||
      message.includes('smtp') ||
      message.includes('mail')
    ) {
      return 'email_service_error';
    }

    // Timeout
    if (message.includes('timeout')) {
      return 'timeout_error';
    }

    // Erreurs d'animation/composant
    if (
      message.includes('framer') ||
      message.includes('motion') ||
      message.includes('animation')
    ) {
      return 'component_error';
    }

    // Erreurs de permission
    if (
      message.includes('permission') ||
      message.includes('unauthorized') ||
      message.includes('forbidden')
    ) {
      return 'permission_error';
    }

    return 'contact_loading_error';
  };

  /**
   * Obtient un message user-friendly selon le type d'erreur
   */
  const getUserFriendlyMessage = () => {
    switch (errorType) {
      case 'network_error':
        return 'Problème de connexion réseau. Vérifiez votre connexion internet.';
      case 'form_error':
        return 'Erreur lors du chargement du formulaire de contact.';
      case 'email_service_error':
        return 'Service de messagerie temporairement indisponible.';
      case 'timeout_error':
        return 'Le chargement a pris trop de temps. Le serveur est peut-être surchargé.';
      case 'component_error':
        return 'Erreur lors du chargement des éléments de la page.';
      case 'permission_error':
        return "Vous n'avez pas les permissions nécessaires pour accéder à cette page.";
      default:
        return 'Une erreur inattendue est survenue lors du chargement de la page de contact.';
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
          error_type: 'contact_error',
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
        error_type: 'contact_error',
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
  const canRetry = retryCount < MAX_RETRIES && errorType !== 'permission_error';

  return (
    <section className="first">
      <div className="contact-error">
        <div className="error-container">
          {/* Titre */}
          <h2 className="error-title">Erreur de contact</h2>

          {/* Message principal */}
          <p className="error-message">{getUserFriendlyMessage()}</p>

          {/* Détails de l'erreur (dev uniquement) */}
          {process.env.NODE_ENV === 'development' && error && (
            <div className="error-details">
              <strong>Détails techniques:</strong>
              <br />
              {error.name}: {error.message?.substring(0, 200)}
              <br />
              <small>Type: {errorType}</small>
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
