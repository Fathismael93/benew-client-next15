'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { captureException } from '@/instrumentation';
import { trackError } from '@/utils/analytics';

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
   * Messages user-friendly selon le type d'erreur
   */
  const getUserFriendlyMessage = () => {
    switch (errorType) {
      case '404':
        return {
          title: 'Template introuvable',
          message:
            "Le template que vous recherchez n'existe pas ou a été supprimé.",
          icon: '🔍',
        };
      case 'network_error':
        return {
          title: 'Problème de connexion',
          message:
            'Impossible de charger le template. Vérifiez votre connexion internet.',
          icon: '📡',
        };
      case 'database_error':
        return {
          title: 'Erreur de chargement',
          message:
            'Impossible de récupérer les informations du template depuis notre serveur.',
          icon: '🗄️',
        };
      case 'timeout_error':
        return {
          title: 'Temps de chargement dépassé',
          message:
            'Le serveur met trop de temps à répondre. Réessayez dans quelques instants.',
          icon: '⏱️',
        };
      case 'image_loading_error':
        return {
          title: 'Erreur de chargement des images',
          message: 'Les images du template ne peuvent pas être chargées.',
          icon: '🖼️',
        };
      case 'permission_error':
        return {
          title: 'Accès non autorisé',
          message:
            "Vous n'avez pas les permissions nécessaires pour voir ce template.",
          icon: '🔒',
        };
      default:
        return {
          title: 'Erreur de chargement',
          message:
            'Une erreur inattendue est survenue lors du chargement du template et de ses applications.',
          icon: '⚠️',
        };
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

  /**
   * Handler pour rafraîchir la page
   */
  const handleRefresh = () => {
    // Track l'action de refresh
    if (typeof window !== 'undefined' && window.dataLayer) {
      window.dataLayer.push({
        event: 'error_page_refresh',
        error_type: 'template_detail_error',
        template_id: templateId,
      });
    }

    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  /**
   * Handler pour retour à la liste des templates
   */
  const handleBackToList = () => {
    // Track l'action de retour
    if (typeof window !== 'undefined' && window.dataLayer) {
      window.dataLayer.push({
        event: 'error_back_to_list',
        error_type: 'template_detail_error',
        template_id: templateId,
      });
    }
  };

  const canRetry =
    retryCount < MAX_RETRIES &&
    errorType !== '404' &&
    errorType !== 'permission_error';
  const errorInfo = getUserFriendlyMessage();

  return (
    <div className="template-detail-error">
      <style>{`
        .template-detail-error {
          min-height: 70vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          background: linear-gradient(135deg, #0c0c1d 0%, #1a1a2e 100%);
        }

        .error-container {
          max-width: 650px;
          width: 100%;
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(15px);
          border-radius: 20px;
          padding: 3.5rem;
          text-align: center;
          border: 1px solid rgba(246, 160, 55, 0.2);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
          animation: fadeIn 0.5s ease-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .error-icon {
          font-size: 5rem;
          margin-bottom: 1.5rem;
          animation: ${errorType === '404' ? 'shake' : 'pulse'} 2s infinite;
          filter: drop-shadow(0 0 20px rgba(246, 160, 55, 0.3));
        }

        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.7;
            transform: scale(1.1);
          }
        }

        @keyframes shake {
          0%,
          100% {
            transform: translateX(0);
          }
          25% {
            transform: translateX(-10px);
          }
          75% {
            transform: translateX(10px);
          }
        }

        .error-badge {
          display: inline-block;
          background: rgba(246, 160, 55, 0.2);
          color: #f6a037;
          padding: 0.3rem 1rem;
          border-radius: 20px;
          font-size: 0.85rem;
          margin-bottom: 1rem;
          border: 1px solid rgba(246, 160, 55, 0.3);
        }

        .error-title {
          color: #f6a037;
          font-size: 2rem;
          font-weight: bold;
          margin-bottom: 1rem;
          line-height: 1.2;
        }

        .error-message {
          color: #e0e0e0;
          font-size: 1.15rem;
          line-height: 1.6;
          margin-bottom: 2rem;
        }

        .error-details {
          background: rgba(246, 160, 55, 0.1);
          border: 1px solid rgba(246, 160, 55, 0.3);
          border-radius: 10px;
          padding: 1.2rem;
          margin-bottom: 2rem;
          color: #f6a037;
          font-size: 0.9rem;
          text-align: left;
          font-family: 'Courier New', monospace;
          max-height: 150px;
          overflow-y: auto;
        }

        .retry-info {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
          padding: 1rem;
          margin-bottom: 2rem;
          color: #999;
          font-size: 0.9rem;
        }

        .retry-indicator {
          display: inline-flex;
          gap: 0.5rem;
          margin-top: 0.5rem;
        }

        .retry-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #666;
        }

        .retry-dot.active {
          background: #f6a037;
        }

        .button-group {
          display: flex;
          gap: 1rem;
          justify-content: center;
          flex-wrap: wrap;
        }

        .btn {
          padding: 0.85rem 1.75rem;
          font-size: 1rem;
          font-weight: 600;
          border-radius: 10px;
          border: none;
          cursor: pointer;
          transition: all 0.3s ease;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          position: relative;
          overflow: hidden;
        }

        .btn::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          transform: translate(-50%, -50%);
          transition:
            width 0.3s,
            height 0.3s;
        }

        .btn:hover::before {
          width: 300px;
          height: 300px;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn:disabled::before {
          display: none;
        }

        .btn-primary {
          background: linear-gradient(135deg, #f6a037 0%, #e89027 100%);
          color: #0c0c1d;
          box-shadow: 0 4px 15px rgba(246, 160, 55, 0.3);
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(246, 160, 55, 0.4);
        }

        .btn-secondary {
          background: transparent;
          color: #f6a037;
          border: 2px solid #f6a037;
        }

        .btn-secondary:hover:not(:disabled) {
          background: rgba(246, 160, 55, 0.1);
          transform: translateY(-2px);
          box-shadow: 0 4px 15px rgba(246, 160, 55, 0.2);
        }

        .btn-tertiary {
          background: rgba(255, 255, 255, 0.05);
          color: #999;
          border: 2px solid rgba(255, 255, 255, 0.1);
        }

        .btn-tertiary:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
          border-color: rgba(255, 255, 255, 0.2);
          transform: translateY(-2px);
        }

        .spinner {
          display: inline-block;
          width: 16px;
          height: 16px;
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

        .template-id-display {
          margin-top: 1rem;
          padding: 0.5rem 1rem;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          font-family: monospace;
          font-size: 0.85rem;
          color: #666;
        }

        .support-section {
          margin-top: 3rem;
          padding-top: 2.5rem;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .support-text {
          color: #999;
          font-size: 0.9rem;
          margin-bottom: 0.5rem;
        }

        .support-text a {
          color: #f6a037;
          text-decoration: none;
          transition: opacity 0.3s;
        }

        .support-text a:hover {
          opacity: 0.8;
          text-decoration: underline;
        }

        .error-reference {
          font-size: 0.75rem;
          color: #666;
          font-family: monospace;
          margin-top: 0.5rem;
        }

        @media (max-width: 640px) {
          .error-container {
            padding: 2rem 1.5rem;
          }

          .error-icon {
            font-size: 3.5rem;
          }

          .error-title {
            font-size: 1.5rem;
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
        <div className="error-icon">{errorInfo.icon}</div>

        {/* Badge du type d'erreur */}
        {errorType !== 'unknown' && (
          <div className="error-badge">
            {errorType === '404'
              ? 'NOT FOUND'
              : errorType.toUpperCase().replace('_', ' ')}
          </div>
        )}

        {/* Titre */}
        <h2 className="error-title">{errorInfo.title}</h2>

        {/* Message principal */}
        <p className="error-message">{errorInfo.message}</p>

        {/* ID du template si disponible */}
        {templateId && errorType !== '404' && (
          <div className="template-id-display">
            Template ID: <strong>{templateId}</strong>
          </div>
        )}

        {/* Détails techniques (dev uniquement) */}
        {process.env.NODE_ENV === 'development' && error && (
          <div className="error-details">
            <strong>Détails techniques:</strong>
            <br />
            {error.name}: {error.message?.substring(0, 200)}
            {error.stack && (
              <>
                <br />
                <br />
                <small>{error.stack.substring(0, 300)}</small>
              </>
            )}
          </div>
        )}

        {/* Info sur les tentatives de retry */}
        {canRetry && retryCount > 0 && (
          <div className="retry-info">
            <div>
              Tentative {retryCount} sur {MAX_RETRIES}
            </div>
            <div className="retry-indicator">
              {[...Array(MAX_RETRIES)].map((_, i) => (
                <span
                  key={i}
                  className={`retry-dot ${i < retryCount ? 'active' : ''}`}
                />
              ))}
            </div>
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

          {errorType !== '404' && (
            <button
              onClick={handleRefresh}
              className="btn btn-secondary"
              disabled={isRetrying}
            >
              🔃 Rafraîchir la page
            </button>
          )}

          <Link
            href="/templates"
            className="btn btn-tertiary"
            onClick={handleBackToList}
          >
            📋 Voir tous les templates
          </Link>

          <Link href="/" className="btn btn-tertiary">
            🏠 Retour à l&apos;accueil
          </Link>
        </div>

        {/* Section support */}
        <div className="support-section">
          <div className="support-text">
            {errorType === '404' ? (
              <>
                Vous cherchez un template spécifique ?<br />
                <Link href="/contact">Contactez-nous</Link> pour obtenir de
                l&apos;aide.
              </>
            ) : (
              <>
                Si le problème persiste, contactez notre support à{' '}
                <a href="mailto:support@benew-dj.com">support@benew-dj.com</a>
              </>
            )}
          </div>

          <div className="error-reference">
            Référence: TPL-{templateId || 'XXX'}-{Date.now()}-
            {Math.random().toString(36).substr(2, 5).toUpperCase()}
          </div>
        </div>
      </div>
    </div>
  );
}
