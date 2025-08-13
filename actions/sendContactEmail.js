'use server';

import { Resend } from 'resend';
import { headers } from 'next/headers';
import {
  captureException,
  captureEmailError,
  captureMessage,
} from '../instrumentation';
import {
  validateContactEmail,
  prepareContactDataFromFormData,
  formatContactValidationErrors,
  detectBotBehavior,
} from '@/utils/schemas/contactEmailSchema';
import { limitBenewAPI } from '@/backend/rateLimiter';

// Configuration simple
const CONFIG = {
  rateLimiting: { enabled: true, preset: 'CONTACT_FORM' },
  validation: { botActionThreshold: 5 },
  email: { maxRetries: 2, retryDelay: 2000, timeout: 15000 },
  performance: { slowThreshold: 3000 },
};

// Initialisation Resend simple
let resend;
function initializeResend() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error(
      "RESEND_API_KEY manquante dans les variables d'environnement",
    );
  }
  resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

// Initialiser au démarrage
try {
  initializeResend();
} catch (error) {
  console.error('Erreur initialisation Resend:', error.message);
}

// Protection anti-doublons simple
const recentEmails = new Map();
const DUPLICATE_WINDOW = 5 * 60 * 1000; // 5 minutes

function isDuplicateEmail(data) {
  const key = `${data.email}:${data.subject}:${data.message.substring(0, 50)}`;
  const now = Date.now();

  // Nettoyer les anciens
  for (const [k, timestamp] of recentEmails.entries()) {
    if (now - timestamp > DUPLICATE_WINDOW) {
      recentEmails.delete(k);
    }
  }

  if (recentEmails.has(key)) {
    const sentAt = recentEmails.get(key);
    const timeLeft = DUPLICATE_WINDOW - (now - sentAt);
    return { isDuplicate: true, waitTime: timeLeft };
  }

  recentEmails.set(key, now);
  return { isDuplicate: false };
}

// Génération du contenu email
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

export async function sendContactEmail(formData) {
  const startTime = performance.now();

  try {
    // Vérifier que Resend est initialisé
    if (!resend) {
      initializeResend();
    }

    if (!process.env.RESEND_FROM_EMAIL || !process.env.RESEND_TO_EMAIL) {
      throw new Error(
        'Adresses email manquantes (RESEND_FROM_EMAIL, RESEND_TO_EMAIL)',
      );
    }

    // Rate Limiting
    if (CONFIG.rateLimiting.enabled) {
      const headersList = headers();
      const rateLimitCheck = await limitBenewAPI('contact')({
        headers: headersList,
        url: '/contact',
        method: 'POST',
      });

      if (rateLimitCheck) {
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
    const duplicateCheck = isDuplicateEmail(validatedData);
    if (duplicateCheck.isDuplicate) {
      const waitMinutes = Math.ceil(duplicateCheck.waitTime / 60000);
      return {
        success: false,
        message: `Message identique déjà envoyé récemment. Veuillez attendre ${waitMinutes} minute(s) avant de renvoyer.`,
        code: 'DUPLICATE_EMAIL',
        retryAfter: duplicateCheck.waitTime,
      };
    }

    // Génération et envoi de l'email
    const emailContent = generateEmailContent(validatedData);
    const emailSubject = `[Contact Benew] ${validatedData.subject}`;

    let lastError;
    let attempt = 0;
    const maxRetries = CONFIG.email.maxRetries;

    while (attempt <= maxRetries) {
      try {
        const emailResult = await Promise.race([
          resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL,
            to: [process.env.RESEND_TO_EMAIL],
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

        // Log seulement si lent
        if (duration > CONFIG.performance.slowThreshold) {
          captureMessage('Slow contact email detected', {
            level: 'warning',
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
          break;
        }

        // Attendre avant le retry
        await new Promise((resolve) =>
          setTimeout(resolve, CONFIG.email.retryDelay * attempt),
        );
      }
    }

    // Échec final après tous les retries
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
    // Catégorisation d'erreur simplifiée
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
