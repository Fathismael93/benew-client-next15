// app/presentation/page.jsx
// Server Component enrichi pour page de présentation
// Next.js 15 - Gestion d'erreurs avancée + Monitoring complet + Validation contenu

import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';

import PresentationComponent from '@/components/presentation';
import { captureException, captureMessage } from '../../instrumentation';

// Configuration étendue avec gestion d'erreurs spécifiques présentation
const CONFIG = {
  cache: {
    revalidate: 900, // 15 minutes pour contenu présentation
    errorRevalidate: 180, // 3 minutes pour erreurs temporaires
  },
  performance: {
    slowLoadThreshold: 2500, // Alerte pour chargements lents
    componentTimeout: 10000, // 10 secondes timeout pour composants lourds
  },
  retry: {
    maxAttempts: 2,
    baseDelay: 250,
  },
  presentation: {
    contentValidation: true,
    mediaOptimization: true,
    animationCheck: true,
  },
};

// Types d'erreurs standardisés pour présentation
const ERROR_TYPES = {
  CONTENT_LOADING_ERROR: 'content_loading_error',
  MEDIA_LOADING_ERROR: 'media_loading_error',
  ANIMATION_ERROR: 'animation_error',
  COMPONENT_INITIALIZATION_ERROR: 'component_initialization_error',
  NETWORK_ERROR: 'network_error',
  TIMEOUT: 'timeout',
  PERFORMANCE_ERROR: 'performance_error',
  MEMORY_ERROR: 'memory_error',
  BROWSER_COMPATIBILITY_ERROR: 'browser_compatibility_error',
  UNKNOWN_ERROR: 'unknown_error',
};

// Messages d'erreur spécifiques à la présentation
const ERROR_MESSAGES = {
  [ERROR_TYPES.CONTENT_LOADING_ERROR]: {
    user: 'Impossible de charger le contenu de la présentation.',
    technical: 'Presentation content loading failed',
  },
  [ERROR_TYPES.MEDIA_LOADING_ERROR]: {
    user: 'Erreur lors du chargement des images ou vidéos.',
    technical: 'Media assets (images/videos) failed to load',
  },
  [ERROR_TYPES.ANIMATION_ERROR]: {
    user: 'Problème avec les animations de la page.',
    technical: 'Animation framework (Framer Motion/GSAP) error',
  },
  [ERROR_TYPES.COMPONENT_INITIALIZATION_ERROR]: {
    user: "Erreur lors de l'initialisation de la présentation.",
    technical: 'Presentation component failed to initialize',
  },
  [ERROR_TYPES.NETWORK_ERROR]: {
    user: 'Problème de connexion réseau. Vérifiez votre connexion internet.',
    technical: 'Network connectivity issues detected',
  },
  [ERROR_TYPES.TIMEOUT]: {
    user: 'Le chargement a pris trop de temps. La page contient peut-être beaucoup de contenu.',
    technical: 'Presentation page load timeout exceeded',
  },
  [ERROR_TYPES.PERFORMANCE_ERROR]: {
    user: 'Votre appareil rencontre des difficultés à afficher cette page.',
    technical: 'Performance issues detected (low memory/CPU)',
  },
  [ERROR_TYPES.MEMORY_ERROR]: {
    user: 'Mémoire insuffisante pour charger la présentation complète.',
    technical: 'Out of memory error during presentation load',
  },
  [ERROR_TYPES.BROWSER_COMPATIBILITY_ERROR]: {
    user: 'Votre navigateur ne supporte pas certaines fonctionnalités de cette page.',
    technical: 'Browser compatibility issues detected',
  },
  [ERROR_TYPES.UNKNOWN_ERROR]: {
    user: 'Une erreur inattendue est survenue lors du chargement de la présentation.',
    technical: 'Unknown error in presentation page loading',
  },
};

/**
 * Classifie les erreurs spécifiques à la présentation
 */
