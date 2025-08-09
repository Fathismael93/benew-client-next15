/* eslint-disable no-unused-vars */
// app/templates/[id]/page.jsx
// Server Component optimisé pour détail d'un template e-commerce
// Next.js 15 + PostgreSQL + Monitoring essentiel

import { Suspense } from 'react';
import { notFound } from 'next/navigation';

import SingleTemplateShops from '@/components/templates/SingleTemplateShops';
import { getClient } from '@/backend/dbConnect';
import { captureException, captureMessage } from '../../../instrumentation';

// Configuration simple et efficace
const CONFIG = {
  cache: {
    revalidate: 300, // 5 minutes ISR
  },
  performance: {
    slowQueryThreshold: 1500, // Alerte pour queries lentes
  },
};

// Fonction principale épurée
async function getTemplateData(templateId) {
  const startTime = performance.now();

  try {
    const client = await getClient();

    try {
      // Exécuter les 3 requêtes en parallèle pour performance optimale
      const [templateResult, applicationsResult, platformsResult] =
        await Promise.all([
          // 1. Vérifier que le template existe
          client.query(
            `SELECT 
            template_id,
            template_name,
            template_image,
            template_has_web,
            template_has_mobile
          FROM catalog.templates 
          WHERE template_id = $1 AND is_active = true`,
            [templateId],
          ),

          // 2. Récupérer les applications du template
          client.query(
            `SELECT 
            a.application_id, 
            a.application_name, 
            a.application_category, 
            a.application_fee, 
            a.application_rent, 
            a.application_images, 
            a.application_level,
            t.template_name
          FROM catalog.applications a
          JOIN catalog.templates t ON a.application_template_id = t.template_id 
          WHERE a.application_template_id = $1 
            AND a.is_active = true 
            AND t.is_active = true
          ORDER BY a.application_level ASC, a.created_at DESC`,
            [templateId],
          ),

          // 3. Récupérer les plateformes de paiement
          client.query(
            `SELECT 
            platform_id, 
            platform_name, 
            platform_number
          FROM admin.platforms
          WHERE is_active = true
          ORDER BY platform_name ASC`,
          ),
        ]);

      const queryDuration = performance.now() - startTime;

      // Log uniquement si lent
      if (queryDuration > CONFIG.performance.slowQueryThreshold) {
        captureMessage('Slow template detail query', {
          level: 'warning',
          tags: { component: 'single_template_page' },
          extra: {
            templateId,
            duration: queryDuration,
            applicationsCount: applicationsResult.rows.length,
          },
        });
      }

      // Vérifier si le template existe
      if (templateResult.rows.length === 0) {
        return {
          template: null,
          applications: [],
          platforms: [],
          success: false,
        };
      }

      return {
        template: templateResult.rows[0],
        applications: applicationsResult.rows,
        platforms: platformsResult.rows,
        success: true,
      };
    } finally {
      client.release();
    }
  } catch (error) {
    captureException(error, {
      tags: {
        component: 'single_template_page',
        error_type: 'database_error',
      },
      extra: { templateId },
    });

    return {
      template: null,
      applications: [],
      platforms: [],
      success: false,
      error: error.message,
    };
  }
}

// Composant principal simplifié
export default async function SingleTemplatePage({ params }) {
  const { id: templateId } = await params;

  // Validation basique de l'ID
  if (!templateId || typeof templateId !== 'string') {
    notFound();
  }

  // Récupérer les données
  const data = await getTemplateData(templateId);

  // Gestion des erreurs et template non trouvé
  if (!data.success || !data.template) {
    notFound();
  }

  // Si pas d'applications (cas valide mais rare)
  if (!data.applications || data.applications.length === 0) {
    return (
      <div className="template-no-applications">
        <h1>{data.template.template_name}</h1>
        <p>Aucune application disponible pour ce template.</p>
        <p>Revenez bientôt pour découvrir les applications.</p>
      </div>
    );
  }

  // Rendu normal avec Suspense
  return (
    <Suspense fallback={<SingleTemplatePageSkeleton />}>
      <SingleTemplateShops
        templateID={templateId}
        applications={data.applications}
        platforms={data.platforms}
      />
    </Suspense>
  );
}

// Skeleton component simple et efficace
function SingleTemplatePageSkeleton() {
  return (
    <div className="single-template-skeleton">
      {/* Header skeleton */}
      <div className="skeleton-header">
        <div className="skeleton-title-large"></div>
      </div>

      {/* Applications grid skeleton */}
      <div className="skeleton-grid">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skeleton-card">
            <div className="skeleton-image"></div>
            <div className="skeleton-content">
              <div className="skeleton-text"></div>
              <div className="skeleton-text short"></div>
              <div className="skeleton-price"></div>
              <div className="skeleton-buttons">
                <div className="skeleton-button"></div>
                <div className="skeleton-button"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Génération dynamique des metadata
export async function generateMetadata({ params }) {
  const { id: templateId } = await params;

  // Récupérer juste le nom du template pour le SEO
  try {
    const client = await getClient();
    try {
      const result = await client.query(
        'SELECT template_name FROM catalog.templates WHERE template_id = $1 AND is_active = true',
        [templateId],
      );

      if (result.rows.length > 0) {
        const templateName = result.rows[0].template_name;

        return {
          title: `${templateName} - Applications Disponibles | Benew`,
          description: `Découvrez le template ${templateName} et ses applications professionnelles. Solutions web et mobile pour votre business.`,
          keywords: [
            templateName,
            'template e-commerce',
            'application web',
            'application mobile',
            'Benew',
            'Djibouti',
          ],
          openGraph: {
            title: `${templateName} - Template Benew`,
            description: `Explorez le template ${templateName} avec ses applications professionnelles disponibles.`,
            url: `${process.env.NEXT_PUBLIC_SITE_URL}/templates/${templateId}`,
          },
          alternates: {
            canonical: `${process.env.NEXT_PUBLIC_SITE_URL}/templates/${templateId}`,
          },
        };
      }
    } finally {
      client.release();
    }
  } catch (error) {
    // Fallback metadata si erreur
  }

  // Metadata par défaut
  return {
    title: 'Template - Applications Disponibles | Benew',
    description:
      'Découvrez ce template et ses applications professionnelles disponibles.',
    openGraph: {
      title: 'Template Benew',
      url: `${process.env.NEXT_PUBLIC_SITE_URL}/templates/${templateId}`,
    },
  };
}

// Configuration ISR Next.js 15
export const revalidate = 300;

// Force static pour performance optimale
export const dynamic = 'force-static';
