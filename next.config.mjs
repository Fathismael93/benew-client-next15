import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

// CONFIGURATION MINIMALE POUR FAIRE FONCTIONNER LE BUILD
import withBundleAnalyzer from '@next/bundle-analyzer';
import { withSentryConfig } from '@sentry/nextjs';

//Add commentMore actions
const validateEnv = () => {
  const requiredVars = [
    'NEXT_PUBLIC_SITE_URL',
    'NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME',
    'NEXT_PUBLIC_CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'DB_USER_NAME',
    'DB_HOST_NAME',
    'DB_NAME',
    'DB_PASSWORD',
    'DB_PORT',
    'DB_CA',
    'SENTRY_AUTH_TOKEN',
    'NEXT_PUBLIC_SENTRY_DSN',
    'SENTRY_PROJECT',
    'SENTRY_IGNORE_API_RESOLUTION_ERROR',
    'SENTRY_ORG',
    'SENTRY_URL',
    'SENTRY_RELEASE',
    'SENTRY_DEBUG',
    'ANALYZE',
    'CLIENT_EXISTENCE',
    'CONNECTION_TIMEOUT',
    'MAXIMUM_CLIENTS',
    'NODE_ENV',
    'NEXT_PUBLIC_GA_MEASUREMENT_ID', // ← AJOUTER CETTE LIGNE
    'NEXT_PUBLIC_GTM_CONTAINER_ID',
    'DOPPLER_TOKEN',
  ];

  const missingVars = requiredVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    console.warn(`⚠️ Missing environment variables: ${missingVars.join(', ')}`);
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        `Production build failed: Missing required environment variables: ${missingVars.join(', ')}`,
      );
    }
  }
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

validateEnv();

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
  analyzerMode: 'static', // ✅ Amélioration
  openAnalyzer: false, // ✅ Amélioration
});

