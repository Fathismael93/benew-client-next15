/**
 * Système de cache avancé optimisé pour Next.js 15, PostgreSQL et Cloudinary - OPTIMISÉ
 * Version optimisée avec logging conditionnel et performance améliorée
 *
 * Features:
 * - Support Next.js 15 (cache opt-in par défaut)
 * - Compression moderne (CompressionStream + lz-string fallback)
 * - Métriques Core Web Vitals
 * - Support Edge Runtime
 * - Invalidation intelligente pour Server Actions
 * - Monitoring optimisé avec Sentry
 * - Cache PostgreSQL optimisé
 * - Gestion Cloudinary avancée
 */

import { captureException } from 'instrumentation';
import { LRUCache } from 'lru-cache';
import { compress, decompress } from 'lz-string';

// =============================================
// CONFIGURATION ADAPTATIVE
// =============================================

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

const CONFIG = {
  logging: {
    enabled: isDevelopment || process.env.BENEW_CACHE_LOGS === 'true',
    verboseAllowed: isDevelopment,
    onlyErrors: isProduction,
  },
  monitoring: {
    cacheStatsInterval: isProduction ? 30 * 60 * 1000 : 10 * 60 * 1000, // 30min prod, 10min dev
    globalStatsInterval: isProduction ? 30 * 60 * 1000 : 10 * 60 * 1000, // 30min prod, 10min dev
    enableDetailedEvents: isDevelopment,
  },
  compression: {
    threshold: 4000, // 4KB seuil de compression
    aggressive: isProduction, // Compression plus agressive en prod
  },
  sentry: {
    enabled: typeof captureException === 'function',
    onlyWarningsAndErrors: isProduction,
  },
};

/**
 * Fonction de logging conditionnelle optimisée
 */
function logConditional(level, message, data = {}) {
  if (!CONFIG.logging.enabled) return;

  // En production, seulement warn et error
  if (CONFIG.logging.onlyErrors && !['warn', 'error'].includes(level)) return;

  if (level === 'info' && CONFIG.logging.verboseAllowed) {
    console.log(`[Cache] ${message}`, data);
  } else if (level === 'warn') {
    console.warn(`[Cache] ${message}`, data);
  } else if (level === 'error') {
    console.error(`[Cache] ${message}`, data);
  }
}

/**
 * Fonction Sentry conditionnelle optimisée
 */
function reportToSentry(error, context = {}) {
  if (!CONFIG.sentry.enabled) return;

  // En production, seulement les erreurs importantes
  if (CONFIG.sentry.onlyWarningsAndErrors && context.level === 'info') return;

  captureException(error, {
    tags: { component: 'advanced_cache', ...context.tags },
    extra: context.extra,
  });
}

// =============================
// CONFIGURATION DE CACHE 2025
// =============================

export const CACHE_CONFIGS = {
  // === DONNÉES CRITIQUES (TTL COURT) ===
  serverActions: {
    maxAge: 0,
    staleWhileRevalidate: 0,
    mustRevalidate: true,
    noStore: true,
    private: true,
  },
  orders: {
    maxAge: 30,
    staleWhileRevalidate: 15,
    mustRevalidate: true,
    private: true,
    sMaxAge: 0,
  },
  userSessions: {
    maxAge: 2 * 60,
    staleWhileRevalidate: 30,
    mustRevalidate: true,
    private: true,
    sMaxAge: 0,
  },

  // === DONNÉES MODÉRÉMENT SENSIBLES ===
  templates: {
    maxAge: 10 * 60,
    staleWhileRevalidate: 5 * 60,
    sMaxAge: 30 * 60,
    revalidateOnFocus: true,
  },
  singleTemplate: {
    maxAge: 15 * 60,
    staleWhileRevalidate: 10 * 60,
    sMaxAge: 1 * 60 * 60,
  },
  applications: {
    maxAge: 15 * 60,
    staleWhileRevalidate: 5 * 60,
    sMaxAge: 30 * 60,
    revalidateOnFocus: true,
  },
  singleApplication: {
    maxAge: 20 * 60,
    staleWhileRevalidate: 10 * 60,
    sMaxAge: 2 * 60 * 60,
  },
  platforms: {
    maxAge: 5 * 60,
    staleWhileRevalidate: 2 * 60,
    mustRevalidate: true,
    sMaxAge: 10 * 60,
  },

  // === CONTENU BLOG ===
  blogArticles: {
    maxAge: 5 * 60,
    staleWhileRevalidate: 2 * 60,
    sMaxAge: 15 * 60,
    revalidateOnFocus: true,
  },
  singleBlogArticle: {
    maxAge: 30 * 60,
    staleWhileRevalidate: 15 * 60,
    sMaxAge: 2 * 60 * 60,
  },

  // === DONNÉES CLOUDINARY ===
  cloudinaryImages: {
    maxAge: 1 * 60 * 60,
    staleWhileRevalidate: 30 * 60,
    sMaxAge: 24 * 60 * 60,
    immutable: false,
  },
  cloudinarySignatures: {
    maxAge: 5 * 60,
    staleWhileRevalidate: 0,
    mustRevalidate: true,
    private: true,
    sMaxAge: 0,
  },

  // === DONNÉES STATIQUES ===
  staticAssets: {
    maxAge: 7 * 24 * 60 * 60,
    sMaxAge: 30 * 24 * 60 * 60,
    immutable: true,
  },
  staticPages: {
    maxAge: 15 * 60,
    staleWhileRevalidate: 10 * 60,
    sMaxAge: 1 * 60 * 60,
  },

  // === CONFIGURATION EDGE RUNTIME ===
  edge: {
    maxSize: 50,
    maxBytes: 5 * 1024 * 1024,
    compress: false,
    ttl: 5 * 60,
  },
};

