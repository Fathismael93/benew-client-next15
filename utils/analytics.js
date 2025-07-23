// utils/analytics.js
// Utilitaires Google Analytics optimisés pour Next.js 15 avec @next/third-parties
// Version corrigée selon la documentation officielle

import { sendGAEvent } from '@next/third-parties/google';

/**
 * Vérifie si Google Analytics est disponible
 */
export const isGAReady = () => {
  return (
    typeof window !== 'undefined' &&
    (typeof window.gtag === 'function' || typeof sendGAEvent === 'function')
  );
};

/**
 * Envoie un événement à Google Analytics (méthode officielle Next.js)
 * @param {string} eventName - Nom de l'événement
 * @param {Object} parameters - Paramètres de l'événement
 */
export const trackEvent = (eventName, parameters = {}) => {
  if (typeof window !== 'undefined') {
    try {
      console.log(`[GA Debug] Sending event: ${eventName}`, parameters);
      // ✅ Signature correcte selon la documentation Next.js 15
      sendGAEvent('event', eventName, {
        event_category: parameters.event_category || 'engagement',
        event_label: parameters.event_label,
        value: parameters.value,
        ...parameters,
      });
    } catch (error) {
      // Fallback vers gtag si sendGAEvent échoue
      if (typeof window.gtag === 'function') {
        window.gtag('event', eventName, {
          event_category: parameters.event_category || 'engagement',
          event_label: parameters.event_label,
          value: parameters.value,
          ...parameters,
        });
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
 * Met à jour les préférences de consentement (RGPD/CCPA)
 * @param {boolean} hasConsent - L'utilisateur a-t-il donné son consentement
 * @param {Object} options - Options de consentement détaillées
 */
export const updateConsent = (hasConsent, options = {}) => {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    const consentValue = hasConsent ? 'granted' : 'denied';

    window.gtag('consent', 'update', {
      analytics_storage: options.analytics_storage ?? consentValue,
      ad_storage: options.ad_storage ?? consentValue,
      ad_user_data: options.ad_user_data ?? consentValue,
      ad_personalization: options.ad_personalization ?? consentValue,
      functionality_storage: options.functionality_storage ?? 'granted',
      security_storage: 'granted', // Toujours accordé pour la sécurité
      ...options.custom,
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('[GA Debug] Consent updated:', { hasConsent, options });
    }
  }
};

/**
 * Configure le consentement initial (à appeler avant le chargement GA)
 * @param {Object} consentSettings - Paramètres de consentement initial
 */
export const initializeConsent = (consentSettings = {}) => {
  if (typeof window !== 'undefined') {
    window.dataLayer = window.dataLayer || [];

    // Configuration du consentement par défaut
    window.gtag =
      window.gtag ||
      function () {
        window.dataLayer.push(arguments);
      };

    window.gtag('consent', 'default', {
      analytics_storage: consentSettings.analytics_storage || 'denied',
      ad_storage: consentSettings.ad_storage || 'denied',
      ad_user_data: consentSettings.ad_user_data || 'denied',
      ad_personalization: consentSettings.ad_personalization || 'denied',
      functionality_storage: consentSettings.functionality_storage || 'granted',
      security_storage: 'granted',
      wait_for_update: consentSettings.wait_for_update || 500,
      region: consentSettings.region || ['FR', 'EU'], // RGPD par défaut
      ...consentSettings.custom,
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('[GA Debug] Consent initialized:', consentSettings);
    }
  }
};

/**
 * Configure les propriétés utilisateur personnalisées
 * @param {Object} properties - Propriétés utilisateur
 */
export const setUserProperties = (properties) => {
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
// ÉVÉNEMENTS SPÉCIFIQUES À VOTRE BUSINESS
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
 * Track les soumissions de formulaire de contact
 * @param {boolean} success - Succès de la soumission
 * @param {string} errorMessage - Message d'erreur (optionnel)
 */
export const trackContactSubmission = (success = true, errorMessage = null) => {
  trackEvent('contact_form_submit', {
    event_category: 'contact',
    event_label: success ? 'success' : 'error',
    value: success ? 1 : 0,
    success: success,
    error_message: errorMessage,
  });
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
// ÉVÉNEMENTS E-COMMERCE GA4 OPTIMISÉS
// ========================================

/**
 * Track le début d'une commande
 * @param {Object} application - Données de l'application
 */
export const trackOrderStart = (application) => {
  trackEvent('begin_checkout', {
    event_category: 'ecommerce',
    currency: 'DJF', // Franc Djiboutien
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
    // Données business spécifiques
    template_id: application.template_id || 'unknown',
    application_level: application.application_level,
    checkout_step: 1,
  });
};

/**
 * Track une commande finalisée
 * @param {Object} application - Données de l'application
 * @param {string} transactionId - ID de la transaction
 * @param {string} paymentMethod - Méthode de paiement
 */
export const trackPurchase = (
  application,
  transactionId,
  paymentMethod = 'mobile_money',
) => {
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
    // Données business enrichies
    template_id: application.template_id || 'unknown',
    application_level: application.application_level,
    payment_method: paymentMethod,
    total_value:
      application.application_fee + (application.application_rent || 0),
  });
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
  trackEvent('exception', {
    event_category: 'errors',
    event_label: errorMessage,
    description: errorMessage,
    page: errorPage,
    fatal: severity === 'fatal',
    error_severity: severity,
  });
};

// ========================================
// ÉVÉNEMENTS DE PERFORMANCE
// ========================================

/**
 * Track les performances de page
 * @param {string} pageName - Nom de la page
 * @param {number} loadTime - Temps de chargement en ms
 * @param {boolean} fromCache - Chargé depuis le cache
 */
export const trackPagePerformance = (pageName, loadTime, fromCache = false) => {
  // Envoyer seulement si le temps de chargement est significatif
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
 * Track les Core Web Vitals
 * @param {string} name - Nom de la métrique (CLS, FID, LCP, etc.)
 * @param {number} value - Valeur de la métrique
 * @param {string} id - ID unique de la métrique
 * @param {string} rating - Rating de la performance (good, needs-improvement, poor)
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
    non_interaction: true, // N'affecte pas le bounce rate
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
 * Configure Enhanced Measurements
 * @param {Object} config - Configuration des mesures enrichies
 */
export const configureEnhancedMeasurements = (config = {}) => {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID, {
      // Mesures enrichies automatiques
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
      // Configuration supplémentaire
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
 * Affiche des informations de debug sur GA
 */
export const debugGA = () => {
  if (process.env.NODE_ENV === 'development') {
    console.log('[GA Debug] Analytics Info:', {
      gtag_available:
        typeof window !== 'undefined' && typeof window.gtag === 'function',
      sendGAEvent_available: typeof sendGAEvent === 'function',
      measurement_id: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
      page_url: typeof window !== 'undefined' ? window.location.href : 'SSR',
      data_layer:
        typeof window !== 'undefined' ? window.dataLayer : 'undefined',
      consent_status:
        typeof window !== 'undefined' && window.gtag
          ? 'gtag available'
          : 'gtag not available',
    });
  }
};

/**
 * Test si le tracking fonctionne
 */
export const testTracking = () => {
  if (process.env.NODE_ENV === 'development') {
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
 * Initialisation complète de GA avec configuration optimale
 * @param {Object} options - Options d'initialisation
 */
export const initializeAnalytics = (options = {}) => {
  if (typeof window !== 'undefined') {
    // Initialiser le consentement si requis
    if (options.requireConsent) {
      initializeConsent(options.consentSettings);
    }

    // Configurer les mesures enrichies
    if (options.enhancedMeasurements !== false) {
      configureEnhancedMeasurements(options.enhancedConfig);
    }

    // Activer le debug en développement
    if (process.env.NODE_ENV === 'development' && options.debug !== false) {
      enableGADebug();
    }

    // Définir les propriétés utilisateur si fournies
    if (options.userProperties) {
      setUserProperties(options.userProperties);
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[GA Debug] Analytics initialized with options:', options);
    }
  }
};

// ========================================
// HOOKS POUR NEXT.JS 15 APP ROUTER
// ========================================

/**
 * Hook pour initialiser automatiquement GA dans un composant
 * À utiliser dans un composant client uniquement
 */
export const useAnalyticsInitialization = (options = {}) => {
  if (typeof window !== 'undefined') {
    const initOnce = () => {
      if (!window._gaInitialized) {
        initializeAnalytics(options);
        window._gaInitialized = true;
      }
    };

    // Initialiser après hydration
    if (document.readyState === 'complete') {
      initOnce();
    } else {
      window.addEventListener('load', initOnce);
      return () => window.removeEventListener('load', initOnce);
    }
  }
};

export default {
  // Fonctions principales
  trackEvent,
  updateConsent,
  initializeConsent,
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
  isGAReady,
  debugGA,
  testTracking,
  initializeAnalytics,
  useAnalyticsInitialization,
  configureEnhancedMeasurements,
};
