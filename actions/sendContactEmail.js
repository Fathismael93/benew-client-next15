'use server';

import { Resend } from 'resend';
import { headers } from 'next/headers';
import {
  captureException,
  captureEmailError,
  captureMessage,
} from '@/instrumentation';
import {
  validateContactEmail,
  prepareContactDataFromFormData,
  formatContactValidationErrors,
  detectBotBehavior,
} from '@/utils/schemas/contactEmailSchema';
import { limitBenewAPI } from '@/backend/rateLimiter';
import { initializeBenewConfig } from '@/utils/doppler';

// Configuration consolidée
const CONFIG = {
  rateLimiting: { enabled: true, preset: 'CONTACT_FORM' },
  validation: { botActionThreshold: 5, reviewThreshold: 3 },
  email: { maxRetries: 2, retryDelay: 2000, timeout: 15000 },
  duplicateProtection: { windowMs: 5 * 60 * 1000, maxSize: 100 },
  performance: { slowThreshold: 3000, alertThreshold: 5000 },
};

// Configuration Doppler
let dopplerConfig = null;
let isConfigLoaded = false;

async function loadDopplerConfig() {
  if (dopplerConfig && isConfigLoaded) return dopplerConfig;

  try {
    const benewConfig = await initializeBenewConfig();
    dopplerConfig = benewConfig.email || {};
    isConfigLoaded = true;
    return dopplerConfig;
  } catch (error) {
    dopplerConfig = {
      resendApiKey: process.env.RESEND_API_KEY,
      fromAddress: process.env.RESEND_FROM_EMAIL,
      toAddress: process.env.RESEND_TO_EMAIL,
    };
    isConfigLoaded = true;
    return dopplerConfig;
  }
}

// Initialisation Resend
let resend;
async function initializeResend() {
  try {
    const config = await loadDopplerConfig();
    if (!config.resendApiKey) {
      throw new Error('RESEND_API_KEY manquante dans la configuration');
    }
    resend = new Resend(config.resendApiKey);
    return resend;
  } catch (error) {
    captureException(error, {
      tags: { component: 'contact_email', issue_type: 'resend_init_failed' },
    });

    if (process.env.RESEND_API_KEY) {
      resend = new Resend(process.env.RESEND_API_KEY);
    }
    return resend;
  }
}

initializeResend();

// Cache anti-duplicate simplifié
class ContactEmailCache {
  constructor() {
    this.cache = new Map();
    this.maxSize = CONFIG.duplicateProtection.maxSize;
    this.windowMs = CONFIG.duplicateProtection.windowMs;
  }

  generateKey(data) {
    const contentHash = this.hashContent(
      `${data.name}${data.subject}${data.message}`,
    );
    return `${data.email}:${contentHash}`;
  }