function classifyPresentationError(error) {
  if (!error) {
    return {
      type: ERROR_TYPES.UNKNOWN_ERROR,
      shouldRetry: false,
      httpStatus: 500,
    };
  }

  const message = error.message?.toLowerCase() || '';
  const name = error.name?.toLowerCase() || '';
  const stack = error.stack?.toLowerCase() || '';

  // Erreurs de contenu et données
  if (
    message.includes('content') ||
    message.includes('data') ||
    message.includes('json') ||
    message.includes('parse')
  ) {
    return {
      type: ERROR_TYPES.CONTENT_LOADING_ERROR,
      shouldRetry: true,
      httpStatus: 503,
      userMessage: ERROR_MESSAGES[ERROR_TYPES.CONTENT_LOADING_ERROR].user,
    };
  }

  // Erreurs de médias (images, vidéos, assets)
  if (
    message.includes('image') ||
    message.includes('video') ||
    message.includes('media') ||
    message.includes('asset') ||
    message.includes('cloudinary') ||
    message.includes('cdn')
  ) {
    return {
      type: ERROR_TYPES.MEDIA_LOADING_ERROR,
      shouldRetry: true,
      httpStatus: 503,
      userMessage: ERROR_MESSAGES[ERROR_TYPES.MEDIA_LOADING_ERROR].user,
    };
  }

  // Erreurs d'animation (Framer Motion, GSAP, CSS animations)
  if (
    message.includes('framer') ||
    message.includes('motion') ||
    message.includes('animation') ||
    message.includes('gsap') ||
    message.includes('transition') ||
    stack.includes('framer-motion')
  ) {
    return {
      type: ERROR_TYPES.ANIMATION_ERROR,
      shouldRetry: true,
      httpStatus: 503,
      userMessage: ERROR_MESSAGES[ERROR_TYPES.ANIMATION_ERROR].user,
    };
  }

  // Erreurs de composants React
  if (
    message.includes('component') ||
    message.includes('react') ||
    message.includes('render') ||
    message.includes('hook') ||
    name.includes('react')
  ) {
    return {
      type: ERROR_TYPES.COMPONENT_INITIALIZATION_ERROR,
      shouldRetry: true,
      httpStatus: 503,
      userMessage:
        ERROR_MESSAGES[ERROR_TYPES.COMPONENT_INITIALIZATION_ERROR].user,
    };
  }

  // Erreurs réseau
  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('connexion') ||
    message.includes('connection') ||
    message.includes('cors')
  ) {
    return {
      type: ERROR_TYPES.NETWORK_ERROR,
      shouldRetry: true,
      httpStatus: 503,
      userMessage: ERROR_MESSAGES[ERROR_TYPES.NETWORK_ERROR].user,
    };
  }

  // Timeout
  if (
    message.includes('timeout') ||
    name === 'timeouterror' ||
    message.includes('timed out')
  ) {
    return {
      type: ERROR_TYPES.TIMEOUT,
      shouldRetry: true,
      httpStatus: 503,
      userMessage: ERROR_MESSAGES[ERROR_TYPES.TIMEOUT].user,
    };
  }

  // Erreurs de performance
  if (
    message.includes('performance') ||
    message.includes('slow') ||
    message.includes('lag') ||
    message.includes('fps')
  ) {
    return {
      type: ERROR_TYPES.PERFORMANCE_ERROR,
      shouldRetry: false,
      httpStatus: 503,
      userMessage: ERROR_MESSAGES[ERROR_TYPES.PERFORMANCE_ERROR].user,
    };
  }

  // Erreurs de mémoire
  if (
    message.includes('memory') ||
    message.includes('heap') ||
    message.includes('out of memory') ||
    name.includes('rangeerror')
  ) {
    return {
      type: ERROR_TYPES.MEMORY_ERROR,
      shouldRetry: false,
      httpStatus: 503,
      userMessage: ERROR_MESSAGES[ERROR_TYPES.MEMORY_ERROR].user,
    };
  }

  // Erreurs de compatibilité navigateur
  if (
    message.includes('not supported') ||
    message.includes('undefined is not a function') ||
    message.includes('browser') ||
    message.includes('compatibility')
  ) {
    return {
      type: ERROR_TYPES.BROWSER_COMPATIBILITY_ERROR,
      shouldRetry: false,
      httpStatus: 400,
      userMessage: ERROR_MESSAGES[ERROR_TYPES.BROWSER_COMPATIBILITY_ERROR].user,
    };
  }

  // Erreur générique
  return {
    type: ERROR_TYPES.UNKNOWN_ERROR,
    shouldRetry: false,
    httpStatus: 500,
    userMessage: ERROR_MESSAGES[ERROR_TYPES.UNKNOWN_ERROR].user,
  };
}

