/**
 * Utilitaires pour améliorer les performances du site portfolio Benew
 * Version optimisée pour Next.js 15, PostgreSQL, Cloudinary, EmailJS et Sentry
 * Adapté spécifiquement pour un site vitrine avec blog, templates et système de commandes
 */

import {
  captureException,
  captureDatabaseError,
  captureCloudinaryError,
  captureEmailError,
  captureValidationError,
} from '@/instrumentation';

// Vérification d'environnement pour SSR (Server-Side Rendering)
const isBrowser = typeof window !== 'undefined';
const isProduction = process.env.NODE_ENV === 'production';

// Configuration par défaut des utilitaires de performance pour le site portfolio
const DEFAULT_CONFIG = {
  // Configuration memoize - Optimisée pour les entités du site (articles, templates, applications, orders)
  memoize: {
    defaultTTL: 600000, // 10 minutes pour site vitrine (plus long que dashboard)
    maxCacheSize: 100, // Taille adaptée au site vitrine
    cleanupInterval: 15 * 60 * 1000, // 15 minutes
  },
  // Configuration du throttling - Adaptée aux interactions utilisateur
  throttle: {
    defaultLimit: 300, // 300ms pour site vitrine (plus réactif)
    errorLimit: 3, // Moins tolérant pour UX
  },
  // Configuration debounce - Pour recherche et interactions
  debounce: {
    defaultDelay: 350, // Délai adapté aux recherches blog/templates
  },
  // Configuration du préchargement - Optimisée pour Cloudinary du site
  preload: {
    timeout: 12000, // 12 secondes pour images de templates/blog
    maxConcurrent: 4, // Plus d'images simultanées pour gallery
    retryAttempts: 2, // Moins de tentatives pour performance
    retryDelay: 1000, // Délai plus court
  },
  // Configuration de détection de réseau - Adaptée pour site vitrine
  network: {
    slowThreshold: 2.0, // 2 Mbps (plus tolérant pour site public)
    checkInterval: 180000, // Vérification toutes les 3 minutes
  },
  // Configuration spécifique au site portfolio
  site: {
    searchDebounceDelay: 350, // Pour la recherche d'articles/templates
    emailThrottle: 2000, // Throttling des envois EmailJS
    imagePreloadBatch: 4, // Nombre d'images à précharger par batch
    cacheInvalidationDelay: 300000, // 5 minutes avant invalidation cache
    animationThreshold: 1.5, // Mbps pour désactiver animations lourdes
  },
};

// État global pour le suivi des performances du site
const performanceState = {
  isSlowConnection: null,
  networkType: null,
  reducedMotionPreferred: null,
  dataSaverEnabled: null,
  // Cache LRU pour les métriques récentes
  recentMetrics: new Map(),
  disabledFeatures: new Set(),
  // États spécifiques au site portfolio
  siteMetrics: {
    pageLoadTimes: new Map(),
    apiCallTimes: new Map(),
    componentRenderTimes: new Map(),
    imageLoadTimes: new Map(),
    searchPerformance: new Map(),
    emailPerformance: new Map(),
  },
  // Cache spécifique aux entités du site
  entityCache: {
    articles: new Map(),
    templates: new Map(),
    applications: new Map(),
    orders: new Map(),
    platforms: new Map(),
    pages: new Map(),
  },
};

/**
 * Utilitaire de logging sécurisé adapté au site portfolio
 * @param {string} level - Niveau de log (debug, info, warn, error)
 * @param {string} context - Contexte du message (site, blog, templates, contact, etc.)
 * @param {string} message - Message principal
 * @param {Object} [data] - Données additionnelles
 */
function safeLog(level, context, message, data = {}) {
  // Ignorer les logs de debug en production
  if (level === 'debug' && isProduction) {
    return;
  }

  // Filtrer les données sensibles spécifiques au site
  const filteredData = { ...data };
  const sensitiveKeys = [
    'password',
    'db_password',
    'cloudinary_secret',
    'emailjs_private_key',
    'emailjs_service_id',
    'emailjs_template_id',
    'session_token',
    'api_key',
    'sentry_dsn',
    'platform_number',
    'account_number',
    'account_name',
    'email',
    'phone',
  ];

  sensitiveKeys.forEach((key) => {
    if (filteredData[key]) {
      filteredData[key] = '[FILTERED]';
    }
  });

  if (isBrowser && typeof console !== 'undefined' && console[level]) {
    try {
      console[level](`[Benew-${context}] ${message}`, filteredData);

      // En cas d'erreur critique, envoyer à Sentry en production avec contexte site
      if (level === 'error' && isProduction) {
        captureException(data instanceof Error ? data : new Error(message), {
          tags: {
            component: 'site_performance',
            context: context,
            level: level,
            source: 'performance_utils',
          },
          extra: filteredData,
        });
      }
    } catch (e) {
      // Fail silently
    }
  }
}

/**
 * Valide une valeur d'entrée pour prévenir des erreurs dans le site
 * @param {any} value - Valeur à valider
 * @param {string} expectedType - Type attendu
 * @param {any} defaultValue - Valeur par défaut en cas d'invalidité
 * @returns {any} - Valeur validée ou valeur par défaut
 */
function validateInput(value, expectedType, defaultValue) {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  const actualType = typeof value;

  if (expectedType === 'array' && Array.isArray(value)) {
    return value;
  }

  if (actualType === expectedType) {
    return value;
  }

  // Tentative de conversion pour certains types
  if (expectedType === 'number' && actualType === 'string') {
    const parsed = parseFloat(value);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }

  if (
    expectedType === 'boolean' &&
    (value === 0 || value === 1 || value === '0' || value === '1')
  ) {
    return value == 1 || value === '1';
  }

  // Log de l'erreur en développement
  if (!isProduction) {
    safeLog(
      'warn',
      'Validation',
      `Type invalide: attendu ${expectedType}, reçu ${actualType}`,
      {
        value,
        defaultValue,
        component: 'site_validation',
      },
    );
  }

  return defaultValue;
}

/**
 * Génère une clé de cache unique et sûre pour les entités du site
 * @param {Array} args - Arguments à hasher
 * @param {string} entityType - Type d'entité (article, template, application, etc.)
 * @returns {string} Clé de cache
 */