// =============================
// COMPRESSION MODERNE OPTIMISÉE
// =============================

class ModernCompression {
  static async compress(value) {
    const serialized = JSON.stringify(value);
    const size = serialized.length;

    // Seuil de compression adaptatif
    const threshold = CONFIG.compression.aggressive
      ? 2000
      : CONFIG.compression.threshold;
    if (size < threshold) {
      return {
        value: serialized,
        size,
        compressed: false,
        method: 'none',
      };
    }

    // Essayer CompressionStream (API native 2025)
    if (typeof CompressionStream !== 'undefined') {
      try {
        const compressed = await this._compressWithNativeAPI(serialized);
        return {
          value: compressed,
          originalSize: size,
          size: compressed.length,
          compressed: true,
          method: 'native',
        };
      } catch (error) {
        if (CONFIG.logging.verboseAllowed) {
          logConditional(
            'warn',
            'Native compression failed, fallback to lz-string:',
            { error: error.message },
          );
        }
      }
    }

    // Fallback vers lz-string
    try {
      const compressed = compress(serialized);
      return {
        value: compressed,
        originalSize: size,
        size: compressed.length,
        compressed: true,
        method: 'lz-string',
      };
    } catch (error) {
      logConditional('error', 'All compression methods failed:', {
        error: error.message,
      });
      return {
        value: serialized,
        size,
        compressed: false,
        method: 'none',
        error: error.message,
      };
    }
  }

  static async decompress(storedData) {
    if (!storedData || !storedData.compressed) {
      return JSON.parse(storedData?.value || storedData);
    }

    try {
      let decompressed;

      if (storedData.method === 'native') {
        decompressed = await this._decompressWithNativeAPI(storedData.value);
      } else {
        decompressed = decompress(storedData.value);
      }

      return JSON.parse(decompressed);
    } catch (error) {
      logConditional('error', 'Decompression failed:', {
        error: error.message,
      });
      throw new Error(`Failed to decompress cache value: ${error.message}`);
    }
  }

  static async _compressWithNativeAPI(data) {
    const stream = new CompressionStream('gzip');
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();

    writer.write(new TextEncoder().encode(data));
    writer.close();

    const chunks = [];
    let done = false;
    while (!done) {
      const { value, done: streamDone } = await reader.read();
      if (value) chunks.push(value);
      done = streamDone;
    }

    return new TextDecoder().decode(new Uint8Array(chunks.flat()));
  }

  static async _decompressWithNativeAPI(data) {
    const stream = new DecompressionStream('gzip');
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();

    writer.write(new TextEncoder().encode(data));
    writer.close();

    const chunks = [];
    let done = false;
    while (!done) {
      const { value, done: streamDone } = await reader.read();
      if (value) chunks.push(value);
      done = streamDone;
    }

    return new TextDecoder().decode(new Uint8Array(chunks.flat()));
  }
}

