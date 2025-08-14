// utils/analytics.js
// Utilitaires Google Analytics optimisés pour Next.js 15 avec @next/third-parties
// Version 2025 CONFORME GDPR/CCPA avec Google Consent Mode v2

import { sendGTMEvent } from '@next/third-parties/google';

/**
 * Vérifie si Google Analytics est disponible et si le consentement est accordé
 */
export const isGAReady = () => {
  return (
    typeof window !== 'undefined' &&
    (typeof window.gtag === 'function' || typeof sendGTMEvent === 'function') &&
    hasAnalyticsConsent()
  );
};

/**
 * Vérifie le consentement Analytics (GDPR/CCPA)
 * @returns {boolean} - True si le consentement Analytics est accordé
 */
export const hasAnalyticsConsent = () => {
  if (typeof window === 'undefined') return false;

  // Vérifier le localStorage pour le consentement
  try {
    const consent = localStorage.getItem('analytics_consent');
    return consent === 'granted';
  } catch (e) {
    return false;
  }
};

/**
 * Vérifie le consentement Marketing/Advertising (pour les conversions)
 * @returns {boolean} - True si le consentement Marketing est accordé
 */
export const hasMarketingConsent = () => {
  if (typeof window === 'undefined') return false;

  try {
    const consent = localStorage.getItem('marketing_consent');
    return consent === 'granted';
  } catch (e) {
    return false;
  }
};

/**
 * Envoie un événement à Google Analytics (méthode conforme GDPR 2025)
 * @param {string} eventName - Nom de l'événement
 * @param {Object} parameters - Paramètres de l'événement
 */
export const trackEvent = (eventName, parameters = {}) => {
  // Vérifier le consentement AVANT tout envoi
  if (!hasAnalyticsConsent()) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[GA Debug] Event blocked - no consent: ${eventName}`);
    }
    return;
  }

  if (typeof window !== 'undefined') {
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[GA Debug] Sending event: ${eventName}`, parameters);
      }

      // ✅ Signature CORRECTE pour sendGTMEvent (2025)
      sendGTMEvent({
        event: eventName,
        ...parameters,
      });
    } catch (error) {
      // Fallback vers gtag si sendGTMEvent échoue
      if (typeof window.gtag === 'function') {
        window.gtag('event', eventName, parameters);
      }

      if (process.env.NODE_ENV === 'development') {
        console.warn('[GA Warning] Event tracking failed:', error);
        console.log('[GA Debug] Event would be sent:', {
          eventName,
          parameters,
        });
      }
    }
  } else if (process.env.NODE_ENV === 'development') {
    console.log('[GA Debug] Event would be sent:', { eventName, parameters });
  }
};

/**
 * Met à jour les préférences de consentement (GDPR/CCPA conformité 2025)
 * @param {Object} consentUpdates - Nouvelles préférences de consentement
 */
export const updateConsent = (consentUpdates = {}) => {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    // ✅ Google Consent Mode v2 (obligatoire 2025)
    const defaultConsent = {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied', // ← NOUVEAU 2025
      ad_personalization: 'denied', // ← NOUVEAU 2025
      functionality_storage: 'granted',
      security_storage: 'granted',
      ...consentUpdates,
    };

    window.gtag('consent', 'update', defaultConsent);

    // Sauvegarder dans localStorage pour vérifications futures
    try {
      localStorage.setItem(
        'analytics_consent',
        defaultConsent.analytics_storage,
      );
      localStorage.setItem('marketing_consent', defaultConsent.ad_storage);
      localStorage.setItem('consent_timestamp', Date.now().toString());
    } catch (e) {
      console.warn('[GA] Failed to save consent preferences');
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[GA Debug] Consent updated:', defaultConsent);
    }
  }
};

/**
 * Configure le consentement initial (GDPR/CCPA - à appeler avant le chargement GA)
 * @param {Object} consentSettings - Paramètres de consentement initial
 */
