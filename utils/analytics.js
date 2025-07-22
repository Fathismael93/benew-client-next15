// utils/analytics.js
// Utilitaires Google Analytics corrigés selon la documentation officielle

/**
 * Vérifie si Google Analytics est disponible
 */
export const isGAReady = () => {
  return typeof window !== 'undefined' && typeof window.gtag === 'function';
};

/**
 * Envoie un événement à Google Analytics
 * @param {string} eventName - Nom de l'événement
 * @param {Object} parameters - Paramètres de l'événement
 */
export const trackEvent = (eventName, parameters = {}) => {
  if (isGAReady()) {
    window.gtag('event', eventName, {
      // Paramètres par défaut recommandés par GA4
      event_category: parameters.event_category || 'engagement',
      event_label: parameters.event_label,
      value: parameters.value,
      ...parameters,
    });
  } else if (process.env.NODE_ENV === 'development') {
    console.log('[GA Debug] Event would be sent:', { eventName, parameters });
  }
};

/**
 * Configure les propriétés utilisateur personnalisées
 */
export const setUserProperties = (properties) => {
  if (isGAReady()) {
    window.gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID, {
      user_properties: properties,
    });
  }
};

/**
 * Track une vue de page personnalisée (optionnel car GA4 le fait automatiquement)
 */
export const trackPageView = (path, title) => {
  if (isGAReady()) {
    window.gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID, {
      page_path: path,
      page_title: title,
    });
  }
};

// ========================================
// ÉVÉNEMENTS SPÉCIFIQUES À VOTRE BUSINESS
// ========================================

/**
 * Track les vues d'articles de blog
 */
export const trackBlogView = (articleId, articleTitle) => {
  trackEvent('blog_article_view', {
    event_category: 'blog',
    event_label: articleTitle,
    article_id: articleId,
    article_title: articleTitle,
  });
};

/**
 * Track les vues de templates
 */
export const trackTemplateView = (templateId, templateName) => {
  trackEvent('template_view', {
    event_category: 'templates',
    event_label: templateName,
    template_id: templateId,
    template_name: templateName,
  });
};

/**
 * Track les vues d'applications
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
  });
};

/**
 * Track les soumissions de formulaire de contact
 */
export const trackContactSubmission = (success = true) => {
  trackEvent('contact_form_submit', {
    event_category: 'contact',
    event_label: success ? 'success' : 'error',
    value: success ? 1 : 0,
  });
};

/**
 * Track les clics sur les réseaux sociaux
 */
export const trackSocialClick = (platform) => {
  trackEvent('social_click', {
    event_category: 'social',
    event_label: platform,
    social_platform: platform,
  });
};

// ========================================
// ÉVÉNEMENTS E-COMMERCE GA4
// ========================================

/**
 * Track le début d'une commande
 */
export const trackOrderStart = (application) => {
  trackEvent('begin_checkout', {
    event_category: 'ecommerce',
    currency: 'XOF', // Franc CFA
    value: application.application_fee,
    items: [
      {
        item_id: application.application_id,
        item_name: application.application_name,
        category: application.application_category,
        price: application.application_fee,
        quantity: 1,
      },
    ],
  });
};

/**
 * Track l'ajout au panier (début de processus)
 */
// export const trackAddToCart = (application) => {
//   trackEvent('add_to_cart', {
//     event_category: 'ecommerce',
//     currency: 'XOF',
//     value: application.application_fee,
//     items: [
//       {
//         item_id: application.application_id,
//         item_name: application.application_name,
//         category: application.application_category,
//         price: application.application_fee,
//         quantity: 1,
//       },
//     ],
//   });
// };

/**
 * Track une commande finalisée
 */
export const trackPurchase = (
  application,
  transactionId,
  paymentMethod = 'mobile_money',
) => {
  trackEvent('purchase', {
    event_category: 'ecommerce',
    transaction_id: transactionId,
    currency: 'XOF',
    value: application.application_fee,
    payment_type: paymentMethod,
    items: [
      {
        item_id: application.application_id,
        item_name: application.application_name,
        category: application.application_category,
        price: application.application_fee,
        quantity: 1,
      },
    ],
  });
};

// ========================================
// ÉVÉNEMENTS D'INTERFACE UTILISATEUR
// ========================================

/**
 * Track l'ouverture d'une modal
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
 * Track les recherches (si implémentées)
 */
// export const trackSearch = (searchTerm, resultCount = 0) => {
//   trackEvent('search', {
//     event_category: 'search',
//     event_label: searchTerm,
//     search_term: searchTerm,
//     result_count: resultCount,
//   });
// };

/**
 * Track les erreurs importantes
 */
export const trackError = (errorMessage, errorPage, severity = 'error') => {
  trackEvent('exception', {
    event_category: 'errors',
    event_label: errorMessage,
    description: errorMessage,
    page: errorPage,
    fatal: severity === 'fatal',
  });
};

// ========================================
// ÉVÉNEMENTS DE PERFORMANCE
// ========================================

/**
 * Track les performances de page
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
    });
  }
};

/**
 * Track les Core Web Vitals (optionnel)
 */
export const trackWebVitals = (name, value, id) => {
  trackEvent('web_vitals', {
    event_category: 'performance',
    event_label: name,
    value: Math.round(value),
    metric_name: name,
    metric_value: Math.round(value),
    metric_id: id,
  });
};

// ========================================
// UTILITAIRES DE DEBUG
// ========================================

/**
 * Active le mode debug GA4 (développement uniquement)
 */
export const enableGADebug = () => {
  if (process.env.NODE_ENV === 'development' && isGAReady()) {
    window.gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID, {
      debug_mode: true,
    });
    console.log('[GA Debug] Debug mode enabled');
  }
};

/**
 * Affiche des informations de debug sur GA
 */
export const debugGA = () => {
  if (process.env.NODE_ENV === 'development') {
    console.log('[GA Debug] Analytics Info:', {
      gtag_available: isGAReady(),
      measurement_id: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
      page_url: typeof window !== 'undefined' ? window.location.href : 'SSR',
      data_layer:
        typeof window !== 'undefined' ? window.dataLayer : 'undefined',
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
    });
    console.log('[GA Debug] Test event sent');
  }
};