const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  // ✅ Configurations manquantes critiques
  reactStrictMode: true,
  compress: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
        pathname: '**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400, // 1 jour
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    loader: 'default',
    unoptimized: false,
  },

  // ===== OPTIMISATION DU COMPILATEUR =====
  compiler: {
    // Suppression des console.log en production (amélioré)
    removeConsole:
      process.env.NODE_ENV === 'production'
        ? {
            exclude: ['error', 'warn', 'log'], // Garde plus de logs pour debugging
          }
        : false,

    // Suppression des props de test en production
    reactRemoveProperties:
      process.env.NODE_ENV === 'production'
        ? {
            properties: ['^data-testid$', '^data-test$', '^data-cy$'],
          }
        : false,

    // Optimisation React en production
    emotion: process.env.NODE_ENV === 'production',
  },

  // Timeout pour la génération de pages statiques
  staticPageGenerationTimeout: 180,

  // Configuration des en-têtes HTTP - AVEC CSP CORRIGÉ POUR NEXT.JS 15
  async headers() {
    // ===== DÉTECTION D'ENVIRONNEMENT =====
    const isDev = process.env.NODE_ENV === 'development';

    // ===== CRÉER TOUS LES OBJETS DE CONFIGURATION =====
    const allHeadersConfigurations = [
      // ===== HEADERS GLOBAUX DE SÉCURITÉ =====
      {
        source: '/(.*)',
        headers: [
          // Protection XSS et injections
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // Politique de référent
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // Isolation cross-origin
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'same-site',
          },
          // Permissions limitées
          {
            key: 'Permissions-Policy',
            value:
              'geolocation=(), microphone=(), camera=(), payment=(), usb=()',
          },
          // HTTPS STRICT ajouté conditionnellement
          ...(process.env.NODE_ENV === 'production'
            ? [
                {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=31536000; includeSubDomains; preload',
                },
              ]
            : []),
          // ✅ CSP GLOBAL CORRIGÉ POUR NEXT.JS 15
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              `script-src 'self' ${isDev ? "'unsafe-eval'" : ''} 'unsafe-inline' https://*.googletagmanager.com https://*.google-analytics.com`,
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' https://res.cloudinary.com https://www.google-analytics.com https://www.googletagmanager.com data:",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://*.doubleclick.net",
              "worker-src 'self' blob:",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
            ].join('; '),
          },
        ],
      },

      // ===== MONITORING SENTRY - TUNNEL =====
      {
        source: '/monitoring',
        headers: [
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; connect-src 'self' https://*.sentry.io;",
          },
        ],
      },

      // ===== SERVER ACTIONS - SÉCURITÉ CRITIQUE =====
      {
        source: '/_next/static/chunks/:path*',
        headers: [
          // Anti-cache strict pour Server Actions
          {
            key: 'Cache-Control',
            value:
              'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
          // Sécurité renforcée
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // ✅ CSP ULTRA-RESTRICTIF CORRIGÉ POUR SERVER ACTIONS
          {
            key: 'Content-Security-Policy',
            value: `default-src 'none'; script-src 'self' ${isDev ? "'unsafe-eval'" : ''}; connect-src 'self'`,
          },
        ],
      },

      // ===== ROUTES SERVER ACTIONS NEXT.JS =====
      {
        source: '/_next/action/:path*',
        headers: [
          // Anti-cache ultra-strict
          {
            key: 'Cache-Control',
            value:
              'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
          // Sécurité maximale pour les actions
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // ✅ CSP SPÉCIFIQUE AUX ACTIONS CORRIGÉ
          {
            key: 'Content-Security-Policy',
            value: `default-src 'none'; script-src 'self' ${isDev ? "'unsafe-eval'" : ''}; connect-src 'self'; form-action 'self'`,
          },
          // Rate limiting hints
          {
            key: 'X-RateLimit-Window',
            value: '60', // 1 minute
          },
          {
            key: 'X-RateLimit-Limit',
            value: '10', // 10 actions par minute
          },
        ],
      },

      // ===== PAGES AVEC FORMULAIRES SPÉCIFIQUES =====
      {
        source: '/contact',
        headers: [
          // Cache page contact
          {
            key: 'Cache-Control',
            value: 'no-cache, must-revalidate',
          },
          // ✅ CSP ADAPTÉ POUR FORMULAIRE DE CONTACT (SANS EMAILJS)
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              `script-src 'self' ${isDev ? "'unsafe-eval'" : ''} 'unsafe-inline'`, // Framer Motion
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data:",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self'", // Server Actions seulement
              "form-action 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },

      // ===== CACHE OPTIMISÉ - ASSETS NEXT.JS =====
      {
        source: '/_next/static/:path*',
        headers: [
          // Cache maximal pour les assets avec hash
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable', // 1 an
          },
          // Sécurité
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'cross-origin', // Permet CDN
          },
          // Performance
          {
            key: 'Vary',
            value: 'Accept-Encoding',
          },
        ],
      },

      // ===== CACHE - IMAGES STATIQUES =====
      {
        source: '/images/:path*',
        headers: [
          // Cache optimisé pour images statiques
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=3600', // 1 jour + SWR 1h
          },
          // Sécurité
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'cross-origin',
          },
          // Performance
          {
            key: 'Vary',
            value: 'Accept, Accept-Encoding',
          },
        ],
      },

      // ===== CACHE - FONTS ET SVG =====
      {
        source: '/:path*\\.(woff|woff2|eot|ttf|otf)$',
        headers: [
          // Cache long pour fonts
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable', // 1 an
          },
          // CORS pour fonts
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'cross-origin',
          },
        ],
      },

      {
        source: '/:path*\\.(svg)$',
        headers: [
          // Cache modéré pour SVG
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=3600', // 1 jour
          },
          // ✅ SÉCURITÉ RENFORCÉE POUR SVG (RISQUE XSS) CORRIGÉE
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Content-Security-Policy',
            value: `default-src 'none'; style-src 'unsafe-inline'; script-src ${isDev ? "'unsafe-eval'" : ''} 'none';`,
          },
        ],
      },

      // ===== CACHE - ASSETS DIVERS =====
      {
        source: '/:path*\\.(css|js|json|xml|txt|ico|manifest)$',
        headers: [
          // Cache modéré pour assets divers
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=3600', // 1 jour
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'same-site',
          },
        ],
      },

      // ===== CACHE - FAVICON ET ICÔNES =====
      {
        source:
          '/:path*(favicon|apple-touch-icon|android-chrome|mstile)\\.(ico|png)$',
        headers: [
          // Cache long pour icônes
          {
            key: 'Cache-Control',
            value: 'public, max-age=2592000, stale-while-revalidate=86400', // 30 jours
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'cross-origin',
          },
        ],
      },

      // ===== BLOG - CACHE INTELLIGENT =====
      {
        source: '/blog/:path*',
        headers: [
          // Cache court pour contenu dynamique
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, stale-while-revalidate=600', // 5min + SWR 10min
          },
          // ✅ CSP POUR CONTENU HTML PARSÉ CORRIGÉ
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              `script-src 'self' ${isDev ? "'unsafe-eval'" : ''} 'unsafe-inline'`,
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' https://res.cloudinary.com data:", // Images d'articles
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },

      // ===== TEMPLATES - CACHE MODÉRÉ (PAGE PROBLÉMATIQUE IDENTIFIÉE) =====
      {
        source: '/templates/:path*',
        headers: [
          // Cache modéré pour pages templates
          {
            key: 'Cache-Control',
            value: 'public, max-age=600, stale-while-revalidate=1200', // 10min + SWR 20min
          },
          // ✅ CSP POUR ORDERMODAL ET SERVER ACTIONS CORRIGÉ (FIX PRINCIPAL)
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              `script-src 'self' ${isDev ? "'unsafe-eval'" : ''} 'unsafe-inline'`, // ⭐ FIX PRINCIPAL : unsafe-eval en dev
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' https://res.cloudinary.com data:",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self'", // Server Actions pour commandes
              "form-action 'self'", // OrderModal
              "frame-ancestors 'none'",
              "worker-src 'self' blob:", // ⭐ AJOUT : Pour les workers potentiels
            ].join('; '),
          },
        ],
      },

      // ===== PAGES SPÉCIFIQUES SUPPLÉMENTAIRES =====
      {
        source: '/presentation/:path*',
        headers: [
          // Cache modéré pour présentation
          {
            key: 'Cache-Control',
            value: 'public, max-age=600, stale-while-revalidate=1200',
          },
          // ✅ CSP POUR PAGES DE PRÉSENTATION
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              `script-src 'self' ${isDev ? "'unsafe-eval'" : ''} 'unsafe-inline'`,
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' https://res.cloudinary.com data:",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },

      // ===== PAGE D'ACCUEIL =====
      {
        source: '/',
        headers: [
          // Cache court pour la homepage (contenu dynamique)
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, stale-while-revalidate=600', // 5min + SWR 10min
          },
          // ✅ CSP POUR PAGE D'ACCUEIL AVEC ANALYTICS
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              `script-src 'self' ${isDev ? "'unsafe-eval'" : ''} 'unsafe-inline' https://*.googletagmanager.com https://*.google-analytics.com`,
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' https://res.cloudinary.com https://www.google-analytics.com https://www.googletagmanager.com data:",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com",
              "worker-src 'self' blob:",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];

    // ===== FILTRER LES CONFIGURATIONS AVEC HEADERS VIDES =====
    const validConfigurations = allHeadersConfigurations.filter(
      (config) => config.headers && config.headers.length > 0,
    );

    // ===== LOGGING POUR DEBUG (OPTIONNEL) =====
    if (isDev) {
      const filteredCount =
        allHeadersConfigurations.length - validConfigurations.length;
      if (filteredCount > 0) {
        console.log(
          `🔧 Headers: ${filteredCount} configuration(s) with empty headers filtered out`,
        );
      }
      console.log(
        `✅ Headers: ${validConfigurations.length} valid configurations loaded`,
      );
      console.log(
        `🛡️ CSP: unsafe-eval ${isDev ? 'ENABLED' : 'DISABLED'} (dev: ${isDev})`,
      );
    }

    return validConfigurations;
  },

  // Configuration du runtime côté serveur
  serverRuntimeConfig: {
    PROJECT_ROOT: __dirname,
  },

  // Configuration publique (accessible côté client)
  publicRuntimeConfig: {
    SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    CLOUDINARY_CLOUD_NAME: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
    GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
  },

  // ===== REDIRECTIONS SEO =====
  async redirects() {
    return [
      // ===== CANONICALISATION DES URLS =====
      {
        source: '/home',
        destination: '/',
        permanent: true, // 301
      },
      {
        source: '/index',
        destination: '/',
        permanent: true,
      },
      {
        source: '/blog/',
        destination: '/blog',
        permanent: true,
      },
      {
        source: '/templates/',
        destination: '/templates',
        permanent: true,
      },
      {
        source: '/contact/',
        destination: '/contact',
        permanent: true,
      },
      {
        source: '/presentation/',
        destination: '/presentation',
        permanent: true,
      },

      // ===== URLS AVEC VARIANTES COURANTES =====
      {
        source: '/template/:id',
        destination: '/templates/:id',
        permanent: true,
      },
      {
        source: '/article/:id',
        destination: '/blog/:id',
        permanent: true,
      },
      {
        source: '/post/:id',
        destination: '/blog/:id',
        permanent: true,
      },

      // ===== NETTOYAGE DES PARAMETRES UTM =====
      {
        source: '/blog/:path*',
        has: [
          {
            type: 'query',
            key: 'utm_source',
          },
        ],
        destination: '/blog/:path*',
        permanent: false, // 302 pour préserver analytics
      },
      {
        source: '/templates/:path*',
        has: [
          {
            type: 'query',
            key: 'utm_source',
          },
        ],
        destination: '/templates/:path*',
        permanent: false,
      },

      // ===== REDIRECTIONS BUSINESS LOGIQUES =====
      {
        source: '/commande',
        destination: '/templates',
        permanent: true,
      },
      {
        source: '/order',
        destination: '/templates',
        permanent: true,
      },
      {
        source: '/boutique',
        destination: '/templates',
        permanent: true,
      },
      {
        source: '/apps',
        destination: '/templates',
        permanent: true,
      },
      {
        source: '/applications',
        destination: '/templates',
        permanent: true,
      },

      // ===== GESTION DES ERREURS COURANTES =====
      {
        source: '/templates/:id/app/:appId',
        destination: '/templates/:id/applications/:appId',
        permanent: true,
      },
      {
        source: '/template/:id/applications/:appId',
        destination: '/templates/:id/applications/:appId',
        permanent: true,
      },
    ];
  },

  // Configuration Webpack optimisée
  webpack: (config, { dev, isServer, buildId }) => {
    // Optimisations webpack pour la production
    if (!dev) {
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
        runtimeChunk: 'single',
        splitChunks: {
          chunks: 'all',
          minSize: 20000,
          maxSize: 244000,
          minChunks: 1,
          maxAsyncRequests: 30,
          maxInitialRequests: 30,
          automaticNameDelimiter: '~',
          cacheGroups: {
            framework: {
              chunks: 'all',
              name: 'framework',
              test: /(?<!node_modules.*)[\\/]node_modules[\\/](react|react-dom|scheduler|prop-types|use-subscription)[\\/]/,
              priority: 40,
              enforce: true,
            },
            lib: {
              test(module) {
                return (
                  module.size() > 160000 &&
                  /node_modules[/\\]/.test(module.identifier())
                );
              },
              name(module) {
                const hash = createHash('sha1');
                hash.update(module.identifier());
                return hash.digest('hex').substring(0, 8);
              },
              priority: 30,
              minChunks: 1,
              reuseExistingChunk: true,
            },
            commons: {
              name: 'commons',
              minChunks: 2,
              priority: 20,
            },
            shared: {
              name(module, chunks) {
                return `shared-${chunks.map((c) => c.name).join('~')}.${buildId}`;
              },
              priority: 10,
              minChunks: 2,
              reuseExistingChunk: true,
            },
          },
        },
      };

      // Configuration du cache pour de meilleures performances de build
      config.cache = {
        type: 'filesystem',
        buildDependencies: {
          config: [__dirname],
        },
        cacheDirectory: path.resolve(__dirname, '.next/cache/webpack'),
      };

      // Réduire les logs en production
      config.infrastructureLogging = {
        level: 'error',
      };

      // Optimisations supplémentaires pour la production
      config.optimization.usedExports = true;
      config.optimization.sideEffects = false;
    }

    // Alias pour améliorer les performances de résolution
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname),
    };

    // Optimisation pour les bibliothèques externes
    if (isServer) {
      config.externals = [...config.externals, 'pg-native'];
    }

    return config;
  },

  eslint: {
    ignoreDuringBuilds: false,
  },

  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,

  // Optimisation des logs
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === 'development',
    },
  },
};

// Configuration Sentry optimisée
const sentryWebpackPluginOptions = {
  org: process.env.SENTRY_ORG || 'benew',
  project: process.env.SENTRY_PROJECT || 'benew-client',
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Optimisations pour la production
  silent: process.env.NODE_ENV === 'production',
  widenClientFileUpload: true,
  // transpileClientSDK: true,
  tunnelRoute: '/monitoring',

  // Configuration pour les builds
  dryRun:
    process.env.NODE_ENV !== 'production' || !process.env.SENTRY_AUTH_TOKEN,
  debug: process.env.NODE_ENV === 'development',

  // Optimisation des uploads
  include: '.next',
  ignore: ['node_modules', '*.map'],

  // Configuration des releases
  release: process.env.SENTRY_RELEASE || '1.0.0',
  deploy: {
    env: process.env.NODE_ENV,
  },
  reactComponentAnnotation: {
    enabled: process.env.NODE_ENV === 'production',
  },
  // Optimisation v9
  disableLogger: process.env.NODE_ENV === 'production',
};

// Appliquer les configurations dans l'ordre : bundleAnalyzer puis Sentry
export default withSentryConfig(
  bundleAnalyzer(nextConfig),
  sentryWebpackPluginOptions,
);
