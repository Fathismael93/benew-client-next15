'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import {
  initializeAnalytics,
  debugGA,
  testTracking,
  trackPagePerformance,
  trackError,
} from '@/utils/analytics';

/**
 * Composant pour initialiser Google Analytics automatiquement
 * @param {boolean} isDevelopment - Mode développement
 */
export default function AnalyticsInitializer({ isDevelopment = false }) {
  const pathname = usePathname();

  // Initialisation une seule fois
  useEffect(() => {
    const initGA = () => {
      try {
        // Configuration selon l'environnement
        const analyticsConfig = {
          requireConsent: true, // RGPD activé
          enhancedMeasurements: true,
          debug: isDevelopment,

          // Configuration du consentement par défaut
          consentSettings: {
            analytics_storage: 'denied', // Par défaut refusé (RGPD)
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
            functionality_storage: 'granted',
            wait_for_update: 500,
            region: ['FR', 'DJ', 'EU'], // France, Djibouti, Europe
          },

          // Configuration des mesures enrichies
          enhancedConfig: {
            scrolls: true,
            clicks: true,
            views: true,
            downloads: true,
            video_engagement: true,
            file_downloads: true,
            page_changes: true,
            // Configuration pour ton site
            anonymize_ip: true,
            cookie_flags: 'SameSite=None;Secure',
          },

          // Propriétés utilisateur par défaut
          userProperties: {
            site_version: '2.0',
            user_type: 'visitor',
            site_language: 'fr',
            site_country: 'DJ', // Djibouti
          },
        };

        // Initialiser Analytics
        initializeAnalytics(analyticsConfig);

        // Debug en développement
        if (isDevelopment) {
          setTimeout(() => {
            debugGA();
            console.log('[Analytics] Initialized for development');
          }, 1000);
        }
      } catch (error) {
        console.error('[Analytics] Initialization error:', error);

        // Tracker l'erreur d'initialisation
        trackError(
          `Analytics initialization failed: ${error.message}`,
          pathname,
          'fatal',
        );
      }
    };

    // Initialiser après hydration
    if (typeof window !== 'undefined') {
      if (document.readyState === 'complete') {
        initGA();
      } else {
        window.addEventListener('load', initGA);
        return () => window.removeEventListener('load', initGA);
      }
    }
  }, []); // Une seule fois au montage

  // Tracking des changements de page (App Router)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.gtag) {
      const startTime = performance.now();

      // Tracker la vue de page avec performance
      setTimeout(() => {
        const loadTime = performance.now() - startTime;
        trackPagePerformance(pathname, loadTime, false);

        if (isDevelopment) {
          console.log(
            `[Analytics] Page tracked: ${pathname} (${loadTime.toFixed(2)}ms)`,
          );
        }
      }, 100);
    }
  }, [pathname, isDevelopment]);

  // Web Vitals reporting
  useEffect(() => {
    if (typeof window !== 'undefined' && 'web-vitals' in window) {
      import('web-vitals')
        .then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
          const reportWebVitals = (metric) => {
            if (window.gtag) {
              window.gtag('event', metric.name, {
                event_category: 'Web Vitals',
                value: Math.round(
                  metric.name === 'CLS' ? metric.value * 1000 : metric.value,
                ),
                event_label: metric.id,
                non_interaction: true,
              });
            }

            if (isDevelopment) {
              console.log(`[Web Vitals] ${metric.name}:`, metric);
            }
          };

          getCLS(reportWebVitals);
          getFID(reportWebVitals);
          getFCP(reportWebVitals);
          getLCP(reportWebVitals);
          getTTFB(reportWebVitals);
        })
        .catch((error) => {
          console.warn('[Analytics] Web Vitals not available:', error);
        });
    }
  }, [isDevelopment]);

  // Test du tracking en développement
  useEffect(() => {
    if (isDevelopment && typeof window !== 'undefined') {
      // Test automatique après 3 secondes
      const testTimer = setTimeout(() => {
        testTracking();
        console.log('[Analytics] Test event sent - Check Network tab');
      }, 3000);

      return () => clearTimeout(testTimer);
    }
  }, [isDevelopment]);

  // Composant invisible - ne rend rien
  return null;
}