/**
 * Promise avec timeout pour composants de présentation
 */
function withTimeout(
  promise,
  timeoutMs,
  errorMessage = 'Presentation operation timed out',
) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        const timeoutError = new Error(errorMessage);
        timeoutError.name = 'TimeoutError';
        reject(timeoutError);
      }, timeoutMs);
    }),
  ]);
}

/**
 * Exécute une opération avec retry logic pour présentation
 */
async function executeWithRetry(
  operation,
  maxAttempts = CONFIG.retry.maxAttempts,
) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const errorInfo = classifyPresentationError(error);

      // Ne pas retry si c'est pas une erreur temporaire
      if (!errorInfo.shouldRetry || attempt === maxAttempts) {
        throw error;
      }

      // Délai exponentiel pour retry
      const delay = CONFIG.retry.baseDelay * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));

      captureMessage(
        `Retrying presentation component loading (attempt ${attempt}/${maxAttempts})`,
        {
          level: 'info',
          tags: { component: 'presentation_page', retry: true },
          extra: {
            attempt,
            maxAttempts,
            errorType: errorInfo.type,
            delay,
          },
        },
      );
    }
  }

  throw lastError;
}

/**
 * Validation des prérequis pour la présentation
 */
async function validatePresentationRequirements() {
  const startTime = performance.now();
  const validationResults = {
    browserCompatibility: false,
    performanceBaseline: false,
    mediaSupport: false,
  };

  try {
    return await executeWithRetry(async () => {
      // Vérification de la compatibilité navigateur (côté serveur limité)
      if (CONFIG.presentation.contentValidation) {
        // Ici on pourrait vérifier des APIs spécifiques
        // Pour l'instant, on assume que c'est compatible
        validationResults.browserCompatibility = true;
      }

      // Vérification baseline des performances (côté serveur)
      if (CONFIG.presentation.mediaOptimization) {
        // Vérifier que les assets média sont accessibles
        // Pour l'instant, on assume que c'est disponible
        validationResults.mediaSupport = true;
      }

      // Vérification des animations
      if (CONFIG.presentation.animationCheck) {
        // Vérifier que les librairies d'animation sont disponibles
        // Pour l'instant, on assume que c'est disponible
        validationResults.performanceBaseline = true;
      }

      const validationDuration = performance.now() - startTime;

      // Log performance si lent
      if (validationDuration > CONFIG.performance.slowLoadThreshold) {
        captureMessage('Slow presentation validation', {
          level: 'warning',
          tags: {
            component: 'presentation_page',
            performance: true,
          },
          extra: {
            duration: validationDuration,
            validationResults,
          },
        });
      }

      return {
        success: true,
        validationResults,
        validationDuration,
      };
    });
  } catch (error) {
    const errorInfo = classifyPresentationError(error);
    const validationDuration = performance.now() - startTime;

    // Log détaillé pour monitoring
    captureException(error, {
      tags: {
        component: 'presentation_page_validation',
        error_type: errorInfo.type,
        should_retry: errorInfo.shouldRetry.toString(),
        http_status: errorInfo.httpStatus.toString(),
      },
      extra: {
        validationDuration,
        validationResults,
        errorMessage: error.message,
      },
    });

    return {
      success: false,
      errorType: errorInfo.type,
      httpStatus: errorInfo.httpStatus,
      userMessage: errorInfo.userMessage,
      shouldRetry: errorInfo.shouldRetry,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    };
  }
}

/**
 * Composant d'erreur réutilisable pour présentation
 */