function generateCacheKey(args, entityType = 'generic') {
  try {
    // Limitation de la taille des arguments pour éviter des problèmes de mémoire
    const safeArgs = args.map((arg) => {
      if (arg === null || arg === undefined) {
        return String(arg);
      }

      if (typeof arg === 'function') {
        return '[Function]';
      }

      if (typeof arg === 'object') {
        try {
          const str = JSON.stringify(arg);
          // Tronquer les objets trop grands
          return str.length > 300 ? str.substring(0, 300) + '...' : str;
        } catch (e) {
          return '[Complex Object]';
        }
      }

      return String(arg);
    });

    // Inclure le type d'entité pour éviter les collisions
    return `${entityType}:${safeArgs.join('::')}`;
  } catch (e) {
    // Fallback en cas d'erreur
    return `${entityType}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  }
}

/**
 * Fonction pour memoizer spécialement adaptée aux entités du site
 * @param {Function} fn - La fonction à mettre en cache
 * @param {Object|number} options - Options ou durée TTL en millisecondes
 * @returns {Function} - La fonction mise en cache
 */
export function memoize(fn, options = {}) {
  const config =
    typeof options === 'number'
      ? { ttl: options }
      : { ...DEFAULT_CONFIG.memoize, ...options };

  const {
    ttl = DEFAULT_CONFIG.memoize.defaultTTL,
    maxSize = DEFAULT_CONFIG.memoize.maxCacheSize,
    cleanupInterval = DEFAULT_CONFIG.memoize.cleanupInterval,
    keyGenerator = generateCacheKey,
    entityType = 'generic',
  } = config;

  // Validation de la fonction
  if (typeof fn !== 'function') {
    throw new Error('memoize: Premier argument doit être une fonction');
  }

  const cache = new Map();
  const timestamps = new Map();
  const accessLog = new Map(); // Pour LRU
  const hitCounts = new Map(); // Pour statistiques

  // Initialiser nettoyage périodique
  let cleanupTimer = null;

  if (isBrowser && typeof setInterval !== 'undefined' && cleanupInterval > 0) {
    cleanupTimer = setInterval(() => {
      cleanup();
    }, cleanupInterval);

    // Ne pas bloquer la fermeture du processus si Node.js
    if (typeof cleanupTimer.unref === 'function') {
      cleanupTimer.unref();
    }
  }

  // Fonction de nettoyage des entrées expirées
  function cleanup() {
    try {
      const now = Date.now();
      let expired = 0;

      for (const [key, timestamp] of timestamps.entries()) {
        if (now - timestamp > ttl) {
          cache.delete(key);
          timestamps.delete(key);
          accessLog.delete(key);
          hitCounts.delete(key);
          expired++;
        }
      }

      // Si le cache a toujours trop d'entrées, supprimer les moins récemment utilisées
      if (cache.size > maxSize) {
        const sortedEntries = [...accessLog.entries()].sort(
          (a, b) => a[1] - b[1],
        );
        const toDelete = sortedEntries.slice(0, cache.size - maxSize);

        for (const [key] of toDelete) {
          cache.delete(key);
          timestamps.delete(key);
          accessLog.delete(key);
          hitCounts.delete(key);
        }
      }

      if (expired > 0 && !isProduction) {
        safeLog(
          'debug',
          'Memoize',
          `Nettoyage cache ${entityType}: ${expired} entrées expirées supprimées, taille: ${cache.size}`,
          { entityType, expired, currentSize: cache.size },
        );
      }
    } catch (error) {
      safeLog('error', 'Memoize', 'Erreur lors du nettoyage du cache', {
        error,
        entityType,
      });
    }
  }

  // Fonction memoizée
  const memoized = function (...args) {
    try {
      const key = keyGenerator(args, entityType);
      const now = Date.now();

      // Mise à jour du log d'accès pour LRU
      accessLog.set(key, now);

      // Si la valeur existe dans le cache et n'a pas expiré
      if (cache.has(key) && now - timestamps.get(key) < ttl) {
        // Incrémenter le compteur de hits
        hitCounts.set(key, (hitCounts.get(key) || 0) + 1);
        return cache.get(key);
      }

      // Si le cache est plein et la clé n'existe pas, nettoyer d'abord
      if (!cache.has(key) && cache.size >= maxSize) {
        cleanup();
      }

      // Calculer le résultat
      const result = fn.apply(this, args);

      // Traiter différemment selon si c'est une promesse ou non
      if (result instanceof Promise) {
        return result
          .then((value) => {
            cache.set(key, value);
            timestamps.set(key, now);
            hitCounts.set(key, 1);

            // Log pour les entités importantes du site
            if (['article', 'template', 'application'].includes(entityType)) {
              safeLog('debug', 'Memoize', `Cache miss pour ${entityType}`, {
                key: key.substring(0, 50),
              });
            }

            return value;
          })
          .catch((error) => {
            // Ne pas mettre en cache les erreurs
            safeLog(
              'warn',
              'Memoize',
              `Erreur dans fonction memoizée ${entityType}`,
              { error },
            );
            throw error;
          });
      } else {
        // Résultats synchrones
        cache.set(key, result);
        timestamps.set(key, now);
        hitCounts.set(key, 1);
        return result;
      }
    } catch (error) {
      safeLog(
        'error',
        'Memoize',
        `Erreur lors de l'exécution de la fonction memoizée ${entityType}`,
        { error, entityType },
      );
      // Si une erreur se produit, exécuter la fonction d'origine (sans cache)
      return fn.apply(this, args);
    }
  };

  // Méthodes pour manipuler le cache
  memoized.clear = () => {
    cache.clear();
    timestamps.clear();
    accessLog.clear();
    hitCounts.clear();
  };

  memoized.size = () => cache.size;

  memoized.stats = () => ({
    size: cache.size,
    maxSize,
    entityType,
    hitCounts: Object.fromEntries(hitCounts),
    totalHits: Array.from(hitCounts.values()).reduce(
      (sum, count) => sum + count,
      0,
    ),
  });

  memoized.invalidate = (predicate) => {
    if (typeof predicate === 'function') {
      for (const [key, value] of cache.entries()) {
        if (predicate(value, key)) {
          cache.delete(key);
          timestamps.delete(key);
          accessLog.delete(key);
          hitCounts.delete(key);
        }
      }
    }
  };

  // Invalidation spécifique aux entités du site
  memoized.invalidateByEntityId = (entityId) => {
    const keysToDelete = [];
    for (const key of cache.keys()) {
      if (key.includes(String(entityId))) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach((key) => {
      cache.delete(key);
      timestamps.delete(key);
      accessLog.delete(key);
      hitCounts.delete(key);
    });

    safeLog('debug', 'Memoize', `Invalidation cache pour entité ${entityId}`, {
      entityType,
      keysDeleted: keysToDelete.length,
    });
  };

  return memoized;
}

/**
 * Debounce spécialement adapté pour les recherches et interactions du site
 * @param {Function} fn - La fonction à debouncer
 * @param {Object|number} options - Options ou délai en millisecondes
 * @returns {Function} - La fonction debouncée
 */
export function debounce(fn, options = {}) {
  // Gérer l'option simple (nombre)
  const config =
    typeof options === 'number'
      ? { delay: options }
      : { ...DEFAULT_CONFIG.debounce, ...options };

  const {
    delay = DEFAULT_CONFIG.debounce.defaultDelay,
    leading = false,
    trailing = true,
    maxWait = null,
    context = 'generic',
  } = config;

  if (typeof fn !== 'function') {
    throw new Error('debounce: Premier argument doit être une fonction');
  }

  // Pas de setTimeout en SSR
  if (!isBrowser) {
    return fn;
  }

  let timeoutId = null;
  let lastArgs = null;
  let lastThis = null;
  let lastCallTime = 0;
  let lastInvocationTime = 0;
  let result;
  let callCount = 0;

  // Vérifie si le temps d'attente max a été dépassé
  function shouldInvoke(time) {
    const timeSinceLastCall = time - lastCallTime;
    const timeSinceLastInvocation = time - lastInvocationTime;

    return (
      lastCallTime === 0 ||
      timeSinceLastCall >= delay ||
      (maxWait !== null && timeSinceLastInvocation >= maxWait)
    );
  }

  // Invoque la fonction avec les arguments sauvegardés
  function invokeFunc(time) {
    const args = lastArgs;
    const thisArg = lastThis;

    // Réinitialiser
    lastArgs = lastThis = null;
    lastInvocationTime = time;
    callCount++;

    // Log pour les recherches importantes
    if (context.includes('search') && !isProduction) {
      safeLog('debug', 'Debounce', `Recherche exécutée après debounce`, {
        context,
        delay,
        callCount,
      });
    }

    result = fn.apply(thisArg, args);
    return result;
  }

  // Lance la fonction debouncée
  function leadingEdge(time) {
    lastInvocationTime = time;

    // Démarrer le timer pour l'invocation trailing
    timeoutId = setTimeout(timerExpired, delay);

    // Invoquer si leading=true
    return leading ? invokeFunc(time) : result;
  }

  // Fonction appelée quand le timer expire
  function timerExpired() {
    const time = Date.now();

    if (shouldInvoke(time)) {
      return trailingEdge(time);
    }

    // Redémarrer le timer pour le temps restant
    timeoutId = setTimeout(timerExpired, delay);
  }

  // Appel final trailing
  function trailingEdge(time) {
    timeoutId = null;

    // Invoquer seulement si on a des args et trailing=true
    if (trailing && lastArgs) {
      return invokeFunc(time);
    }

    lastArgs = lastThis = null;
    return result;
  }

  // Fonction debouncée
  function debounced(...args) {
    const time = Date.now();
    const isInvoking = shouldInvoke(time);

    lastArgs = args;
    lastThis = this;
    lastCallTime = time;

    if (isInvoking) {
      if (timeoutId === null) {
        return leadingEdge(time);
      }

      if (maxWait !== null) {
        // Gérer les invocations en attente maximale
        timeoutId = setTimeout(timerExpired, delay);
        return invokeFunc(time);
      }
    }

    if (timeoutId === null) {
      timeoutId = setTimeout(timerExpired, delay);
    }

    return result;
  }

  // Méthodes utilitaires
  debounced.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    lastArgs = lastThis = null;
    lastCallTime = lastInvocationTime = 0;
    callCount = 0;
  };

  debounced.flush = () => {
    return timeoutId === null ? result : trailingEdge(Date.now());
  };

  debounced.pending = () => timeoutId !== null;

  debounced.stats = () => ({
    context,
    delay,
    callCount,
    isPending: timeoutId !== null,
  });

  return debounced;
}

/**
 * Throttle adapté aux interactions du site (emails, recherches, etc.)
 * @param {Function} fn - La fonction à throttler
 * @param {Object|number} options - Options ou limite en millisecondes
 * @returns {Function} - La fonction throttlée
 */