// =============================
// SYSTÈME D'ÉVÉNEMENTS OPTIMISÉ
// =============================

export const cacheEvents = (() => {
  const listeners = new Map();
  const metrics = {
    events: 0,
    errors: 0,
    performance: new Map(),
  };

  return {
    on(event, callback) {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event).add(callback);
      return this;
    },

    emit(event, data) {
      const start = performance.now();
      metrics.events++;

      // Émettre seulement les événements importants en production
      if (
        CONFIG.monitoring.enableDetailedEvents ||
        [
          'cache_error',
          'cache_invalidate_pattern',
          'project_cache_invalidation',
        ].includes(event)
      ) {
        if (listeners.has(event)) {
          listeners.get(event).forEach((callback) => {
            try {
              callback(data);
            } catch (error) {
              metrics.errors++;
              logConditional('error', `Cache event error [${event}]:`, {
                error: error.message,
              });

              reportToSentry(error, {
                tags: { component: 'cache_events', event },
                extra: { data },
              });
            }
          });
        }
      }

      const duration = performance.now() - start;
      metrics.performance.set(event, duration);
      return this;
    },

    off(event, callback) {
      if (listeners.has(event)) {
        if (callback) {
          listeners.get(event).delete(callback);
        } else {
          listeners.delete(event);
        }
      }
      return this;
    },

    once(event, callback) {
      const onceCallback = (data) => {
        this.off(event, onceCallback);
        callback(data);
      };
      return this.on(event, onceCallback);
    },

    getMetrics() {
      return {
        ...metrics,
        performance: Object.fromEntries(metrics.performance),
      };
    },
  };
})();

// =============================
// CLASSE CACHE AVANCÉE OPTIMISÉE
// =============================

export class AdvancedMemoryCache {
  constructor(options = {}) {
    const opts = typeof options === 'number' ? { ttl: options } : options;

    this.config = {
      ttl: opts.ttl || 5 * 60 * 1000,
      maxSize: opts.maxSize || 500,
      maxBytes: opts.maxBytes || 100 * 1024 * 1024,
      compress: opts.compress !== false,
      name: opts.name || 'advanced-cache',
      entityType: opts.entityType || 'generic',
      edgeCompatible: opts.edgeCompatible || false,
    };

    // Adapter pour Edge Runtime
    if (this.config.edgeCompatible) {
      this.config.maxSize = Math.min(
        this.config.maxSize,
        CACHE_CONFIGS.edge.maxSize,
      );
      this.config.maxBytes = Math.min(
        this.config.maxBytes,
        CACHE_CONFIGS.edge.maxBytes,
      );
      this.config.compress = CACHE_CONFIGS.edge.compress;
    }

    // Métriques optimisées
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      compressionSavings: 0,
      totalSize: 0,
      coreWebVitals: {
        lcp: 0,
        fid: 0,
        cls: 0,
      },
    };

    // Initialiser LRU Cache
    this.cache = new LRUCache({
      max: this.config.maxSize,
      ttl: this.config.ttl,
      maxSize: this.config.maxBytes,
      sizeCalculation: (value) => value?.data?.size || 0,
      allowStale: false,
      updateAgeOnGet: true,
      updateAgeOnHas: false,
      fetchMethod: opts.fetchMethod,
      noDeleteOnFetchRejection: true,
      ignoreFetchAbort: true,
      disposeAfter: (value, key) => {
        if (value?.data?.size) {
          this.metrics.totalSize -= value.data.size;
        }
        cacheEvents.emit('cache_dispose', {
          key,
          entityType: value?.data?.entityType || this.config.entityType,
          cache: this,
        });
      },
    });

