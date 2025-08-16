'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { captureMessage } from '@/instrumentation';
import { trackEvent } from '@/utils/analytics';
import './not-found.scss';

/**
 * Page 404 pour la route /templates/[id]
 * Gère le cas où un template spécifique n'existe pas
 * Production-ready avec suggestions intelligentes
 */
export default function TemplateDetailNotFound() {
  const params = useParams();
  const templateId = params?.id;

  useEffect(() => {
    // Capture dans Sentry
    captureMessage('404 - Template not found', {
      level: 'info',
      tags: {
        component: 'template_detail_not_found',
        page_type: 'template_detail',
        error_type: '404',
        template_id: templateId || 'unknown',
      },
      extra: {
        templateId,
        timestamp: new Date().toISOString(),
        url: typeof window !== 'undefined' ? window.location.href : 'unknown',
        referrer:
          typeof document !== 'undefined' ? document.referrer : 'unknown',
      },
    });

    // Track dans Analytics
    trackEvent('page_not_found', {
      event_category: 'errors',
      event_label: '404_template_detail',
      page_path: `/templates/${templateId}`,
      template_id: templateId,
    });

    // Log en dev
    if (process.env.NODE_ENV === 'development') {
      console.log('[TemplateDetailNotFound] 404 for template:', templateId);
    }
  }, [templateId]);

  /**
   * Handler pour les liens avec tracking
   */
  const handleLinkClick = (destination, extra = {}) => {
    trackEvent('404_navigation', {
      event_category: 'errors',
      event_label: `404_to_${destination}`,
      from_page: 'template_detail',
      template_id: templateId,
      ...extra,
    });
  };

  return (
    <section className="first">
      <div className="not-found-container">
        {/* Formes géométriques animées */}
        <div className="geometric-bg">
          <div className="shape shape-1"></div>
          <div className="shape shape-2"></div>
          <div className="shape shape-3"></div>
        </div>

        <div className="content-wrapper">
          {/* Icône avec badge 404 */}
          <div className="error-icon-wrapper">
            <div className="error-icon">🔍</div>
            <span className="error-code">404</span>
          </div>

          {/* Titre principal */}
          <h1 className="error-title">Template Introuvable</h1>

          {/* Badge de l'ID du template */}
          {templateId && (
            <div className="template-id-badge">ID recherché : {templateId}</div>
          )}

          {/* Message explicatif */}
          <p className="error-message">
            Désolé, le template que vous recherchez n&apos;existe pas ou a
            peut-être été retiré de notre catalogue. Mais ne vous inquiétez pas,
            nous avons plein d&apos;autres options fantastiques pour vous !
          </p>

          {/* Boutons d'action */}
          <div className="button-group">
            <Link
              href="/templates"
              className="btn btn-primary"
              onClick={() => handleLinkClick('templates_list')}
            >
              📋 Voir tous les templates
            </Link>

            <Link
              href="/"
              className="btn btn-secondary"
              onClick={() => handleLinkClick('home')}
            >
              🏠 Retour à l&apos;accueil
            </Link>
          </div>

          {/* Section d'aide */}
          <div className="help-section">
            <div className="help-text">
              Besoin d&apos;aide ? Contactez notre équipe support ou consultez
              notre{' '}
              <Link href="/help" onClick={() => handleLinkClick('help')}>
                centre d&apos;aide
              </Link>
              .
              <br />
              Vous pouvez aussi nous signaler ce problème si vous pensez
              qu&apos;il s&apos;agit d&apos;une erreur.
            </div>

            <div className="reference-code">
              Référence: 404-TEMPLATE-{templateId?.toUpperCase() || 'UNKNOWN'}-
              {Date.now().toString(36).toUpperCase()}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