export function throttle(fn, options = {}) {
  const config =
    typeof options === 'number'
      ? { limit: options }
      : { ...DEFAULT_CONFIG.throttle, ...options };

  const {
    limit = DEFAULT_CONFIG.throttle.defaultLimit,
    trailing = true,
    leading = true,
    errorLimit = DEFAULT_CONFIG.throttle.errorLimit,
    context = 'generic',
  } = config;

  if (typeof fn !== 'function') {
    throw new Error('throttle: Premier argument doit être une fonction');
  }

  // Pas de setTimeout en SSR
  if (!isBrowser) {
    return fn;
  }

  let lastCallTime = 0;
  let lastInvokeTime = 0;
  let timerId = null;
  let lastArgs = null;
  let lastThis = null;
  let lastResult;
  let errorCount = 0;
  let active = true;
  let invokeCount = 0;

  // Vérifier si une nouvelle invocation est possible
  function shouldInvoke(time) {
    const timeSinceLastCall = time - lastCallTime;
    const timeSinceLastInvoke = time - lastInvokeTime;

    return (
      lastCallTime === 0 || timeSinceLastCall >= limit || timeSinceLastCall < 0
    );
  }

  // Invoquer la fonction avec catch d'erreur
  function invokeFunc(time, args, thisArg) {
    lastInvokeTime = time;
    invokeCount++;

    try {
      lastResult = fn.apply(thisArg, args);
      // Réinitialiser le compteur d'erreurs en cas de succès
      errorCount = 0;

      // Log pour les fonctions importantes
      if (context.includes('email') && !isProduction) {
        safeLog('debug', 'Throttle', `Envoi email throttlé exécuté`, {
          context,
          limit,
          invokeCount,
        });
      }

      return lastResult;
    } catch (error) {
      errorCount++;
      safeLog(
        'error',
        'Throttle',
        `Erreur dans la fonction throttlée (${errorCount}/${errorLimit})`,
        { error, context, invokeCount },
      );

      // Désactiver le throttle après trop d'erreurs pour les fonctions critiques
      if (errorCount >= errorLimit && context.includes('email')) {
        active = false;
        safeLog(
          'warn',
          'Throttle',
          `Trop d'erreurs email, fonction throttlée désactivée`,
          { context, errorCount },
        );
      }

      throw error;
    }
  }

  // Traiter le premier appel (leading edge)
  function leadingEdge(time) {
    lastInvokeTime = time;

    // Programmer un appel trailing si nécessaire
    if (trailing) {
      timerId = setTimeout(trailingEdge, limit);
    }

    // Exécuter si leading=true
    return leading ? invokeFunc(time, lastArgs, lastThis) : lastResult;
  }

  // Traiter l'appel final (trailing edge)
  function trailingEdge() {
    timerId = null;

    // Exécuter si trailing=true et si des arguments sont en attente
    if (trailing && lastArgs) {
      return invokeFunc(Date.now(), lastArgs, lastThis);
    }

    lastArgs = lastThis = null;
    return lastResult;
  }

  // Fonction throttlée principale
  function throttled(...args) {
    // Si désactivé après trop d'erreurs, exécuter directement
    if (!active) {
      return fn.apply(this, args);
    }

    const time = Date.now();
    const isInvoking = shouldInvoke(time);

    lastArgs = args;
    lastThis = this;
    lastCallTime = time;

    if (isInvoking) {
      if (timerId === null) {
        return leadingEdge(time);
      }

      // Si leading=false, programmer seulement l'appel trailing
      if (trailing) {
        timerId = setTimeout(trailingEdge, limit - (time - lastCallTime));
      }
    }

    return lastResult;
  }

  // Méthodes utilitaires
  throttled.cancel = () => {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
    lastCallTime = 0;
    lastInvokeTime = 0;
    lastArgs = lastThis = null;
    invokeCount = 0;
  };

  throttled.flush = () => {
    return timerId === null ? lastResult : trailingEdge();
  };

  throttled.pending = () => {
    return timerId !== null;
  };

  throttled.reset = () => {
    errorCount = 0;
    active = true;
    invokeCount = 0;
  };

  throttled.stats = () => ({
    context,
    limit,
    errorCount,
    active,
    invokeCount,
    isPending: timerId !== null,
  });

  return throttled;
}

/**
 * Queue pour limiter le nombre de tâches concurrentes dans le site
 */
class SiteTaskQueue {
  constructor(concurrency = 4, context = 'site') {
    this.concurrency = Math.max(1, concurrency);
    this.running = 0;
    this.queue = [];
    this.context = context;
    this.completed = 0;
    this.failed = 0;
  }

  add(task, priority = 0) {
    return new Promise((resolve, reject) => {
      // Ajouter à la queue avec priorité
      const queueItem = {
        task,
        resolve,
        reject,
        priority,
        addedAt: Date.now(),
      };

      // Insérer selon la priorité (plus haute priorité en premier)
      const insertIndex = this.queue.findIndex(
        (item) => item.priority < priority,
      );
      if (insertIndex === -1) {
        this.queue.push(queueItem);
      } else {
        this.queue.splice(insertIndex, 0, queueItem);
      }

      this.processQueue();
    });
  }

  processQueue() {
    if (this.running >= this.concurrency || this.queue.length === 0) {
      return;
    }

    // Retirer le premier élément (plus haute priorité)
    const item = this.queue.shift();
    this.running++;

    const startTime = Date.now();

    // Exécuter la tâche avec gestion des promesses
    Promise.resolve()
      .then(() => item.task())
      .then((result) => {
        this.running--;
        this.completed++;

        const duration = Date.now() - startTime;
        if (!isProduction && duration > 3000) {
          safeLog('warn', 'TaskQueue', `Tâche lente détectée`, {
            context: this.context,
            duration,
            priority: item.priority,
          });
        }

        item.resolve(result);
        this.processQueue();
      })
      .catch((error) => {
        this.running--;
        this.failed++;

        safeLog('error', 'TaskQueue', `Tâche échouée`, {
          error,
          context: this.context,
          priority: item.priority,
        });

        item.reject(error);
        this.processQueue();
      });
  }

  get size() {
    return this.queue.length;
  }

  get active() {
    return this.running;
  }

  get stats() {
    return {
      context: this.context,
      queued: this.queue.length,
      running: this.running,
      completed: this.completed,
      failed: this.failed,
      concurrency: this.concurrency,
    };
  }

  clear() {
    this.queue.forEach((item) => {
      item.reject(new Error('Queue cleared'));
    });
    this.queue = [];
  }
}

// Queue globale pour les préchargements d'image Cloudinary du site
const cloudinaryQueue = isBrowser
  ? new SiteTaskQueue(DEFAULT_CONFIG.preload.maxConcurrent, 'cloudinary')
  : null;

/**
 * Charge une image Cloudinary à l'avance avec timeout et retry (adapté au site)
 * @param {string} src - L'URL de l'image Cloudinary à charger
 * @param {Object} options - Options pour le chargement
 * @returns {Promise<HTMLImageElement>} - Une promesse qui se résout avec l'image chargée
 */
export function preloadCloudinaryImage(src, options = {}) {
  // Pas de préchargement en SSR
  if (!isBrowser) {
    return Promise.resolve(null);
  }

  const {
    timeout = DEFAULT_CONFIG.preload.timeout,
    retryAttempts = DEFAULT_CONFIG.preload.retryAttempts,
    retryDelay = DEFAULT_CONFIG.preload.retryDelay,
    priority = 'auto', // 'high', 'low', 'auto'
    crossOrigin = 'anonymous', // Cloudinary recommande anonymous
    transform = '', // Transformations Cloudinary pour templates/blog
  } = options;

  if (!src || typeof src !== 'string') {
    return Promise.reject(new Error("URL d'image Cloudinary invalide"));
  }

  // Construire l'URL Cloudinary avec transformations si spécifiées
  let finalSrc = src;
  if (transform && src.includes('cloudinary.com')) {
    const parts = src.split('/upload/');
    if (parts.length === 2) {
      finalSrc = `${parts[0]}/upload/${transform}/${parts[1]}`;
    }
  }

  // Fonction de préchargement à ajouter à la queue
  const preloadTask = (attempt = 0) => {
    return new Promise((resolve, reject) => {
      // Gérer le timeout
      let timeoutId = null;
      let isTimedOut = false;

      if (timeout > 0) {
        timeoutId = setTimeout(() => {
          isTimedOut = true;

          // Si on a encore des tentatives, réessayer
          if (attempt < retryAttempts) {
            safeLog(
              'warn',
              'CloudinaryPreload',
              `Timeout lors du chargement Cloudinary (${attempt + 1}/${retryAttempts + 1})`,
              { src: finalSrc, attempt, transform },
            );

            setTimeout(() => {
              preloadTask(attempt + 1)
                .then(resolve)
                .catch(reject);
            }, retryDelay);
          } else {
            const error = new Error(
              `Timeout lors du chargement de l'image Cloudinary: ${finalSrc}`,
            );
            captureCloudinaryError(error, {
              uploadType: 'preload',
              fileType: 'image',
              tags: { timeout: true, attempts: retryAttempts + 1 },
              extra: { src: finalSrc, transform },
            });
            reject(error);
          }
        }, timeout);
      }

      const img = new Image();

      // Configurer les attributs pour Cloudinary
      if (crossOrigin) {
        img.crossOrigin = crossOrigin;
      }

      if (priority !== 'auto' && 'fetchPriority' in img) {
        img.fetchPriority = priority;
      }

      // Gestionnaires d'événements
      img.onload = () => {
        if (isTimedOut) return;

        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        safeLog(
          'debug',
          'CloudinaryPreload',
          'Image Cloudinary chargée avec succès',
          {
            src: finalSrc,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            transform,
          },
        );

        resolve(img);
      };

      img.onerror = () => {
        if (isTimedOut) return;

        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        // Réessayer si on n'a pas dépassé le nombre de tentatives
        if (attempt < retryAttempts) {
          safeLog(
            'warn',
            'CloudinaryPreload',
            `Erreur lors du chargement Cloudinary (${attempt + 1}/${retryAttempts + 1})`,
            { src: finalSrc, attempt, transform },
          );

          setTimeout(() => {
            preloadTask(attempt + 1)
              .then(resolve)
              .catch(reject);
          }, retryDelay);
        } else {
          const error = new Error(
            `Impossible de charger l'image Cloudinary: ${finalSrc}`,
          );
          captureCloudinaryError(error, {
            uploadType: 'preload',
            fileType: 'image',
            tags: { load_failed: true, attempts: retryAttempts + 1 },
            extra: { src: finalSrc, transform },
          });
          reject(error);
        }
      };

      // Définir src après les gestionnaires
      img.src = finalSrc;
    });
  };

  // Ajouter à la queue globale avec priorité
  const queuePriority = priority === 'high' ? 10 : priority === 'low' ? 1 : 5;
  return cloudinaryQueue.add(() => preloadTask(), queuePriority);
}

