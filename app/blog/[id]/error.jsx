'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { captureException } from '@/instrumentation';
import { trackError } from '@/utils/analytics';
import './error.scss';

/**
 * Composant de gestion d'erreurs pour la page d'un article du blog
 * Gère les erreurs spécifiques au chargement d'un article individuel
 * Production-ready avec retry logic et monitoring complet
 */
export default function BlogArticleError({ error, reset }) {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const params = useParams();
  const articleId = params?.id;
  const MAX_RETRIES = 3;

  useEffect(() => {
    // Capture dans Sentry avec contexte spécifique article
    if (error) {
      const errorContext = {
        tags: {
          component: 'blog_article_error_boundary',
          error_type: 'article_loading_error',
          page: 'blog_article',
          article_id: articleId || 'unknown',
          severity: 'warning',
        },
        level: 'warning',
        extra: {
          errorName: error?.name || 'Unknown',
          errorMessage: error?.message || 'No message',
          articleId,
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
        `Blog article error: ${error?.message || 'Unknown'}`,
        `/blog/${articleId}`,
        'warning',
      );

      // Log en dev
      if (process.env.NODE_ENV === 'development') {
        console.error('[BlogArticleError] Erreur de chargement:', error);
        console.log('Article ID:', articleId, 'Retry count:', retryCount);
      }
    }
  }, [error, articleId, retryCount]);

  /**
   * Handler pour le retry avec logique exponentielle
   */
  const handleRetry = async () => {
    if (retryCount >= MAX_RETRIES) {
      // Track max retries atteint
      if (typeof window !== 'undefined' && window.dataLayer) {
        window.dataLayer.push({
          event: 'error_max_retries',
          error_type: 'blog_article_error',
          article_id: articleId,
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
        error_type: 'blog_article_error',
        article_id: articleId,
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
      <div className="blog-article-error">
        <div className="error-container">
          {/* Icône d'erreur */}
          <div className="error-icon">⚠️</div>

          {/* Titre */}
          <h2 className="error-title">Erreur de chargement</h2>

          {/* Message principal */}
          <p className="error-message">
            Une erreur est survenue lors du chargement de l&apos;article.
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

            <Link href="/blog" className="btn btn-secondary">
              📋 Voir tous les articles
            </Link>

            <Link href="/" className="btn btn-secondary">
              🏠 Retour à l&apos;accueil
            </Link>
          </div>

          {/* Support */}
          <div className="support-text">
            Si le problème persiste, contactez notre support à{' '}
            <a href="mailto:support@benew-dj.com">support@benew-dj.com</a>
            <br />
            <small>
              Référence: ART-{articleId || 'XXX'}-{Date.now()}-
              {Math.random().toString(36).substr(2, 5).toUpperCase()}
            </small>
          </div>
        </div>
      </div>
    </section>
  );
}
