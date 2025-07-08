// actions/sendContactEmail.js
// Server Action production-ready pour l'envoi d'emails de contact
// Next.js 15 + Resend + Validation stricte + Monitoring complet

'use server';

import { Resend } from 'resend';
import { headers } from 'next/headers';
import {
  captureException,
  captureEmailError,
  captureValidationError,
  captureMessage,
} from '@/instrumentation';
import {
  validateContactEmail,
  prepareContactDataFromFormData,
  formatContactValidationErrors,
  detectBotBehavior,
} from '@/utils/schemas/contactEmailSchema';
import { limitBenewAPI } from '@/backend/rateLimiter';

// =============================
// CONFIGURATION PRODUCTION
// =============================

const CONTACT_EMAIL_CONFIG = {
  // Rate limiting
  rateLimiting: {
    enabled: true,
    preset: 'CONTACT_FORM',
  },

  // Validation
  validation: {
    strictMode: true,
    enableBotDetection: true,
    botActionThreshold: 5, // Score à partir duquel on bloque
    reviewThreshold: 3, // Score à partir duquel on flagge
  },

  // Email Resend
  email: {
    fromAddress: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
    toAddress: process.env.RESEND_TO_EMAIL || 'fathismael@gmail.com',
    maxRetries: 2,
    retryDelay: 2000,
    timeout: 15000, // 15 secondes max
  },

  // Anti-duplicate
  duplicateProtection: {
    enabled: true,
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxSize: 100, // Nombre d'emails en cache
  },

  // Performance
  performance: {
    slowThreshold: 3000, // 3 secondes
    alertThreshold: 5000, // 5 secondes
  },

  // Security
  security: {
    logSensitiveData: false,
    anonymizeUserData: true,
    enableContentAnalysis: true,
  },
};

// Variables d'environnement requises
const requiredEnvVars = [
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'RESEND_TO_EMAIL',
];

// Vérification des variables d'environnement au chargement
requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    console.error(
      `[Contact Email] Variable d'environnement manquante: ${envVar}`,
    );

    captureMessage(
      `Variable d'environnement manquante pour contact email: ${envVar}`,
      {
        level: 'error',
        tags: {
          component: 'contact_email',
          issue_type: 'missing_env_var',
          env_var: envVar,
        },
      },
    );
  }
});

// Initialisation Resend avec validation
let resend;
try {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY manquante');
  }
  resend = new Resend(process.env.RESEND_API_KEY);
} catch (error) {
  console.error('[Contact Email] Erreur initialisation Resend:', error.message);
  captureException(error, {
    tags: {
      component: 'contact_email',
      issue_type: 'resend_init_failed',
    },
  });
}

// =============================
// CACHE ANTI-DUPLICATE
// =============================

class ContactEmailCache {
  constructor() {
    this.cache = new Map();
    this.maxSize = CONTACT_EMAIL_CONFIG.duplicateProtection.maxSize;
    this.windowMs = CONTACT_EMAIL_CONFIG.duplicateProtection.windowMs;
  }

  generateKey(data) {
    // Créer une clé basée sur email + hash du contenu
    const contentHash = this.hashContent(
      `${data.name}${data.subject}${data.message}`,
    );
    return `${data.email}:${contentHash}`;
  }

  hashContent(content) {
    // Hash simple pour détecter contenu similaire
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  isDuplicate(data) {
    if (!CONTACT_EMAIL_CONFIG.duplicateProtection.enabled) {
      return false;
    }

    const key = this.generateKey(data);
    const now = Date.now();

    // Nettoyer les entrées expirées
    this.cleanup();

    // Vérifier si existe et pas expiré
    if (this.cache.has(key)) {
      const timestamp = this.cache.get(key);
      if (now - timestamp < this.windowMs) {
        return {
          isDuplicate: true,
          lastSent: timestamp,
          waitTime: this.windowMs - (now - timestamp),
        };
      }
    }

    // Ajouter/mettre à jour l'entrée
    this.cache.set(key, now);

    // Limiter la taille du cache
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    return { isDuplicate: false };
  }

  cleanup() {
    const now = Date.now();
    for (const [key, timestamp] of this.cache.entries()) {
      if (now - timestamp > this.windowMs) {
        this.cache.delete(key);
      }
    }
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      windowMs: this.windowMs,
    };
  }