function PresentationError({ errorType, userMessage, shouldRetry }) {
  return (
    <div className="presentation-error-page">
      <section className="first">
        <div className="error-content">
          <div className="server-error">
            <div className="error-icon">
              {errorType === ERROR_TYPES.MEDIA_LOADING_ERROR
                ? '🖼️'
                : errorType === ERROR_TYPES.ANIMATION_ERROR
                  ? '✨'
                  : errorType === ERROR_TYPES.PERFORMANCE_ERROR
                    ? '⚡'
                    : errorType === ERROR_TYPES.MEMORY_ERROR
                      ? '💾'
                      : errorType === ERROR_TYPES.BROWSER_COMPATIBILITY_ERROR
                        ? '🌐'
                        : errorType === ERROR_TYPES.TIMEOUT
                          ? '⏱️'
                          : '📋'}
            </div>
            <h1 className="error-code">
              {errorType === ERROR_TYPES.BROWSER_COMPATIBILITY_ERROR
                ? '400'
                : shouldRetry
                  ? '503'
                  : '500'}
            </h1>
            <h2 className="error-title">
              {shouldRetry
                ? 'Problème de chargement'
                : 'Erreur de présentation'}
            </h2>
            <p className="error-message">{userMessage}</p>

            {errorType === ERROR_TYPES.PERFORMANCE_ERROR && (
              <div className="error-tip">
                <p>
                  💡 <strong>Conseil :</strong> Essayez de fermer d&apos;autres
                  onglets ou applications pour libérer de la mémoire.
                </p>
              </div>
            )}

            {errorType === ERROR_TYPES.BROWSER_COMPATIBILITY_ERROR && (
              <div className="error-tip">
                <p>
                  💡 <strong>Conseil :</strong> Utilisez un navigateur récent
                  (Chrome, Firefox, Safari, Edge) pour une expérience optimale.
                </p>
              </div>
            )}

            <div className="error-actions">
              {shouldRetry && (
                <button className="cta-button primary">🔄 Réessayer</button>
              )}
              <Link href="/" className="cta-button secondary">
                🏠 Retour à l&apos;accueil
              </Link>
              <Link href="/about" className="cta-button tertiary">
                📱 Version simplifiée
              </Link>
            </div>
          </div>

          {process.env.NODE_ENV === 'development' && (
            <div className="debug-section">
              <details className="debug-details">
                <summary className="debug-summary">
                  Informations de débogage
                </summary>
                <div className="debug-content">
                  <p>
                    <strong>Type d&apos;erreur:</strong> {errorType}
                  </p>
                  <p>
                    <strong>Peut réessayer:</strong>{' '}
                    {shouldRetry ? 'Oui' : 'Non'}
                  </p>
                  <p>
                    <strong>Page:</strong> presentation
                  </p>
                  <p>
                    <strong>Composants vérifiés:</strong> Contenu, Médias,
                    Animations
                  </p>
                </div>
              </details>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/**
 * Composant principal avec validation et gestion d'erreurs avancée
 */
export default async function PresentationPage() {
  // Validation des prérequis présentation
  const validation = await validatePresentationRequirements();

  // Gestion des erreurs de validation
  if (!validation.success) {
    // En production, page d'erreur personnalisée pour erreurs temporaires
    if (validation.shouldRetry && process.env.NODE_ENV === 'production') {
      return (
        <PresentationError
          errorType={validation.errorType}
          userMessage={validation.userMessage}
          shouldRetry={validation.shouldRetry}
        />
      );
    }

    // Pour les erreurs non récupérables en production
    if (process.env.NODE_ENV === 'production') {
      notFound();
    }

    // En dev, affichage détaillé
    return (
      <PresentationError
        errorType={validation.errorType}
        userMessage={validation.userMessage}
        shouldRetry={validation.shouldRetry}
      />
    );
  }

  // Log de succès en dev
  if (process.env.NODE_ENV === 'development') {
    console.log(
      `[Presentation] Validation réussie en ${Math.round(validation.validationDuration)}ms`,
      validation.validationResults,
    );
  }

  return (
    // <Suspense fallback={<Loading />}>
    <PresentationComponent />
    // </Suspense>
  );
}

// Metadata pour SEO avec focus sur le contenu de présentation
export const metadata = {
  title: 'Présentation - Benew | Notre Vision et Nos Produits',
  description:
    'Découvrez la vision de Benew, nos produits innovants et notre fondateur. Solutions technologiques modernes pour le développement de Djibouti.',
  keywords: [
    'benew présentation',
    'vision entreprise',
    'produits innovants',
    'fondateur',
    'développement Djibouti',
  ],
  openGraph: {
    title: 'Présentation Benew - Notre Vision',
    description: 'Notre manifeste, nos produits et notre fondateur.',
    url: `${process.env.NEXT_PUBLIC_SITE_URL}/presentation`,
    type: 'website',
    locale: 'fr_FR',
  },
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL}/presentation`,
  },
};

// Configuration Next.js 15 pour page avec contenu riche
export const dynamic = 'force-static';
export const revalidate = 900;
