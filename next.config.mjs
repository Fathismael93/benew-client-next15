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
    'USER_NAME',
    'HOST_NAME',
    'DB_NAME',
    'DB_PASSWORD',
    'PORT_NUMBER',
    'DB_CA',
    'SENTRY_AUTH_TOKEN',
    'NEXT_PUBLIC_SENTRY_DSN',
    'SENTRY_PROJECT',
    'SENTRY_IGNORE_API_RESOLUTION_ERROR',
    'SENTRY_ORG',
    'SENTRY_URL',
    'SENTRY_RELEASE',
    'ANALYZE',
    'CLIENT_EXISTENCE',
    'CONNECTION_TIMEOUT',
    'MAXIMUM_CLIENTS',
    'NODE_ENV',
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
});

const nextConfig = {
  poweredByHeader: false,

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
  },

  // Fonctionnalités expérimentales pour les performances
  experimental: {
    optimizePackageImports: [
      'react-icons',
      'next-cloudinary',
      'yup',
      'html-react-parser',
    ],
    gzipSize: true,
  },

  // Configuration du compilateur pour la production
  compiler: {
    removeConsole:
      process.env.NODE_ENV === 'production'
        ? {
            exclude: ['log', 'error', 'warn'],
          }
        : false,
    reactRemoveProperties:
      process.env.NODE_ENV === 'production'
        ? {
            properties: ['^data-testid$'],
          }
        : false,
  },

  // Timeout pour la génération de pages statiques
  staticPageGenerationTimeout: 180,

  // Configuration des en-têtes HTTP - Phase 1
  async headers() {
    return [
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
          // CSP global adapté à ton stack
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'", // Framer Motion + React
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", // SCSS + Google Fonts
              "img-src 'self' https://res.cloudinary.com data:", // Cloudinary + data URLs
              "font-src 'self' https://fonts.gstatic.com", // Google Fonts
              "connect-src 'self'", // Server Actions uniquement
              "form-action 'self'", // Formulaires sécurisés
              "frame-ancestors 'none'", // Pas d'iframes
              "base-uri 'self'",
            ].join('; '),
          },
        ],
      },

      // ===== HTTPS STRICT (si en production) =====
      {
        source: '/(.*)',
        headers: [
          ...(process.env.NODE_ENV === 'production'
            ? [
                {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=31536000; includeSubDomains; preload',
                },
              ]
            : []),
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
          // CSP ultra-restrictif pour les actions
          {
            key: 'Content-Security-Policy',
            value: "default-src 'none'; script-src 'self'; connect-src 'self'",
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
          // CSP spécifique aux actions
          {
            key: 'Content-Security-Policy',
            value: "default-src 'none'; connect-src 'self'; form-action 'self'",
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
          // CSP adapté pour formulaire (sans EmailJS)
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'", // Framer Motion
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
          // Sécurité renforcée pour SVG (risque XSS)
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'none'; style-src 'unsafe-inline'; script-src 'none';",
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
          // CSP pour contenu HTML parsé
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' https://res.cloudinary.com data:", // Images d'articles
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },

      // ===== TEMPLATES - CACHE MODÉRÉ =====
      {
        source: '/templates/:path*',
        headers: [
          // Cache modéré pour pages templates
          {
            key: 'Cache-Control',
            value: 'public, max-age=600, stale-while-revalidate=1200', // 10min + SWR 20min
          },
          // CSP pour OrderModal et Server Actions
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'", // Framer Motion dans modals
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' https://res.cloudinary.com data:",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self'", // Server Actions pour commandes
              "form-action 'self'", // OrderModal
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
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

  // ===== OPTIMISATIONS WEBPACK AVANCÉES =====
  webpack: (config, { dev, isServer, buildId }) => {
    // ===== OPTIMISATIONS POUR LA PRODUCTION =====
    if (!dev) {
      // Configuration du cache filesystem améliorée
      config.cache = {
        type: 'filesystem',
        buildDependencies: {
          config: [__dirname],
        },
        cacheDirectory: path.resolve(__dirname, '.next/cache/webpack'),
        // Nouvelle: compression du cache
        compression: 'gzip',
        // Nouvelle: versioning du cache
        version: buildId,
      };

      // Split chunks optimisé pour ton projet
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
            // Framework React optimisé
            framework: {
              chunks: 'all',
              name: 'framework',
              test: /(?<!node_modules.*)[\\/]node_modules[\\/](react|react-dom|scheduler|prop-types|use-subscription)[\\/]/,
              priority: 40,
              enforce: true,
            },

            // Framer Motion séparé (gros package)
            framerMotion: {
              name: 'framer-motion',
              test: /[\\/]node_modules[\\/]framer-motion[\\/]/,
              chunks: 'all',
              priority: 35,
              enforce: true,
            },

            // React Icons optimisé
            reactIcons: {
              name: 'react-icons',
              test: /[\\/]node_modules[\\/]react-icons[\\/]/,
              chunks: 'all',
              priority: 34,
              enforce: true,
            },

            // Next Cloudinary
            cloudinary: {
              name: 'cloudinary',
              test: /[\\/]node_modules[\\/]next-cloudinary[\\/]/,
              chunks: 'all',
              priority: 33,
              enforce: true,
            },

            // SASS et CSS
            styles: {
              name: 'styles',
              test: /\.(css|scss|sass)$/,
              chunks: 'all',
              priority: 32,
              enforce: true,
            },

            // Librairies volumineuses
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
                return `lib-${hash.digest('hex').substring(0, 8)}`;
              },
              priority: 30,
              minChunks: 1,
              reuseExistingChunk: true,
            },

            // Vendor commun
            vendor: {
              name: 'vendor',
              test: /[\\/]node_modules[\\/]/,
              chunks: 'all',
              priority: 20,
              minChunks: 2,
              reuseExistingChunk: true,
            },

            // Code partagé de ton app
            common: {
              name: 'common',
              minChunks: 2,
              priority: 10,
              chunks: 'all',
              reuseExistingChunk: true,
            },

            // Pages spécifiques lourdes
            blogPages: {
              name: 'blog-pages',
              test: /[\\/](blog|article)[\\/]/,
              chunks: 'all',
              priority: 15,
              minChunks: 1,
            },

            templatesPages: {
              name: 'templates-pages',
              test: /[\\/]templates[\\/]/,
              chunks: 'all',
              priority: 15,
              minChunks: 1,
            },
          },
        },

        // Tree shaking amélioré
        usedExports: true,
        sideEffects: false,

        // Optimisation des modules
        providedExports: true,

        // Minimizer optimisé
        minimize: true,
        minimizer: [
          // Garde les minimizers par défaut de Next.js
          '...',
        ],
      };

      // Logging réduit en production
      config.infrastructureLogging = {
        level: 'error',
      };

      // Stats optimisés
      config.stats = {
        cached: false,
        cachedAssets: false,
        chunks: false,
        chunkModules: false,
        colors: true,
        hash: false,
        modules: false,
        reasons: false,
        timings: true,
        version: false,
      };
    }

    // ===== ALIAS POUR PERFORMANCE =====
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname),
      '@components': path.resolve(__dirname, 'components'),
      '@utils': path.resolve(__dirname, 'utils'),
      '@actions': path.resolve(__dirname, 'actions'),
      '@app': path.resolve(__dirname, 'app'),
    };

    // ===== OPTIMISATIONS POUR LES IMAGES =====
    config.module.rules.push({
      test: /\.(png|jpe?g|gif|svg|webp|avif)$/i,
      use: [
        {
          loader: 'file-loader',
          options: {
            publicPath: '/_next/static/images/',
            outputPath: 'static/images/',
            name: '[name].[hash].[ext]',
          },
        },
      ],
    });

    // ===== OPTIMISATIONS POUR SASS =====
    config.module.rules.push({
      test: /\.scss$/,
      use: [
        'style-loader',
        {
          loader: 'css-loader',
          options: {
            modules: {
              localIdentName: dev
                ? '[local]__[hash:base64:5]'
                : '[hash:base64:8]',
            },
          },
        },
        {
          loader: 'sass-loader',
          options: {
            sassOptions: {
              includePaths: [path.resolve(__dirname, 'app')],
              // Optimisation SASS
              outputStyle: dev ? 'expanded' : 'compressed',
            },
          },
        },
      ],
    });

    // ===== OPTIMISATIONS SERVER =====
    if (isServer) {
      // Externalize database drivers
      config.externals = [...config.externals, 'pg-native'];

      // Optimisation pour Server Actions
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    // ===== PLUGIN POUR BUNDLE ANALYSIS =====
    if (process.env.ANALYZE === 'true') {
      config.plugins.push(
        new (require('webpack-bundle-analyzer').BundleAnalyzerPlugin)({
          analyzerMode: 'static',
          openAnalyzer: false,
          generateStatsFile: true,
          statsOptions: {
            source: false,
          },
        }),
      );
    }

    // ===== OPTIMISATION DES PERFORMANCES =====
    if (!dev) {
      // Préchargement des modules critiques
      config.plugins.push({
        apply: (compiler) => {
          compiler.hooks.compilation.tap(
            'PreloadCriticalChunks',
            (compilation) => {
              compilation.hooks.htmlWebpackPluginBeforeHtmlGeneration.tapAsync(
                'PreloadCriticalChunks',
                (data, cb) => {
                  // Précharge les chunks critiques
                  const criticalChunks = ['framework', 'main', 'commons'];
                  criticalChunks.forEach((chunk) => {
                    if (compilation.chunks.find((c) => c.name === chunk)) {
                      data.assets.js.unshift(
                        `/_next/static/chunks/${chunk}.js`,
                      );
                    }
                  });
                  cb(null, data);
                },
              );
            },
          );
        },
      });
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
  hideSourceMaps: process.env.NODE_ENV === 'production',
  widenClientFileUpload: true,
  transpileClientSDK: true,
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
};

// Appliquer les configurations dans l'ordre : bundleAnalyzer puis Sentry
export default withSentryConfig(
  bundleAnalyzer(nextConfig),
  sentryWebpackPluginOptions,
);