  clear() {
    this.cache.clear();
  }
}

// Instance globale du cache
const emailCache = new ContactEmailCache();

// =============================
// MÉTRIQUES ET MONITORING
// =============================

class ContactEmailMetrics {
  constructor() {
    this.reset();
  }

  reset() {
    this.metrics = {
      // Compteurs
      totalAttempts: 0,
      successful: 0,
      failed: 0,
      blocked: 0,
      duplicates: 0,

      // Validation
      validationErrors: 0,
      botDetections: 0,
      spamDetections: 0,

      // Performance
      averageTime: 0,
      slowRequests: 0,

      // Erreurs
      resendErrors: 0,
      validationErrorDetails: new Map(),

      // Timestamps
      startTime: Date.now(),
      lastReset: Date.now(),
    };
  }

  recordAttempt() {
    this.metrics.totalAttempts++;
  }

  recordSuccess(duration) {
    this.metrics.successful++;
    this.updateAverageTime(duration);

    if (duration > CONTACT_EMAIL_CONFIG.performance.slowThreshold) {
      this.metrics.slowRequests++;
    }
  }

  recordFailure(type, details = {}) {
    this.metrics.failed++;

    switch (type) {
      case 'validation':
        this.metrics.validationErrors++;
        if (details.field) {
          const count =
            this.metrics.validationErrorDetails.get(details.field) || 0;
          this.metrics.validationErrorDetails.set(details.field, count + 1);
        }
        break;
      case 'bot':
        this.metrics.botDetections++;
        break;
      case 'spam':
        this.metrics.spamDetections++;
        break;
      case 'resend':
        this.metrics.resendErrors++;
        break;
      case 'duplicate':
        this.metrics.duplicates++;
        break;
      case 'blocked':
        this.metrics.blocked++;
        break;
    }
  }

  updateAverageTime(duration) {
    const total = this.metrics.successful;
    this.metrics.averageTime =
      (this.metrics.averageTime * (total - 1) + duration) / total;
  }

  getStats() {
    const uptime = Date.now() - this.metrics.startTime;
    const successRate =
      this.metrics.totalAttempts > 0
        ? (this.metrics.successful / this.metrics.totalAttempts) * 100
        : 0;

    return {
      ...this.metrics,
      uptime,
      successRate: Math.round(successRate * 100) / 100,
      requestsPerMinute: this.metrics.totalAttempts / (uptime / 60000),
      validationErrorDetails: Object.fromEntries(
        this.metrics.validationErrorDetails,
      ),
      cacheStats: emailCache.getStats(),
    };
  }
}

// Instance globale des métriques
const emailMetrics = new ContactEmailMetrics();

// =============================
// FONCTIONS UTILITAIRES
// =============================

/**
 * Anonymise les données utilisateur pour les logs
 */
function anonymizeContactData(data) {
  if (!CONTACT_EMAIL_CONFIG.security.anonymizeUserData) {
    return data;
  }

  return {
    name: data.name ? `${data.name[0]}***` : '',
    email: data.email
      ? `${data.email.split('@')[0][0]}***@${data.email.split('@')[1]}`
      : '',
    subject: data.subject ? `${data.subject.substring(0, 10)}...` : '',
    message: data.message ? `${data.message.substring(0, 20)}...` : '',
  };
}

/**
 * Génère le contenu de l'email en texte brut
 */
