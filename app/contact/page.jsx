// app/contact/page.jsx
// Server Component enrichi pour page de contact
// Next.js 15 - Gestion d'erreurs avancée + Monitoring complet + Validation

import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';

import Contact from '@/components/contact';
import { captureException, captureMessage } from '../../instrumentation';
import Loading from './loading';

// Configuration étendue avec gestion d'erreurs spécifiques contact
const CONFIG = {
  cache: {
    revalidate: 600, // 10 minutes pour page de contact
    errorRevalidate: 120, // 2 minutes pour erreurs temporaires
  },
  performance: {
    slowLoadThreshold: 2000, // Alerte pour chargements lents
    componentTimeout: 8000, // 8 secondes timeout pour composants
  },
  retry: {
    maxAttempts: 2,
    baseDelay: 200,
  },
  contact: {
    formValidation: true,
    emailServiceCheck: true,
    rateLimiting: true,
  },
};

// Types d'erreurs standardisés pour contact
const ERROR_TYPES = {
  FORM_INITIALIZATION_ERROR: 'form_initialization_error',
  EMAIL_SERVICE_ERROR: 'email_service_error',
  VALIDATION_SERVICE_ERROR: 'validation_service_error',
  COMPONENT_LOADING_ERROR: 'component_loading_error',
  NETWORK_ERROR: 'network_error',
  TIMEOUT: 'timeout',
  RATE_LIMIT_ERROR: 'rate_limit_error',
  PERMISSION_ERROR: 'permission_error',
  CONFIG_ERROR: 'config_error',
  UNKNOWN_ERROR: 'unknown_error',
};

// Messages d'erreur spécifiques au contact
const ERROR_MESSAGES = {
  [ERROR_TYPES.FORM_INITIALIZATION_ERROR]: {
    user: "Impossible d'initialiser le formulaire de contact.",
    technical: 'Contact form component failed to initialize',
  },
  [ERROR_TYPES.EMAIL_SERVICE_ERROR]: {
    user: 'Service de messagerie temporairement indisponible.',
    technical: 'Email service (SendGrid/SMTP) connection failed',
  },
  [ERROR_TYPES.VALIDATION_SERVICE_ERROR]: {
    user: 'Service de validation des formulaires indisponible.',
    technical: 'Form validation service unavailable',
  },
  [ERROR_TYPES.COMPONENT_LOADING_ERROR]: {
    user: 'Erreur lors du chargement des éléments de la page.',
    technical: 'Contact component loading failed',
  },
  [ERROR_TYPES.NETWORK_ERROR]: {
    user: 'Problème de connexion réseau. Vérifiez votre connexion internet.',
    technical: 'Network connectivity issues detected',
  },
  [ERROR_TYPES.TIMEOUT]: {
    user: 'Le chargement a pris trop de temps. Le serveur est peut-être surchargé.',
    technical: 'Contact page load timeout exceeded',
  },
  [ERROR_TYPES.RATE_LIMIT_ERROR]: {
    user: 'Trop de tentatives. Veuillez patienter avant de réessayer.',
    technical: 'Rate limit exceeded for contact page',
  },
  [ERROR_TYPES.PERMISSION_ERROR]: {
    user: "Vous n'avez pas les permissions nécessaires pour accéder à cette page.",
    technical: 'Insufficient permissions for contact page',
  },
  [ERROR_TYPES.CONFIG_ERROR]: {
    user: 'Erreur de configuration du formulaire.',
    technical: 'Contact form configuration error',
  },
  [ERROR_TYPES.UNKNOWN_ERROR]: {
    user: 'Une erreur inattendue est survenue lors du chargement de la page de contact.',
    technical: 'Unknown error in contact page loading',
  },
};

/**
 * Classifie les erreurs spécifiques au contact
 */