export const initializeConsent = (consentSettings = {}) => {
  if (typeof window !== 'undefined') {
    window.dataLayer = window.dataLayer || [];

    window.gtag =
      window.gtag ||
      function () {
        window.dataLayer.push(arguments);
      };

    // ✅ Google Consent Mode v2 par défaut (2025)
    const defaultConsentSettings = {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied', // ← OBLIGATOIRE 2025
      ad_personalization: 'denied', // ← OBLIGATOIRE 2025
      functionality_storage: 'granted',
      security_storage: 'granted',
      wait_for_update: 500,
      region: ['FR', 'DJ', 'EU'], // France, Djibouti, Europe
      ...consentSettings,
    };

    window.gtag('consent', 'default', defaultConsentSettings);

    if (process.env.NODE_ENV === 'development') {
      console.log('[GA Debug] Consent initialized:', defaultConsentSettings);
    }
  }
};

/**
 * Accorde le consentement Analytics (appelé depuis banner de cookies)
 * @param {boolean} analytics - Consentement analytics
 * @param {boolean} marketing - Consentement marketing/advertising
 */
export const grantConsent = (analytics = false, marketing = false) => {
  const consentUpdates = {
    analytics_storage: analytics ? 'granted' : 'denied',
    ad_storage: marketing ? 'granted' : 'denied',
    ad_user_data: marketing ? 'granted' : 'denied',
    ad_personalization: marketing ? 'granted' : 'denied',
  };

  updateConsent(consentUpdates);

  if (process.env.NODE_ENV === 'development') {
    console.log('[GA Debug] Consent granted:', { analytics, marketing });
  }
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

  if (process.env.NODE_ENV === 'development') {
    console.log('[GA Debug] All consent revoked');
  }
};

/**
 * Configure les propriétés utilisateur personnalisées (avec consentement)
 * @param {Object} properties - Propriétés utilisateur
 */
export const setUserProperties = (properties) => {
  if (!hasAnalyticsConsent()) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[GA Debug] User properties blocked - no consent');
    }
    return;
  }

  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID, {
      user_properties: properties,
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('[GA Debug] User properties set:', properties);
    }
  }
};

// ========================================
// ÉVÉNEMENTS SPÉCIFIQUES AU BUSINESS (Avec vérification consentement)
// ========================================

/**
 * Track les vues d'articles de blog
 * @param {string} articleId - ID de l'article
 * @param {string} articleTitle - Titre de l'article
 */
export const trackBlogView = (articleId, articleTitle) => {
  trackEvent('blog_article_view', {
    event_category: 'blog',
    event_label: articleTitle,
    article_id: articleId,
    article_title: articleTitle,
    content_type: 'blog_post',
  });
};

/**
 * Track les vues de templates
 * @param {string} templateId - ID du template
 * @param {string} templateName - Nom du template
 */
export const trackTemplateView = (templateId, templateName) => {
  trackEvent('template_view', {
    event_category: 'templates',
    event_label: templateName,
    template_id: templateId,
    template_name: templateName,
    content_type: 'template',
  });
};

/**
 * Track les vues d'applications
 * @param {string} applicationId - ID de l'application
 * @param {string} applicationName - Nom de l'application
 * @param {string} templateId - ID du template parent
 */
export const trackApplicationView = (
  applicationId,
  applicationName,
  templateId,
) => {
  trackEvent('application_view', {
    event_category: 'applications',
    event_label: applicationName,
    application_id: applicationId,
    application_name: applicationName,
    template_id: templateId,
    content_type: 'application',
  });
};

/**
 * Track les soumissions de formulaire de contact (avec consentement marketing)
 * @param {boolean} success - Succès de la soumission
 * @param {string} errorMessage - Message d'erreur (optionnel)
 */
export const trackContactSubmission = (success = true, errorMessage = null) => {
  // Événement de base (analytics)
  trackEvent('contact_form_submit', {
    event_category: 'contact',
    event_label: success ? 'success' : 'error',
    value: success ? 1 : 0,
    success: success,
    error_message: errorMessage,
  });

  // Conversion (nécessite consentement marketing)
  if (success && hasMarketingConsent()) {
    trackEvent('conversion', {
      event_category: 'conversion',
      event_label: 'contact_form',
      value: 1,
      conversion_type: 'lead_generation',
    });
  }
};

