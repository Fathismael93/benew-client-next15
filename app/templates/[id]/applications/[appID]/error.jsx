'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { captureException } from '@/instrumentation';
import { trackError } from '@/utils/analytics';
import './error.scss';

/**
 * Composant de gestion d'erreurs pour la page de détail d'une application
 * Gère les erreurs spécifiques au chargement d'une application individuelle
 * Production-ready avec retry logic intelligent et monitoring complet
 */
export default function ApplicationDetailError({ error, reset }) {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [errorType, setErrorType] = useState('unknown');
  const params = useParams();
  const templateId = params?.id;
  const appId = params?.appID;
  const MAX_RETRIES = 3;

  useEffect(() => {
    if (error) {
      const detectedErrorType = determineErrorType(error);
      setErrorType(detectedErrorType);

      // Capture dans Sentry avec contexte détaillé
      const errorContext = {
        tags: {
          component: 'application_detail_error_boundary',
          error_type: detectedErrorType,
          page: 'application_detail',
          template_id: templateId || 'unknown',
          app_id: appId || 'unknown',
          severity: detectedErrorType === '404' ? 'info' : 'warning',
        },
        level: detectedErrorType === '404' ? 'info' : 'warning',
        extra: {
          errorName: error?.name || 'Unknown',
          errorMessage: error?.message || 'No message',
          templateId,
          appId,
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
        `Application detail error: ${error?.message || 'Unknown'}`,
        `/templates/${templateId}/applications/${appId}`,
        detectedErrorType === '404' ? 'info' : 'warning',
      );

      // Log en console (dev uniquement)
      if (process.env.NODE_ENV === 'development') {
        console.error('[ApplicationDetailError] Erreur capturée:', {
          error,
          templateId,
          appId,
          errorType: detectedErrorType,
          retryCount,
        });
      }
    }
  }, [error, templateId, appId, retryCount]);

  /**
   * Détermine le type d'erreur pour un meilleur tracking et UX
   */
  const determineErrorType = (err) => {
    if (!err) return 'unknown';

    const message = err.message?.toLowerCase() || '';

    // Erreur 404 - Application non trouvée
    if (
      message.includes('not found') ||
      message.includes('404') ||
      message.includes('introuvable') ||
      message.includes('nexiste pas') ||
      message.includes('application not found')
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

    // Erreurs d'images
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

    // Erreurs de prix/paiement
    if (
      message.includes('price') ||
      message.includes('payment') ||
      message.includes('prix')
    ) {
      return 'pricing_error';
    }

    return 'application_loading_error';
  };

  /**
   * Obtient un message user-friendly selon le type d'erreur
   */
  const getUserFriendlyMessage = () => {
    switch (errorType) {
      case '404':
        return 'Cette application est introuvable. Elle a peut-être été supprimée ou déplacée.';
      case 'network_error':
        return 'Problème de connexion réseau. Vérifiez votre connexion internet.';
      case 'database_error':
        return "Impossible de récupérer les détails de l'application depuis notre serveur.";
      case 'timeout_error':
        return 'Le chargement a pris trop de temps. Le serveur est peut-être surchargé.';
      case 'image_loading_error':
        return "Problème de chargement des images de l'application.";
      case 'permission_error':
        return "Vous n'avez pas les permissions nécessaires pour accéder à cette application.";
      case 'pricing_error':
        return "Erreur lors du chargement des informations de prix de l'application.";
      default:
        return "Une erreur inattendue est survenue lors du chargement des détails de l'application.";
    }
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
          error_type: 'application_detail_error',
          template_id: templateId,
          app_id: appId,
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
        error_type: 'application_detail_error',
        template_id: templateId,
        app_id: appId,
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
      <div className="application-detail-error">
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

          {/* Détails techniques (dev uniquement) */}
          {process.env.NODE_ENV === 'development' && error && (
            <div className="error-details">
              <strong>Détails techniques:</strong>
              <br />
              {error.name}: {error.message?.substring(0, 200)}
              <br />
              <small>
                Template ID: {templateId} | App ID: {appId}
              </small>
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

            <Link href={`/templates/${templateId}`} className="template-button">
              🔙 Retour au template
            </Link>

            <Link href="/" className="home-button">
              🏠 Retour à l&apos;accueil
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