/**
 * Charge plusieurs images Cloudinary à l'avance pour le site (templates, articles)
 * @param {Array<string|Object>} items - URLs des images ou objets de configuration
 * @param {Object} globalOptions - Options globales pour toutes les images
 * @returns {Promise<HTMLImageElement[]>} - Une promesse qui se résout quand toutes les images sont chargées
 */
export function preloadCloudinaryImages(items, globalOptions = {}) {
  // Pas de préchargement en SSR
  if (!isBrowser) {
    return Promise.resolve([]);
  }

  if (!Array.isArray(items) || items.length === 0) {
    return Promise.resolve([]);
  }

  const batchSize =
    globalOptions.batchSize || DEFAULT_CONFIG.site.imagePreloadBatch;

  // Traitement par batch pour éviter de surcharger
  const batches = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }

  // Traiter chaque batch séquentiellement
  return batches
    .reduce((promise, batch) => {
      return promise.then((results) => {
        const batchPromises = batch.map((item) => {
          // Déterminer src et options selon le format d'entrée
          const src = typeof item === 'string' ? item : item.src;
          const options =
            typeof item === 'object'
              ? { ...globalOptions, ...item }
              : globalOptions;

          // Wrapper pour capturer les erreurs et retourner null en cas d'échec
          return preloadCloudinaryImage(src, options).catch((error) => {
            safeLog(
              'error',
              'CloudinaryPreload',
              `Échec du préchargement Cloudinary`,
              {
                src,
                error: error.message,
              },
            );
            return null;
          });
        });

        return Promise.all(batchPromises).then((batchResults) => {
          return [...results, ...batchResults];
        });
      });
    }, Promise.resolve([]))
    .then((allResults) => {
      // Filtrer les résultats null (échecs)
      const loaded = allResults.filter((img) => img !== null);

      if (loaded.length < items.length) {
        safeLog(
          'warn',
          'CloudinaryPreload',
          `${loaded.length}/${items.length} images Cloudinary préchargées`,
          { expectedCount: items.length, loadedCount: loaded.length },
        );
      }

      return loaded;
    });
}

/**
 * Fonction générique pour détecter les préférences utilisateur dans le site
 * @param {string} name - Nom de la préférence
 * @param {Function} detector - Fonction de détection
 * @param {boolean} defaultValue - Valeur par défaut
 * @returns {boolean} - Valeur détectée ou par défaut
 */
function detectPreference(name, detector, defaultValue = false) {
  // Si pas de navigateur, retourner la valeur par défaut
  if (!isBrowser) {
    return defaultValue;
  }

  // Si déjà détecté, retourner la valeur en cache
  const stateKey = `${name}Preferred`;
  if (performanceState[stateKey] !== null) {
    return performanceState[stateKey];
  }

  try {
    const result = detector();
    performanceState[stateKey] = result;

    // Log pour le site en mode développement
    if (!isProduction) {
      safeLog('debug', 'Preferences', `Détection ${name}`, {
        result,
        context: 'site',
      });
    }

    return result;
  } catch (error) {
    safeLog('warn', 'Preferences', `Erreur lors de la détection de ${name}`, {
      error,
      context: 'site',
    });
    performanceState[stateKey] = defaultValue;
    return defaultValue;
  }
}

/**
 * Détecte si le navigateur est en mode préférence de réduction du mouvement
 * (Important pour les animations Framer Motion du site)
 * @returns {boolean} - true si le navigateur est en mode préférence de réduction du mouvement
 */
export function prefersReducedMotion() {
  return detectPreference(
    'reducedMotion',
    () => {
      return (
        isBrowser &&
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      );
    },
    false,
  );
}

/**
 * Détecte si le navigateur supporte l'API NetworkInformation
 * @returns {boolean} - true si l'API est supportée
 */
function hasNetworkInfoSupport() {
  return (
    isBrowser &&
    window.navigator &&
    typeof window.navigator.connection !== 'undefined'
  );
}

/**
 * Détecte si le navigateur est en mode data saver
 * (Important pour optimiser les images et animations du site)
 * @returns {boolean} - true si le navigateur est en mode data saver
 */
export function prefersDataSaver() {
  return detectPreference(
    'dataSaver',
    () => {
      if (!hasNetworkInfoSupport()) {
        return false;
      }

      return window.navigator.connection.saveData === true;
    },
    false,
  );
}

/**
 * Détecte si l'utilisateur est sur une connexion lente
 * (Crucial pour adapter l'interface du site et les animations)
 * @param {boolean} [forceCheck=false] - Forcer une nouvelle vérification
 * @returns {boolean} - true si l'utilisateur est sur une connexion lente
 */
export function isSlowConnection(forceCheck = false) {
  // Si pas dans un navigateur, retourner false
  if (!isBrowser) {
    return false;
  }

  // Si déjà détecté et pas de force check, retourner la valeur en cache
  if (performanceState.isSlowConnection !== null && !forceCheck) {
    return performanceState.isSlowConnection;
  }

  try {
    // Utiliser l'API NetworkInformation si disponible
    if (hasNetworkInfoSupport()) {
      const connection = window.navigator.connection;

      // Méthode principale: vérifier effectiveType
      if (connection.effectiveType) {
        const isSlow =
          connection.effectiveType === 'slow-2g' ||
          connection.effectiveType === '2g' ||
          connection.effectiveType === '3g';

        performanceState.networkType = connection.effectiveType;
        performanceState.isSlowConnection = isSlow;

        // Adapter l'interface du site selon la connexion
        if (isSlow && !isProduction) {
          safeLog(
            'info',
            'Network',
            'Connexion lente détectée, adaptation du site',
            {
              effectiveType: connection.effectiveType,
              downlink: connection.downlink,
            },
          );
        }

        return isSlow;
      }

      // Méthode alternative: vérifier downlink
      if (typeof connection.downlink === 'number') {
        const isSlow =
          connection.downlink < DEFAULT_CONFIG.network.slowThreshold;
        performanceState.isSlowConnection = isSlow;
        return isSlow;
      }

      // Méthode de secours basée sur le type de connexion
      if (connection.type) {
        const slowTypes = ['cellular', 'wimax'];
        const isSlow = slowTypes.includes(connection.type);
        performanceState.isSlowConnection = isSlow;
        return isSlow;
      }
    }

    // Fallback: vérifier le temps de chargement de la page comme heuristique
    if (window.performance) {
      const navEntries = window.performance.getEntriesByType('navigation');
      if (navEntries && navEntries.length > 0) {
        const navEntry = navEntries[0];
        if (navEntry.loadEventEnd && navEntry.startTime) {
          const loadTime = navEntry.loadEventEnd - navEntry.startTime;
          const isSlow = loadTime > 3000; // Plus de 3 secondes pour site vitrine
          performanceState.isSlowConnection = isSlow;
          return isSlow;
        }
      }
    }

    // Si aucune détection n'a fonctionné, valeur par défaut
    performanceState.isSlowConnection = false;
    return false;
  } catch (error) {
    safeLog('warn', 'Network', 'Erreur lors de la détection de la connexion', {
      error,
      context: 'site',
    });
    performanceState.isSlowConnection = false;
    return false;
  }
}

