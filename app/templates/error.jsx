'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { captureException } from '@/instrumentation';
import { trackError } from '@/utils/analytics';

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

  /**
   * Handler pour rafraîchir la page complètement
   */
  const handleHardRefresh = () => {
    // Track l'action de refresh complet
    if (typeof window !== 'undefined' && window.dataLayer) {
      window.dataLayer.push({
        event: 'error_hard_refresh',
        error_type: 'templates_error',
      });
    }

    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  // Déterminer si on peut encore réessayer
  const canRetry = retryCount < MAX_RETRIES;

  return (
    <div className="templates-error">
      <style>{`
        .templates-error {
          min-height: 60vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          background: linear-gradient(135deg, #0c0c1d 0%, #1a1a2e 100%);
        }

        .error-container {
          max-width: 600px;
          width: 100%;
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
          border-radius: 16px;
          padding: 3rem;
          text-align: center;
          border: 1px solid rgba(246, 160, 55, 0.2);
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
        }

        .error-icon {
          font-size: 4rem;
          margin-bottom: 1.5rem;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }

        .error-title {
          color: #f6a037;
          font-size: 1.75rem;
          font-weight: bold;
          margin-bottom: 1rem;
        }

        .error-message {
          color: #e0e0e0;
          font-size: 1.1rem;
          line-height: 1.6;
          margin-bottom: 2rem;
        }

        .error-details {
          background: rgba(246, 160, 55, 0.1);
          border: 1px solid rgba(246, 160, 55, 0.3);
          border-radius: 8px;
          padding: 1rem;
          margin-bottom: 2rem;
          color: #f6a037;
          font-size: 0.9rem;
        }

        .retry-info {
          color: #999;
          font-size: 0.85rem;
          margin-bottom: 2rem;
        }

        .button-group {
          display: flex;
          gap: 1rem;
          justify-content: center;
          flex-wrap: wrap;
        }

        .btn {
          padding: 0.75rem 1.5rem;
          font-size: 1rem;
          font-weight: 600;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          transition: all 0.3s ease;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-primary {
          background: #f6a037;
          color: #0c0c1d;
        }

        .btn-primary:hover:not(:disabled) {
          background: #e89027;
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(246, 160, 55, 0.3);
        }

        .btn-secondary {
          background: transparent;
          color: #f6a037;
          border: 2px solid #f6a037;
        }

        .btn-secondary:hover:not(:disabled) {
          background: rgba(246, 160, 55, 0.1);
          transform: translateY(-2px);
        }

        .btn-tertiary {
          background: transparent;
          color: #999;
          border: 2px solid #999;
        }

        .btn-tertiary:hover {
          background: rgba(255, 255, 255, 0.05);
          color: #fff;
          border-color: #fff;
        }

        .spinner {
          display: inline-block;
          width: 14px;
          height: 14px;
          border: 2px solid transparent;
          border-top-color: currentColor;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .support-text {
          margin-top: 2rem;
          padding-top: 2rem;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          color: #999;
          font-size: 0.85rem;
        }

        .support-text a {
          color: #f6a037;
          text-decoration: none;
        }

        .support-text a:hover {
          text-decoration: underline;
        }

        @media (max-width: 640px) {
          .error-container {
            padding: 2rem 1.5rem;
          }

          .button-group {
            flex-direction: column;
          }

          .btn {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>

      <div className="error-container">
        {/* Icône d'erreur */}
        <div className="error-icon">⚠️</div>

        {/* Titre */}
        <h2 className="error-title">Erreur de chargement des templates</h2>

        {/* Message principal */}
        <p className="error-message">{getUserFriendlyMessage()}</p>

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
                  {retryCount > 0 && ` (${MAX_RETRIES - retryCount} restantes)`}
                </>
              )}
            </button>
          )}

          <button
            onClick={handleHardRefresh}
            className="btn btn-secondary"
            disabled={isRetrying}
          >
            🔃 Rafraîchir la page
          </button>

          <Link href="/" className="btn btn-tertiary">
            🏠 Retour à l&apos;accueil
          </Link>
        </div>

        {/* Support */}
        <div className="support-text">
          Si le problème persiste, contactez notre support à{' '}
          <a href="mailto:support@benew-dj.com">support@benew-dj.com</a>
          <br />
          <small>
            Référence: TPL-{Date.now()}-
            {Math.random().toString(36).substr(2, 5).toUpperCase()}
          </small>
        </div>
      </div>
    </div>
  );
}
