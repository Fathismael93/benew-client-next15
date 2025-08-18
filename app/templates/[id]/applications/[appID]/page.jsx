/* eslint-disable no-unused-vars */
// app/templates/[id]/applications/[appID]/page.jsx
// Server Component optimisé pour détail d'une application e-commerce
// Next.js 15 + PostgreSQL + Monitoring essentiel + Validation UUID + Timeouts

import { Suspense } from 'react';
import { notFound } from 'next/navigation';

import SingleApplication from '@/components/templates/SingleApplication';
import { getClient } from '@/backend/dbConnect';
import {
  captureException,
  captureMessage,
} from '../../../../../instrumentation';
import { sanitizeAndValidateUUID } from '@/utils/validation';
import Loading from './loading';

// Configuration étendue avec timeouts
const CONFIG = {
  cache: {
    revalidate: 300, // 5 minutes ISR
  },
  performance: {
    slowQueryThreshold: 1500, // Alerte pour queries lentes
    queryTimeout: 8000, // 8 secondes timeout
  },
};

/**
 * Promise avec timeout
 */
function withTimeout(promise, timeoutMs, errorMessage = 'Operation timed out') {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        const timeoutError = new Error(errorMessage);
        timeoutError.name = 'TimeoutError';
        reject(timeoutError);
      }, timeoutMs);
    }),
  ]);
}

/**
 * Validation robuste des IDs avec UUID
 */
function validateIds(appId, templateId) {
  // Validation et nettoyage de l'ID application
  const cleanApplicationId = sanitizeAndValidateUUID(appId);
  if (!cleanApplicationId) {
    return {
      isValid: false,
      error: 'Application ID format invalide',
      field: 'applicationId',
    };
  }

  // Validation et nettoyage de l'ID template
  const cleanTemplateId = sanitizeAndValidateUUID(templateId);
  if (!cleanTemplateId) {
    return {
      isValid: false,
      error: 'Template ID format invalide',
      field: 'templateId',
    };
  }

  return {
    isValid: true,
    applicationId: cleanApplicationId,
    templateId: cleanTemplateId,
  };
}