function classifyContactError(error) {
  if (!error) {
    return {
      type: ERROR_TYPES.UNKNOWN_ERROR,
      shouldRetry: false,
      httpStatus: 500,
    };
  }

  const message = error.message?.toLowerCase() || '';
  const name = error.name?.toLowerCase() || '';

  // Erreurs de formulaire et validation
  if (
    message.includes('form') ||
    message.includes('validation') ||
    message.includes('input') ||
    message.includes('field')
  ) {
    return {
      type: ERROR_TYPES.FORM_INITIALIZATION_ERROR,
      shouldRetry: true,
      httpStatus: 503,
      userMessage: ERROR_MESSAGES[ERROR_TYPES.FORM_INITIALIZATION_ERROR].user,
    };
  }

  // Erreurs d'email/SMTP/SendGrid
  if (
    message.includes('email') ||
    message.includes('sendgrid') ||
    message.includes('smtp') ||
    message.includes('mail') ||
    message.includes('nodemailer')
  ) {
    return {
      type: ERROR_TYPES.EMAIL_SERVICE_ERROR,
      shouldRetry: true,
      httpStatus: 503,
      userMessage: ERROR_MESSAGES[ERROR_TYPES.EMAIL_SERVICE_ERROR].user,
    };
  }

  // Erreurs de composants (Framer Motion, animations)
  if (
    message.includes('framer') ||
    message.includes('motion') ||
    message.includes('animation') ||
    message.includes('component') ||
    message.includes('react')
  ) {
    return {
      type: ERROR_TYPES.COMPONENT_LOADING_ERROR,
      shouldRetry: true,
      httpStatus: 503,
      userMessage: ERROR_MESSAGES[ERROR_TYPES.COMPONENT_LOADING_ERROR].user,
    };
  }

  // Erreurs réseau
  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('connexion') ||
    message.includes('connection')
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

  // Rate limiting
  if (
    message.includes('rate limit') ||
    message.includes('too many') ||
    message.includes('quota exceeded')
  ) {
    return {
      type: ERROR_TYPES.RATE_LIMIT_ERROR,
      shouldRetry: false,
      httpStatus: 429,
      userMessage: ERROR_MESSAGES[ERROR_TYPES.RATE_LIMIT_ERROR].user,
    };
  }

  // Erreurs de permission
  if (
    message.includes('permission') ||
    message.includes('unauthorized') ||
    message.includes('forbidden') ||
    message.includes('access denied')
  ) {
    return {
      type: ERROR_TYPES.PERMISSION_ERROR,
      shouldRetry: false,
      httpStatus: 403,
      userMessage: ERROR_MESSAGES[ERROR_TYPES.PERMISSION_ERROR].user,
    };
  }

  // Erreurs de configuration
  if (
    message.includes('config') ||
    message.includes('environment') ||
    message.includes('variable') ||
    message.includes('missing')
  ) {
    return {
      type: ERROR_TYPES.CONFIG_ERROR,
      shouldRetry: false,
      httpStatus: 500,
      userMessage: ERROR_MESSAGES[ERROR_TYPES.CONFIG_ERROR].user,
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
 * Exécute une opération avec retry logic pour contact
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
      const errorInfo = classifyContactError(error);

      // Ne pas retry si c'est pas une erreur temporaire
      if (!errorInfo.shouldRetry || attempt === maxAttempts) {
        throw error;
      }

      // Délai exponentiel pour retry
      const delay = CONFIG.retry.baseDelay * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));

      captureMessage(
        `Retrying contact component loading (attempt ${attempt}/${maxAttempts})`,
        {
          level: 'info',
          tags: { component: 'contact_page', retry: true },
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
 * Validation des services requis pour le contact
 */
async function validateContactServices() {
  const startTime = performance.now();
  const validationResults = {
    emailService: false,
    formValidation: false,
    rateLimit: false,
  };

  try {
    return await executeWithRetry(async () => {
      // Vérification de la configuration email
      if (CONFIG.contact.emailServiceCheck) {
        const emailConfigured = !!(
          process.env.SENDGRID_API_KEY ||
          process.env.SMTP_HOST ||
          process.env.EMAIL_SERVICE_URL
        );

        if (!emailConfigured) {
          throw new Error('Email service not configured');
        }
        validationResults.emailService = true;
      }

      // Vérification des services de validation
      if (CONFIG.contact.formValidation) {
        // Ici on pourrait vérifier un service externe de validation
        // Pour l'instant, on assume que c'est disponible
        validationResults.formValidation = true;
      }

      // Vérification du rate limiting
      if (CONFIG.contact.rateLimiting) {
        // Ici on pourrait vérifier Redis ou autre service de rate limiting
        // Pour l'instant, on assume que c'est disponible
        validationResults.rateLimit = true;
      }

      const validationDuration = performance.now() - startTime;

      // Log performance
      if (validationDuration > CONFIG.performance.slowLoadThreshold) {
        captureMessage('Slow contact services validation', {
          level: 'warning',
          tags: {
            component: 'contact_page',
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
    const errorInfo = classifyContactError(error);
    const validationDuration = performance.now() - startTime;

    // Log détaillé pour monitoring
    captureException(error, {
      tags: {
        component: 'contact_page_validation',
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
 * Composant d'erreur réutilisable pour contact
 */
function ContactError({ errorType, userMessage, shouldRetry }) {
  return (
    <div className="contact-error-page">
      <section className="first">
        <div className="error-content">
          <div className="server-error">
            <div className="error-icon">
              {errorType === ERROR_TYPES.EMAIL_SERVICE_ERROR
                ? '📧'
                : errorType === ERROR_TYPES.FORM_INITIALIZATION_ERROR
                  ? '📝'
                  : errorType === ERROR_TYPES.NETWORK_ERROR
                    ? '🌐'
                    : errorType === ERROR_TYPES.TIMEOUT
                      ? '⏱️'
                      : errorType === ERROR_TYPES.RATE_LIMIT_ERROR
                        ? '⚡'
                        : '⚠️'}
            </div>
            <h1 className="error-code">
              {errorType === ERROR_TYPES.RATE_LIMIT_ERROR
                ? '429'
                : errorType === ERROR_TYPES.PERMISSION_ERROR
                  ? '403'
                  : shouldRetry
                    ? '503'
                    : '500'}
            </h1>
            <h2 className="error-title">
              {shouldRetry
                ? 'Service temporairement indisponible'
                : 'Erreur du formulaire de contact'}
            </h2>
            <p className="error-message">{userMessage}</p>

            {errorType === ERROR_TYPES.EMAIL_SERVICE_ERROR && (
              <div className="error-tip">
                <p>
                  💡 <strong>Conseil :</strong> Vous pouvez nous contacter
                  directement par téléphone ou sur nos réseaux sociaux.
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
              {errorType !== ERROR_TYPES.EMAIL_SERVICE_ERROR && (
                <Link href="/about" className="cta-button tertiary">
                  📱 Autres moyens de contact
                </Link>
              )}
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
                    <strong>Page:</strong> contact
                  </p>
                  <p>
                    <strong>Services vérifiés:</strong> Email, Validation, Rate
                    Limit
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
export default async function ContactPage() {
  // Validation des services contact
  const validation = await validateContactServices();

  // Gestion des erreurs de validation
  if (!validation.success) {
    // En production, page d'erreur personnalisée pour erreurs temporaires
    if (validation.shouldRetry && process.env.NODE_ENV === 'production') {
      return (
        <ContactError
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
      <ContactError
        errorType={validation.errorType}
        userMessage={validation.userMessage}
        shouldRetry={validation.shouldRetry}
      />
    );
  }

  // Log de succès en dev
  if (process.env.NODE_ENV === 'development') {
    console.log(
      `[Contact] Services validés en ${Math.round(validation.validationDuration)}ms`,
      validation.validationResults,
    );
  }

  // Rendu normal avec Suspense - Error Boundary géré par error.jsx
  return (
    <Suspense fallback={<Loading />}>
      <Contact />
    </Suspense>
  );
}

// Metadata pour SEO avec monitoring en cas d'erreur
export const metadata = {
  title: 'Contact - Benew | Contactez-nous pour vos projets',
  description:
    'Contactez Benew pour vos projets de templates et applications web & mobile. Nous vous accompagnons dans vos besoins digitaux à Djibouti.',
  keywords: [
    'contact benew',
    'devis template',
    'développement web djibouti',
    'contact développeur',
    'projet digital',
    'Djibouti',
  ],
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Contact Benew - Démarrez votre projet',
    description:
      'Contactez-nous pour transformer vos idées en solutions digitales.',
    url: `${process.env.NEXT_PUBLIC_SITE_URL}/contact`,
    type: 'website',
    locale: 'fr_FR',
  },
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL}/contact`,
  },
};

// Configuration Next.js 15 pour page statique avec revalidation
export const dynamic = 'force-static';
export const revalidate = 600;