function generateEmailContent(data) {
  const timestamp = new Date().toLocaleString('fr-FR', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return `NOUVEAU MESSAGE DE CONTACT - BENEW
======================================

📧 Reçu le : ${timestamp}

👤 EXPÉDITEUR
Nom : ${data.name}
Email : ${data.email}

📋 DÉTAILS
Sujet : ${data.subject}

💬 MESSAGE
${data.message}

---
Cet email a été envoyé automatiquement depuis le formulaire de contact du site Benew.
Vous pouvez répondre directement à cet email pour contacter ${data.name}.

🔒 ID de référence : ${Date.now().toString(36).toUpperCase()}
`;
}

/**
 * Valide l'environnement et la configuration
 */
function validateEnvironment() {
  const issues = [];

  if (!resend) {
    issues.push('Resend non initialisé');
  }

  if (!process.env.RESEND_FROM_EMAIL || !process.env.RESEND_TO_EMAIL) {
    issues.push('Adresses email manquantes');
  }

  if (issues.length > 0) {
    throw new Error(`Configuration invalide: ${issues.join(', ')}`);
  }
}

// =============================
// FONCTION PRINCIPALE
// =============================

/**
 * Envoie un email de contact avec validation complète et sécurité
 * @param {FormData} formData - Données du formulaire de contact
 * @returns {Promise<Object>} Résultat de l'envoi
 */
export async function sendContactEmail(formData) {
  const startTime = performance.now();
  emailMetrics.recordAttempt();

  try {
    // 1. Validation de l'environnement
    validateEnvironment();

    // 2. Rate Limiting
    if (CONTACT_EMAIL_CONFIG.rateLimiting.enabled) {
      const headersList = headers();
      const rateLimitCheck = await limitBenewAPI('contact')({
        headers: headersList,
        url: '/contact',
        method: 'POST',
      });

      if (rateLimitCheck) {
        emailMetrics.recordFailure('blocked');

        captureMessage('Contact form rate limited', {
          level: 'warning',
          tags: {
            component: 'contact_email',
            issue_type: 'rate_limited',
          },
        });

        return {
          success: false,
          message:
            'Trop de messages envoyés récemment. Veuillez patienter avant de renvoyer.',
          code: 'RATE_LIMITED',
          retryAfter: 300, // 5 minutes
        };
      }
    }

    // 3. Préparation et validation des données
    const rawData = prepareContactDataFromFormData(formData);

    const validationResult = await validateContactEmail(rawData);
    if (!validationResult.success) {
      emailMetrics.recordFailure('validation', {
        field: Object.keys(validationResult.errors || {})[0],
        errorCount: validationResult.errorCount,
      });

      captureValidationError(new Error('Contact validation failed'), {
        field: 'contact_form',
        form: 'contact',
        validationType: 'yup_contact',
        tags: {
          component: 'contact_email',
          validation_step: 'yup',
        },
        extra: {
          errors: validationResult.errors,
          errorCount: validationResult.errorCount,
        },
      });

      return {
        success: false,
        message: formatContactValidationErrors(validationResult.errors),
        code: 'VALIDATION_FAILED',
        errors: validationResult.errors,
        validationError: true,
      };
    }

    const validatedData = validationResult.data;

    // 4. Détection de bot/spam
    if (CONTACT_EMAIL_CONFIG.validation.enableBotDetection) {
      const botAnalysis = detectBotBehavior(validatedData, {
        fillTime: formData.get('_fillTime'), // Temps de remplissage si disponible
      });

      if (
        botAnalysis.riskScore >=
        CONTACT_EMAIL_CONFIG.validation.botActionThreshold
      ) {
        emailMetrics.recordFailure('bot');

        captureMessage('Bot behavior detected in contact form', {
          level: 'warning',
          tags: {
            component: 'contact_email',
            issue_type: 'bot_detected',
            risk_score: botAnalysis.riskScore,
          },
          extra: {
            indicators: botAnalysis.indicators,
            action: botAnalysis.action,
            anonymizedData: anonymizeContactData(validatedData),
          },
        });

        return {
          success: false,
          message:
            "Votre message n'a pas pu être envoyé. Veuillez réessayer plus tard.",
          code: 'BOT_DETECTED',
          reference: Date.now().toString(36).toUpperCase(),
        };
      }

      // Log des comportements suspects mais non bloquants
      if (
        botAnalysis.riskScore >= CONTACT_EMAIL_CONFIG.validation.reviewThreshold
      ) {
        captureMessage('Suspicious contact form behavior', {
          level: 'info',
          tags: {
            component: 'contact_email',
            issue_type: 'suspicious_behavior',
            risk_score: botAnalysis.riskScore,
          },
          extra: {
            indicators: botAnalysis.indicators,
            anonymizedData: anonymizeContactData(validatedData),
          },
        });
      }
    }

    // 5. Vérification des doublons
    const duplicateCheck = emailCache.isDuplicate(validatedData);
    if (duplicateCheck.isDuplicate) {
      emailMetrics.recordFailure('duplicate');

      const waitMinutes = Math.ceil(duplicateCheck.waitTime / 60000);

      captureMessage('Duplicate contact email detected', {
        level: 'info',
        tags: {
          component: 'contact_email',
          issue_type: 'duplicate_email',
        },
        extra: {
          waitTime: duplicateCheck.waitTime,
          lastSent: duplicateCheck.lastSent,
          anonymizedEmail: anonymizeContactData(validatedData).email,
        },
      });

      return {
        success: false,
        message: `Message identique déjà envoyé récemment. Veuillez attendre ${waitMinutes} minute(s) avant de renvoyer.`,
        code: 'DUPLICATE_EMAIL',
        retryAfter: duplicateCheck.waitTime,
      };
    }

    // 6. Génération du contenu email
    const emailContent = generateEmailContent(validatedData);
    const emailSubject = `[Contact Benew] ${validatedData.subject}`;

    // 7. Envoi via Resend avec retry
    let lastError;
    let attempt = 0;
    const maxRetries = CONTACT_EMAIL_CONFIG.email.maxRetries;

    while (attempt <= maxRetries) {
      try {
        const emailResult = await Promise.race([
          resend.emails.send({
            from: CONTACT_EMAIL_CONFIG.email.fromAddress,
            to: [CONTACT_EMAIL_CONFIG.email.toAddress],
            subject: emailSubject,
            text: emailContent,
            replyTo: validatedData.email,
            headers: {
              'X-Contact-Source': 'Benew-Contact-Form',
              'X-Contact-Version': '2.0',
              'X-Contact-Timestamp': new Date().toISOString(),
            },
          }),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error('Email timeout')),
              CONTACT_EMAIL_CONFIG.email.timeout,
            ),
          ),
        ]);

        // 8. Succès - enregistrer les métriques
        const duration = performance.now() - startTime;
        emailMetrics.recordSuccess(duration);

        captureMessage('Contact email sent successfully', {
          level: 'info',
          tags: {
            component: 'contact_email',
            operation: 'send_success',
          },
          extra: {
            emailId: emailResult.data?.id,
            duration,
            attempt: attempt + 1,
            anonymizedData: anonymizeContactData(validatedData),
            cacheStats: emailCache.getStats(),
          },
        });

        // Log de performance si lent
        if (duration > CONTACT_EMAIL_CONFIG.performance.slowThreshold) {
          captureMessage('Slow contact email detected', {
            level:
              duration > CONTACT_EMAIL_CONFIG.performance.alertThreshold
                ? 'warning'
                : 'info',
            tags: {
              component: 'contact_email',
              performance: 'slow_operation',
            },
            extra: {
              duration,
              threshold: CONTACT_EMAIL_CONFIG.performance.slowThreshold,
              emailId: emailResult.data?.id,
            },
          });
        }

        return {
          success: true,
          message:
            'Votre message a été envoyé avec succès. Nous vous répondrons dans les plus brefs délais.',
          emailId: emailResult.data?.id,
          reference: Date.now().toString(36).toUpperCase(),
          performance: {
            duration,
            attempt: attempt + 1,
            grade:
              duration < 1000 ? 'excellent' : duration < 3000 ? 'good' : 'slow',
          },
        };
      } catch (error) {
        lastError = error;
        attempt++;

        const isLastAttempt = attempt > maxRetries;
        const duration = performance.now() - startTime;

        // Log de l'erreur
        captureEmailError(error, {
          emailType: 'contact',
          tags: {
            contact_email_retry: true,
            attempt: attempt,
            is_last_attempt: isLastAttempt,
          },
          extra: {
            duration,
            maxRetries,
            errorType: error.message?.includes('timeout')
              ? 'timeout'
              : 'resend_api',
            anonymizedData: anonymizeContactData(validatedData),
          },
        });

        if (isLastAttempt) {
          emailMetrics.recordFailure('resend');
          break;
        }

        // Attendre avant le retry
        await new Promise((resolve) =>
          setTimeout(resolve, CONTACT_EMAIL_CONFIG.email.retryDelay * attempt),
        );
      }
    }

    // 9. Échec final après tous les retries
    const finalDuration = performance.now() - startTime;

    captureMessage('Contact email failed after all retries', {
      level: 'error',
      tags: {
        component: 'contact_email',
        operation: 'send_failed_final',
      },
      extra: {
        attempts: maxRetries + 1,
        finalDuration,
        lastError: lastError?.message,
        anonymizedData: anonymizeContactData(validatedData),
      },
    });

    return {
      success: false,
      message:
        "Impossible d'envoyer votre message pour le moment. Veuillez réessayer plus tard.",
      code: 'SEND_FAILED',
      reference: Date.now().toString(36).toUpperCase(),
      error:
        process.env.NODE_ENV === 'production' ? undefined : lastError?.message,
      performance: {
        duration: finalDuration,
        attempts: maxRetries + 1,
        grade: 'failed',
      },
    };
  } catch (error) {
    // Erreur inattendue globale
    const duration = performance.now() - startTime;
    emailMetrics.recordFailure('unexpected');

    // Catégoriser l'erreur
    let errorCategory = 'unknown';
    let errorLevel = 'error';

    if (/rate.?limit/i.test(error.message)) {
      errorCategory = 'rate_limiting';
      errorLevel = 'warning';
    } else if (/validation/i.test(error.message)) {
      errorCategory = 'validation';
      errorLevel = 'warning';
    } else if (/resend|email|send/i.test(error.message)) {
      errorCategory = 'email_service';
    } else if (/environment|config/i.test(error.message)) {
      errorCategory = 'configuration';
    }

    captureException(error, {
      tags: {
        component: 'contact_email',
        operation: 'send_contact_email',
        error_category: errorCategory,
      },
      extra: {
        duration,
        emailMetrics: emailMetrics.getStats(),
        config: {
          rateLimitingEnabled: CONTACT_EMAIL_CONFIG.rateLimiting.enabled,
          botDetectionEnabled:
            CONTACT_EMAIL_CONFIG.validation.enableBotDetection,
          duplicateProtectionEnabled:
            CONTACT_EMAIL_CONFIG.duplicateProtection.enabled,
        },
      },
      level: errorLevel,
    });

    // Message d'erreur selon la catégorie
    let userMessage =
      "Une erreur est survenue lors de l'envoi de votre message.";
    if (errorCategory === 'email_service') {
      userMessage =
        "Service d'email temporairement indisponible. Veuillez réessayer plus tard.";
    } else if (errorCategory === 'validation') {
      userMessage =
        'Erreur de validation des données. Veuillez vérifier votre saisie.';
    } else if (errorCategory === 'configuration') {
      userMessage =
        "Erreur de configuration système. Veuillez contacter l'administrateur.";
    }

    return {
      success: false,
      message: userMessage,
      code: `${errorCategory.toUpperCase()}_ERROR`,
      reference: Date.now().toString(36).toUpperCase(),
      error: process.env.NODE_ENV === 'production' ? undefined : error.message,
      performance: {
        duration,
        grade: 'error',
      },
    };
  }
}

