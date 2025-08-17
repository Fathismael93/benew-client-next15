/* eslint-disable no-unused-vars */
// app/templates/[id]/applications/[appID]/page.jsx
// Server Component optimisé pour détail d'une application e-commerce
// Next.js 15 + PostgreSQL + Monitoring essentiel

import { Suspense } from 'react';
import { notFound } from 'next/navigation';

import SingleApplication from '@/components/templates/SingleApplication';
import { getClient } from '@/backend/dbConnect';
import {
  captureException,
  captureMessage,
} from '../../../../../instrumentation';
import { Loading } from './loading';

// Configuration simple et efficace
const CONFIG = {
  cache: {
    revalidate: 300, // 5 minutes ISR
  },
  performance: {
    slowQueryThreshold: 1500, // Alerte pour queries lentes
  },
};

// Validation basique des IDs
function validateIds(appId, templateId) {
  // Validation simple sans schéma complexe
  if (!appId || typeof appId !== 'string' || appId.length === 0) {
    return { isValid: false };
  }

  if (
    !templateId ||
    typeof templateId !== 'string' ||
    templateId.length === 0
  ) {
    return { isValid: false };
  }

  return {
    isValid: true,
    applicationId: appId,
    templateId: templateId,
  };
}

// Fonction principale épurée
async function getApplicationData(applicationId, templateId) {
  const startTime = performance.now();

  try {
    const client = await getClient();

    try {
      // Exécuter toutes les requêtes en parallèle pour performance optimale
      const [applicationResult, relatedAppsResult, platformsResult] =
        await Promise.all([
          // 1. Application avec contexte du template
          client.query(
            `SELECT 
            -- Application
            a.application_id,
            a.application_name,
            a.application_link,
            a.application_admin_link,
            a.application_description,
            a.application_category,
            a.application_fee,
            a.application_rent,
            a.application_images,
            a.application_level,
            a.sales_count as application_sales,
            
            -- Template parent
            t.template_id,
            t.template_name,
            
            -- Stats basiques du template
            (SELECT COUNT(*) FROM catalog.applications 
             WHERE application_template_id = t.template_id AND is_active = true) as template_total_applications
            
          FROM catalog.applications a
          JOIN catalog.templates t ON a.application_template_id = t.template_id
          WHERE a.application_id = $1 
            AND a.application_template_id = $2
            AND a.is_active = true 
            AND t.is_active = true`,
            [applicationId, templateId],
          ),

          // 2. Applications similaires
          client.query(
            `SELECT 
            application_id,
            application_name,
            application_category,
            application_fee,
            application_level,
            application_images[1] as primary_image,
            sales_count
          FROM catalog.applications
          WHERE application_template_id = $1 
            AND application_id != $2
            AND is_active = true
          ORDER BY application_level ASC, sales_count DESC
          LIMIT 6`,
            [templateId, applicationId],
          ),

          // 3. Plateformes de paiement
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
        captureMessage('Slow application detail query', {
          level: 'warning',
          tags: { component: 'single_application_page' },
          extra: {
            applicationId,
            templateId,
            duration: queryDuration,
            relatedAppsCount: relatedAppsResult.rows.length,
          },
        });
      }

      // Vérifier si l'application existe
      if (applicationResult.rows.length === 0) {
        return {
          application: null,
          template: null,
          relatedApplications: [],
          platforms: [],
          success: false,
        };
      }

      const mainData = applicationResult.rows[0];

      // Séparer les données application et template
      const application = {
        application_id: mainData.application_id,
        application_name: mainData.application_name,
        application_link: mainData.application_link,
        application_admin_link: mainData.application_admin_link,
        application_description: mainData.application_description,
        application_category: mainData.application_category,
        application_fee: mainData.application_fee,
        application_rent: mainData.application_rent,
        application_images: mainData.application_images,
        application_level: mainData.application_level,
        application_sales: mainData.application_sales,
      };

      const template = {
        template_id: mainData.template_id,
        template_name: mainData.template_name,
        template_total_applications: mainData.template_total_applications,
      };

      return {
        application,
        template,
        relatedApplications: relatedAppsResult.rows,
        platforms: platformsResult.rows,
        success: true,
      };
    } finally {
      client.release();
    }
  } catch (error) {
    captureException(error, {
      tags: {
        component: 'single_application_page',
        error_type: 'database_error',
      },
      extra: { applicationId, templateId },
    });

    return {
      application: null,
      template: null,
      relatedApplications: [],
      platforms: [],
      success: false,
      error: error.message,
    };
  }
}

// Composant principal simplifié
export default async function SingleApplicationPage({ params }) {
  const { id: templateId, appID: appId } = await params;

  // Validation basique
  const validation = validateIds(appId, templateId);
  if (!validation.isValid) {
    notFound();
  }

  // Récupérer les données
  const data = await getApplicationData(
    validation.applicationId,
    validation.templateId,
  );

  // Gestion des erreurs et application non trouvée
  if (!data.success || !data.application) {
    notFound();
  }

  // Rendu normal avec Suspense
  return (
    <Suspense fallback={<Loading />}>
      <SingleApplication
        application={data.application}
        template={data.template}
        // relatedApplications={data.relatedApplications}
        platforms={data.platforms}
        context={{
          templateId: validation.templateId,
          applicationId: validation.applicationId,
        }}
      />
    </Suspense>
  );
}

// Génération dynamique des metadata
export async function generateMetadata({ params }) {
  const { id: templateId, appID: appId } = await params;

  // Validation basique
  const validation = validateIds(appId, templateId);
  if (!validation.isValid) {
    return {
      title: 'Application non trouvée - Benew',
      description:
        "L'application demandée n'existe pas ou n'est plus disponible.",
    };
  }

  try {
    const client = await getClient();
    try {
      const result = await client.query(
        `SELECT 
          a.application_name,
          a.application_description,
          a.application_category,
          a.application_fee,
          a.application_images,
          t.template_name
        FROM catalog.applications a
        JOIN catalog.templates t ON a.application_template_id = t.template_id
        WHERE a.application_id = $1 
          AND a.application_template_id = $2
          AND a.is_active = true`,
        [validation.applicationId, validation.templateId],
      );

      if (result.rows.length > 0) {
        const app = result.rows[0];

        return {
          title: `${app.application_name} - ${app.template_name} | Benew`,
          description:
            app.application_description ||
            `Découvrez l'application ${app.application_name} du template ${app.template_name} sur Benew.`,
          keywords: [
            app.application_name,
            app.template_name,
            app.application_category,
            'application e-commerce',
            'Benew',
            'Djibouti',
          ],
          openGraph: {
            title: `${app.application_name} - ${app.template_name}`,
            description:
              app.application_description ||
              `Application ${app.application_name} disponible sur Benew.`,
            images:
              app.application_images?.length > 0
                ? [app.application_images[0]]
                : [],
            url: `${process.env.NEXT_PUBLIC_SITE_URL}/templates/${validation.templateId}/applications/${validation.applicationId}`,
          },
          alternates: {
            canonical: `${process.env.NEXT_PUBLIC_SITE_URL}/templates/${validation.templateId}/applications/${validation.applicationId}`,
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
    title: 'Application - Benew',
    description: 'Découvrez cette application sur Benew.',
    openGraph: {
      title: 'Application Benew',
      url: `${process.env.NEXT_PUBLIC_SITE_URL}/templates/${validation.templateId}/applications/${validation.applicationId}`,
    },
  };
}

// Configuration ISR Next.js 15
export const revalidate = 300;

// Force static pour performance optimale
export const dynamic = 'auto';