/**
 * Track les clics sur les réseaux sociaux
 * @param {string} platform - Plateforme sociale (facebook, instagram, etc.)
 * @param {string} location - Localisation du clic (header, footer, etc.)
 */
export const trackSocialClick = (platform, location = 'unknown') => {
  trackEvent('social_click', {
    event_category: 'social',
    event_label: platform,
    social_platform: platform,
    click_location: location,
  });
};

// ========================================
// ÉVÉNEMENTS E-COMMERCE GA4 (Avec vérification consentement)
// ========================================

/**
 * Track le début d'une commande
 * @param {Object} application - Données de l'application
 */
export const trackOrderStart = (application) => {
  trackEvent('begin_checkout', {
    event_category: 'ecommerce',
    currency: 'DJF',
    value: application.application_fee,
    items: [
      {
        item_id: application.application_id,
        item_name: application.application_name,
        item_category: application.application_category,
        item_brand: 'Benew',
        item_variant: application.application_level,
        price: application.application_fee,
        quantity: 1,
      },
    ],
    template_id: application.template_id || 'unknown',
    application_level: application.application_level,
    checkout_step: 1,
  });
};

/**
 * Track une commande finalisée (nécessite consentement marketing pour conversion)
 * @param {Object} application - Données de l'application
 * @param {string} transactionId - ID de la transaction
 * @param {string} paymentMethod - Méthode de paiement
 */
export const trackPurchase = (
  application,
  transactionId,
  paymentMethod = 'mobile_money',
) => {
  // Événement de base (analytics)
  trackEvent('purchase', {
    event_category: 'ecommerce',
    transaction_id: transactionId,
    currency: 'DJF',
    value: application.application_fee,
    payment_type: paymentMethod,
    items: [
      {
        item_id: application.application_id,
        item_name: application.application_name,
        item_category: application.application_category,
        item_brand: 'Benew',
        item_variant: application.application_level,
        price: application.application_fee,
        quantity: 1,
      },
    ],
    template_id: application.template_id || 'unknown',
    application_level: application.application_level,
    payment_method: paymentMethod,
    total_value:
      application.application_fee + (application.application_rent || 0),
  });

  // Conversion avancée (nécessite consentement marketing)
  if (hasMarketingConsent()) {
    trackEvent('conversion', {
      event_category: 'conversion',
      event_label: 'purchase',
      value: application.application_fee,
      conversion_type: 'ecommerce_purchase',
      transaction_id: transactionId,
    });
  }
};

/**
 * Track l'abandon de commande
 * @param {Object} application - Données de l'application
 * @param {string} abandonStep - Étape d'abandon
 * @param {string} reason - Raison de l'abandon (optionnel)
 */
export const trackCheckoutAbandonment = (
  application,
  abandonStep,
  reason = 'unknown',
) => {
  trackEvent('checkout_abandon', {
    event_category: 'ecommerce',
    event_label: abandonStep,
    currency: 'DJF',
    value: application.application_fee,
    abandon_step: abandonStep,
    abandon_reason: reason,
    application_id: application.application_id,
    template_id: application.template_id,
  });
};

// ========================================
// ÉVÉNEMENTS D'INTERFACE UTILISATEUR
// ========================================

/**
 * Track l'ouverture d'une modal
 * @param {string} modalName - Nom de la modal
 * @param {string} context - Contexte d'ouverture
 */
export const trackModalOpen = (modalName, context = '') => {
  trackEvent('modal_open', {
    event_category: 'ui_interaction',
    event_label: modalName,
    modal_name: modalName,
    context: context,
  });
};

/**
 * Track la fermeture d'une modal
 * @param {string} modalName - Nom de la modal
 * @param {string} action - Action de fermeture
 */
export const trackModalClose = (modalName, action = 'close') => {
  trackEvent('modal_close', {
    event_category: 'ui_interaction',
    event_label: `${modalName}_${action}`,
    modal_name: modalName,
    close_action: action,
  });
};

/**
 * Track les clics de navigation
 * @param {string} linkText - Texte du lien
 * @param {string} destination - URL de destination
 * @param {string} location - Localisation du lien
 */
