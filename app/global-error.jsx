'use client';

import { useEffect } from 'react';
import { captureException } from '@/instrumentation';
import './styles/global-error.scss';

/**
 * Composant de gestion d'erreurs globales pour Next.js 15
 * Capture TOUTES les erreurs non gérées dans l'application
 * Production-ready pour 500 visiteurs/jour
 */
export default function GlobalError({ error, reset }) {
  useEffect(() => {
    // Capture dans Sentry avec contexte complet
    if (error) {
      captureException(error, {
        tags: {
          component: 'global_error_boundary',
          error_type: 'unhandled_global',
          severity: 'critical',
        },
        level: 'error',
        extra: {
          errorName: error?.name || 'Unknown',
          errorMessage: error?.message || 'No message',
          errorStack: error?.stack?.substring(0, 500),
          timestamp: new Date().toISOString(),
          userAgent:
            typeof window !== 'undefined'
              ? window.navigator.userAgent
              : 'unknown',
          url: typeof window !== 'undefined' ? window.location.href : 'unknown',
        },
      });

      // Log en console pour debug (seulement en dev)
      if (process.env.NODE_ENV === 'development') {
        console.error('[GlobalError] Erreur critique capturée:', error);
      }
    }
  }, [error]);

  // Handler pour le bouton réessayer
  const handleReset = () => {
    // Track l'action de reset dans Analytics
    if (typeof window !== 'undefined' && window.dataLayer) {
      window.dataLayer.push({
        event: 'error_recovery_attempt',
        error_type: 'global_error',
        error_message: error?.message?.substring(0, 100),
      });
    }

    // Tenter de réinitialiser
    reset();
  };

  // Handler pour retour à l'accueil
  const handleGoHome = () => {
    // Track l'action de retour
    if (typeof window !== 'undefined' && window.dataLayer) {
      window.dataLayer.push({
        event: 'error_recovery_home',
        error_type: 'global_error',
      });
    }

    // Redirection sécurisée vers l'accueil
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  return (
    <html lang="fr">
      <head>
        <title>Erreur - Benew</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <body>
        <div className="global-error">
          <div className="error-container">
            {/* Icône d'erreur */}
            <div className="error-icon">⚠️</div>

            {/* Titre */}
            <h1 className="error-title">Une erreur est survenue</h1>

            {/* Message */}
            <p className="error-message">
              Nous rencontrons un problème technique temporaire. Notre équipe a
              été automatiquement notifiée.
            </p>

            {/* Détails techniques (dev uniquement) */}
            {process.env.NODE_ENV === 'development' && error && (
              <div className="error-details">
                <strong>Détails techniques:</strong>
                <br />
                {error.name}: {error.message?.substring(0, 150)}
              </div>
            )}

            {/* Boutons d'action */}
            <div className="button-group">
              <button onClick={handleReset} className="nextButton">
                🔄 Réessayer
              </button>

              <button onClick={handleGoHome} className="cancelButton">
                🏠 Retour à l&apos;accueil
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
