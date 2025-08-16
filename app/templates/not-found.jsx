'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { captureMessage } from '@/instrumentation';
import { trackEvent } from '@/utils/analytics';

/**
 * Page 404 pour la route /templates
 * Gère le cas où la page des templates n'existe pas ou erreur de routing
 * Production-ready avec monitoring et suggestions
 */
export default function TemplatesNotFound() {
  useEffect(() => {
    // Capture dans Sentry
    captureMessage('404 - Templates page not found', {
      level: 'info',
      tags: {
        component: 'templates_not_found',
        page_type: 'templates_list',
        error_type: '404',
      },
      extra: {
        timestamp: new Date().toISOString(),
        url: typeof window !== 'undefined' ? window.location.href : 'unknown',
        referrer:
          typeof document !== 'undefined' ? document.referrer : 'unknown',
      },
    });

    // Track dans Analytics
    trackEvent('page_not_found', {
      event_category: 'errors',
      event_label: '404_templates_list',
      page_path: '/templates',
    });

    // Log en dev
    if (process.env.NODE_ENV === 'development') {
      console.log('[TemplatesNotFound] 404 page displayed');
    }
  }, []);

  /**
   * Handler pour les liens avec tracking
   */
  const handleLinkClick = (destination) => {
    trackEvent('404_navigation', {
      event_category: 'errors',
      event_label: `404_to_${destination}`,
      from_page: 'templates_list',
    });
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

        /* Particules d'arrière-plan animées */
        .not-found-container::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(
            circle at 20% 80%,
            rgba(246, 160, 55, 0.1) 0%,
            transparent 50%
          );
          animation: rotate 30s linear infinite;
        }

        .not-found-container::after {
          content: '';
          position: absolute;
          top: -50%;
          right: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(
            circle at 80% 20%,
            rgba(246, 160, 55, 0.05) 0%,
            transparent 50%
          );
          animation: rotate 40s linear infinite reverse;
        }

        @keyframes rotate {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        .content-wrapper {
          max-width: 700px;
          width: 100%;
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(20px);
          border-radius: 24px;
          padding: 4rem;
          text-align: center;
          border: 1px solid rgba(246, 160, 55, 0.2);
          box-shadow:
            0 20px 60px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
          position: relative;
          z-index: 1;
          animation: fadeInUp 0.6s ease-out;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .error-code {
          font-size: 8rem;
          font-weight: bold;
          background: linear-gradient(135deg, #f6a037 0%, #e89027 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin: 0;
          line-height: 1;
          text-shadow: 0 0 40px rgba(246, 160, 55, 0.3);
          animation: glow 2s ease-in-out infinite alternate;
        }

        @keyframes glow {
          from {
            filter: drop-shadow(0 0 20px rgba(246, 160, 55, 0.3));
          }
          to {
            filter: drop-shadow(0 0 30px rgba(246, 160, 55, 0.5));
          }
        }

        .error-title {
          color: #f6a037;
          font-size: 2.2rem;
          font-weight: bold;
          margin: 1.5rem 0 1rem;
          letter-spacing: -0.5px;
        }

        .error-message {
          color: #e0e0e0;
          font-size: 1.2rem;
          line-height: 1.7;
          margin-bottom: 2.5rem;
        }

        .suggestions {
          background: rgba(246, 160, 55, 0.1);
          border: 1px solid rgba(246, 160, 55, 0.3);
          border-radius: 12px;
          padding: 1.5rem;
          margin-bottom: 2.5rem;
        }

        .suggestions-title {
          color: #f6a037;
          font-size: 1.1rem;
          font-weight: 600;
          margin-bottom: 1rem;
        }

        .suggestions-list {
          list-style: none;
          padding: 0;
          margin: 0;
          text-align: left;
        }

        .suggestions-list li {
          color: #b0b0b0;
          padding: 0.5rem 0;
          padding-left: 1.5rem;
          position: relative;
          font-size: 0.95rem;
          line-height: 1.5;
        }

        .suggestions-list li::before {
          content: '→';
          position: absolute;
          left: 0;
          color: #f6a037;
          font-weight: bold;
        }

        .button-group {
          display: flex;
          gap: 1rem;
          justify-content: center;
          flex-wrap: wrap;
          margin-bottom: 2rem;
        }

        .btn {
          padding: 1rem 2rem;
          font-size: 1.05rem;
          font-weight: 600;
          border-radius: 12px;
          border: none;
          cursor: pointer;
          transition: all 0.3s ease;
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
          background: rgba(255, 255, 255, 0.1);
          transform: translate(-50%, -50%);
          transition:
            width 0.3s,
            height 0.3s;
        }

        .btn:hover::before {
          width: 400px;
          height: 400px;
        }

        .btn-primary {
          background: linear-gradient(135deg, #f6a037 0%, #e89027 100%);
          color: #0c0c1d;
          box-shadow:
            0 6px 20px rgba(246, 160, 55, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.2);
        }

        .btn-primary:hover {
          transform: translateY(-3px);
          box-shadow:
            0 8px 30px rgba(246, 160, 55, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.3);
        }

        .btn-secondary {
          background: transparent;
          color: #f6a037;
          border: 2px solid #f6a037;
        }

        .btn-secondary:hover {
          background: rgba(246, 160, 55, 0.1);
          transform: translateY(-3px);
          box-shadow: 0 6px 20px rgba(246, 160, 55, 0.2);
        }

        .btn-tertiary {
          background: rgba(255, 255, 255, 0.05);
          color: #999;
          border: 2px solid rgba(255, 255, 255, 0.1);
        }

        .btn-tertiary:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
          border-color: rgba(255, 255, 255, 0.2);
          transform: translateY(-3px);
        }

        .search-hint {
          margin-top: 2rem;
          padding-top: 2rem;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          color: #999;
          font-size: 0.9rem;
        }

        .search-hint a {
          color: #f6a037;
          text-decoration: none;
          transition: opacity 0.3s;
        }

        .search-hint a:hover {
          opacity: 0.8;
          text-decoration: underline;
        }

        .decorative-icon {
          font-size: 1.5rem;
          opacity: 0.8;
          animation: float 3s ease-in-out infinite;
        }

        @keyframes float {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        @media (max-width: 640px) {
          .content-wrapper {
            padding: 2.5rem 1.5rem;
          }

          .error-code {
            font-size: 6rem;
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

      <div className="content-wrapper">
        {/* Code 404 animé */}
        <h1 className="error-code">404</h1>

        {/* Titre principal */}
        <h2 className="error-title">Page Templates Introuvable</h2>

        {/* Message explicatif */}
        <p className="error-message">
          Oops ! La page des templates que vous recherchez semble avoir disparu
          dans le cyberespace.
          <br />
          Ne vous inquiétez pas, nous avons d&apos;autres options pour vous !
        </p>

        {/* Suggestions utiles */}
        <div className="suggestions">
          <h3 className="suggestions-title">Cela peut vous aider :</h3>
          <ul className="suggestions-list">
            <li>
              Vérifiez l&apos;URL pour d&apos;éventuelles erreurs de frappe
            </li>
            <li>La page a peut-être été déplacée ou renommée</li>
            <li>Retournez à l&apos;accueil pour naviguer vers les templates</li>
            <li>
              Utilisez notre menu de navigation pour trouver ce que vous
              cherchez
            </li>
          </ul>
        </div>

        {/* Boutons d'action */}
        <div className="button-group">
          <Link
            href="/"
            className="btn btn-primary"
            onClick={() => handleLinkClick('home')}
          >
            <span className="decorative-icon">🏠</span>
            Retour à l&apos;accueil
          </Link>

          <Link
            href="/templates"
            className="btn btn-secondary"
            onClick={() => handleLinkClick('templates')}
          >
            <span className="decorative-icon">📋</span>
            Voir nos templates
          </Link>

          <Link
            href="/contact"
            className="btn btn-tertiary"
            onClick={() => handleLinkClick('contact')}
          >
            <span className="decorative-icon">💬</span>
            Nous contacter
          </Link>
        </div>

        {/* Aide supplémentaire */}
        <div className="search-hint">
          Besoin d&apos;aide pour trouver le template parfait ?<br />
          <Link href="/contact">Contactez notre équipe</Link> ou envoyez-nous un
          email à <a href="mailto:support@benew-dj.com">support@benew-dj.com</a>
        </div>
      </div>
    </div>
  );
}