export const trackNavigation = (
  linkText,
  destination,
  location = 'unknown',
) => {
  trackEvent('navigation_click', {
    event_category: 'navigation',
    event_label: linkText,
    link_text: linkText,
    link_url: destination,
    link_location: location,
  });
};

/**
 * Track les erreurs importantes
 * @param {string} errorMessage - Message d'erreur
 * @param {string} errorPage - Page où l'erreur s'est produite
 * @param {string} severity - Gravité de l'erreur
 */
export const trackError = (errorMessage, errorPage, severity = 'error') => {
  // Les erreurs sont trackées même sans consentement (sécurité/technique)
  if (typeof window !== 'undefined') {
    try {
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'exception', {
          event_category: 'errors',
          event_label: errorMessage,
          description: errorMessage,
          page: errorPage,
          fatal: severity === 'fatal',
          error_severity: severity,
        });
      }
    } catch (e) {
      // Fail silently pour les erreurs
    }
  }
};

// ========================================
// ÉVÉNEMENTS DE PERFORMANCE
// ========================================

/**
 * Track les performances de page (avec consentement)
 * @param {string} pageName - Nom de la page
 * @param {number} loadTime - Temps de chargement en ms
 * @param {boolean} fromCache - Chargé depuis le cache
 */
export const trackPagePerformance = (pageName, loadTime, fromCache = false) => {
  if (loadTime > 100) {
    trackEvent('page_load_time', {
      event_category: 'performance',
      event_label: pageName,
      value: Math.round(loadTime),
      page_name: pageName,
      from_cache: fromCache,
      load_time_ms: Math.round(loadTime),
      performance_bucket: getPerformanceBucket(loadTime),
    });
  }
};

/**
 * Catégorise les performances
 * @param {number} loadTime - Temps de chargement
 * @returns {string} Catégorie de performance
 */
const getPerformanceBucket = (loadTime) => {
  if (loadTime < 1000) return 'fast';
  if (loadTime < 3000) return 'average';
  if (loadTime < 5000) return 'slow';
  return 'very_slow';
};

/**
 * Track les Core Web Vitals (avec consentement)
 * @param {string} name - Nom de la métrique (CLS, FID, LCP, etc.)
 * @param {number} value - Valeur de la métrique
 * @param {string} id - ID unique de la métrique
 * @param {string} rating - Rating de la performance
 */
export const trackWebVitals = (name, value, id, rating = 'unknown') => {
  trackEvent('web_vitals', {
    event_category: 'performance',
    event_label: name,
    value: Math.round(name === 'CLS' ? value * 1000 : value),
    metric_name: name,
    metric_value: Math.round(name === 'CLS' ? value * 1000 : value),
    metric_id: id,
    metric_rating: rating,
    non_interaction: true,
  });
};

// ========================================
// UTILITAIRES DE DEBUG ET CONFIGURATION
// ========================================

/**
 * Active le mode debug GA4 (développement uniquement)
 */
export const enableGADebug = () => {
  if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
    if (typeof window.gtag === 'function') {
      window.gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID, {
        debug_mode: true,
      });
    }
    console.log('[GA Debug] Debug mode enabled');
  }
};

/**
 * Configure Enhanced Measurements (avec vérification consentement)
 * @param {Object} config - Configuration des mesures enrichies
 */
export const configureEnhancedMeasurements = (config = {}) => {
  if (!hasAnalyticsConsent()) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[GA Debug] Enhanced measurements blocked - no consent');
    }
    return;
  }

  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID, {
      enhanced_measurement: {
        scrolls: config.scrolls ?? true,
        clicks: config.clicks ?? true,
        views: config.views ?? true,
        downloads: config.downloads ?? true,
        video_engagement: config.video_engagement ?? true,
        file_downloads: config.file_downloads ?? true,
        page_changes: config.page_changes ?? true,
        ...config.custom,
      },
      anonymize_ip: config.anonymize_ip ?? true,
      cookie_flags: 'SameSite=None;Secure',
      ...config.additional,
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('[GA Debug] Enhanced measurements configured:', config);
    }
  }
};

