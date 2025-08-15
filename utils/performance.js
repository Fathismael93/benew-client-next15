/**
 * Utilitaires de performance simplifiés pour site vitrine Benew
 * Next.js 15 + 500 visiteurs/jour - Version pragmatique 2025
 *
 * Philosophie : "Keep it simple, measure first, optimize when needed"
 */

// Vérification environnement
const isBrowser = typeof window !== 'undefined';
const isDev = process.env.NODE_ENV === 'development';

// =============================================
// DEBOUNCE SIMPLE (Recherche, validation form)
// =============================================

/**
 * Debounce simple pour recherche et validation
 * @param {Function} fn - Fonction à debouncer
 * @param {number} delay - Délai en ms (défaut: 350ms)
 * @returns {Function} Fonction debouncée
 */
export function debounce(fn, delay = 350) {
  let timeoutId;

  const debounced = function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };

  debounced.cancel = () => clearTimeout(timeoutId);
  return debounced;
}

// =============================================
// THROTTLE SIMPLE (EmailJS, scrolling)
// =============================================

/**
 * Throttle simple pour limiter la fréquence d'exécution
 * @param {Function} fn - Fonction à throttler
 * @param {number} limit - Limite en ms (défaut: 1000ms)
 * @returns {Function} Fonction throttlée
 */
export function throttle(fn, limit = 1000) {
  let inThrottle;

  return function (...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// =============================================
// CACHE SIMPLE (Articles, Templates)
// =============================================

/**
 * Cache simple avec TTL pour les données du site
 * Idéal pour 500 visiteurs/jour
 */
class SimpleCache {
  constructor(maxSize = 20, defaultTTL = 300000) {
    // 5 minutes par défaut
    this.cache = new Map();
    this.timestamps = new Map();
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  set(key, value, ttl = this.defaultTTL) {
    // Si le cache est plein, supprimer le plus ancien
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.delete(firstKey);
    }

    this.cache.set(key, value);
    this.timestamps.set(key, Date.now() + ttl);
  }

  get(key) {
    if (!this.cache.has(key)) return null;

    // Vérifier l'expiration
    if (Date.now() > this.timestamps.get(key)) {
      this.delete(key);
      return null;
    }

    return this.cache.get(key);
  }

  delete(key) {
    this.cache.delete(key);
    this.timestamps.delete(key);
  }

  clear() {
    this.cache.clear();
    this.timestamps.clear();
  }

  size() {
    return this.cache.size;
  }
}

// Cache global pour les entités du site
export const siteCache = new SimpleCache(20, 300000); // 20 items, 5 minutes

// =============================================
// PRÉCHARGEMENT D'IMAGES CLOUDINARY
// =============================================

/**
 * Précharge une image Cloudinary de manière simple
 * @param {string} src - URL de l'image
 * @param {Object} options - Options basiques
 * @returns {Promise<HTMLImageElement>}
 */
export function preloadImage(src, options = {}) {
  if (!isBrowser || !src) {
    return Promise.resolve(null);
  }

  const { timeout = 8000, transform = '' } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();

    // Timeout simple
    const timeoutId = setTimeout(() => {
      if (isDev) console.warn(`Timeout préchargement image: ${src}`);
      reject(new Error('Timeout'));
    }, timeout);

    img.onload = () => {
      clearTimeout(timeoutId);
      resolve(img);
    };

    img.onerror = () => {
      clearTimeout(timeoutId);
      reject(new Error(`Erreur chargement: ${src}`));
    };

    // Appliquer la transformation Cloudinary si spécifiée
    if (transform && src.includes('cloudinary.com')) {
      const parts = src.split('/upload/');
      img.src =
        parts.length === 2
          ? `${parts[0]}/upload/${transform}/${parts[1]}`
          : src;
    } else {
      img.src = src;
    }
  });
}

/**
 * Précharge plusieurs images avec limitation de concurrence
 * @param {Array<string>} sources - URLs des images
 * @param {Object} options - Options
 * @returns {Promise<Array>}
 */
