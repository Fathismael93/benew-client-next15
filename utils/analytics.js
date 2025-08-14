// utils/analytics.gtm.js
// Google Analytics 4 / GTM Utilities – Next.js 15
// Version GTM-first corrigée – GDPR/CCPA compliant – Consent Mode v2
// Août 2025

import { sendGTMEvent } from '@next/third-parties/google';

// ===========================
// INITIALISATION SÉCURISÉE
// ===========================

// Initialisation immédiate du dataLayer pour éviter les pertes d'événements
if (typeof window !== 'undefined') {
  window.dataLayer = window.dataLayer || [];
}

// Queue pour événements précoces (avant que GTM soit prêt)
const eventQueue = [];
let isGTMReady = false;

// Vérifier périodiquement si GTM est chargé
if (typeof window !== 'undefined') {
  const checkGTMReady = setInterval(() => {
    if (window.google_tag_manager) {
      isGTMReady = true;
      // Vider la queue d'événements en attente
      eventQueue.forEach(({ eventName, parameters }) => {
        window.dataLayer.push({ event: eventName, ...parameters });
      });
      eventQueue.length = 0;
      clearInterval(checkGTMReady);

      if (process.env.NODE_ENV === 'development') {
        console.log('[GTM] ✅ GTM initialisé, queue vidée');
      }
    }
  }, 100);

  // Timeout après 10 secondes
  setTimeout(() => clearInterval(checkGTMReady), 10000);
}

// ===========================
// GESTION DU CONSENTEMENT
// ===========================

/**
 * Vérifie si le consentement Analytics est accordé
 */
export const hasAnalyticsConsent = () => {
  if (typeof window === 'undefined') return false;

  try {
    const consent = localStorage.getItem('analytics_consent');
    return consent === 'granted';
  } catch {
    return false;
  }
};

/**
 * Vérifie si le consentement Marketing est accordé
 */
export const hasMarketingConsent = () => {
  if (typeof window === 'undefined') return false;

  try {
    const consent = localStorage.getItem('marketing_consent');
    return consent === 'granted';
  } catch {
    return false;
  }
};

/**
 * Met à jour les préférences de consentement
 */
export const updateConsent = (consentUpdates = {}) => {
  if (typeof window === 'undefined') return;

  const defaultConsent = {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted',
    ...consentUpdates,
  };

  // Sauvegarder en localStorage
  try {
    localStorage.setItem('analytics_consent', defaultConsent.analytics_storage);
    localStorage.setItem('marketing_consent', defaultConsent.ad_storage);
    localStorage.setItem('consent_timestamp', String(Date.now()));
  } catch (e) {
    console.warn('[GTM] Impossible de sauvegarder le consentement:', e);
  }

  // Push vers GTM (format Consent Mode v2)
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: 'consent_update',
    consent: defaultConsent,
  });

  if (process.env.NODE_ENV === 'development') {
    console.log('[GTM] Consentement mis à jour:', defaultConsent);
  }
};

/**
 * Accorde le consentement
 */
export const grantConsent = (analytics = false, marketing = false) => {
  updateConsent({
    analytics_storage: analytics ? 'granted' : 'denied',
    ad_storage: marketing ? 'granted' : 'denied',
    ad_user_data: marketing ? 'granted' : 'denied',
    ad_personalization: marketing ? 'granted' : 'denied',
  });
};

/**
 * Révoque tous les consentements
 */