/**
 * Affiche des informations de debug sur GA et le consentement
 */
export const debugGA = () => {
  if (process.env.NODE_ENV === 'development') {
    console.log('[GA Debug] Analytics Info:', {
      gtag_available:
        typeof window !== 'undefined' && typeof window.gtag === 'function',
      sendGTMEvent_available: typeof sendGTMEvent === 'function',
      measurement_id: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
      page_url: typeof window !== 'undefined' ? window.location.href : 'SSR',
      data_layer:
        typeof window !== 'undefined' ? window.dataLayer : 'undefined',
      analytics_consent: hasAnalyticsConsent(),
      marketing_consent: hasMarketingConsent(),
      consent_timestamp:
        typeof window !== 'undefined'
          ? localStorage.getItem('consent_timestamp')
          : 'N/A',
    });
  }
};

/**
 * Test si le tracking fonctionne (seulement si consentement accordé)
 */
export const testTracking = () => {
  if (process.env.NODE_ENV === 'development') {
    if (!hasAnalyticsConsent()) {
      console.log('[GA Debug] Test blocked - no analytics consent');
      return;
    }

    trackEvent('debug_test', {
      event_category: 'debug',
      event_label: 'manual_test',
      timestamp: new Date().toISOString(),
      test_value: Math.random(),
    });
    console.log(
      '[GA Debug] Test event sent - Check Network tab or GA Real-time reports',
    );
  }
};

/**
 * Initialisation complète de GA avec configuration GDPR/CCPA 2025
 * @param {Object} options - Options d'initialisation
 */
export const initializeAnalytics = (options = {}) => {
  if (typeof window !== 'undefined') {
    // ✅ ÉTAPE 1: Initialiser le consentement AVANT tout
    if (options.requireConsent !== false) {
      initializeConsent(options.consentSettings);
    }

    // ✅ ÉTAPE 2: Vérifier si on a déjà le consentement
    const hasConsent = hasAnalyticsConsent();

    // ✅ ÉTAPE 3: Configurer seulement si consentement accordé
    if (hasConsent && options.enhancedMeasurements !== false) {
      configureEnhancedMeasurements(options.enhancedConfig);
    }

    // ✅ ÉTAPE 4: Debug en développement
    if (process.env.NODE_ENV === 'development' && options.debug !== false) {
      enableGADebug();
    }

    // ✅ ÉTAPE 5: Propriétés utilisateur seulement si consentement
    if (hasConsent && options.userProperties) {
      setUserProperties(options.userProperties);
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[GA Debug] Analytics initialized (GDPR compliant):', {
        ...options,
        consentStatus: {
          analytics: hasConsent,
          marketing: hasMarketingConsent(),
        },
      });
    }
  }
};

/**
 * Hook pour vérifier le statut de consentement (pour les composants React)
 * @returns {Object} Statut des consentements
 */
export const getConsentStatus = () => {
  return {
    analytics: hasAnalyticsConsent(),
    marketing: hasMarketingConsent(),
    isReady: isGAReady(),
  };
};

// ========================================
// EXPORT PAR DÉFAUT - API Complète 2025
// ========================================
export default {
  // Fonctions principales avec vérification consentement
  trackEvent,
  isGAReady,

  // Gestion du consentement GDPR/CCPA
  hasAnalyticsConsent,
  hasMarketingConsent,
  updateConsent,
  initializeConsent,
  grantConsent,
  revokeConsent,
  getConsentStatus,
  setUserProperties,

  // Événements business
  trackBlogView,
  trackTemplateView,
  trackApplicationView,
  trackContactSubmission,
  trackSocialClick,

  // E-commerce
  trackOrderStart,
  trackPurchase,
  trackCheckoutAbandonment,

  // Interface utilisateur
  trackModalOpen,
  trackModalClose,
  trackNavigation,
  trackError,

  // Performance
  trackPagePerformance,
  trackWebVitals,

  // Utilitaires
  debugGA,
  testTracking,
  initializeAnalytics,
  configureEnhancedMeasurements,
  enableGADebug,
};
