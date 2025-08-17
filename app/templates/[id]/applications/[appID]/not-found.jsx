'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { captureMessage } from '@/instrumentation';
import { trackEvent } from '@/utils/analytics';
import './not-found.scss';

/**
 * Page 404 pour la route /templates/[id]/applications/[appID]
 * Gère le cas où une application spécifique n'existe pas
 * Production-ready avec suggestions intelligentes et contexte du template
 */
export default function ApplicationDetailNotFound() {
  const params = useParams();
  const templateId = params?.id;
  const appId = params?.appID;

  useEffect(() => {
    // Capture dans Sentry
    captureMessage('404 - Application not found', {
      level: 'info',
      tags: {
        component: 'application_detail_not_found',
        page_type: 'application_detail',
        error_type: '404',
        template_id: templateId || 'unknown',
        application_id: appId || 'unknown',
      },
      extra: {
        templateId,
        appId,
        timestamp: new Date().toISOString(),
        url: typeof window !== 'undefined' ? window.location.href : 'unknown',
        referrer:
          typeof document !== 'undefined' ? document.referrer : 'unknown',
      },
    });

    // Track dans Analytics
    trackEvent('page_not_found', {
      event_category: 'errors',
      event_label: '404_application_detail',
      page_path: `/templates/${templateId}/applications/${appId}`,
      template_id: templateId,
      application_id: appId,
    });

    // Log en dev
    if (process.env.NODE_ENV === 'development') {
      console.log('[ApplicationDetailNotFound] 404 for application:', {
        templateId,
        appId,
      });
    }
  }, [templateId, appId]);

  /**
   * Handler pour les liens avec tracking
   */
  const handleLinkClick = (destination, extra = {}) => {
    trackEvent('404_navigation', {
      event_category: 'errors',
      event_label: `404_to_${destination}`,
      from_page: 'application_detail',
      template_id: templateId,
      application_id: appId,
      ...extra,
    });
  };

  return (
    <section className="first">
      <div className="app-not-found-container">
        <div className="content-wrapper">
          {/* Titre principal */}
          <h1 className="error-title">Application Introuvable</h1>

          {/* Badges des IDs */}
          <div className="id-badges">
            {templateId && (
              <div className="template-id-badge">Template : {templateId}</div>
            )}
            {appId && <div className="app-id-badge">Application : {appId}</div>}
          </div>

          {/* Message explicatif */}
          <p className="error-message">
            Désolé, l&apos;application que vous recherchez n&apos;existe pas
            dans ce template ou a peut-être été retirée de notre catalogue.
            {templateId &&
              " Mais vous pouvez explorer d'autres applications de ce template !"}
          </p>

          {/* Boutons d'action */}
          <div className="button-group">
            {templateId && (
              <Link
                href={`/templates/${templateId}`}
                className="retry-button"
                onClick={() => handleLinkClick('template_applications')}
              >
                📋 Voir les applications du template
              </Link>
            )}

            <Link
              href="/templates"
              className="templates-button"
              onClick={() => handleLinkClick('all_templates')}
            >
              🎯 Tous les templates
            </Link>

            <Link
              href="/"
              className="home-button"
              onClick={() => handleLinkClick('home')}
            >
              🏠 Retour à l&apos;accueil
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