/**
 * Détecte le type et la qualité de la connexion réseau pour le site
 * @returns {Object} Informations détaillées sur la connexion
 */
export function getNetworkInfo() {
  // Si pas dans un navigateur, retourner des valeurs par défaut
  if (!isBrowser) {
    return {
      type: 'unknown',
      effectiveType: 'unknown',
      downlink: null,
      rtt: null,
      saveData: false,
      isSlowConnection: false,
      siteOptimized: false,
    };
  }

  // Forcer une vérification fraîche
  isSlowConnection(true);

  const result = {
    type: 'unknown',
    effectiveType: 'unknown',
    downlink: null,
    rtt: null,
    saveData: prefersDataSaver(),
    isSlowConnection: performanceState.isSlowConnection || false,
    siteOptimized: false,
  };

  try {
    if (hasNetworkInfoSupport()) {
      const connection = window.navigator.connection;

      if (connection.type) {
        result.type = connection.type;
      }

      if (connection.effectiveType) {
        result.effectiveType = connection.effectiveType;
      }

      if (typeof connection.downlink === 'number') {
        result.downlink = connection.downlink;
      }

      if (typeof connection.rtt === 'number') {
        result.rtt = connection.rtt;
      }

      // Déterminer si le site doit être optimisé
      result.siteOptimized =
        result.isSlowConnection ||
        result.saveData ||
        (result.downlink &&
          result.downlink < DEFAULT_CONFIG.site.animationThreshold) ||
        (result.rtt && result.rtt > 300);

      // Enregistrer les événements de changement de connexion
      if (typeof connection.addEventListener === 'function') {
        // Supprimer les anciens écouteurs pour éviter les doublons
        try {
          connection.removeEventListener('change', onNetworkChange);
        } catch (e) {
          // Ignorer si l'écouteur n'existait pas
        }

        // Ajouter un nouvel écouteur
        connection.addEventListener('change', onNetworkChange);
      }
    }
  } catch (error) {
    safeLog(
      'error',
      'Network',
      'Erreur lors de la récupération des informations réseau',
      { error, context: 'site' },
    );
  }

  return result;
}

/**
 * Gestionnaire d'événements pour les changements de réseau dans le site
 */
function onNetworkChange() {
  // Vérifier que nous sommes dans un navigateur
  if (!isBrowser) return;

  // Réinitialiser le cache pour forcer une nouvelle détection
  performanceState.isSlowConnection = null;
  performanceState.networkType = null;

  // Réexécuter la détection
  const isSlow = isSlowConnection(true);
  const networkInfo = getNetworkInfo();

  // Log du changement de réseau
  safeLog('info', 'Network', 'Changement de réseau détecté', {
    isSlowConnection: isSlow,
    effectiveType: networkInfo.effectiveType,
    downlink: networkInfo.downlink,
    siteOptimized: networkInfo.siteOptimized,
  });

  // Déclencher un événement personnalisé pour les composants du site
  if (window.dispatchEvent) {
    try {
      const event = new CustomEvent('siteNetworkChange', {
        detail: {
          isSlowConnection: isSlow,
          networkInfo: networkInfo,
          timestamp: Date.now(),
        },
      });
      window.dispatchEvent(event);
    } catch (e) {
      // Ignorer les erreurs d'événements
    }
  }
}

/**
 * Optimise les appels API selon le contexte du site
 * @param {Function} apiCall - La fonction d'appel API
 * @param {Object} options - Options d'optimisation
 * @returns {Function} - Fonction d'appel API optimisée
 */
export function optimizeApiCall(apiCall, options = {}) {
  const {
    entityType = 'generic',
    cacheTTL = 600000, // 10 minutes par défaut pour site vitrine
    throttleDelay = DEFAULT_CONFIG.throttle.defaultLimit,
    retryAttempts = 2,
    retryDelay = 1000,
  } = options;

  // Memoize avec cache spécifique à l'entité
  const memoizedCall = memoize(apiCall, {
    ttl: cacheTTL,
    entityType: entityType,
    maxSize: 50,
  });

  // Throttle pour éviter les appels trop fréquents
  const throttledCall = throttle(memoizedCall, {
    limit: throttleDelay,
    context: `api_${entityType}`,
  });

  // Wrapper avec retry automatique pour les erreurs réseau
  return async function optimizedApiCall(...args) {
    let lastError;

    for (let attempt = 0; attempt <= retryAttempts; attempt++) {
      try {
        const startTime = Date.now();
        const result = await throttledCall(...args);
        const duration = Date.now() - startTime;

        // Tracker les performances de l'API
        if (!performanceState.siteMetrics.apiCallTimes.has(entityType)) {
          performanceState.siteMetrics.apiCallTimes.set(entityType, []);
        }
        performanceState.siteMetrics.apiCallTimes
          .get(entityType)
          .push(duration);

        // Log des appels API lents
        if (duration > 2000) {
          safeLog('warn', 'ApiOptimizer', `Appel API lent détecté`, {
            entityType,
            duration,
            attempt: attempt + 1,
          });
        }

        return result;
      } catch (error) {
        lastError = error;

        // Utiliser captureDatabaseError pour les erreurs DB spécifiques
        if (/postgres|pg|database|db|connection/i.test(error.message)) {
          captureDatabaseError(error, {
            table: entityType,
            operation: 'api_call',
            queryType: 'select',
            tags: { api_optimization: true, attempt: attempt + 1 },
          });
        } else {
          captureException(error, {
            tags: {
              component: 'api_optimizer',
              entity_type: entityType,
              attempt: attempt + 1,
            },
            extra: { duration: Date.now() - Date.now() },
          });
        }

        // Ne pas retry pour certaines erreurs
        if (
          error.status === 401 ||
          error.status === 403 ||
          error.status === 404
        ) {
          throw error;
        }

        // Attendre avant le retry
        if (attempt < retryAttempts) {
          await new Promise((resolve) =>
            setTimeout(resolve, retryDelay * (attempt + 1)),
          );
        }
      }
    }

    throw lastError;
  };
}

/**
 * Optimise la recherche dans le site avec debouncing intelligent
 * @param {Function} searchFunction - La fonction de recherche
 * @param {Object} options - Options de recherche
 * @returns {Function} - Fonction de recherche optimisée
 */
export function optimizeSearch(searchFunction, options = {}) {
  const {
    entityType = 'generic',
    minQueryLength = 2,
    debounceDelay = DEFAULT_CONFIG.site.searchDebounceDelay,
    cacheResults = true,
    maxCacheSize = 20,
  } = options;

  let searchCache = new Map();
  let searchMetrics = {
    totalSearches: 0,
    cacheHits: 0,
    averageTime: 0,
  };

  // Debounce la fonction de recherche
  const debouncedSearch = debounce(searchFunction, {
    delay: debounceDelay,
    context: `search_${entityType}`,
  });

  return async function optimizedSearch(query, ...args) {
    // Valider la longueur de la requête
    if (!query || query.length < minQueryLength) {
      return [];
    }

    const normalizedQuery = query.toLowerCase().trim();
    const cacheKey = `${normalizedQuery}:${JSON.stringify(args)}`;

    searchMetrics.totalSearches++;

    // Vérifier le cache si activé
    if (cacheResults && searchCache.has(cacheKey)) {
      searchMetrics.cacheHits++;
      safeLog(
        'debug',
        'SearchOptimizer',
        `Cache hit pour recherche ${entityType}`,
        {
          query: normalizedQuery,
          cacheHitRate: (
            (searchMetrics.cacheHits / searchMetrics.totalSearches) *
            100
          ).toFixed(2),
        },
      );
      return searchCache.get(cacheKey);
    }

    const startTime = Date.now();

    try {
      const results = await debouncedSearch(query, ...args);
      const duration = Date.now() - startTime;

      // Mettre à jour les métriques
      searchMetrics.averageTime =
        (searchMetrics.averageTime * (searchMetrics.totalSearches - 1) +
          duration) /
        searchMetrics.totalSearches;

      // Mettre en cache si activé
      if (cacheResults) {
        // Limiter la taille du cache
        if (searchCache.size >= maxCacheSize) {
          const firstKey = searchCache.keys().next().value;
          searchCache.delete(firstKey);
        }
        searchCache.set(cacheKey, results);
      }

      // Tracker les performances de recherche
      if (!performanceState.siteMetrics.searchPerformance.has(entityType)) {
        performanceState.siteMetrics.searchPerformance.set(entityType, []);
      }
      performanceState.siteMetrics.searchPerformance.get(entityType).push({
        query: normalizedQuery,
        duration,
        resultsCount: results.length,
        timestamp: Date.now(),
      });

      safeLog('debug', 'SearchOptimizer', `Recherche ${entityType} terminée`, {
        query: normalizedQuery,
        duration,
        resultsCount: results.length,
        averageTime: searchMetrics.averageTime.toFixed(2),
      });

      return results;
    } catch (error) {
      // Utiliser captureDatabaseError pour les erreurs de recherche DB
      if (/postgres|pg|database|db|connection/i.test(error.message)) {
        captureDatabaseError(error, {
          table: entityType,
          operation: 'search',
          queryType: 'select_search',
          tags: { search_optimization: true },
          extra: { query: normalizedQuery, resultsExpected: true },
        });
      } else {
        captureException(error, {
          tags: {
            component: 'search_optimizer',
            entity_type: entityType,
          },
          extra: { query: normalizedQuery },
        });
      }

      safeLog(
        'error',
        'SearchOptimizer',
        `Erreur lors de la recherche ${entityType}`,
        {
          query: normalizedQuery,
          error: error.message,
        },
      );
      throw error;
    }
  };
}