    this.locks = new Map();
    this._startOptimizedMonitoring();
  }

  // =============================
  // MÉTHODES PRINCIPALES OPTIMISÉES
  // =============================

  async get(key) {
    const start = performance.now();

    try {
      const entry = this.cache.get(key);

      if (!entry) {
        this.metrics.misses++;
        this._updateCoreWebVitals('miss', performance.now() - start);

        cacheEvents.emit('cache_miss', {
          key,
          entityType: this.config.entityType,
          cache: this,
          duration: performance.now() - start,
        });

        return null;
      }

      this.metrics.hits++;
      const value = await ModernCompression.decompress(entry.data);

      this._updateCoreWebVitals('hit', performance.now() - start);

      cacheEvents.emit('cache_hit', {
        key,
        entityType: entry.data?.entityType || this.config.entityType,
        cache: this,
        duration: performance.now() - start,
        compressed: entry.data?.compressed,
      });

      return value;
    } catch (error) {
      this.metrics.errors++;
      this._logError('get', key, error);
      return null;
    }
  }

  async set(key, value, options = {}) {
    const start = performance.now();

    try {
      if (!key || typeof key !== 'string') {
        throw new Error('Invalid cache key');
      }

      const opts = typeof options === 'number' ? { ttl: options } : options;
      const ttl = opts.ttl || this.config.ttl;

      // Compression moderne
      const compressed = await ModernCompression.compress(value);

      // Vérification taille avec log conditionnel
      if (compressed.size > this.config.maxBytes * 0.1) {
        logConditional(
          'warn',
          `Cache entry too large: ${key} (${compressed.size} bytes)`,
        );
        return false;
      }

      // Calculer économies de compression
      if (compressed.compressed) {
        this.metrics.compressionSavings +=
          compressed.originalSize - compressed.size;
      }

      // Métadonnées enrichies
      const entry = {
        data: {
          ...compressed,
          entityType: this._detectEntityType(value),
          timestamp: Date.now(),
          ttl,
        },
        metadata: {
          cacheInstance: this.config.name,
          edgeCompatible: this.config.edgeCompatible,
          version: '2025.1',
        },
      };

      // Mettre en cache
      this.cache.set(key, entry, { ttl });
      this.metrics.sets++;
      this.metrics.totalSize += compressed.size;

      this._updateCoreWebVitals('set', performance.now() - start);

      cacheEvents.emit('cache_set', {
        key,
        size: compressed.size,
        entityType: entry.data.entityType,
        compressed: compressed.compressed,
        compressionMethod: compressed.method,
        cache: this,
        duration: performance.now() - start,
      });

      return true;
    } catch (error) {
      this.metrics.errors++;
      this._logError('set', key, error);
      return false;
    }
  }

  async getOrSet(key, fetchFn, options = {}) {
    // Vérifier verrouillage
    if (this.locks.has(key)) {
      await this.locks.get(key);
    }

    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }

    // Créer verrou
    let resolver;
    const lock = new Promise((resolve) => {
      resolver = resolve;
    });
    this.locks.set(key, lock);

    try {
      const result = await Promise.resolve(fetchFn());
      await this.set(key, result, options);
      return result;
    } finally {
      this.locks.delete(key);
      resolver();
    }
  }

  delete(key) {
    try {
      const existed = this.cache.has(key);
      this.cache.delete(key);
      if (existed) this.metrics.deletes++;
      return existed;
    } catch (error) {
      this.metrics.errors++;
      this._logError('delete', key, error);
      return false;
    }
  }

  clear() {
    try {
      this.cache.clear();
      this.metrics.totalSize = 0;
      cacheEvents.emit('cache_clear', { cache: this });
      return true;
    } catch (error) {
      this.metrics.errors++;
      this._logError('clear', 'all', error);
      return false;
    }
  }

  // =============================
  // INVALIDATION INTELLIGENTE
  // =============================

  invalidatePattern(pattern) {
    try {
      const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);
      const keysToDelete = [];

      for (const key of this.cache.keys()) {
        if (regex.test(key)) {
          keysToDelete.push(key);
        }
      }

      keysToDelete.forEach((key) => this.delete(key));

      cacheEvents.emit('cache_invalidate_pattern', {
        pattern: pattern.toString(),
        count: keysToDelete.length,
        cache: this,
      });

      return keysToDelete.length;
    } catch (error) {
      this._logError('invalidatePattern', pattern.toString(), error);
      return 0;
    }
  }

  invalidateByEntity(entityType) {
    let count = 0;
    try {
      for (const [key, entry] of this.cache.entries()) {
        if (
          entry?.data?.entityType === entityType ||
          key.includes(entityType)
        ) {
          this.delete(key);
          count++;
        }
      }

      cacheEvents.emit('cache_invalidate_entity', {
        entityType,
        count,
        cache: this,
      });

      return count;
    } catch (error) {
      this._logError('invalidateByEntity', entityType, error);
      return 0;
    }
  }

  // =============================
  // MÉTRIQUES ET MONITORING OPTIMISÉS
  // =============================

  getStats() {
    const hitRate = this._calculateHitRate();

    return {
      entries: this.cache.size,
      bytes: this.metrics.totalSize,
      maxEntries: this.config.maxSize,
      maxBytes: this.config.maxBytes,
      hitRate,
      operations: {
        hits: this.metrics.hits,
        misses: this.metrics.misses,
        sets: this.metrics.sets,
        deletes: this.metrics.deletes,
        errors: this.metrics.errors,
      },
      efficiency: this._calculateEfficiency(hitRate),
      compressionSavings: this.metrics.compressionSavings,
      utilization: this.metrics.totalSize / this.config.maxBytes,
      coreWebVitals: { ...this.metrics.coreWebVitals },
      name: this.config.name,
      entityType: this.config.entityType,
      edgeCompatible: this.config.edgeCompatible,
      timestamp: new Date().toISOString(),
    };
  }

  getCoreWebVitalsImpact() {
    return {
      lcp: this.metrics.coreWebVitals.lcp,
      fid: this.metrics.coreWebVitals.fid,
      cls: 0,
      hitRate: this._calculateHitRate(),
    };
  }

  // =============================
  // MÉTHODES PRIVÉES OPTIMISÉES
  // =============================

  _detectEntityType(value) {
    if (!value || typeof value !== 'object') return 'primitive';

    if (value.article_id || value.article_title) return 'blog_article';
    if (value.template_id || value.template_name) return 'template';
    if (value.application_id || value.application_name) return 'application';
    if (value.order_id || value.order_payment_status) return 'order';
    if (value.platform_id || value.platform_name) return 'platform';
    if (value.cloudinary || value.public_id) return 'cloudinary_asset';

    if (Array.isArray(value)) {
      if (value.length > 0) return this._detectEntityType(value[0]) + '_list';
      return 'empty_list';
    }

    return 'generic';
  }

  _updateCoreWebVitals(operation, duration) {
    if (operation === 'hit' && duration < 100) {
      this.metrics.coreWebVitals.lcp += 0.1;
    } else if (operation === 'miss') {
      this.metrics.coreWebVitals.lcp -= 0.05;
    }

    if (duration < 50) {
      this.metrics.coreWebVitals.fid += 0.1;
    } else if (duration > 200) {
      this.metrics.coreWebVitals.fid -= 0.1;
    }
  }

  _calculateHitRate() {
    const total = this.metrics.hits + this.metrics.misses;
    return total > 0 ? this.metrics.hits / total : 0;
  }

  _calculateEfficiency(hitRate) {
    if (hitRate > 0.8) return 'excellent';
    if (hitRate > 0.6) return 'good';
    if (hitRate > 0.4) return 'average';
    return 'poor';
  }

  _logError(operation, key, error) {
    logConditional(
      'error',
      `Cache error [${this.config.name}] during ${operation} for key '${key}':`,
      {
        error: error.message,
      },
    );

    reportToSentry(error, {
      tags: {
        component: 'advanced_cache',
        operation,
        cache: this.config.name,
      },
      extra: {
        key,
        entityType: this.config.entityType,
        stats: this.getStats(),
      },
    });

    cacheEvents.emit('cache_error', {
      error,
      operation,
      key,
      cache: this,
      entityType: this.config.entityType,
    });
  }

  _startOptimizedMonitoring() {
    // Monitoring adaptatif selon l'environnement
    if (typeof setInterval !== 'undefined') {
      const interval = setInterval(() => {
        const stats = this.getStats();

        // Log stats seulement en développement ou si problèmes détectés
        if (CONFIG.logging.verboseAllowed && stats.entries > 0) {
          logConditional('info', `Cache [${this.config.name}] Stats:`, {
            entries: stats.entries,
            hitRate: `${(stats.hitRate * 100).toFixed(1)}%`,
            efficiency: stats.efficiency,
            compressionSavings: `${(stats.compressionSavings / 1024).toFixed(1)}KB`,
          });
        }

        // Alertes pour problèmes de performance
        if (
          stats.efficiency === 'poor' &&
          stats.operations.hits + stats.operations.misses > 10
        ) {
          logConditional(
            'warn',
            `Cache [${this.config.name}] poor efficiency detected:`,
            {
              hitRate: `${(stats.hitRate * 100).toFixed(1)}%`,
              operations: stats.operations.hits + stats.operations.misses,
            },
          );
        }

        // Émettre métriques pour monitoring externe
        cacheEvents.emit('cache_metrics', {
          cache: this,
          stats,
          timestamp: Date.now(),
        });
      }, CONFIG.monitoring.cacheStatsInterval);

      interval.unref?.();
    }
  }
}