// Fonction principale avec timeout intégré
async function getApplicationData(applicationId, templateId) {
  const startTime = performance.now();

  try {
    const client = await getClient();

    try {
      // Exécuter toutes les requêtes en parallèle avec timeout
      const queryPromise = Promise.all([
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

      const [applicationResult, relatedAppsResult, platformsResult] =
        await withTimeout(
          queryPromise,
          CONFIG.performance.queryTimeout,
          'Database query timeout',
        );

      const queryDuration = performance.now() - startTime;

      // Log performance avec timeout info
      if (queryDuration > CONFIG.performance.slowQueryThreshold) {
        captureMessage('Slow application detail query', {
          level: 'warning',
          tags: {
            component: 'single_application_page',
            performance: true,
          },
          extra: {
            applicationId,
            templateId,
            duration: queryDuration,
            timeout: CONFIG.performance.queryTimeout,
            relatedAppsCount: relatedAppsResult.rows.length,
          },
        });
      }

      // Log de succès en dev
      if (process.env.NODE_ENV === 'development') {
        console.log(
          `[Application] Query exécutée en ${Math.round(queryDuration)}ms (timeout: ${CONFIG.performance.queryTimeout}ms)`,
        );
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
        queryDuration,
      };
    } finally {
      client.release();
    }
  } catch (error) {
    const queryDuration = performance.now() - startTime;

    // Gestion spécifique des timeouts
    if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
      captureMessage('Application query timeout', {
        level: 'error',
        tags: {
          component: 'single_application_page',
          error_type: 'query_timeout',
        },
        extra: {
          applicationId,
          templateId,
          duration: queryDuration,
          timeout: CONFIG.performance.queryTimeout,
        },
      });

      return {
        application: null,
        template: null,
        relatedApplications: [],
        platforms: [],
        success: false,
        error: 'La requête a pris trop de temps. Veuillez réessayer.',
        isTimeout: true,
      };
    }

    // Autres erreurs DB
    captureException(error, {
      tags: {
        component: 'single_application_page',
        error_type: 'database_error',
      },
      extra: {
        applicationId,
        templateId,
        duration: queryDuration,
        timeout: CONFIG.performance.queryTimeout,
      },
    });

    return {
      application: null,
      template: null,
      relatedApplications: [],
      platforms: [],
      success: false,
      error: error.message,
      isTimeout: false,
    };
  }
}

// Composant principal avec validation UUID robuste
export default async function SingleApplicationPage({ params }) {
  const { id: templateId, appID: appId } = await params;

  // Validation robuste avec UUID
  const validation = validateIds(appId, templateId);
  if (!validation.isValid) {
    // Log de la tentative d'accès avec ID invalide
    captureMessage('Invalid ID format in application page', {
      level: 'info',
      tags: {
        component: 'single_application_page',
        validation: true,
      },
      extra: {
        rawAppId: appId,
        rawTemplateId: templateId,
        validationError: validation.error,
        invalidField: validation.field,
      },
    });

    notFound();
  }

  // Récupérer les données avec gestion d'erreurs et timeout
  const data = await getApplicationData(
    validation.applicationId,
    validation.templateId,
  );

  // Gestion des erreurs et application non trouvée
  if (!data.success) {
    // En production, toujours notFound pour les erreurs
    if (process.env.NODE_ENV === 'production') {
      notFound();
    }

    // En dev, affichage différencié selon le type d'erreur
    return (
      <div className="application-error-fallback">
        <h1>Erreur de chargement de l&apos;application</h1>
        {data.isTimeout ? (
          <div>
            <p>
              ⏱️ La requête a pris trop de temps (timeout:{' '}
              {CONFIG.performance.queryTimeout}ms).
            </p>
            <p>Veuillez rafraîchir la page.</p>
          </div>
        ) : (
          <p>Impossible de charger l&apos;application.</p>
        )}
        {process.env.NODE_ENV === 'development' && (
          <details>
            <summary>Détails de l&apos;erreur (dev)</summary>
            <pre>{data.error}</pre>
            <p>
              <strong>Application ID:</strong> {validation.applicationId}
            </p>
            <p>
              <strong>Template ID:</strong> {validation.templateId}
            </p>
          </details>
        )}
      </div>
    );
  }

  if (!data.application) {
    notFound();
  }

  // Rendu normal avec Suspense
  return (
    <Suspense fallback={<Loading />}>
      <SingleApplication
        application={data.application}
        template={data.template}
        relatedApplications={data.relatedApplications}
        platforms={data.platforms}
        context={{
          templateId: validation.templateId,
          applicationId: validation.applicationId,
        }}
      />
    </Suspense>
  );
}

// Génération dynamique des metadata avec validation UUID et timeout
export async function generateMetadata({ params }) {
  const { id: templateId, appID: appId } = await params;

  // Validation robuste avec UUID
  const validation = validateIds(appId, templateId);
  if (!validation.isValid) {
    return {
      title: 'Application non trouvée - Benew',
      description:
        "L'application demandée n'existe pas ou l'identifiant est invalide.",
      robots: { index: false, follow: false },
    };
  }

  try {
    const client = await getClient();
    try {
      const queryPromise = client.query(
        `SELECT 
          a.application_name,
          a.application_description,
          a.application_category,
          a.application_images,
          t.template_name
        FROM catalog.applications a
        JOIN catalog.templates t ON a.application_template_id = t.template_id
        WHERE a.application_id = $1 
          AND a.application_template_id = $2
          AND a.is_active = true`,
        [validation.applicationId, validation.templateId],
      );

      const result = await withTimeout(
        queryPromise,
        2000, // Timeout plus court pour metadata
        'Metadata query timeout',
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
    // Log mais pas d'exception pour metadata
    captureMessage('Metadata generation failed for application', {
      level: 'warning',
      tags: {
        component: 'single_application_metadata',
        error_type:
          error.name === 'TimeoutError' ? 'timeout' : 'database_error',
      },
      extra: {
        applicationId: validation.applicationId,
        templateId: validation.templateId,
        errorMessage: error.message,
      },
    });
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
export const dynamic = 'force-static';
