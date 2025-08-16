'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { captureMessage } from '@/instrumentation';
import { trackEvent } from '@/utils/analytics';

/**
 * Page 404 pour la route /templates/[id]
 * Gère le cas où un template spécifique n'existe pas
 * Production-ready avec suggestions intelligentes
 */
export default function TemplateDetailNotFound() {
  const params = useParams();
  const templateId = params?.id;
  const [suggestedTemplates, setSuggestedTemplates] = useState([]);

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

    // Simuler des suggestions (en production, pourrait venir d'une API)
    setSuggestedTemplates([
      { id: 'e-commerce', name: 'E-Commerce Pro', icon: '🛒' },
      { id: 'restaurant', name: 'Restaurant Digital', icon: '🍽️' },
      { id: 'services', name: 'Services Business', icon: '💼' },
    ]);
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

  /**
   * Handler pour la recherche
   */
  const handleSearchClick = () => {
    trackEvent('404_search_initiated', {
      event_category: 'errors',
      event_label: 'search_from_404',
      template_id: templateId,
    });
    // Rediriger vers la page de recherche ou ouvrir un modal de recherche
    // window.location.href = '/search?q=' + encodeURIComponent(templateId || '');
  };

  return (
    <div className="not-found-container">
      <style>{`
        .not-found-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          background: linear-gradient(135deg, #0c0c1d 0%, #1a1a2e 100%);
          position: relative;
          overflow: hidden;
        }

        /* Animation de fond avec des formes géométriques */
        .geometric-bg {
          position: absolute;
          width: 100%;
          height: 100%;
          overflow: hidden;
          opacity: 0.1;
        }

        .shape {
          position: absolute;
          border: 2px solid #f6a037;
          animation: float 20s infinite ease-in-out;
        }

        .shape-1 {
          width: 300px;
          height: 300px;
          top: 10%;
          left: 10%;
          border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%;
          animation-delay: 0s;
        }

        .shape-2 {
          width: 200px;
          height: 200px;
          top: 60%;
          right: 10%;
          border-radius: 50%;
          animation-delay: 5s;
        }

        .shape-3 {
          width: 150px;
          height: 150px;
          bottom: 20%;
          left: 50%;
          transform: rotate(45deg);
          animation-delay: 10s;
        }

        @keyframes float {
          0%,
          100% {
            transform: translateY(0) rotate(0deg);
          }
          33% {
            transform: translateY(-30px) rotate(120deg);
          }
          66% {
            transform: translateY(30px) rotate(240deg);
          }
        }

        .content-wrapper {
          max-width: 800px;
          width: 100%;
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(20px);
          border-radius: 24px;
          padding: 4rem;
          text-align: center;
          border: 1px solid rgba(246, 160, 55, 0.2);
          box-shadow:
            0 30px 80px rgba(0, 0, 0, 0.5),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
          position: relative;
          z-index: 1;
          animation: slideIn 0.6s ease-out;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .error-icon-wrapper {
          position: relative;
          display: inline-block;
          margin-bottom: 2rem;
        }

        .error-icon {
          font-size: 6rem;
          animation: bounce 2s infinite;
        }

        @keyframes bounce {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-20px);
          }
        }

        .error-code {
          position: absolute;
          top: -10px;
          right: -20px;
          background: linear-gradient(135deg, #f6a037 0%, #e89027 100%);
          color: #0c0c1d;
          font-size: 1.2rem;
          font-weight: bold;
          padding: 0.3rem 0.8rem;
          border-radius: 20px;
          box-shadow: 0 4px 10px rgba(246, 160, 55, 0.3);
        }

        .error-title {
          color: #f6a037;
          font-size: 2.5rem;
          font-weight: bold;
          margin: 1rem 0;
          letter-spacing: -1px;
        }

        .template-id-badge {
          display: inline-block;
          background: rgba(246, 160, 55, 0.1);
          color: #f6a037;
          padding: 0.4rem 1.2rem;
          border-radius: 20px;
          font-family: monospace;
          font-size: 0.95rem;
          margin-bottom: 1.5rem;
          border: 1px solid rgba(246, 160, 55, 0.3);
        }

        .error-message {
          color: #e0e0e0;
          font-size: 1.2rem;
          line-height: 1.7;
          margin-bottom: 3rem;
          max-width: 600px;
          margin-left: auto;
          margin-right: auto;
        }

        .suggestions-section {
          background: rgba(255, 255, 255, 0.03);
          border-radius: 16px;
          padding: 2rem;
          margin-bottom: 2.5rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .suggestions-title {
          color: #f6a037;
          font-size: 1.3rem;
          font-weight: 600;
          margin-bottom: 1.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }

        .template-suggestions {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-top: 1.5rem;
        }

        .suggested-template {
          background: rgba(246, 160, 55, 0.1);
          border: 1px solid rgba(246, 160, 55, 0.3);
          border-radius: 12px;
          padding: 1.2rem;
          text-decoration: none;
          transition: all 0.3s ease;
          cursor: pointer;
        }

        .suggested-template:hover {
          background: rgba(246, 160, 55, 0.15);
          transform: translateY(-3px);
          box-shadow: 0 8px 20px rgba(246, 160, 55, 0.2);
        }

        .suggested-icon {
          font-size: 2rem;
          margin-bottom: 0.5rem;
        }

        .suggested-name {
          color: #e0e0e0;
          font-size: 1rem;
          font-weight: 500;
        }

        .button-group {
          display: flex;
          gap: 1rem;
          justify-content: center;
          flex-wrap: wrap;
          margin-bottom: 2rem;
        }

        .btn {
          padding: 1rem 2.2rem;
          font-size: 1.05rem;
          font-weight: 600;
          border-radius: 12px;
          border: none;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
          position: relative;
          overflow: hidden;
        }

        .btn::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.15);
          transform: translate(-50%, -50%);
          transition:
            width 0.4s,
            height 0.4s;
        }

        .btn:hover::before {
          width: 500px;
          height: 500px;
        }

        .btn-primary {
          background: linear-gradient(135deg, #f6a037 0%, #e89027 100%);
          color: #0c0c1d;
          box-shadow:
            0 6px 20px rgba(246, 160, 55, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.2);
        }

        .btn-primary:hover {
          transform: translateY(-3px) scale(1.02);
          box-shadow:
            0 10px 35px rgba(246, 160, 55, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.3);
        }

        .btn-secondary {
          background: transparent;
          color: #f6a037;
          border: 2px solid #f6a037;
        }

        .btn-secondary:hover {
          background: rgba(246, 160, 55, 0.1);
          transform: translateY(-3px) scale(1.02);
          box-shadow: 0 8px 25px rgba(246, 160, 55, 0.2);
        }

        .btn-search {
          background: rgba(255, 255, 255, 0.05);
          color: #e0e0e0;
          border: 2px solid rgba(255, 255, 255, 0.2);
        }

        .btn-search:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: #f6a037;
          color: #f6a037;
          transform: translateY(-3px) scale(1.02);
        }

        .help-section {
          margin-top: 3rem;
          padding-top: 2.5rem;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .help-text {
          color: #999;
          font-size: 0.95rem;
          line-height: 1.6;
        }

        .help-text a {
          color: #f6a037;
          text-decoration: none;
          transition: all 0.3s;
        }

        .help-text a:hover {
          opacity: 0.8;
          text-decoration: underline;
        }

        .reference-code {
          margin-top: 1rem;
          font-family: monospace;
          font-size: 0.8rem;
          color: #666;
        }

        @media (max-width: 768px) {
          .content-wrapper {
            padding: 3rem 2rem;
          }

          .error-title {
            font-size: 2rem;
          }

          .template-suggestions {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .content-wrapper {
            padding: 2.5rem 1.5rem;
          }

          .error-icon {
            font-size: 4rem;
          }

          .error-title {
            font-size: 1.75rem;
          }

          .error-message {
            font-size: 1.05rem;
          }

          .button-group {
            flex-direction: column;
          }

          .btn {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>

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

        {/* Suggestions de templates */}
        <div className="suggestions-section">
          <h2 className="suggestions-title">
            <span>✨</span>
            Templates populaires que vous pourriez aimer
          </h2>
          <div className="template-suggestions">
            {suggestedTemplates.map((template) => (
              <Link
                key={template.id}
                href={`/templates/${template.id}`}
                className="suggested-template"
                onClick={() =>
                  handleLinkClick('suggested_template', {
                    suggested_template_id: template.id,
                  })
                }
              >
                <div className="suggested-icon">{template.icon}</div>
                <div className="suggested-name">{template.name}</div>
              </Link>
            ))}
          </div>
        </div>

        {/* Boutons d'action */}
        <div className="button-group">
          <Link
            href="/templates"
            className="btn btn-primary"
            onClick={() => handleLinkClick('templates_list')}
          >
            📋 Voir tous les templates
          </Link>

          <button className="btn btn-search" onClick={handleSearchClick}>
            🔎 Rechercher un template
          </button>

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
  );
}