  hashContent(content) {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  isDuplicate(data) {
    const key = this.generateKey(data);
    const now = Date.now();

    // Nettoyer les entrées expirées
    this.cleanup();

    if (this.cache.has(key)) {
      const timestamp = this.cache.get(key);
      if (now - timestamp < this.windowMs) {
        return {
          isDuplicate: true,
          waitTime: this.windowMs - (now - timestamp),
        };
      }
    }

    this.cache.set(key, now);

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

  clear() {
    this.cache.clear();
  }
}

const emailCache = new ContactEmailCache();

// Métriques simplifiées
class ContactEmailMetrics {
  constructor() {
    this.reset();
  }

  reset() {
    this.metrics = {
      totalAttempts: 0,
      successful: 0,
      failed: 0,
      blocked: 0,
      duplicates: 0,
      botDetections: 0,
      startTime: Date.now(),
    };
  }

  recordAttempt() {
    this.metrics.totalAttempts++;
  }

  recordSuccess() {
    this.metrics.successful++;
  }

  recordFailure(type) {
    this.metrics.failed++;
    switch (type) {
      case 'bot':
        this.metrics.botDetections++;
        break;
      case 'duplicate':
        this.metrics.duplicates++;
        break;
      case 'blocked':
        this.metrics.blocked++;
        break;
    }
  }

  getStats() {
    const successRate =
      this.metrics.totalAttempts > 0
        ? (this.metrics.successful / this.metrics.totalAttempts) * 100
        : 0;

    return {
      ...this.metrics,
      successRate: Math.round(successRate * 100) / 100,
      uptime: Date.now() - this.metrics.startTime,
    };
  }
}

const emailMetrics = new ContactEmailMetrics();

// Utilitaires
function anonymizeContactData(data) {
  return {
    name: data.name ? `${data.name[0]}***` : '',
    email: data.email
      ? `${data.email.split('@')[0][0]}***@${data.email.split('@')[1]}`
      : '',
    subject: data.subject ? `${data.subject.substring(0, 10)}...` : '',
    message: data.message ? `${data.message.substring(0, 20)}...` : '',
  };
}

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

async function validateEnvironment() {
  if (!resend) {
    await initializeResend();
  }

  const config = await loadDopplerConfig();
  if (!config.fromAddress || !config.toAddress) {
    throw new Error('Adresses email manquantes dans la configuration');
  }
}

export async function sendContactEmail(formData) {
  const startTime = performance.now();
  emailMetrics.recordAttempt();

  try {
    await validateEnvironment();

    // Rate Limiting
    if (CONFIG.rateLimiting.enabled) {
      const headersList = headers();
      const rateLimitCheck = await limitBenewAPI('contact')({
        headers: headersList,
        url: '/contact',
        method: 'POST',
      });

      if (rateLimitCheck) {
        emailMetrics.recordFailure('blocked');
        return {
          success: false,
          message:
            'Trop de messages envoyés récemment. Veuillez patienter avant de renvoyer.',
          code: 'RATE_LIMITED',
          retryAfter: 300,
        };
      }
    }

    // Validation des données
    const rawData = prepareContactDataFromFormData(formData);
    const validationResult = await validateContactEmail(rawData);

    if (!validationResult.success) {
      emailMetrics.recordFailure('validation');
      return {
        success: false,
        message: formatContactValidationErrors(validationResult.errors),
        code: 'VALIDATION_FAILED',
        errors: validationResult.errors,
        validationError: true,
      };
    }

    const validatedData = validationResult.data;

    // Détection de bot
    const botAnalysis = detectBotBehavior(validatedData, {
      fillTime: formData.get('_fillTime'),
    });

    if (botAnalysis.riskScore >= CONFIG.validation.botActionThreshold) {
      emailMetrics.recordFailure('bot');

      captureMessage('Bot behavior detected in contact form', {
        level: 'warning',
        tags: { component: 'contact_email', issue_type: 'bot_detected' },
        extra: {
          riskScore: botAnalysis.riskScore,
          indicators: botAnalysis.indicators,
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

    // Vérification des doublons
    const duplicateCheck = emailCache.isDuplicate(validatedData);
    if (duplicateCheck.isDuplicate) {
      emailMetrics.recordFailure('duplicate');
      const waitMinutes = Math.ceil(duplicateCheck.waitTime / 60000);

      return {
        success: false,
        message: `Message identique déjà envoyé récemment. Veuillez attendre ${waitMinutes} minute(s) avant de renvoyer.`,
        code: 'DUPLICATE_EMAIL',
        retryAfter: duplicateCheck.waitTime,
      };
    }

    // Génération et envoi de l'email
    const config = await loadDopplerConfig();
    const emailContent = generateEmailContent(validatedData);
    const emailSubject = `[Contact Benew] ${validatedData.subject}`;

    let lastError;
    let attempt = 0;
    const maxRetries = CONFIG.email.maxRetries;

    while (attempt <= maxRetries) {
      try {
        const emailResult = await Promise.race([
          resend.emails.send({
            from: config.fromAddress || process.env.RESEND_FROM_EMAIL,
            to: [config.toAddress || process.env.RESEND_TO_EMAIL],
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
              CONFIG.email.timeout,
            ),
          ),
        ]);

        const duration = performance.now() - startTime;
        emailMetrics.recordSuccess();

        // Log seulement si lent
        if (duration > CONFIG.performance.slowThreshold) {
          captureMessage('Slow contact email detected', {
            level:
              duration > CONFIG.performance.alertThreshold ? 'warning' : 'info',
            tags: { component: 'contact_email', performance: 'slow_operation' },
            extra: { duration, threshold: CONFIG.performance.slowThreshold },
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

        if (attempt > maxRetries) {
          emailMetrics.recordFailure('resend');
          break;
        }

        await new Promise((resolve) =>
          setTimeout(resolve, CONFIG.email.retryDelay * attempt),
        );
      }
    }

    // Échec final
    captureEmailError(lastError, {
      emailType: 'contact',
      tags: { contact_email_retry: true, attempts: maxRetries + 1 },
    });

    return {
      success: false,
      message:
        "Impossible d'envoyer votre message pour le moment. Veuillez réessayer plus tard.",
      code: 'SEND_FAILED',
      reference: Date.now().toString(36).toUpperCase(),
      error:
        process.env.NODE_ENV === 'production' ? undefined : lastError?.message,
    };
  } catch (error) {
    emailMetrics.recordFailure('unexpected');

    // Catégorisation simplifiée
    let errorCategory = 'unknown';
    if (/rate.?limit/i.test(error.message)) {
      errorCategory = 'rate_limiting';
    } else if (/validation/i.test(error.message)) {
      errorCategory = 'validation';
    } else if (/resend|email|send/i.test(error.message)) {
      errorCategory = 'email_service';
    } else if (/environment|config/i.test(error.message)) {
      errorCategory = 'configuration';
    }

    captureException(error, {
      tags: { component: 'contact_email', error_category: errorCategory },
      extra: { duration: performance.now() - startTime },
    });

    const errorMessages = {
      email_service:
        "Service d'email temporairement indisponible. Veuillez réessayer plus tard.",
      validation:
        'Erreur de validation des données. Veuillez vérifier votre saisie.',
      configuration:
        "Erreur de configuration système. Veuillez contacter l'administrateur.",
      default: "Une erreur est survenue lors de l'envoi de votre message.",
    };

    return {
      success: false,
      message: errorMessages[errorCategory] || errorMessages.default,
      code: `${errorCategory.toUpperCase()}_ERROR`,
      reference: Date.now().toString(36).toUpperCase(),
      error: process.env.NODE_ENV === 'production' ? undefined : error.message,
    };
  }
}

export async function getContactEmailStats() {
  const config = await loadDopplerConfig();

  return {
    metrics: emailMetrics.getStats(),
    cache: { size: emailCache.cache.size },
    config: {
      rateLimitingEnabled: CONFIG.rateLimiting.enabled,
      maxRetries: CONFIG.email.maxRetries,
      timeout: CONFIG.email.timeout,
      configSource: dopplerConfig ? 'doppler' : 'env',
    },
    environment: {
      hasResendKey: !!(config.resendApiKey || process.env.RESEND_API_KEY),
      hasFromEmail: !!(config.fromAddress || process.env.RESEND_FROM_EMAIL),
      hasToEmail: !!(config.toAddress || process.env.RESEND_TO_EMAIL),
      resendInitialized: !!resend,
    },
    timestamp: new Date().toISOString(),
  };
}

export async function resetContactEmailData() {
  const beforeStats = {
    metricsCount: emailMetrics.metrics.totalAttempts,
    cacheSize: emailCache.cache.size,
  };

  emailMetrics.reset();
  emailCache.clear();

  return {
    success: true,
    message: 'Données de contact email réinitialisées',
    beforeStats,
    timestamp: new Date().toISOString(),
  };
}

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

    // Vérifier configuration
    const config = await loadDopplerConfig();
    const requiredKeys = ['resendApiKey', 'fromAddress', 'toAddress'];
    const missingKeys = requiredKeys.filter(
      (key) => !config[key] && !process.env[key.toUpperCase()],
    );

    health.checks.configuration = {
      status: missingKeys.length === 0 ? 'ok' : 'error',
      message:
        missingKeys.length === 0
          ? 'Configuration email complète'
          : `Configuration manquante: ${missingKeys.join(', ')}`,
      configSource: dopplerConfig ? 'doppler' : 'env',
    };

    // Vérifier métriques
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
    };

    // Statut global
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
      tags: { component: 'contact_email', operation: 'health_check' },
    });
  }

  return health;
}

export async function refreshEmailConfiguration() {
  try {
    dopplerConfig = null;
    isConfigLoaded = false;
    await loadDopplerConfig();
    await initializeResend();

    return {
      success: true,
      message: 'Configuration email rafraîchie depuis Doppler',
      configSource: 'doppler',
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    captureException(error, {
      tags: { component: 'contact_email', operation: 'config_refresh_error' },
    });

    return {
      success: false,
      message: 'Erreur lors du rafraîchissement de la configuration',
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}