export function preloadImages(sources, options = {}) {
  if (!isBrowser || !Array.isArray(sources) || sources.length === 0) {
    return Promise.resolve([]);
  }

  const { maxConcurrent = 3, transform = 'w_400,h_300,c_fill,q_auto,f_auto' } =
    options;

  // Traiter par petits lots
  const batches = [];
  for (let i = 0; i < sources.length; i += maxConcurrent) {
    batches.push(sources.slice(i, i + maxConcurrent));
  }

  return batches.reduce(
    (promise, batch) =>
      promise.then((results) =>
        Promise.allSettled(
          batch.map((src) => preloadImage(src, { transform })),
        ).then((batchResults) => [
          ...results,
          ...batchResults.map((r) =>
            r.status === 'fulfilled' ? r.value : null,
          ),
        ]),
      ),
    Promise.resolve([]),
  );
}

// =============================================
// DÉTECTION DE PRÉFÉRENCES UTILISATEUR
// =============================================

/**
 * Détecte si l'utilisateur préfère les animations réduites
 * @returns {boolean}
 */
export function prefersReducedMotion() {
  if (!isBrowser) return false;

  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Détecte si l'utilisateur est en mode économie de données
 * @returns {boolean}
 */
export function prefersDataSaver() {
  if (!isBrowser) return false;

  try {
    return navigator.connection?.saveData === true;
  } catch {
    return false;
  }
}

/**
 * Détecte si la connexion est lente (heuristique simple)
 * @returns {boolean}
 */
export function isSlowConnection() {
  if (!isBrowser) return false;

  try {
    const connection = navigator.connection;
    if (!connection) return false;

    // Connexion lente si 2G ou 3G ou débit < 1.5 Mbps
    return (
      connection.effectiveType === '2g' ||
      connection.effectiveType === 'slow-2g' ||
      (connection.downlink && connection.downlink < 1.5)
    );
  } catch {
    return false;
  }
}

// =============================================
// OPTIMISATIONS POUR LE SITE BENEW
// =============================================

/**
 * Configuration adaptative selon les performances réseau
 * @returns {Object} Configuration optimisée
 */
export function getAdaptiveConfig() {
  const isSlowConn = isSlowConnection();
  const dataSaver = prefersDataSaver();
  const reducedMotion = prefersReducedMotion();

  return {
    // Images
    imageQuality: isSlowConn || dataSaver ? 'low' : 'high',
    imageTransform: isSlowConn
      ? 'w_300,h_200,c_fill,q_auto:low,f_auto'
      : 'w_600,h_400,c_fill,q_auto,f_auto',

    // Animations
    enableAnimations: !reducedMotion && !isSlowConn,
    animationDuration: reducedMotion ? 0 : isSlowConn ? 150 : 300,

    // Chargement
    pageSize: isSlowConn ? 6 : 12, // Articles/templates par page
    preloadImages: !isSlowConn && !dataSaver,

    // Interface
    searchDebounce: isSlowConn ? 500 : 350,
    emailThrottle: 2000, // Toujours 2s pour éviter le spam

    // Debug
    isSlowConnection: isSlowConn,
    dataSaver,
    reducedMotion,
  };
}

/**
 * Optimise une fonction de recherche avec debounce et cache
 * @param {Function} searchFn - Fonction de recherche
 * @param {Object} options - Options
 * @returns {Function} Fonction optimisée
 */
export function optimizeSearch(searchFn, options = {}) {
  const { debounceDelay = 350, cacheKey = 'search', minLength = 2 } = options;

  const debouncedSearch = debounce(async (query) => {
    if (query.length < minLength) return [];

    const normalizedQuery = query.toLowerCase().trim();
    const cacheKeyWithQuery = `${cacheKey}:${normalizedQuery}`;

    // Vérifier le cache
    const cached = siteCache.get(cacheKeyWithQuery);
    if (cached) return cached;

    try {
      const results = await searchFn(query);
      siteCache.set(cacheKeyWithQuery, results);
      return results;
    } catch (error) {
      if (isDev) console.error('Erreur recherche:', error);
      return [];
    }
  }, debounceDelay);

  return debouncedSearch;
}

/**
 * Optimise l'envoi d'emails avec throttle et prévention doublons
 * @param {Function} emailFn - Fonction d'envoi email
 * @returns {Function} Fonction optimisée
 */
export function optimizeEmail(emailFn) {
  const recentEmails = new Map();

  const throttledEmail = throttle(async (formData) => {
    // Prévention doublons simples (1 minute)
    const emailKey = `${formData.get('email')}-${formData.get('subject')}`;
    const lastSent = recentEmails.get(emailKey);

    if (lastSent && Date.now() - lastSent < 60000) {
      throw new Error('Email déjà envoyé récemment. Veuillez patienter.');
    }

    const result = await emailFn(formData);
    recentEmails.set(emailKey, Date.now());

    // Nettoyer les anciens emails (> 5 minutes)
    for (const [key, timestamp] of recentEmails.entries()) {
      if (Date.now() - timestamp > 300000) {
        recentEmails.delete(key);
      }
    }

    return result;
  }, 2000); // 2 secondes de throttle

  return throttledEmail;
}

// =============================================
// UTILITAIRES DIVERS
// =============================================

/**
 * Invalide le cache pour une entité spécifique
 * @param {string} entityType - Type d'entité (article, template, etc.)
 * @param {string} entityId - ID optionnel
 */
export function invalidateCache(entityType, entityId = null) {
  if (entityId) {
    // Invalider une entité spécifique
    siteCache.delete(`${entityType}:${entityId}`);
  } else {
    // Invalider tous les éléments du type
    for (const key of siteCache.cache.keys()) {
      if (key.startsWith(`${entityType}:`)) {
        siteCache.delete(key);
      }
    }
  }

  if (isDev) {
    console.log(
      `Cache invalidé pour ${entityType}${entityId ? `:${entityId}` : ''}`,
    );
  }
}

/**
 * Statistiques de performance simples
 * @returns {Object} Stats basiques
 */
export function getPerformanceStats() {
  return {
    cache: {
      size: siteCache.size(),
      maxSize: siteCache.maxSize,
    },
    network: {
      isSlowConnection: isSlowConnection(),
      dataSaver: prefersDataSaver(),
      reducedMotion: prefersReducedMotion(),
    },
    config: getAdaptiveConfig(),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Initialisation simple des optimisations
 * @param {Object} config - Configuration optionnelle
 */
export function initPerformance(config = {}) {
  if (!isBrowser) return;

  const { enableNetworkListener = true, logStats = isDev } = config;

  // Écouter les changements de connexion
  if (enableNetworkListener && navigator.connection) {
    try {
      navigator.connection.addEventListener('change', () => {
        if (logStats) {
          console.log('Connexion changée:', getAdaptiveConfig());
        }

        // Déclencher un événement personnalisé
        window.dispatchEvent(
          new CustomEvent('networkchange', {
            detail: getAdaptiveConfig(),
          }),
        );
      });
    } catch (error) {
      if (isDev)
        console.warn("Impossible d'écouter les changements réseau:", error);
    }
  }

  // Stats initiales
  if (logStats) {
    console.log('Performance initialisée:', getPerformanceStats());
  }

  // Exposer les utilitaires en développement
  if (isDev) {
    window.benewPerf = {
      cache: siteCache,
      getStats: getPerformanceStats,
      invalidateCache,
      getAdaptiveConfig,
    };
  }
}

// =============================================
// EXPORT PAR DÉFAUT
// =============================================

export default {
  // Fonctions principales
  debounce,
  throttle,
  preloadImage,
  preloadImages,

  // Cache
  siteCache,
  invalidateCache,

  // Détection
  prefersReducedMotion,
  prefersDataSaver,
  isSlowConnection,
  getAdaptiveConfig,

  // Optimisations spécifiques
  optimizeSearch,
  optimizeEmail,

  // Utils
  getPerformanceStats,
  initPerformance,
};

// Auto-initialisation en développement
if (isDev && isBrowser) {
  // Délai pour éviter les conflits avec l'hydratation
  setTimeout(() => initPerformance(), 1000);
}
