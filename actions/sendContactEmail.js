'use server';

import { Resend } from 'resend';
import { headers } from 'next/headers';
import { captureException, captureEmailError } from '../instrumentation';
import {
  validateContactEmail,
  prepareContactDataFromFormData,
  formatContactValidationErrors,
  detectBotBehavior,
} from '@/utils/schemas/contactEmailSchema';
import { limitBenewAPI } from '@/backend/rateLimiter';

// Initialisation Resend simple
const resend = new Resend(process.env.RESEND_API_KEY);

// Anti-doublons simple
const recentEmails = new Map();
const DUPLICATE_WINDOW = 5 * 60 * 1000; // 5 minutes

function isDuplicateEmail(data) {
  const key = `${data.email}:${data.subject}`;
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
  try {
    // Vérifier la configuration
    if (
      !process.env.RESEND_API_KEY ||
      !process.env.RESEND_FROM_EMAIL ||
      !process.env.RESEND_TO_EMAIL
    ) {
      throw new Error('Configuration email manquante');
    }

    // Rate Limiting
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
      };
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
      };
    }

    const validatedData = validationResult.data;

    // Détection de bot simple
    const botAnalysis = detectBotBehavior(validatedData, {
      fillTime: formData.get('_fillTime'),
    });

    if (botAnalysis.isSuspicious) {
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
      };
    }

    // Génération et envoi de l'email
    const emailContent = generateEmailContent(validatedData);
    const emailSubject = `[Contact Benew] ${validatedData.subject}`;

    // Tentative d'envoi avec retry simple
    let lastError;
    const maxRetries = 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const emailResult = await resend.emails.send({
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
        });

        return {
          success: true,
          message:
            'Votre message a été envoyé avec succès. Nous vous répondrons dans les plus brefs délais.',
          emailId: emailResult.data?.id,
          reference: Date.now().toString(36).toUpperCase(),
        };
      } catch (error) {
        lastError = error;

        if (attempt < maxRetries) {
          // Attendre avant le retry
          await new Promise((resolve) =>
            setTimeout(resolve, 2000 * (attempt + 1)),
          );
        }
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
    // Log de l'erreur
    captureException(error, {
      tags: { component: 'contact_email' },
    });

    // Message d'erreur selon le type
    let errorMessage =
      "Une erreur est survenue lors de l'envoi de votre message.";

    if (/resend|email|send/i.test(error.message)) {
      errorMessage =
        "Service d'email temporairement indisponible. Veuillez réessayer plus tard.";
    } else if (/validation/i.test(error.message)) {
      errorMessage =
        'Erreur de validation des données. Veuillez vérifier votre saisie.';
    } else if (/environment|config/i.test(error.message)) {
      errorMessage =
        "Erreur de configuration système. Veuillez contacter l'administrateur.";
    }

    return {
      success: false,
      message: errorMessage,
      code: 'SYSTEM_ERROR',
      reference: Date.now().toString(36).toUpperCase(),
      error: process.env.NODE_ENV === 'production' ? undefined : error.message,
    };
  }
}