export const revokeConsent = () => {
  updateConsent({
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
};

/**
 * Initialise le consentement pour GTM (à appeler au chargement)
 */
export const initializeGTMConsent = () => {
  if (typeof window === 'undefined') return;

  window.dataLayer = window.dataLayer || [];

  // Événement d'initialisation GTM
  window.dataLayer.push({
    event: 'gtm.init',
    'gtm.start': new Date().getTime(),
  });

  // Configuration initiale du consentement (par défaut: denied)
  window.dataLayer.push({
    event: 'consent_default',
    consent: {
      wait_for_update: 500,
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      region: ['FR', 'DJ', 'EU'], // France, Djibouti, Europe
    },
  });

  // Si consentement déjà accordé précédemment, le mettre à jour
  const hasConsent = hasAnalyticsConsent();
  const hasMarketing = hasMarketingConsent();

  if (hasConsent || hasMarketing) {
    grantConsent(hasConsent, hasMarketing);
  }
};

// ===========================
// TRACKING GÉNÉRIQUE ROBUSTE
// ===========================

/**
 * Envoie un événement à GTM/GA4 de manière robuste
 */
export const trackEvent = (eventName, parameters = {}) => {
  // Vérifier le consentement
  if (!hasAnalyticsConsent()) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[GTM] Event bloqué - pas de consentement: ${eventName}`);
    }
    return;
  }

  if (typeof window !== 'undefined') {
    const eventData = {
      event: eventName,
      ...parameters,
      timestamp: new Date().toISOString(), // Ajout timestamp pour debug
    };

    // STRATÉGIE 1: Push direct vers dataLayer (TOUJOURS fonctionnel)
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(eventData);

    // STRATÉGIE 2: Si GTM pas encore prêt, mettre en queue
    if (!isGTMReady && eventQueue.length < 100) {
      // Limite de sécurité
      eventQueue.push({ eventName, parameters });
    }

    // STRATÉGIE 3: Tenter sendGTMEvent (peut échouer si appelé trop tôt)
    try {
      sendGTMEvent(eventData);
    } catch (err) {
      // Pas critique car déjà dans dataLayer
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          '[GTM] sendGTMEvent a échoué (normal au démarrage):',
          err.message,
        );
      }
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[GTM] Event envoyé:', eventName, parameters);
    }
  }
};

// ===========================
// ÉVÉNEMENTS BUSINESS
// ===========================

export const trackBlogView = (articleId, articleTitle) =>
  trackEvent('blog_article_view', {
    article_id: articleId,
    article_title: articleTitle,
    content_type: 'blog_post',
    event_category: 'blog',
  });

export const trackTemplateView = (templateId, templateName) =>
  trackEvent('template_view', {
    template_id: templateId,
    template_name: templateName,
    content_type: 'template',
    event_category: 'templates',
  });

export const trackApplicationView = (
  applicationId,
  applicationName,
  templateId,
) =>
  trackEvent('application_view', {
    application_id: applicationId,
    application_name: applicationName,
    template_id: templateId,
    content_type: 'application',
    event_category: 'applications',
  });

export const trackContactSubmission = (success = true, errorMessage = null) => {
  trackEvent('contact_form_submit', {
    success,
    error_message: errorMessage,
    event_category: 'contact',
    event_label: success ? 'success' : 'error',
  });

  // Conversion si succès et consentement marketing
  if (success && hasMarketingConsent()) {
    trackEvent('conversion', {
      event_category: 'conversion',
      event_label: 'contact_form',
      conversion_type: 'lead_generation',
    });
  }
};

// ===========================
// E-COMMERCE GA4
// ===========================

export const trackOrderStart = (application) => {
  if (!application?.application_id) {
    console.error('[GTM] trackOrderStart: données application manquantes');
    return;
  }

  trackEvent('begin_checkout', {
    currency: 'DJF',
    value: application.application_fee || 0,
    items: [
      {
        item_id: application.application_id,
        item_name: application.application_name,
        item_category: application.application_category || 'uncategorized',
        item_brand: 'Benew',
        item_variant: application.application_level || 'standard',
        price: application.application_fee || 0,
        quantity: 1,
      },
    ],
    event_category: 'ecommerce',
  });
};

export const trackPurchase = (
  application,
  transactionId,
  paymentMethod = 'mobile_money',
) => {
  if (!application?.application_id || !transactionId) {
    console.error('[GTM] trackPurchase: données manquantes');
    return;
  }

  const totalValue =
    (application.application_fee || 0) + (application.application_rent || 0);

  trackEvent('purchase', {
    transaction_id: transactionId,
    currency: 'DJF',
    value: totalValue,
    payment_type: paymentMethod,
    items: [
      {
        item_id: application.application_id,
        item_name: application.application_name,
        item_category: application.application_category || 'uncategorized',
        item_brand: 'Benew',
        item_variant: application.application_level || 'standard',
        price: application.application_fee || 0,
        quantity: 1,
      },
    ],
    event_category: 'ecommerce',
  });

  // Conversion si consentement marketing
  if (hasMarketingConsent()) {
    trackEvent('conversion', {
      event_category: 'conversion',
      event_label: 'purchase',
      value: totalValue,
      conversion_type: 'ecommerce_purchase',
      transaction_id: transactionId,
    });
  }
};

export const trackCheckoutAbandonment = (
  application,
  abandonStep,
  reason = 'unknown',
) => {
  if (!application?.application_id) {
    console.error(
      '[GTM] trackCheckoutAbandonment: données application manquantes',
    );
    return;
  }

  trackEvent('checkout_abandon', {
    abandon_step: abandonStep,
    abandon_reason: reason,
    application_id: application.application_id,
    template_id: application.template_id || 'unknown',
    value: application.application_fee || 0,
    currency: 'DJF',
    event_category: 'ecommerce',
  });
};

// ===========================
// UI & NAVIGATION
// ===========================

export const trackModalOpen = (modalName, context = '') =>
  trackEvent('modal_open', {
    modal_name: modalName,
    context,
    event_category: 'ui_interaction',
  });

export const trackModalClose = (modalName, action = 'close') =>
  trackEvent('modal_close', {
    modal_name: modalName,
    close_action: action,
    event_category: 'ui_interaction',
  });

export const trackNavigation = (linkText, destination, location = 'unknown') =>
  trackEvent('navigation_click', {
    link_text: linkText,
    link_url: destination,
    link_location: location,
    event_category: 'navigation',
  });

export const trackSocialClick = (platform, location = 'unknown') =>
  trackEvent('social_click', {
    social_platform: platform,
    click_location: location,
    event_category: 'social',
  });

// ===========================
// ERREURS & EXCEPTIONS
// ===========================

export const trackError = (errorMessage, errorPage, severity = 'error') => {
  // Les erreurs sont trackées même sans consentement (sécurité)
  if (typeof window !== 'undefined') {
    const errorData = {
      event: 'exception',
      description: errorMessage,
      page: errorPage,
      fatal: severity === 'fatal',
      error_severity: severity,
      event_category: 'errors',
    };

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(errorData);

    // Log aussi dans Sentry si disponible
    if (window.Sentry && severity === 'fatal') {
      window.Sentry.captureException(new Error(errorMessage), {
        tags: { page: errorPage },
      });
    }
  }
};

// ===========================
// PERFORMANCE
// ===========================

const getPerformanceBucket = (loadTime) => {
  if (loadTime < 1000) return 'fast';
  if (loadTime < 3000) return 'average';
  if (loadTime < 5000) return 'slow';
  return 'very_slow';
};

export const trackPagePerformance = (pageName, loadTime, fromCache = false) => {
  if (loadTime > 100) {
    trackEvent('page_load_time', {
      page_name: pageName,
      from_cache: fromCache,
      load_time_ms: Math.round(loadTime),
      performance_bucket: getPerformanceBucket(loadTime),
      event_category: 'performance',
    });
  }
};

export const trackWebVitals = (name, value, id, rating = 'unknown') => {
  trackEvent('web_vitals', {
    metric_name: name,
    metric_value: Math.round(name === 'CLS' ? value * 1000 : value),
    metric_id: id,
    metric_rating: rating,
    event_category: 'performance',
    non_interaction: true,
  });
};

// ===========================
// DEBUG & UTILITAIRES
// ===========================

export const debugGA = () => {
  if (process.env.NODE_ENV === 'development') {
    console.log('[GTM] Debug Info:', {
      sendGTMEvent_available: typeof sendGTMEvent === 'function',
      gtm_ready: isGTMReady,
      dataLayer_exists:
        typeof window !== 'undefined' && Array.isArray(window.dataLayer),
      dataLayer_length:
        typeof window !== 'undefined' ? window.dataLayer?.length : 0,
      analytics_consent: hasAnalyticsConsent(),
      marketing_consent: hasMarketingConsent(),
      consent_timestamp:
        typeof window !== 'undefined'
          ? localStorage.getItem('consent_timestamp')
          : null,
      queued_events: eventQueue.length,
    });

    // Afficher les derniers événements du dataLayer
    if (typeof window !== 'undefined' && window.dataLayer) {
      console.log(
        '[GTM] Derniers événements dataLayer:',
        window.dataLayer.slice(-5),
      );
    }
  }
};

export const testTracking = () => {
  if (process.env.NODE_ENV === 'development') {
    const testId = `test_${Date.now()}`;
    trackEvent('debug_test', {
      event_category: 'debug',
      event_label: 'manual_test',
      test_id: testId,
      timestamp: new Date().toISOString(),
    });
    console.log(`[GTM] Test event envoyé avec ID: ${testId}`);
    console.log(
      '[GTM] Vérifiez l\'onglet Network pour "collect" ou le DebugView GA4',
    );
  }
};

// ===========================
// EXPORT API COMPLÈTE
// ===========================

export default {
  // Core
  trackEvent,
  initializeGTMConsent,

  // Consentement
  hasAnalyticsConsent,
  hasMarketingConsent,
  updateConsent,
  grantConsent,
  revokeConsent,

  // Business Events
  trackBlogView,
  trackTemplateView,
  trackApplicationView,
  trackContactSubmission,

  // E-commerce
  trackOrderStart,
  trackPurchase,
  trackCheckoutAbandonment,

  // UI & Navigation
  trackModalOpen,
  trackModalClose,
  trackNavigation,
  trackSocialClick,

  // Technique
  trackError,
  trackPagePerformance,
  trackWebVitals,

  // Debug
  debugGA,
  testTracking,
};