/**
 * Optimise l'envoi d'emails via EmailJS
 * @param {Function} emailFunction - La fonction d'envoi EmailJS
 * @param {Object} options - Options d'optimisation
 * @returns {Function} - Fonction d'envoi email optimisée
 */
export function optimizeEmailSending(emailFunction, options = {}) {
  const {
    throttleDelay = DEFAULT_CONFIG.site.emailThrottle,
    retryAttempts = 1, // Moins de retry pour emails
    retryDelay = 2000,
    cachePreventDuplicates = true,
  } = options;

  let recentEmails = new Map();
  let emailMetrics = {
    totalSent: 0,
    successful: 0,
    failed: 0,
    duplicatesPrevented: 0,
  };

  // Throttle pour éviter l'envoi trop fréquent
  const throttledEmail = throttle(emailFunction, {
    limit: throttleDelay,
    context: 'email_sending',
    errorLimit: 2, // Moins tolérant pour emails
  });

  return async function optimizedEmailSending(formData, ...args) {
    const startTime = Date.now();
    emailMetrics.totalSent++;

    // Prévention des doublons si activée
    if (cachePreventDuplicates) {
      const emailKey = JSON.stringify({
        name: formData.get ? formData.get('name') : formData.name,
        email: formData.get ? formData.get('email') : formData.email,
        subject: formData.get ? formData.get('subject') : formData.subject,
      });

      const lastSent = recentEmails.get(emailKey);
      if (lastSent && Date.now() - lastSent < 60000) {
        // 1 minute
        emailMetrics.duplicatesPrevented++;
        safeLog('warn', 'EmailOptimizer', 'Email dupliqué empêché', {
          emailKey: emailKey.substring(0, 50),
          lastSent,
        });
        throw new Error(
          'Email déjà envoyé récemment. Veuillez attendre avant de renvoyer.',
        );
      }

      recentEmails.set(emailKey, Date.now());

      // Nettoyer les anciens emails (plus de 5 minutes)
      for (const [key, timestamp] of recentEmails.entries()) {
        if (Date.now() - timestamp > 300000) {
          recentEmails.delete(key);
        }
      }
    }

    let lastError;

    for (let attempt = 0; attempt <= retryAttempts; attempt++) {
      try {
        const result = await throttledEmail(formData, ...args);
        const duration = Date.now() - startTime;

        emailMetrics.successful++;

        // Tracker les performances d'email
        if (!performanceState.siteMetrics.emailPerformance.has('contact')) {
          performanceState.siteMetrics.emailPerformance.set('contact', []);
        }
        performanceState.siteMetrics.emailPerformance.get('contact').push({
          duration,
          success: true,
          attempt: attempt + 1,
          timestamp: Date.now(),
        });

        safeLog('info', 'EmailOptimizer', 'Email envoyé avec succès', {
          duration,
          attempt: attempt + 1,
          totalSent: emailMetrics.totalSent,
          successRate: (
            (emailMetrics.successful / emailMetrics.totalSent) *
            100
          ).toFixed(2),
        });

        return result;
      } catch (error) {
        lastError = error;
        emailMetrics.failed++;

        // Utiliser captureEmailError pour les erreurs EmailJS spécifiques
        captureEmailError(error, {
          emailType: 'contact',
          tags: {
            email_optimization: true,
            attempt: attempt + 1,
          },
          extra: {
            duration: Date.now() - startTime,
            totalAttempts: retryAttempts + 1,
          },
        });

        safeLog(
          'error',
          'EmailOptimizer',
          `Erreur envoi email (tentative ${attempt + 1})`,
          {
            error: error.message,
            attempt: attempt + 1,
            maxAttempts: retryAttempts + 1,
          },
        );

        // Attendre avant le retry
        if (attempt < retryAttempts) {
          await new Promise((resolve) =>
            setTimeout(resolve, retryDelay * (attempt + 1)),
          );
        }
      }
    }

    // Log de l'échec final
    const duration = Date.now() - startTime;
    performanceState.siteMetrics.emailPerformance.get('contact')?.push({
      duration,
      success: false,
      attempts: retryAttempts + 1,
      timestamp: Date.now(),
    });

    throw lastError;
  };
}

/**
 * Invalide le cache pour une entité spécifique du site
 * @param {string} entityType - Type d'entité (article, template, application, etc.)
 * @param {string|number} [entityId] - ID spécifique de l'entité (optionnel)
 */
export function invalidateEntityCache(entityType, entityId = null) {
  try {
    // Invalider le cache de l'entité spécifique
    if (performanceState.entityCache[entityType]) {
      if (entityId) {
        performanceState.entityCache[entityType].delete(String(entityId));
      } else {
        performanceState.entityCache[entityType].clear();
      }
    }

    // Invalider les métriques associées
    if (entityId) {
      // Invalider les caches memoizés contenant cet ID
      Object.values(performanceState.siteMetrics).forEach((metricMap) => {
        if (metricMap instanceof Map) {
          for (const [key, value] of metricMap.entries()) {
            if (key.includes(String(entityId))) {
              metricMap.delete(key);
            }
          }
        }
      });
    }

    safeLog('info', 'CacheInvalidation', `Cache invalidé pour ${entityType}`, {
      entityType,
      entityId,
      timestamp: Date.now(),
    });

    // Déclencher un événement personnalisé pour les composants
    if (isBrowser && window.dispatchEvent) {
      try {
        const event = new CustomEvent('siteCacheInvalidated', {
          detail: {
            entityType,
            entityId,
            timestamp: Date.now(),
          },
        });
        window.dispatchEvent(event);
      } catch (e) {
        // Ignorer les erreurs d'événements
      }
    }
  } catch (error) {
    captureException(error, {
      tags: { component: 'cache_invalidation' },
      extra: { entityType, entityId },
    });

    safeLog(
      'error',
      'CacheInvalidation',
      "Erreur lors de l'invalidation du cache",
      {
        error: error.message,
        entityType,
        entityId,
      },
    );
  }
}

/**
 * Obtient les statistiques de performance du site
 * @returns {Object} Statistiques détaillées
 */
export function getSitePerformanceStats() {
  const stats = {
    network: {
      isSlowConnection: performanceState.isSlowConnection,
      networkType: performanceState.networkType,
      dataSaverEnabled: prefersDataSaver(),
    },
    preferences: {
      reducedMotionPreferred: prefersReducedMotion(),
    },
    cache: {
      entityCacheSizes: {},
      totalCacheEntries: 0,
    },
    metrics: {
      pageLoadTimes: {},
      apiCallTimes: {},
      searchPerformance: {},
      componentRenderTimes: {},
      imageLoadTimes: {},
      emailPerformance: {},
    },
    queues: {
      cloudinary: cloudinaryQueue ? cloudinaryQueue.stats : null,
    },
    timestamp: new Date().toISOString(),
  };

  // Calculer les tailles de cache par entité
  Object.entries(performanceState.entityCache).forEach(
    ([entityType, cache]) => {
      stats.cache.entityCacheSizes[entityType] = cache.size;
      stats.cache.totalCacheEntries += cache.size;
    },
  );

  // Agréger les métriques de performance
  Object.entries(performanceState.siteMetrics).forEach(
    ([metricType, metricMap]) => {
      if (metricMap instanceof Map) {
        stats.metrics[metricType] = {};
        metricMap.forEach((value, key) => {
          if (Array.isArray(value)) {
            stats.metrics[metricType][key] = {
              count: value.length,
              average:
                value.reduce((sum, val) => sum + (val.duration || val), 0) /
                value.length,
              latest: value[value.length - 1],
            };
          } else {
            stats.metrics[metricType][key] = value;
          }
        });
      }
    },
  );

  safeLog(
    'info',
    'PerformanceStats',
    'Statistiques de performance du site',
    stats,
  );

  return stats;
}

/**
 * Réinitialise toutes les données de performance du site
 */
