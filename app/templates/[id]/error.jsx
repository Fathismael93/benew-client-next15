'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { captureException } from '@/instrumentation';
import { trackError } from '@/utils/analytics';
import './error.scss';

/**
 * Composant de gestion d'erreurs pour la page de détail d'un template
 * Gère les erreurs spécifiques au chargement d'un template et ses applications
 * Production-ready avec retry logic intelligent et monitoring complet
 */
export default function TemplateDetailError({ error, reset }) {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [errorType, setErrorType] = useState('unknown');
  const params = useParams();
  const templateId = params?.id;
  const MAX_RETRIES = 3;

  useEffect(() => {
    if (error) {
      const detectedErrorType = determineErrorType(error);
      setErrorType(detectedErrorType);

      // Capture dans Sentry avec contexte détaillé
      const errorContext = {
        tags: {
          component: 'template_detail_error_boundary',
          error_type: detectedErrorType,
          page: 'template_detail',
          template_id: templateId || 'unknown',
          severity: detectedErrorType === '404' ? 'info' : 'warning',
        },
        level: detectedErrorType === '404' ? 'info' : 'warning',
        extra: {
          errorName: error?.name || 'Unknown',
          errorMessage: error?.message || 'No message',
          templateId,
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
        `Template detail error: ${error?.message || 'Unknown'}`,
        `/templates/${templateId}`,
        detectedErrorType === '404' ? 'info' : 'warning',
      );

      // Log en console (dev uniquement)
      if (process.env.NODE_ENV === 'development') {
        console.error('[TemplateDetailError] Erreur capturée:', {
          error,
          templateId,
          errorType: detectedErrorType,
          retryCount,
        });
      }
    }
  }, [error, templateId, retryCount]);

  /**
   * Détermine le type d'erreur pour un meilleur tracking et UX
   */
  const determineErrorType = (err) => {
    if (!err) return 'unknown';

    const message = err.message?.toLowerCase() || '';

    // Erreur 404 - Template non trouvé
    if (
      message.includes('not found') ||
      message.includes('404') ||
      message.includes('introuvable') ||
      message.includes('nexiste pas')
    ) {
      return '404';
    }

    // Erreurs réseau
    if (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('connexion')
    ) {
      return 'network_error';
    }

    // Erreurs base de données
    if (
      message.includes('database') ||
      message.includes('postgres') ||
      message.includes('pool') ||
      message.includes('query')
    ) {
      return 'database_error';
    }

    // Timeout
    if (message.includes('timeout')) {
      return 'timeout_error';
    }

    // Erreurs d'images Cloudinary
    if (message.includes('cloudinary') || message.includes('image')) {
      return 'image_loading_error';
    }

    // Erreurs de permission
    if (
      message.includes('permission') ||
      message.includes('unauthorized') ||
      message.includes('forbidden')
    ) {
      return 'permission_error';
    }

    return 'application_loading_error';
  };

  /**
   * Handler pour le retry avec backoff exponentiel
   */
  const handleRetry = async () => {
    if (retryCount >= MAX_RETRIES) {
      // Track max retries atteint
      if (typeof window !== 'undefined' && window.dataLayer) {
        window.dataLayer.push({
          event: 'error_max_retries',
          error_type: 'template_detail_error',
          template_id: templateId,
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
        error_type: 'template_detail_error',
        template_id: templateId,
        retry_number: retryCount + 1,
      });
    }

    // Délai exponentiel (1s, 2s, 4s)
    const delay = Math.min(1000 * Math.pow(2, retryCount), 4000);

    setTimeout(() => {
      setIsRetrying(false);
      reset(); // Réinitialiser l'état d'erreur
    }, delay);
  };

  const canRetry =
    retryCount < MAX_RETRIES &&
    errorType !== '404' &&
    errorType !== 'permission_error';

  return (
    <section className="first">
      <div className="template-detail-error">
        <div className="error-container">
          {/* Icône d'erreur */}
          <div className="error-icon">⚠️</div>

          {/* Titre */}
          <h2 className="error-title">Erreur de chargement</h2>

          {/* Message principal */}
          <p className="error-message">
            Une erreur est survenue lors du chargement du template. Veuillez
            réessayer ou revenir plus tard.
          </p>

          {/* Détails techniques (dev uniquement) */}
          {process.env.NODE_ENV === 'development' && error && (
            <div className="error-details">
              <strong>Détails techniques:</strong>
              <br />
              {error.name}: {error.message?.substring(0, 200)}
            </div>
          )}

          {/* Info sur les tentatives de retry */}
          {canRetry && retryCount > 0 && (
            <div className="retry-info">
              Tentative {retryCount} sur {MAX_RETRIES}
              {retryCount >= MAX_RETRIES && ' - Maximum de tentatives atteint'}
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

          {/* Section support */}
          <div className="support-text">
            Si le problème persiste, contactez notre support à{' '}
            <a href="mailto:support@benew-dj.com">support@benew-dj.com</a>
            <br />
            <small>
              Référence: TPL-{templateId || 'XXX'}-{Date.now()}-
              {Math.random().toString(36).substr(2, 5).toUpperCase()}
            </small>
          </div>
        </div>
      </div>
    </section>
  );
}