// =============================
// FONCTIONS UTILITAIRES EXPORT
// =============================

/**
 * Obtient les statistiques du système de contact email
 * @returns {Object} Statistiques détaillées
 */
export async function getContactEmailStats() {
  return {
    metrics: emailMetrics.getStats(),
    cache: emailCache.getStats(),
    config: {
      rateLimitingEnabled: CONTACT_EMAIL_CONFIG.rateLimiting.enabled,
      botDetectionEnabled: CONTACT_EMAIL_CONFIG.validation.enableBotDetection,
      duplicateProtectionEnabled:
        CONTACT_EMAIL_CONFIG.duplicateProtection.enabled,
      maxRetries: CONTACT_EMAIL_CONFIG.email.maxRetries,
      timeout: CONTACT_EMAIL_CONFIG.email.timeout,
    },
    environment: {
      hasResendKey: !!process.env.RESEND_API_KEY,
      hasFromEmail: !!process.env.RESEND_FROM_EMAIL,
      hasToEmail: !!process.env.RESEND_TO_EMAIL,
      resendInitialized: !!resend,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Réinitialise les métriques et le cache (utile pour les tests)
 * @returns {Object} Résultat de la réinitialisation
 */
export async function resetContactEmailData() {
  const beforeStats = {
    metricsCount: emailMetrics.metrics.totalAttempts,
    cacheSize: emailCache.cache.size,
  };

  emailMetrics.reset();
  emailCache.clear();

  captureMessage('Contact email data reset', {
    level: 'info',
    tags: {
      component: 'contact_email',
      operation: 'data_reset',
    },
    extra: beforeStats,
  });

  return {
    success: true,
    message: 'Données de contact email réinitialisées',
    beforeStats,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Vérifie la santé du système de contact email
 * @returns {Object} État de santé
 */
export async function checkContactEmailHealth() {
  const health = {
    status: 'healthy',
    checks: {},
    timestamp: new Date().toISOString(),
  };

  try {
    // Vérifier Resend
    health.checks.resend = {
      status: resend ? 'ok' : 'error',
      message: resend ? 'Resend initialisé' : 'Resend non initialisé',
    };

    // Vérifier les variables d'environnement
    const missingEnvVars = requiredEnvVars.filter(
      (envVar) => !process.env[envVar],
    );
    health.checks.environment = {
      status: missingEnvVars.length === 0 ? 'ok' : 'error',
      message:
        missingEnvVars.length === 0
          ? "Toutes les variables d'environnement présentes"
          : `Variables manquantes: ${missingEnvVars.join(', ')}`,
      missingVars: missingEnvVars,
    };

    // Vérifier les métriques
    const stats = emailMetrics.getStats();
    health.checks.metrics = {
      status:
        stats.successRate >= 80
          ? 'ok'
          : stats.successRate >= 60
            ? 'warning'
            : 'error',
      message: `Taux de succès: ${stats.successRate}%`,
      successRate: stats.successRate,
      totalAttempts: stats.totalAttempts,
    };

    // Déterminer le statut global
    const statuses = Object.values(health.checks).map((check) => check.status);
    if (statuses.includes('error')) {
      health.status = 'unhealthy';
    } else if (statuses.includes('warning')) {
      health.status = 'degraded';
    }
  } catch (error) {
    health.status = 'unhealthy';
    health.error = error.message;

    captureException(error, {
      tags: {
        component: 'contact_email',
        operation: 'health_check',
      },
    });
  }

  return health;
}