// =============================
// UTILITAIRES NEXT.JS 15
// =============================

export function getNextJS15CacheHeaders(resourceType) {
  const config = CACHE_CONFIGS[resourceType] || CACHE_CONFIGS.staticPages;

  if (config.noStore) {
    return {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'CDN-Cache-Control': 'no-store',
      'Vercel-CDN-Cache-Control': 'no-store',
    };
  }

  let cacheControl = `max-age=${config.maxAge}`;

  if (config.staleWhileRevalidate) {
    cacheControl += `, stale-while-revalidate=${config.staleWhileRevalidate}`;
  }

  if (config.private) {
    cacheControl += ', private';
  } else {
    cacheControl += ', public';
  }

  if (config.mustRevalidate) {
    cacheControl += ', must-revalidate';
  }

  if (config.immutable) {
    cacheControl += ', immutable';
  }

  const headers = {
    'Cache-Control': cacheControl,
    'Next-Cache-Tags': resourceType,
  };

  if (config.sMaxAge && !config.private) {
    headers['CDN-Cache-Control'] = `s-maxage=${config.sMaxAge}`;
    headers['Vercel-CDN-Cache-Control'] = `s-maxage=${config.sMaxAge}`;
  }

  return headers;
}

export function generateCacheKey(prefix, params = {}) {
  const cleanParams = {};

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;

    const cleanKey = String(key).replace(/[^a-zA-Z0-9_-]/g, '');
    let cleanValue;

    if (typeof value === 'object') {
      cleanValue = JSON.stringify(value);
    } else {
      cleanValue = String(value);
    }

    if (cleanValue.length > 100) {
      cleanValue = cleanValue.substring(0, 97) + '...';
    }

    cleanParams[cleanKey] = encodeURIComponent(cleanValue);
  }

  const sortedParams = Object.keys(cleanParams)
    .sort()
    .map((key) => `${key}=${cleanParams[key]}`)
    .join('&');

  const safePrefix = String(prefix).replace(/[^a-zA-Z0-9_-]/g, '');

  return `benew:${safePrefix}:${sortedParams || 'default'}`;
}

