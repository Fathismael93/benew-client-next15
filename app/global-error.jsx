'use client';

import { useEffect } from 'react';
import { captureException } from '@/instrumentation';

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

  // Styles inline pour garantir l'affichage même si les CSS sont cassés
  const containerStyles = {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    backgroundColor: '#0c0c1d',
    color: '#ffffff',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  };

  const contentStyles = {
    maxWidth: '600px',
    textAlign: 'center',
    padding: '2rem',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '12px',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  };

  const headingStyles = {
    fontSize: '2.5rem',
    marginBottom: '1rem',
    color: '#f6a037',
    fontWeight: 'bold',
  };

  const subHeadingStyles = {
    fontSize: '1.25rem',
    marginBottom: '1.5rem',
    color: '#e0e0e0',
    lineHeight: '1.6',
  };

  const messageStyles = {
    fontSize: '0.95rem',
    marginBottom: '2rem',
    color: '#b0b0b0',
    lineHeight: '1.5',
  };

  const buttonContainerStyles = {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'center',
    flexWrap: 'wrap',
  };

  const buttonStyles = {
    padding: '0.75rem 2rem',
    fontSize: '1rem',
    fontWeight: '600',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    textDecoration: 'none',
    display: 'inline-block',
  };

  const primaryButtonStyles = {
    ...buttonStyles,
    backgroundColor: '#f6a037',
    color: '#0c0c1d',
  };

  const secondaryButtonStyles = {
    ...buttonStyles,
    backgroundColor: 'transparent',
    color: '#f6a037',
    border: '2px solid #f6a037',
  };

  const errorDetailsStyles = {
    marginTop: '2rem',
    padding: '1rem',
    backgroundColor: 'rgba(246, 160, 55, 0.1)',
    borderRadius: '8px',
    border: '1px solid rgba(246, 160, 55, 0.3)',
    fontSize: '0.85rem',
    color: '#f6a037',
    textAlign: 'left',
    wordBreak: 'break-word',
    maxHeight: '150px',
    overflowY: 'auto',
  };

  const logoStyles = {
    fontSize: '3rem',
    marginBottom: '1rem',
  };

  // Déterminer si on affiche les détails techniques (seulement en dev)
  const showTechnicalDetails = process.env.NODE_ENV === 'development' && error;

  return (
    <html lang="fr">
      <head>
        <title>Erreur - Benew</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <body>
        <div style={containerStyles}>
          <div style={contentStyles}>
            {/* Logo ou icône */}
            <div style={logoStyles}>⚠️</div>

            {/* Titre principal */}
            <h1 style={headingStyles}>Oops ! Une erreur est survenue</h1>

            {/* Sous-titre */}
            <h2 style={subHeadingStyles}>
              Nous rencontrons un problème technique temporaire
            </h2>

            {/* Message explicatif */}
            <p style={messageStyles}>
              Notre équipe a été automatiquement notifiée et travaille à
              résoudre ce problème. Vous pouvez essayer de rafraîchir la page ou
              revenir à l&apos;accueil.
            </p>

            {/* Boutons d'action */}
            <div style={buttonContainerStyles}>
              <button
                onClick={handleReset}
                style={primaryButtonStyles}
                onMouseOver={(e) => {
                  e.target.style.backgroundColor = '#e89027';
                  e.target.style.transform = 'translateY(-2px)';
                }}
                onMouseOut={(e) => {
                  e.target.style.backgroundColor = '#f6a037';
                  e.target.style.transform = 'translateY(0)';
                }}
              >
                Réessayer
              </button>

              <button
                onClick={handleGoHome}
                style={secondaryButtonStyles}
                onMouseOver={(e) => {
                  e.target.style.backgroundColor = 'rgba(246, 160, 55, 0.1)';
                  e.target.style.transform = 'translateY(-2px)';
                }}
                onMouseOut={(e) => {
                  e.target.style.backgroundColor = 'transparent';
                  e.target.style.transform = 'translateY(0)';
                }}
              >
                Retour à l&apos;accueil
              </button>
            </div>

            {/* Détails techniques (dev uniquement) */}
            {showTechnicalDetails && (
              <div style={errorDetailsStyles}>
                <strong>Détails techniques (dev) :</strong>
                <br />
                {error.name}: {error.message}
                <br />
                <small>{error.stack?.substring(0, 200)}</small>
              </div>
            )}

            {/* Message de support */}
            <p
              style={{
                ...messageStyles,
                marginTop: '2rem',
                fontSize: '0.85rem',
              }}
            >
              Si le problème persiste, contactez-nous à{' '}
              <a
                href="mailto:support@benew-dj.com"
                style={{ color: '#f6a037', textDecoration: 'none' }}
              >
                support@benew-dj.com
              </a>
            </p>

            {/* ID de référence pour le support */}
            {error && (
              <p
                style={{
                  fontSize: '0.75rem',
                  color: '#666',
                  marginTop: '1rem',
                }}
              >
                Référence erreur: {Date.now()}-
                {Math.random().toString(36).substr(2, 9)}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