export function resetSitePerformanceData() {
  const beforeStats = {
    entityCacheEntries: Object.values(performanceState.entityCache).reduce(
      (sum, cache) => sum + cache.size,
      0,
    ),
    metricsEntries: Object.values(performanceState.siteMetrics).reduce(
      (sum, metric) => sum + (metric instanceof Map ? metric.size : 0),
      0,
    ),
  };

  // Réinitialiser les caches d'entités
  Object.values(performanceState.entityCache).forEach((cache) => cache.clear());

  // Réinitialiser les métriques
  Object.values(performanceState.siteMetrics).forEach((metric) => {
    if (metric instanceof Map) {
      metric.clear();
    }
  });

  // Réinitialiser les états de performance
  performanceState.isSlowConnection = null;
  performanceState.networkType = null;
  performanceState.reducedMotionPreferred = null;
  performanceState.dataSaverEnabled = null;
  performanceState.recentMetrics.clear();
  performanceState.disabledFeatures.clear();

  // Nettoyer les queues
  if (cloudinaryQueue) {
    cloudinaryQueue.clear();
  }

  safeLog(
    'info',
    'PerformanceReset',
    'Réinitialisation des données de performance du site',
    {
      beforeStats,
      timestamp: Date.now(),
    },
  );

  // Déclencher un événement personnalisé
  if (isBrowser && window.dispatchEvent) {
    try {
      const event = new CustomEvent('sitePerformanceReset', {
        detail: {
          beforeStats,
          timestamp: Date.now(),
        },
      });
      window.dispatchEvent(event);
    } catch (e) {
      // Ignorer les erreurs d'événements
    }
  }
}

/**
 * Optimise les opérations CRUD pour les entités du site
 * @param {Object} operations - Opérations CRUD (create, read, update, delete)
 * @param {string} entityType - Type d'entité
 * @returns {Object} - Opérations CRUD optimisées
 */
export function createOptimizedCRUD(operations, entityType) {
  const { create, read, update, delete: deleteOp, list } = operations;

  return {
    // Create optimisé
    create: create
      ? optimizeApiCall(
          async (data) => {
            const result = await create(data);
            // Invalider le cache après création
            invalidateEntityCache(entityType);
            return result;
          },
          {
            entityType,
            cacheTTL: 0, // Pas de cache pour les créations
            retryAttempts: 1,
          },
        )
      : null,

    // Read optimisé avec cache plus long pour site vitrine
    read: read
      ? optimizeApiCall(read, {
          entityType,
          cacheTTL: 600000, // 10 minutes de cache pour site vitrine
          retryAttempts: 2,
        })
      : null,

    // Update optimisé
    update: update
      ? optimizeApiCall(
          async (id, data) => {
            const result = await update(id, data);
            // Invalider le cache spécifique après modification
            invalidateEntityCache(entityType, id);
            return result;
          },
          {
            entityType,
            cacheTTL: 0, // Pas de cache pour les modifications
            retryAttempts: 1,
          },
        )
      : null,

    // Delete optimisé
    delete: deleteOp
      ? optimizeApiCall(
          async (id) => {
            const result = await deleteOp(id);
            // Invalider le cache après suppression
            invalidateEntityCache(entityType, id);
            return result;
          },
          {
            entityType,
            cacheTTL: 0, // Pas de cache pour les suppressions
            retryAttempts: 0, // Pas de retry pour les suppressions
          },
        )
      : null,

    // List optimisé avec recherche
    list: list
      ? optimizeSearch(list, {
          entityType,
          cacheResults: true,
          maxCacheSize: 15,
        })
      : null,

    // Méthodes utilitaires
    invalidateCache: (id = null) => invalidateEntityCache(entityType, id),
    getStats: () => ({
      entityType,
      cacheSize: performanceState.entityCache[entityType]?.size || 0,
      metrics: performanceState.siteMetrics,
    }),
  };
}

/**
 * Adapte l'interface du site selon les performances réseau et préférences
 * @returns {Object} - Configuration d'interface adaptée
 */
export function getAdaptiveSiteConfig() {
  const networkInfo = getNetworkInfo();
  const isSlowConn = isSlowConnection();
  const dataSaver = prefersDataSaver();
  const reducedMotion = prefersReducedMotion();

  const config = {
    // Images et médias
    imageQuality: isSlowConn || dataSaver ? 'low' : 'high',
    lazyLoadImages: true,
    preloadImages: !isSlowConn && !dataSaver,
    imageTransforms: isSlowConn
      ? 'w_400,h_300,c_fill,q_auto:low,f_auto'
      : 'w_800,h_600,c_fill,q_auto,f_auto',

    // Animations Framer Motion
    enableAnimations: !reducedMotion && !isSlowConn,
    animationDuration: reducedMotion ? 0 : isSlowConn ? 150 : 300,
    enableParallax: !reducedMotion && !isSlowConn,
    enableComplexAnimations: !reducedMotion && !isSlowConn && !dataSaver,

    // Chargement de contenu
    pageSize: isSlowConn ? 6 : 12, // Articles/templates par page
    enableInfiniteScroll: !isSlowConn,
    preloadNextPage: !isSlowConn && !dataSaver,

    // Interface utilisateur
    enableTooltips: !isSlowConn,
    enableHoverEffects: !isSlowConn,
    searchDebounce: isSlowConn ? 500 : 350,
    enableAutoComplete: !isSlowConn,

    // Spécifique au site Benew
    enableBlogImageGallery: !isSlowConn,
    enableTemplatePreview: !isSlowConn,
    compactTemplateView: isSlowConn || dataSaver,
    enableEmailValidation: true, // Toujours activé
    enableFormAutoSave: !isSlowConn,

    // Debug info
    networkInfo: {
      type: networkInfo.type,
      effectiveType: networkInfo.effectiveType,
      downlink: networkInfo.downlink,
      isSlowConnection: isSlowConn,
      dataSaver: dataSaver,
      reducedMotion: reducedMotion,
    },
  };

  safeLog('debug', 'AdaptiveSite', 'Configuration site adaptative générée', {
    isSlowConnection: isSlowConn,
    dataSaver: dataSaver,
    reducedMotion: reducedMotion,
    imageQuality: config.imageQuality,
    enableAnimations: config.enableAnimations,
    pageSize: config.pageSize,
  });

  return config;
}

/**
 * Monitore les performances de rendu des composants du site
 * @param {string} componentName - Nom du composant
 * @param {Function} renderFunction - Fonction de rendu à monitorer
 * @returns {Function} - Fonction de rendu monitorée
 */
export function monitorComponentPerformance(componentName, renderFunction) {
  return function monitoredRender(...args) {
    const startTime = performance.now();

    try {
      const result = renderFunction.apply(this, args);

      const renderTime = performance.now() - startTime;

      // Tracker les temps de rendu
      if (
        !performanceState.siteMetrics.componentRenderTimes.has(componentName)
      ) {
        performanceState.siteMetrics.componentRenderTimes.set(
          componentName,
          [],
        );
      }

      const renderTimes =
        performanceState.siteMetrics.componentRenderTimes.get(componentName);
      renderTimes.push(renderTime);

      // Garder seulement les 30 derniers temps de rendu
      if (renderTimes.length > 30) {
        renderTimes.splice(0, renderTimes.length - 30);
      }

      // Log des rendus lents
      if (renderTime > 50) {
        safeLog(
          'warn',
          'ComponentMonitor',
          `Rendu lent détecté pour ${componentName}`,
          {
            renderTime: renderTime.toFixed(2),
            averageTime: (
              renderTimes.reduce((sum, time) => sum + time, 0) /
              renderTimes.length
            ).toFixed(2),
          },
        );
      }

      return result;
    } catch (error) {
      const renderTime = performance.now() - startTime;

      captureException(error, {
        tags: {
          component: 'component_monitor',
          component_name: componentName,
        },
        extra: { renderTime: renderTime.toFixed(2) },
      });

      safeLog(
        'error',
        'ComponentMonitor',
        `Erreur de rendu dans ${componentName}`,
        {
          error: error.message,
          renderTime: renderTime.toFixed(2),
        },
      );

      throw error;
    }
  };
}

/**
 * Optimise les listes d'entités pour l'affichage (templates, articles)
 * @param {Array} items - Liste des éléments à optimiser
 * @param {Object} options - Options d'optimisation
 * @returns {Array} - Liste optimisée
 */
