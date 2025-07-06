/**
 * Système de cache avancé optimisé pour Next.js 15, PostgreSQL et Cloudinary
 * Intègre les dernières bonnes pratiques 2025 et améliorations identifiées
 *
 * Features:
 * - Support Next.js 15 (cache opt-in par défaut)
 * - Compression moderne (CompressionStream + lz-string fallback)
 * - Métriques Core Web Vitals
 * - Support Edge Runtime
 * - Invalidation intelligente pour Server Actions
 * - Monitoring temps réel avec Sentry
 * - Cache PostgreSQL optimisé
 * - Gestion Cloudinary avancée
 */

import { captureException } from 'instrumentation';
import { LRUCache } from 'lru-cache';
import { compress, decompress } from 'lz-string';

// =============================
// CONFIGURATION DE CACHE 2025
// =============================

export const CACHE_CONFIGS = {
  // === DONNÉES CRITIQUES (TTL COURT) ===

  // Server Actions (Next.js 15 - pas de cache par défaut)
  serverActions: {
    maxAge: 0, // Pas de cache pour les Server Actions
    staleWhileRevalidate: 0,
    mustRevalidate: true,
    noStore: true, // Forcer no-store
    private: true,
  },

  // Commandes (données financières sensibles)
  orders: {
    maxAge: 30, // 30 secondes seulement
    staleWhileRevalidate: 15,
    mustRevalidate: true,
    private: true,
    sMaxAge: 0, // Pas de cache CDN
  },

  // Sessions utilisateur
  userSessions: {
    maxAge: 2 * 60, // 2 minutes
    staleWhileRevalidate: 30,
    mustRevalidate: true,
    private: true,
    sMaxAge: 0,
  },

  // === DONNÉES MODÉRÉMENT SENSIBLES ===

  // Templates (changent peu souvent)
  templates: {
    maxAge: 10 * 60, // 10 minutes
    staleWhileRevalidate: 5 * 60,
    sMaxAge: 30 * 60, // 30 min CDN
    revalidateOnFocus: true,
  },

  // Template spécifique
  singleTemplate: {
    maxAge: 15 * 60, // 15 minutes
    staleWhileRevalidate: 10 * 60,
    sMaxAge: 1 * 60 * 60, // 1h CDN
  },

  // Applications
  applications: {
    maxAge: 15 * 60, // 15 minutes
    staleWhileRevalidate: 5 * 60,
    sMaxAge: 30 * 60,
    revalidateOnFocus: true,
  },

  // Application spécifique
  singleApplication: {
    maxAge: 20 * 60, // 20 minutes
    staleWhileRevalidate: 10 * 60,
    sMaxAge: 2 * 60 * 60, // 2h CDN
  },

  // Plateformes de paiement
  platforms: {
    maxAge: 5 * 60, // 5 minutes (données sensibles)
    staleWhileRevalidate: 2 * 60,
    mustRevalidate: true,
    sMaxAge: 10 * 60,
  },

  // === CONTENU BLOG (MODÉRÉMENT STABLE) ===

  // Liste des articles
  blogArticles: {
    maxAge: 5 * 60, // 5 minutes
    staleWhileRevalidate: 2 * 60,
    sMaxAge: 15 * 60, // 15 min CDN
    revalidateOnFocus: true,
  },

  // Article spécifique
  singleBlogArticle: {
    maxAge: 30 * 60, // 30 minutes
    staleWhileRevalidate: 15 * 60,
    sMaxAge: 2 * 60 * 60, // 2h CDN
  },

  // === DONNÉES CLOUDINARY ===

  // Métadonnées images
  cloudinaryImages: {
    maxAge: 1 * 60 * 60, // 1 heure
    staleWhileRevalidate: 30 * 60,
    sMaxAge: 24 * 60 * 60, // 24h CDN
    immutable: false, // Peuvent changer
  },

  // Signatures upload Cloudinary
  cloudinarySignatures: {
    maxAge: 5 * 60, // 5 minutes (sécurité)
    staleWhileRevalidate: 0,
    mustRevalidate: true,
    private: true,
    sMaxAge: 0,
  },

  // === DONNÉES STATIQUES ===

  // Assets statiques
  staticAssets: {
    maxAge: 7 * 24 * 60 * 60, // 1 semaine
    sMaxAge: 30 * 24 * 60 * 60, // 30 jours CDN
    immutable: true,
  },

  // Pages statiques
  staticPages: {
    maxAge: 15 * 60, // 15 minutes
    staleWhileRevalidate: 10 * 60,
    sMaxAge: 1 * 60 * 60, // 1h CDN
  },

  // === CONFIGURATION EDGE RUNTIME ===

  edge: {
    maxSize: 50, // Limite pour Edge
    maxBytes: 5 * 1024 * 1024, // 5MB
    compress: false, // Éviter compression intensive
    ttl: 5 * 60, // 5 minutes max
  },
};

// =============================
// COMPRESSION MODERNE 2025
// =============================

/**
 * Système de compression hybride utilisant les APIs natives modernes
 * avec fallback vers lz-string pour compatibilité
 */