// =============================
// INSTANCES DE CACHE PROJET
// =============================

export const projectCache = {
  orders: new AdvancedMemoryCache({
    ttl: CACHE_CONFIGS.orders.maxAge * 1000,
    maxSize: 100,
    compress: true,
    name: 'orders',
    entityType: 'order',
  }),

  serverActions: new AdvancedMemoryCache({
    ttl: 0,
    maxSize: 0,
    name: 'server-actions',
    entityType: 'server_action',
  }),

  templates: new AdvancedMemoryCache({
    ttl: CACHE_CONFIGS.templates.maxAge * 1000,
    maxSize: 200,
    compress: true,
    name: 'templates',
    entityType: 'template',
  }),

  singleTemplate: new AdvancedMemoryCache({
    ttl: CACHE_CONFIGS.singleTemplate.maxAge * 1000,
    maxSize: 300,
    compress: true,
    name: 'single-template',
    entityType: 'single_template',
  }),

  applications: new AdvancedMemoryCache({
    ttl: CACHE_CONFIGS.applications.maxAge * 1000,
    maxSize: 300,
    compress: true,
    name: 'applications',
    entityType: 'application',
  }),

  singleApplication: new AdvancedMemoryCache({
    ttl: CACHE_CONFIGS.singleApplication.maxAge * 1000,
    maxSize: 400,
    compress: true,
    name: 'single-application',
    entityType: 'single_application',
  }),

  platforms: new AdvancedMemoryCache({
    ttl: CACHE_CONFIGS.platforms.maxAge * 1000,
    maxSize: 50,
    compress: false,
    name: 'platforms',
    entityType: 'platform',
  }),

  blogArticles: new AdvancedMemoryCache({
    ttl: CACHE_CONFIGS.blogArticles.maxAge * 1000,
    maxSize: 200,
    compress: true,
    name: 'blog-articles',
    entityType: 'blog_article',
  }),

  singleBlogArticle: new AdvancedMemoryCache({
    ttl: CACHE_CONFIGS.singleBlogArticle.maxAge * 1000,
    maxSize: 300,
    compress: true,
    name: 'single-blog-article',
    entityType: 'single_blog_article',
  }),

  cloudinaryImages: new AdvancedMemoryCache({
    ttl: CACHE_CONFIGS.cloudinaryImages.maxAge * 1000,
    maxSize: 1000,
    compress: false,
    name: 'cloudinary-images',
    entityType: 'cloudinary_image',
  }),

  cloudinarySignatures: new AdvancedMemoryCache({
    ttl: CACHE_CONFIGS.cloudinarySignatures.maxAge * 1000,
    maxSize: 100,
    compress: false,
    name: 'cloudinary-signatures',
    entityType: 'cloudinary_signature',
  }),

  userSessions: new AdvancedMemoryCache({
    ttl: CACHE_CONFIGS.userSessions.maxAge * 1000,
    maxSize: 200,
    compress: false,
    name: 'user-sessions',
    entityType: 'user_session',
  }),

  edge: new AdvancedMemoryCache({
    ...CACHE_CONFIGS.edge,
    ttl: CACHE_CONFIGS.edge.ttl * 1000,
    name: 'edge-cache',
    entityType: 'edge',
    edgeCompatible: true,
  }),
};