export function optimizeEntityList(items, options = {}) {
  const {
    entityType = 'generic',
    pageSize = 12,
    preloadImages = true,
    sortBy = null,
    filterBy = null,
  } = options;

  if (!Array.isArray(items)) {
    return [];
  }

  let optimizedItems = [...items];

  // Appliquer le filtrage si spécifié
  if (filterBy && typeof filterBy === 'function') {
    optimizedItems = optimizedItems.filter(filterBy);
  }

  // Appliquer le tri si spécifié
  if (sortBy && typeof sortBy === 'function') {
    optimizedItems = optimizedItems.sort(sortBy);
  }

  // Précharger les images si activé et si connexion rapide
  if (preloadImages && !isSlowConnection() && optimizedItems.length > 0) {
    const imagesToPreload = optimizedItems
      .slice(0, pageSize)
      .map((item) => {
        // Extraire les URLs d'images selon le type d'entité
        switch (entityType) {
          case 'article':
            return item.article_image;
          case 'template':
            return item.template_image;
          case 'application':
            return item.application_images?.[0];
          default:
            return item.image || item.thumbnail;
        }
      })
      .filter(Boolean);

    if (imagesToPreload.length > 0) {
      preloadCloudinaryImages(imagesToPreload, {
        priority: 'low',
        batchSize: 3,
        transform: 'w_400,h_300,c_fill,q_auto,f_auto', // Optimisé pour listes
      }).catch((error) => {
        safeLog(
          'warn',
          'EntityListOptimizer',
          `Erreur préchargement images ${entityType}`,
          {
            error: error.message,
            imagesCount: imagesToPreload.length,
          },
        );
      });
    }
  }

  // Log des optimisations appliquées
  if (!isProduction && optimizedItems.length !== items.length) {
    safeLog('debug', 'EntityListOptimizer', `Liste ${entityType} optimisée`, {
      originalCount: items.length,
      optimizedCount: optimizedItems.length,
      pageSize,
      preloadImages: preloadImages && !isSlowConnection(),
    });
  }

  return optimizedItems;
}

/**
 * Initialise les optimisations de performance pour le site
 * @param {Object} config - Configuration d'initialisation
 */
export function initializeSitePerformance(config = {}) {
  const {
    enableNetworkMonitoring = true,
    enableComponentMonitoring = true,
    enableCachePrewarm = true,
    logLevel = 'info',
  } = config;

  safeLog(
    'info',
    'SiteInit',
    'Initialisation des optimisations de performance du site Benew',
    {
      enableNetworkMonitoring,
      enableComponentMonitoring,
      enableCachePrewarm,
      userAgent: isBrowser ? navigator.userAgent : 'Server',
      timestamp: Date.now(),
    },
  );

  // Initialiser la détection réseau
  if (enableNetworkMonitoring && isBrowser) {
    // Détection initiale
    getNetworkInfo();

    // Écouter les changements de connexion
    if ('connection' in navigator) {
      try {
        navigator.connection.addEventListener('change', onNetworkChange);
      } catch (e) {
        safeLog(
          'warn',
          'SiteInit',
          "Impossible d'écouter les changements de connexion",
          { error: e.message },
        );
      }
    }

    // Écouter les changements de préférences
    if (window.matchMedia) {
      try {
        const prefersReducedMotionMQ = window.matchMedia(
          '(prefers-reduced-motion: reduce)',
        );
        prefersReducedMotionMQ.addEventListener('change', () => {
          performanceState.reducedMotionPreferred =
            prefersReducedMotionMQ.matches;
          safeLog(
            'debug',
            'SiteInit',
            'Préférence de mouvement réduit changée',
            {
              reducedMotion: prefersReducedMotionMQ.matches,
            },
          );
        });
      } catch (e) {
        safeLog(
          'warn',
          'SiteInit',
          "Impossible d'écouter les changements de préférences",
          { error: e.message },
        );
      }
    }
  }

  // Préchauffer les caches importants
  if (enableCachePrewarm && isBrowser) {
    setTimeout(() => {
      try {
        // Préchauffer la détection des préférences
        prefersReducedMotion();
        prefersDataSaver();

        safeLog('debug', 'SiteInit', 'Préchauffage des caches terminé');
      } catch (error) {
        captureException(error, {
          tags: { component: 'site_init', action: 'cache_prewarm' },
        });

        safeLog('warn', 'SiteInit', 'Erreur lors du préchauffage des caches', {
          error: error.message,
        });
      }
    }, 1000);
  }

  // Exposer les utilitaires globalement en développement
  if (!isProduction && isBrowser) {
    window.benewPerformance = {
      getStats: getSitePerformanceStats,
      getNetworkInfo,
      getAdaptiveSiteConfig,
      invalidateCache: invalidateEntityCache,
      resetData: resetSitePerformanceData,
      isSlowConnection,
      prefersReducedMotion,
      prefersDataSaver,
    };

    safeLog(
      'debug',
      'SiteInit',
      'Utilitaires de performance exposés sur window.benewPerformance',
    );
  }

  return {
    getStats: getSitePerformanceStats,
    getNetworkInfo,
    getAdaptiveSiteConfig,
    invalidateCache: invalidateEntityCache,
    resetData: resetSitePerformanceData,
    isInitialized: true,
  };
}

// Nettoyage périodique spécifique au site (optionnel)
if (
  typeof setInterval !== 'undefined' &&
  process.env.NODE_ENV !== 'production'
) {
  // Nettoyage des métriques anciennes (toutes les 15 minutes en développement)
  const metricsCleanupInterval = setInterval(
    () => {
      try {
        const now = Date.now();
        const maxAge = 30 * 60 * 1000; // 30 minutes
        let cleaned = 0;

        // Nettoyer les métriques de recherche anciennes
        performanceState.siteMetrics.searchPerformance.forEach(
          (searches, entityType) => {
            const recentSearches = searches.filter(
              (search) => now - search.timestamp < maxAge,
            );
            if (recentSearches.length !== searches.length) {
              performanceState.siteMetrics.searchPerformance.set(
                entityType,
                recentSearches,
              );
              cleaned += searches.length - recentSearches.length;
            }
          },
        );

        // Nettoyer les temps d'appel API anciens
        performanceState.siteMetrics.apiCallTimes.forEach(
          (times, entityType) => {
            if (times.length > 50) {
              const recentTimes = times.slice(-25); // Garder les 25 plus récents
              performanceState.siteMetrics.apiCallTimes.set(
                entityType,
                recentTimes,
              );
              cleaned += times.length - recentTimes.length;
            }
          },
        );

        if (cleaned > 0) {
          safeLog(
            'info',
            'PerformanceCleanup',
            'Nettoyage périodique des métriques du site',
            {
              itemsCleaned: cleaned,
              timestamp: now,
            },
          );
        }
      } catch (error) {
        captureException(error, {
          tags: { component: 'performance_cleanup' },
        });

        safeLog(
          'error',
          'PerformanceCleanup',
          'Erreur lors du nettoyage des métriques',
          {
            error: error.message,
          },
        );
      }
    },
    15 * 60 * 1000, // 15 minutes
  );

  // Éviter de bloquer la fermeture du processus
  if (metricsCleanupInterval.unref) {
    metricsCleanupInterval.unref();
  }

  // Rapports statistiques périodiques (toutes les 45 minutes en développement)
  const statsReportInterval = setInterval(
    () => {
      const stats = getSitePerformanceStats();

      // Envoyer à Sentry en tant qu'information (pas erreur)
      if (isProduction) {
        try {
          captureException(new Error('Site Performance Stats'), {
            level: 'info',
            tags: {
              component: 'site_performance',
              action: 'periodic_stats',
              type: 'performance_monitoring',
            },
            extra: stats,
          });
        } catch (e) {
          // Ignorer les erreurs Sentry
        }
      }
    },
    45 * 60 * 1000, // 45 minutes
  );

  // Éviter de bloquer la fermeture du processus Node.js
  if (statsReportInterval.unref) {
    statsReportInterval.unref();
  }
}

// Exports pour compatibilité
export const memoizeWithTTL = memoize;
export const preloadImage = preloadCloudinaryImage;
export const preloadImages = preloadCloudinaryImages;

// Exports par défaut
export default {
  // Fonctions principales
  memoize,
  debounce,
  throttle,
  preloadCloudinaryImage,
  preloadCloudinaryImages,

  // Détection de préférences
  prefersReducedMotion,
  prefersDataSaver,
  isSlowConnection,
  getNetworkInfo,

  // Optimisations spécifiques au site
  optimizeApiCall,
  optimizeSearch,
  optimizeEmailSending,
  optimizeEntityList,
  createOptimizedCRUD,
  monitorComponentPerformance,
  getAdaptiveSiteConfig,

  // Gestion du cache
  invalidateEntityCache,

  // Statistiques et monitoring
  getSitePerformanceStats,
  resetSitePerformanceData,

  // Initialisation
  initializeSitePerformance,

  // Classes utilitaires
  SiteTaskQueue,

  // Configuration
  DEFAULT_CONFIG,

  // Alias pour compatibilité
  memoizeWithTTL: memoize,
  preloadImage: preloadCloudinaryImage,
  preloadImages: preloadCloudinaryImages,
};
