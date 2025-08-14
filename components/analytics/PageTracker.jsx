'use client';

import { useEffect, useRef } from 'react';
import analytics from '@/utils/analytics'; // Utiliser la version GTM

/**
 * Composant pour tracker les interactions sur une page spécifique
 * @param {string} pageName - Nom de la page
 * @param {string} pageType - Type de page (landing, blog, template, etc.)
 * @param {Array} sections - Sections de la page à tracker
 */
export default function PageTracker({
  pageName,
  pageType = 'page',
  sections = [],
}) {
  const startTimeRef = useRef(performance.now());
  const sectionsTrackedRef = useRef(new Set());

  useEffect(() => {
    // Tracker l'entrée sur la page
    analytics.trackEvent('page_enter', {
      page_name: pageName,
      page_type: pageType,
      sections_count: sections.length,
    });

    // Performance initiale
    const initialLoadTime = performance.now() - startTimeRef.current;
    if (initialLoadTime > 0) {
      analytics.trackPagePerformance(pageName, initialLoadTime, false);
    }

    // Cleanup: tracker la sortie de page
    return () => {
      const timeOnPage = performance.now() - startTimeRef.current;

      analytics.trackEvent('page_exit', {
        page_name: pageName,
        page_type: pageType,
        time_on_page: Math.round(timeOnPage),
        sections_viewed: sectionsTrackedRef.current.size,
      });
    };
  }, [pageName, pageType, sections.length]);

  // Intersection Observer pour tracker les sections visibles
  useEffect(() => {
    if (sections.length === 0 || typeof window === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const sectionName = entry.target.dataset.section;

            if (sectionName && !sectionsTrackedRef.current.has(sectionName)) {
              sectionsTrackedRef.current.add(sectionName);

              analytics.trackEvent('section_view', {
                page_name: pageName,
                section_name: sectionName,
                section_position: sections.indexOf(sectionName) + 1,
              });
            }
          }
        });
      },
      {
        threshold: 0.5, // Section visible à 50%
        rootMargin: '0px 0px -100px 0px', // Déclencher 100px avant
      },
    );

    // Observer toutes les sections avec data-section
    const sectionElements = document.querySelectorAll('[data-section]');
    sectionElements.forEach((element) => observer.observe(element));

    return () => {
      sectionElements.forEach((element) => observer.unobserve(element));
    };
  }, [sections, pageName]);

  // Tracker le scroll profond (90% de la page)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let deepScrollTracked = false;

    const handleScroll = () => {
      if (deepScrollTracked) return;

      const scrollPercent =
        (window.scrollY /
          (document.documentElement.scrollHeight - window.innerHeight)) *
        100;

      if (scrollPercent >= 90) {
        deepScrollTracked = true;

        analytics.trackEvent('deep_scroll', {
          page_name: pageName,
          scroll_depth: 90,
        });
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [pageName]);

  // Tracker les clics sortants
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleClick = (event) => {
      const link = event.target.closest('a');
      if (!link) return;

      const href = link.href;
      const text = link.textContent?.trim() || 'No text';

      // Liens externes
      if (href && !href.startsWith(window.location.origin)) {
        analytics.trackEvent('external_link_click', {
          link_url: href,
          page_name: pageName,
          link_text: text,
        });
      }

      // Liens internes importants
      else if (
        href &&
        (href.includes('/templates') ||
          href.includes('/contact') ||
          href.includes('/blog'))
      ) {
        analytics.trackEvent('internal_link_click', {
          link_url: href,
          page_name: pageName,
          link_text: text,
          link_type: href.includes('/templates')
            ? 'template'
            : href.includes('/contact')
              ? 'contact'
              : 'blog',
        });
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [pageName]);

  // Composant invisible
  return null;
}