// =============================
// FONCTIONS D'INVALIDATION OPTIMISÉES
// =============================

export function invalidateProjectCache(entityType, entityId = null) {
  let invalidatedCount = 0;

  const entityCacheMap = {
    order: ['orders'],
    template: ['templates', 'singleTemplate'],
    application: ['applications', 'singleApplication'],
    blog: ['blogArticles', 'singleBlogArticle'],
    article: ['blogArticles', 'singleBlogArticle'],
    platform: ['platforms'],
    cloudinary: ['cloudinaryImages', 'cloudinarySignatures'],
    user: ['userSessions'],
  };

  const cachesToInvalidate = entityCacheMap[entityType] || [];

  cachesToInvalidate.forEach((cacheName) => {
    const cache = projectCache[cacheName];
    if (cache) {
      if (entityId) {
        const pattern = new RegExp(`${entityType}.*${entityId}`);
        invalidatedCount += cache.invalidatePattern(pattern);
      } else {
        invalidatedCount += cache.invalidateByEntity(entityType);
      }
    }
  });

  if (invalidatedCount > 0 || CONFIG.logging.verboseAllowed) {
    logConditional(
      'info',
      `Cache invalidated: ${invalidatedCount} entries for ${entityType}${entityId ? ` (ID: ${entityId})` : ''}`,
    );
  }

  cacheEvents.emit('project_cache_invalidation', {
    entityType,
    entityId,
    invalidatedCount,
    timestamp: Date.now(),
  });

  return invalidatedCount;
}

export function withCacheInvalidation(entityType, action) {
  return async function (...args) {
    try {
      const result = await Promise.resolve(action.apply(this, args));

      if (result?.success !== false) {
        invalidateProjectCache(entityType);
      }

      return result;
    } catch (error) {
      logConditional('error', `Server Action error for ${entityType}:`, {
        error: error.message,
      });
      throw error;
    }
  };
}

export function getProjectCacheStats() {
  const stats = {
    timestamp: new Date().toISOString(),
    caches: {},
    totals: {
      entries: 0,
      bytes: 0,
      hits: 0,
      misses: 0,
      compressionSavings: 0,
      hitRate: 0,
      efficiency: 'unknown',
    },
    coreWebVitals: {
      lcp: 0,
      fid: 0,
      cls: 0,
    },
  };

  let totalHits = 0;
  let totalRequests = 0;

  Object.entries(projectCache).forEach(([cacheName, cache]) => {
    const cacheStats = cache.getStats();
    stats.caches[cacheName] = cacheStats;

    stats.totals.entries += cacheStats.entries;
    stats.totals.bytes += cacheStats.bytes;
    stats.totals.hits += cacheStats.operations.hits;
    stats.totals.misses += cacheStats.operations.misses;
    stats.totals.compressionSavings += cacheStats.compressionSavings;

    stats.coreWebVitals.lcp += cacheStats.coreWebVitals.lcp;
    stats.coreWebVitals.fid += cacheStats.coreWebVitals.fid;

    totalHits += cacheStats.operations.hits;
    totalRequests += cacheStats.operations.hits + cacheStats.operations.misses;
  });

  stats.totals.hitRate = totalRequests > 0 ? totalHits / totalRequests : 0;
  stats.totals.efficiency =
    stats.totals.hitRate > 0.8
      ? 'excellent'
      : stats.totals.hitRate > 0.6
        ? 'good'
        : stats.totals.hitRate > 0.4
          ? 'average'
          : 'poor';

  return stats;
}