class ModernCompression {
  static async compress(value) {
    const serialized = JSON.stringify(value);
    const size = serialized.length;

    // Seuil de compression adapté (4KB)
    if (size < 4000) {
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
        console.warn(
          'Native compression failed, fallback to lz-string:',
          error,
        );
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
      console.error('All compression methods failed:', error);
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
      console.error('Decompression failed:', error);
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
// SYSTÈME D'ÉVÉNEMENTS AVANCÉ
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

      if (listeners.has(event)) {
        listeners.get(event).forEach((callback) => {
          try {
            callback(data);
          } catch (error) {
            metrics.errors++;
            console.error(`Cache event error [${event}]:`, error);

            // Report to Sentry in production
            if (
              process.env.NODE_ENV === 'production' &&
              typeof captureException === 'function'
            ) {
              captureException(error, {
                tags: { component: 'cache_events', event },
                extra: { data },
              });
            }
          }
        });
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
// CLASSE CACHE AVANCÉE 2025
// =============================

export class AdvancedMemoryCache {
  constructor(options = {}) {
    const opts = typeof options === 'number' ? { ttl: options } : options;

    this.config = {
      ttl: opts.ttl || 5 * 60 * 1000, // 5 minutes par défaut
      maxSize: opts.maxSize || 500,
      maxBytes: opts.maxBytes || 100 * 1024 * 1024, // 100MB
      compress: opts.compress !== false, // Activé par défaut
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

    // Métriques avancées
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      compressionSavings: 0,
      totalSize: 0,
      // Core Web Vitals impact
      coreWebVitals: {
        lcp: 0, // Largest Contentful Paint impact
        fid: 0, // First Input Delay impact
        cls: 0, // Cumulative Layout Shift impact (cache doesn't affect this)
      },
    };

    // Initialiser LRU Cache avec options optimisées
    this.cache = new LRUCache({
      max: this.config.maxSize,
      ttl: this.config.ttl,
      maxSize: this.config.maxBytes,
      sizeCalculation: (value) => value?.data?.size || 0,
      allowStale: false,
      updateAgeOnGet: true,
      updateAgeOnHas: false,
      // Nouveau: fetchMethod pour async operations
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

    // Système de verrouillage pour éviter conditions de course
    this.locks = new Map();

    // Démarrer monitoring
    this._startAdvancedMonitoring();
  }

  // =============================
  // MÉTHODES PRINCIPALES
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

      // Vérification taille
      if (compressed.size > this.config.maxBytes * 0.1) {
        // 10% max
        console.warn(
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
  // MÉTRIQUES ET MONITORING
  // =============================

  getStats() {
    const hitRate = this._calculateHitRate();

    return {
      // Métriques de base
      entries: this.cache.size,
      bytes: this.metrics.totalSize,
      maxEntries: this.config.maxSize,
      maxBytes: this.config.maxBytes,
      hitRate,

      // Métriques avancées
      operations: {
        hits: this.metrics.hits,
        misses: this.metrics.misses,
        sets: this.metrics.sets,
        deletes: this.metrics.deletes,
        errors: this.metrics.errors,
      },

      // Performance
      efficiency: this._calculateEfficiency(hitRate),
      compressionSavings: this.metrics.compressionSavings,
      utilization: this.metrics.totalSize / this.config.maxBytes,

      // Core Web Vitals impact
      coreWebVitals: { ...this.metrics.coreWebVitals },

      // Métadonnées
      name: this.config.name,
      entityType: this.config.entityType,
      edgeCompatible: this.config.edgeCompatible,
      timestamp: new Date().toISOString(),
    };
  }

  getCoreWebVitalsImpact() {
    return {
      lcp: this.metrics.coreWebVitals.lcp, // Impact sur LCP
      fid: this.metrics.coreWebVitals.fid, // Impact sur FID
      cls: 0, // Cache n'affecte pas CLS
      hitRate: this._calculateHitRate(),
    };
  }

  // =============================
  // MÉTHODES PRIVÉES
  // =============================

  _detectEntityType(value) {
    if (!value || typeof value !== 'object') return 'primitive';

    // Détection basée sur les propriétés du projet
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
    // Impact sur LCP (Largest Contentful Paint)
    if (operation === 'hit' && duration < 100) {
      this.metrics.coreWebVitals.lcp += 0.1; // Amélioration
    } else if (operation === 'miss') {
      this.metrics.coreWebVitals.lcp -= 0.05; // Dégradation
    }

    // Impact sur FID (First Input Delay)
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
    console.error(
      `Cache error [${this.config.name}] during ${operation} for key '${key}':`,
      error,
    );

    // Sentry reporting en production
    if (
      process.env.NODE_ENV === 'production' &&
      typeof captureException === 'function'
    ) {
      captureException(error, {
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
    }

    cacheEvents.emit('cache_error', {
      error,
      operation,
      key,
      cache: this,
      entityType: this.config.entityType,
    });
  }

  _startAdvancedMonitoring() {
    // Monitoring périodique (toutes les 5 minutes)
    if (typeof setInterval !== 'undefined') {
      const interval = setInterval(
        () => {
          const stats = this.getStats();

          // Log stats en développement
          if (process.env.NODE_ENV !== 'production' && stats.entries > 0) {
            console.log(`[Cache ${this.config.name}] Stats:`, {
              entries: stats.entries,
              hitRate: `${(stats.hitRate * 100).toFixed(1)}%`,
              efficiency: stats.efficiency,
              compressionSavings: `${(stats.compressionSavings / 1024).toFixed(1)}KB`,
            });
          }

          // Émettre métriques pour monitoring externe
          cacheEvents.emit('cache_metrics', {
            cache: this,
            stats,
            timestamp: Date.now(),
          });
        },
        5 * 60 * 1000,
      );

      interval.unref?.(); // Éviter de bloquer le process
    }
  }
}

// =============================
// UTILITAIRES NEXT.JS 15
// =============================

/**
 * Génère les headers de cache optimisés pour Next.js 15
 */
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

  // Headers CDN spécifiques
  if (config.sMaxAge && !config.private) {
    headers['CDN-Cache-Control'] = `s-maxage=${config.sMaxAge}`;
    headers['Vercel-CDN-Cache-Control'] = `s-maxage=${config.sMaxAge}`;
  }

  return headers;
}

/**
 * Génère une clé de cache canonique pour le projet
 */
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
  // === DONNÉES CRITIQUES ===

  orders: new AdvancedMemoryCache({
    ttl: CACHE_CONFIGS.orders.maxAge * 1000,
    maxSize: 100, // Limité pour données sensibles
    compress: true,
    name: 'orders',
    entityType: 'order',
  }),

  serverActions: new AdvancedMemoryCache({
    ttl: 0, // Pas de cache
    maxSize: 0,
    name: 'server-actions',
    entityType: 'server_action',
  }),

  // === CONTENU ===

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

  // === BLOG ===

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

  // === CLOUDINARY ===

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

  // === SESSIONS ET USERS ===

  userSessions: new AdvancedMemoryCache({
    ttl: CACHE_CONFIGS.userSessions.maxAge * 1000,
    maxSize: 200,
    compress: false,
    name: 'user-sessions',
    entityType: 'user_session',
  }),

  // === EDGE CACHE (pour deployment edge) ===

  edge: new AdvancedMemoryCache({
    ...CACHE_CONFIGS.edge,
    ttl: CACHE_CONFIGS.edge.ttl * 1000,
    name: 'edge-cache',
    entityType: 'edge',
    edgeCompatible: true,
  }),
};

// =============================
// FONCTIONS D'INVALIDATION
// =============================

/**
 * Invalide intelligemment le cache selon le type d'entité
 */
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

  console.log(
    `Cache invalidated: ${invalidatedCount} entries for ${entityType}${entityId ? ` (ID: ${entityId})` : ''}`,
  );

  cacheEvents.emit('project_cache_invalidation', {
    entityType,
    entityId,
    invalidatedCount,
    timestamp: Date.now(),
  });

  return invalidatedCount;
}

/**
 * Middleware pour Server Actions avec invalidation automatique
 */
export function withCacheInvalidation(entityType, action) {
  return async function (...args) {
    try {
      const result = await Promise.resolve(action.apply(this, args));

      // Invalider après succès
      if (result?.success !== false) {
        invalidateProjectCache(entityType);
      }

      return result;
    } catch (error) {
      console.error(`Server Action error for ${entityType}:`, error);
      throw error;
    }
  };
}

/**
 * Obtient les statistiques globales du cache
 */
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

    // Core Web Vitals
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

/**
 * Nettoyage de tous les caches
 */
export function cleanupProjectCaches() {
  let totalCleaned = 0;

  Object.entries(projectCache).forEach(([cacheName, cache]) => {
    const sizeBefore = cache.getStats().entries;
    cache.clear();
    const sizeAfter = cache.getStats().entries;
    const cleaned = sizeBefore - sizeAfter;
    totalCleaned += cleaned;

    if (cleaned > 0) {
      console.log(`Cache [${cacheName}]: Cleaned ${cleaned} entries`);
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

/**
 * Hook pour opérations CRUD avec cache automatique
 */
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
// NETTOYAGE ET MONITORING
// =============================

// Monitoring global
if (typeof setInterval !== 'undefined') {
  setInterval(
    () => {
      const globalStats = getProjectCacheStats();

      // Log en développement
      if (process.env.NODE_ENV !== 'production') {
        console.log('📊 Global Cache Stats:', {
          totalEntries: globalStats.totals.entries,
          hitRate: `${(globalStats.totals.hitRate * 100).toFixed(1)}%`,
          efficiency: globalStats.totals.efficiency,
          compressionSavings: `${(globalStats.totals.compressionSavings / 1024).toFixed(1)}KB`,
        });
      }

      // Émettre pour monitoring externe
      cacheEvents.emit('global_cache_stats', globalStats);
    },
    10 * 60 * 1000,
  ); // Toutes les 10 minutes
}

// Nettoyage gracieux à l'arrêt
if (typeof process !== 'undefined' && process.on) {
  const cleanup = () => {
    console.log('🧹 Cleaning up caches...');
    cleanupProjectCaches();
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
