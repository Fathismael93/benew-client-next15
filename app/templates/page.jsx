// app/templates/page.jsx
// Server Component optimisé pour liste des templates e-commerce
// Next.js 15 + PostgreSQL + Cache simplifié + Monitoring essentiel + Query Timeout

import { Suspense } from 'react';
import { notFound } from 'next/navigation';

import TemplatesList from '@/components/templates/TemplatesList';
import { getClient } from '@/backend/dbConnect';
import { captureException, captureMessage } from '../../instrumentation';
import Loading from './loading';

// Configuration simplifiée mais robuste pour e-commerce
const CONFIG = {
  cache: {
    revalidate: 300, // 5 minutes - suffisant pour e-commerce
  },
  performance: {
    slowQueryThreshold: 1500, // Seuil d'alerte pour queries lentes
    queryTimeout: 5000, // 5 secondes - timeout pour queries
  },
};

// 🔥 NOUVELLE FONCTION : Query avec timeout
async function executeQueryWithTimeout(
  client,
  query,
  timeout = CONFIG.performance.queryTimeout,
) {
  return new Promise((resolve, reject) => {
    // Timer pour le timeout
    const timeoutId = setTimeout(() => {
      reject(new Error(`Query timeout après ${timeout}ms`));
    }, timeout);

    // Exécution de la query
    client
      .query(query)
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

// Fonction principale avec timeout intégré
async function getTemplates() {
  const startTime = performance.now();

  try {
    const client = await getClient();

    try {
      // Query avec timeout
      const query = `
        SELECT 
          template_id, 
          template_name, 
          template_image, 
          template_has_web, 
          template_has_mobile 
        FROM catalog.templates 
        WHERE is_active = true 
        ORDER BY template_added DESC
      `;

      const result = await executeQueryWithTimeout(client, query);

      const queryDuration = performance.now() - startTime;

      // Log pour queries lentes
      if (queryDuration > CONFIG.performance.slowQueryThreshold) {
        captureMessage('Slow templates query detected', {
          level: 'warning',
          tags: { component: 'templates_page' },
          extra: {
            duration: queryDuration,
            templatesCount: result.rows.length,
            queryTimeout: CONFIG.performance.queryTimeout,
          },
        });
      }

      // Log de succès avec durée (en dev seulement)
      if (process.env.NODE_ENV === 'development') {
        console.log(
          `[Templates] Query exécutée en ${Math.round(queryDuration)}ms`,
        );
      }

      return {
        templates: result.rows,
        success: true,
      };
    } finally {
      client.release();
    }
  } catch (error) {
    const queryDuration = performance.now() - startTime;

    // Gestion spécifique des timeouts
    if (error.message.includes('Query timeout')) {
      captureMessage('Templates query timeout', {
        level: 'error',
        tags: {
          component: 'templates_page',
          error_type: 'query_timeout',
        },
        extra: {
          duration: queryDuration,
          timeout: CONFIG.performance.queryTimeout,
        },
      });

      return {
        templates: [],
        success: false,
        error: 'La requête a pris trop de temps. Veuillez réessayer.',
        isTimeout: true,
      };
    }

    // Autres erreurs DB
    captureException(error, {
      tags: {
        component: 'templates_page',
        error_type: 'database_error',
      },
      extra: {
        duration: queryDuration,
        timeout: CONFIG.performance.queryTimeout,
      },
    });

    return {
      templates: [],
      success: false,
      error: error.message,
      isTimeout: false,
    };
  }
}

// Composant principal épuré
export default async function TemplatesPage() {
  const data = await getTemplates();

  // Gestion d'erreur avec distinction timeout
  if (!data.success) {
    if (process.env.NODE_ENV === 'production') {
      notFound();
    }

    // En dev, affichage différencié selon le type d'erreur
    return (
      <div className="templates-error-fallback">
        <h1>Erreur de chargement</h1>
        {data.isTimeout ? (
          <div>
            <p>⏱️ La requête a pris trop de temps.</p>
            <p>Veuillez rafraîchir la page.</p>
          </div>
        ) : (
          <p>Impossible de charger les templates.</p>
        )}
        {process.env.NODE_ENV !== 'production' && (
          <details>
            <summary>Détails de l&apos;erreur (dev)</summary>
            <pre>{data.error}</pre>
          </details>
        )}
      </div>
    );
  }

  // Si pas de templates (cas valide pour e-commerce)
  if (!data.templates || data.templates.length === 0) {
    return (
      <div className="templates-empty-state">
        <h1>Aucun template disponible</h1>
        <p>Revenez bientôt pour découvrir nos nouveaux templates.</p>
      </div>
    );
  }

  // Rendu normal avec Suspense pour UX
  return (
    <Suspense fallback={<Loading />}>
      <TemplatesList templates={data.templates} />
    </Suspense>
  );
}

// Metadata pour SEO e-commerce
export const metadata = {
  title: 'Templates - Benew | Solutions E-commerce',
  description:
    'Découvrez notre collection de templates e-commerce professionnels. Solutions complètes pour votre boutique en ligne.',
  keywords: [
    'templates e-commerce',
    'boutique en ligne',
    'solutions e-commerce',
    'templates professionnels',
    'Benew',
    'Djibouti',
  ],
  openGraph: {
    title: 'Templates E-commerce Benew',
    description:
      'Collection de templates professionnels pour votre boutique en ligne.',
    url: `${process.env.NEXT_PUBLIC_SITE_URL}/templates`,
  },
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL}/templates`,
  },
};

// Configuration Next.js 15 pour cache ISR
export const revalidate = 300; // ISR de 5 minutes

// Dynamic si besoin de personnalisation par utilisateur (désactivé par défaut)
export const dynamic = 'force-static'; // Pour e-commerce, on peut garder statique