export function cleanupProjectCaches() {
  let totalCleaned = 0;

  Object.entries(projectCache).forEach(([cacheName, cache]) => {
    const sizeBefore = cache.getStats().entries;
    cache.clear();
    const sizeAfter = cache.getStats().entries;
    const cleaned = sizeBefore - sizeAfter;
    totalCleaned += cleaned;

    if (cleaned > 0 && CONFIG.logging.verboseAllowed) {
      logConditional(
        'info',
        `Cache [${cacheName}]: Cleaned ${cleaned} entries`,
      );
    }
  });

  cacheEvents.emit('project_cache_cleanup', {
    totalCleaned,
    timestamp: Date.now(),
  });

  return totalCleaned;
}

// =============================
// HOOKS ET UTILITAIRES
// =============================

export function useCacheOperations(entityType) {
  return {
    async create(data) {
      return withCacheInvalidation(entityType, async () => {
        throw new Error('Create operation must be implemented');
      })(data);
    },

    async read(id, fetchFn) {
      const cache = projectCache[entityType] || projectCache.edge;
      const key = generateCacheKey(`${entityType}_read`, { id });

      return await cache.getOrSet(key, fetchFn, {
        ttl: CACHE_CONFIGS[entityType]?.maxAge * 1000 || 5 * 60 * 1000,
      });
    },

    async update(id, data) {
      return withCacheInvalidation(entityType, async () => {
        throw new Error('Update operation must be implemented');
      })(id, data);
    },

    async delete(id) {
      return withCacheInvalidation(entityType, async () => {
        throw new Error('Delete operation must be implemented');
      })(id);
    },

    invalidate: (id = null) => invalidateProjectCache(entityType, id),
  };
}

// =============================
// NETTOYAGE ET MONITORING OPTIMISÉS
// =============================

// Monitoring global adaptatif
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const globalStats = getProjectCacheStats();

    // Log en développement ou si efficacité dégradée
    if (
      CONFIG.logging.verboseAllowed ||
      globalStats.totals.efficiency === 'poor'
    ) {
      const logLevel =
        globalStats.totals.efficiency === 'poor' ? 'warn' : 'info';
      logConditional(logLevel, '📊 Global Cache Stats:', {
        totalEntries: globalStats.totals.entries,
        hitRate: `${(globalStats.totals.hitRate * 100).toFixed(1)}%`,
        efficiency: globalStats.totals.efficiency,
        compressionSavings: `${(globalStats.totals.compressionSavings / 1024).toFixed(1)}KB`,
      });
    }

    // Alertes pour problèmes critiques
    if (
      globalStats.totals.efficiency === 'poor' &&
      globalStats.totals.entries > 50
    ) {
      logConditional('warn', 'Cache efficiency degraded globally:', {
        hitRate: `${(globalStats.totals.hitRate * 100).toFixed(1)}%`,
        totalEntries: globalStats.totals.entries,
      });
    }

    cacheEvents.emit('global_cache_stats', globalStats);
  }, CONFIG.monitoring.globalStatsInterval);
}

// Nettoyage gracieux optimisé
if (typeof process !== 'undefined' && process.on) {
  const cleanup = () => {
    logConditional('info', '🧹 Cleaning up caches...');
    const cleaned = cleanupProjectCaches();
    if (cleaned > 0) {
      logConditional('info', `🧹 Cleaned ${cleaned} cache entries`);
    }
  };

  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);
}

// =============================
// EXPORTS
// =============================

export default {
  CACHE_CONFIGS,
  ModernCompression,
  AdvancedMemoryCache,
  projectCache,
  cacheEvents,
  getNextJS15CacheHeaders,
  generateCacheKey,
  invalidateProjectCache,
  withCacheInvalidation,
  getProjectCacheStats,
  cleanupProjectCaches,
  useCacheOperations,
};
