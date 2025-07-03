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

  // Configuration des en-têtes HTTP
  async headers() {
    return [];
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
