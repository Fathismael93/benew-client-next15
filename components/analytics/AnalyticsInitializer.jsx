'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import analytics from '@/utils/analytics.gtm'; // Utiliser la version GTM

/**
 * Composant pour initialiser GTM/GA4 automatiquement
 * @param {boolean} isDevelopment - Mode développement
 */
export default function AnalyticsInitializer({ isDevelopment = false }) {
  const pathname = usePathname();

  // Initialisation GTM une seule fois
  useEffect(() => {
    const initGTM = () => {
      try {
        // Initialiser le consentement GTM
        analytics.initializeGTMConsent();

        // Vérifier si on a déjà un consentement stocké
        const hasAnalytics = analytics.hasAnalyticsConsent();
        const hasMarketing = analytics.hasMarketingConsent();

        // Si consentement déjà accordé, le mettre à jour
        if (hasAnalytics || hasMarketing) {
          analytics.grantConsent(hasAnalytics, hasMarketing);
        }

        // Debug en développement
        if (isDevelopment) {
          setTimeout(() => {
            analytics.debugGA();
            console.log('[GTM] Initialized for development');
            console.log(
              '[GTM] Container ID:',
              process.env.NEXT_PUBLIC_GTM_CONTAINER_ID,
            );
            console.log(
              '[GTM] GA4 ID (configure in GTM):',
              process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
            );
          }, 1000);
        }
      } catch (error) {
        console.error('[GTM] Initialization error:', error);
        analytics.trackError(
          `GTM initialization failed: ${error.message}`,
          pathname,
          'fatal',
        );
      }
    };

    // Initialiser après hydration
    if (typeof window !== 'undefined') {
      if (document.readyState === 'complete') {
        initGTM();
      } else {
        window.addEventListener('load', initGTM);
        return () => window.removeEventListener('load', initGTM);
      }
    }
  }, []); // Une seule fois au montage

  // Tracking des changements de page (App Router)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const startTime = performance.now();

      // Tracker la vue de page avec performance
      setTimeout(() => {
        const loadTime = performance.now() - startTime;

        // Envoyer page_view event pour GTM
        analytics.trackEvent('page_view', {
          page_path: pathname,
          page_title: document.title,
          page_location: window.location.href,
        });

        // Tracker la performance
        analytics.trackPagePerformance(pathname, loadTime, false);

        if (isDevelopment) {
          console.log(
            `[GTM] Page tracked: ${pathname} (${loadTime.toFixed(2)}ms)`,
          );
        }
      }, 100);
    }
  }, [pathname, isDevelopment]);

  // Test du tracking en développement
  useEffect(() => {
    if (isDevelopment && typeof window !== 'undefined') {
      // Test automatique après 3 secondes
      const testTimer = setTimeout(() => {
        analytics.testTracking();
        console.log(
          '[GTM] Test event sent - Check GTM Preview & GA4 DebugView',
        );
      }, 3000);

      return () => clearTimeout(testTimer);
    }
  }, [isDevelopment]);

  // Composant invisible - ne rend rien
  return null;
}
