// actions/orderActions.js
// Server Actions production-ready pour la gestion des commandes
// Next.js 15 + PostgreSQL + Validation stricte + Sanitization + Monitoring

'use server';

import { getClient } from '@/backend/dbConnect';
import {
  captureDatabaseError,
  captureException,
  captureMessage,
  captureValidationError,
} from '@/instrumentation';
import {
  validateOrderServer,
  prepareOrderDataFromFormData,
  formatValidationErrors,
} from '@/utils/schemas/schema';
import {
  sanitizeOrderData,
  preValidateOrderData,
  validateBusinessRules,
  validateSanitizedDataSafety,
  formatSanitizationErrorsForUser,
  generateSanitizationReport,
  createSecureLogHash,
} from '@/utils/sanitizers/orderSanitizer';
import { invalidateProjectCache } from '@/utils/cache';
import { limitBenewAPI } from '@/backend/rateLimiter';
import { headers } from 'next/headers';

// =============================
// CONFIGURATION PRODUCTION
// =============================

const ORDER_CONFIG = {
  // Rate limiting
  rateLimiting: {
    enabled: true,
    preset: 'ORDER_ACTIONS',
  },

  // Validation
  validation: {
    strictMode: true,
    requireAllFields: true,
    sanitizeInputs: true,
  },

  // Database
  database: {
    timeout: 15000, // 15 secondes pour transactions complexes
    retryAttempts: 2,
    retryDelay: 2000,
  },

  // Performance
  performance: {
    slowQueryThreshold: 3000, // 3 secondes
    alertThreshold: 5000, // 5 secondes
  },

  // Security
  security: {
    logSensitiveData: false,
    hashUserData: true,
    validateForeignKeys: true,
  },
};

// =============================
// FONCTIONS DE VALIDATION BUSINESS
// =============================

/**
 * Vérifie que l'application existe et est active
 * @param {Object} client - Client de base de données
 * @param {string} applicationId - ID de l'application
 * @returns {Promise<Object>} Résultat de validation
 */
async function validateApplicationExists(client, applicationId) {
  try {
    const query = {
      text: `
        SELECT 
          application_id,
          application_name,
          application_fee,
          is_active,
          application_template_id
        FROM catalog.applications 
        WHERE application_id = $1
      `,
      values: [applicationId],
    };

    const result = await client.query(query);

    if (result.rows.length === 0) {
      return {
        valid: false,
        error: 'Application not found',
        code: 'APPLICATION_NOT_FOUND',
      };
    }

    const application = result.rows[0];

    if (!application.is_active) {
      return {
        valid: false,
        error: 'Application is not active',
        code: 'APPLICATION_INACTIVE',
      };
    }

    return {
      valid: true,
      application: {
        id: application.application_id,
        name: application.application_name,
        fee: parseFloat(application.application_fee),
        templateId: application.application_template_id,
      },
    };
  } catch (error) {
    captureDatabaseError(error, {
      table: 'catalog.applications',
      operation: 'validate_application_exists',
      queryType: 'select',
      tags: { component: 'order_actions', validation: 'application_exists' },
      extra: { applicationId },
    });

    return {
      valid: false,
      error: 'Database error while validating application',
      code: 'DATABASE_ERROR',
    };
  }
}

/**
 * Vérifie que la plateforme de paiement existe et est active
 * @param {Object} client - Client de base de données
 * @param {string} platformId - ID de la plateforme
 * @returns {Promise<Object>} Résultat de validation
 */
async function validatePlatformExists(client, platformId) {
  try {
    const query = {
      text: `
        SELECT 
          platform_id,
          platform_name,
          platform_number,
          is_active
        FROM admin.platforms 
        WHERE platform_id = $1
      `,
      values: [platformId],
    };

    const result = await client.query(query);

    if (result.rows.length === 0) {
      return {
        valid: false,
        error: 'Payment platform not found',
        code: 'PLATFORM_NOT_FOUND',
      };
    }

    const platform = result.rows[0];

    if (!platform.is_active) {
      return {
        valid: false,
        error: 'Payment platform is not active',
        code: 'PLATFORM_INACTIVE',
      };
    }

    return {
      valid: true,
      platform: {
        id: platform.platform_id,
        name: platform.platform_name,
        number: platform.platform_number,
      },
    };
  } catch (error) {
    captureDatabaseError(error, {
      table: 'admin.platforms',
      operation: 'validate_platform_exists',
      queryType: 'select',
      tags: { component: 'order_actions', validation: 'platform_exists' },
      extra: { platformId },
    });

    return {
      valid: false,
      error: 'Database error while validating platform',
      code: 'DATABASE_ERROR',
    };
  }
}

/**
 * Vérifie la cohérence entre le montant soumis et le montant de l'application
 * @param {number} submittedFee - Montant soumis
 * @param {number} applicationFee - Montant de l'application
 * @returns {Object} Résultat de validation
 */
function validateApplicationFee(submittedFee, applicationFee) {
  const tolerance = 0.01; // Tolérance de 1 centime pour les arrondis

  if (Math.abs(submittedFee - applicationFee) > tolerance) {
    return {
      valid: false,
      error: 'Price mismatch between submitted and application fee',
      code: 'PRICE_MISMATCH',
      details: {
        submitted: submittedFee,
        expected: applicationFee,
        difference: Math.abs(submittedFee - applicationFee),
      },
    };
  }

  return { valid: true };
}

/**
 * Vérifie qu'il n'y a pas de commande en double récente
 * @param {Object} client - Client de base de données
 * @param {Object} orderData - Données de la commande
 * @returns {Promise<Object>} Résultat de validation
 */
async function validateNoDuplicateOrder(client, orderData) {
  try {
    const query = {
      text: `
        SELECT 
          order_id,
          order_created,
          order_payment_status
        FROM admin.orders 
        WHERE order_client[3] = $1 
          AND order_application_id = $2
          AND order_created > NOW() - INTERVAL '10 minutes'
          AND order_payment_status != 'failed'
        ORDER BY order_created DESC
        LIMIT 1
      `,
      values: [orderData.email, orderData.applicationId],
    };

    const result = await client.query(query);

    if (result.rows.length > 0) {
      const existingOrder = result.rows[0];

      return {
        valid: false,
        error: 'Duplicate order detected',
        code: 'DUPLICATE_ORDER',
        details: {
          existingOrderId: existingOrder.order_id,
          timeSinceLastOrder:
            new Date() - new Date(existingOrder.order_created),
          existingStatus: existingOrder.order_payment_status,
        },
      };
    }

    return { valid: true };
  } catch (error) {
    captureDatabaseError(error, {
      table: 'admin.orders',
      operation: 'validate_no_duplicate_order',
      queryType: 'select',
      tags: { component: 'order_actions', validation: 'duplicate_check' },
      extra: {
        email: orderData.email
          ? `${orderData.email[0]}***@${orderData.email.split('@')[1]}`
          : null,
        applicationId: orderData.applicationId,
      },
    });

    // En cas d'erreur DB pour la vérification, on continue (fail open)
    captureMessage(
      'Duplicate order check failed, proceeding with order creation',
      {
        level: 'warning',
        tags: { component: 'order_actions', issue: 'duplicate_check_failed' },
      },
    );

    return { valid: true };
  }
}

// =============================
// FONCTION PRINCIPALE CREATE ORDER
// =============================

/**
 * Crée une nouvelle commande avec validation complète et sécurité
 * @param {FormData} formData - Données du formulaire
 * @param {string} applicationId - ID de l'application
 * @param {number} applicationFee - Montant de l'application
 * @returns {Promise<Object>} Résultat de création
 */
export async function createOrder(formData, applicationId, applicationFee) {
  const startTime = performance.now();
  let client = null;

  try {
    // 1. Rate Limiting (protection contre l'abus)
    if (ORDER_CONFIG.rateLimiting.enabled) {
      const headersList = headers();
      const rateLimitCheck = await limitBenewAPI('order')({
        headers: headersList,
        url: '/order/create',
        method: 'POST',
      });

      if (rateLimitCheck) {
        return {
          success: false,
          message: 'Trop de tentatives de commande. Veuillez patienter.',
          code: 'RATE_LIMITED',
          retryAfter: 300, // 5 minutes
        };
      }
    }

    // 2. Préparer les données brutes
    const rawData = prepareOrderDataFromFormData(
      formData,
      applicationId,
      applicationFee,
    );

    captureMessage('Order creation started', {
      level: 'info',
      tags: { component: 'order_actions', operation: 'create_order' },
      extra: {
        dataHash: createSecureLogHash(rawData).hash,
        applicationId,
        applicationFee,
      },
    });

    // 3. Pré-validation rapide des données
    const preValidation = preValidateOrderData(rawData);
    if (!preValidation.canProceed) {
      captureValidationError(new Error('Pre-validation failed'), {
        field: 'all',
        form: 'order_creation',
        validationType: 'pre_validation',
        tags: { component: 'order_actions', validation_step: 'pre_check' },
        extra: {
          criticalIssues: preValidation.critical,
          summary: preValidation.summary,
        },
      });

      return {
        success: false,
        message: 'Données invalides détectées. Veuillez vérifier votre saisie.',
        code: 'PRE_VALIDATION_FAILED',
        errors: preValidation.critical,
      };
    }

    // 4. Sanitization complète des données
    const sanitizationResult = sanitizeOrderData(rawData);
    if (!sanitizationResult.success) {
      captureMessage('Order data sanitization failed', {
        level: 'warning',
        tags: { component: 'order_actions', sanitization: 'failed' },
        extra: {
          issues: sanitizationResult.issues?.slice(0, 10),
          summary: sanitizationResult.summary,
          performance: sanitizationResult.performance,
        },
      });

      return {
        success: false,
        message: formatSanitizationErrorsForUser(sanitizationResult.issues),
        code: 'SANITIZATION_FAILED',
        validationError: true,
      };
    }

    const cleanData = sanitizationResult.sanitized;

    // Log du rapport de sanitization
    if (process.env.NODE_ENV !== 'production') {
      console.log(
        `[Order Sanitization] ${generateSanitizationReport(sanitizationResult)}`,
      );
    }

    // 5. Validation Yup stricte
    const yupValidation = await validateOrderServer(cleanData);
    if (!yupValidation.success) {
      captureValidationError(new Error('Yup validation failed'), {
        field: 'multiple',
        form: 'order_creation',
        validationType: 'yup_strict',
        tags: { component: 'order_actions', validation_step: 'yup' },
        extra: {
          errors: yupValidation.errors,
          message: yupValidation.message,
        },
      });

      return {
        success: false,
        message:
          'Validation échouée: ' + formatValidationErrors(yupValidation.errors),
        code: 'YUP_VALIDATION_FAILED',
        errors: yupValidation.errors,
        validationError: true,
      };
    }

    const validatedData = yupValidation.data;

    // 6. Validation des règles métier
    const businessRulesValidation = validateBusinessRules(validatedData);
    if (!businessRulesValidation.valid) {
      captureMessage('Business rules validation failed', {
        level: 'warning',
        tags: { component: 'order_actions', validation: 'business_rules' },
        extra: {
          violations: businessRulesValidation.violations,
          warnings: businessRulesValidation.warnings,
          rulesPassed: businessRulesValidation.rulesPassed,
        },
      });

      return {
        success: false,
        message:
          'Les informations ne respectent pas nos critères de validation.',
        code: 'BUSINESS_RULES_FAILED',
        violations: businessRulesValidation.violations,
      };
    }

    // 7. Vérification de sécurité finale
    const safetyCheck = validateSanitizedDataSafety(validatedData);
    if (!safetyCheck.safe) {
      captureMessage('Sanitized data safety check failed', {
        level: 'error',
        tags: { component: 'order_actions', security: 'safety_check_failed' },
        extra: {
          issues: safetyCheck.issues,
          recommendations: safetyCheck.recommendations,
        },
      });

      return {
        success: false,
        message: 'Erreur de sécurité des données. Veuillez réessayer.',
        code: 'SAFETY_CHECK_FAILED',
      };
    }

    // 8. Connexion à la base de données
    client = await getClient();

    // 9. Démarrer une transaction
    await client.query('BEGIN');

    try {
      // 10. Validation en base : vérifier que l'application existe
      const applicationValidation = await validateApplicationExists(
        client,
        validatedData.applicationId,
      );
      if (!applicationValidation.valid) {
        await client.query('ROLLBACK');

        captureMessage('Application validation failed', {
          level: 'warning',
          tags: {
            component: 'order_actions',
            validation: 'application_exists',
          },
          extra: {
            applicationId: validatedData.applicationId,
            error: applicationValidation.error,
            code: applicationValidation.code,
          },
        });

        return {
          success: false,
          message: "L'application sélectionnée n'est pas disponible.",
          code: applicationValidation.code,
        };
      }

      // 11. Validation en base : vérifier que la plateforme existe
      const platformValidation = await validatePlatformExists(
        client,
        validatedData.paymentMethod,
      );
      if (!platformValidation.valid) {
        await client.query('ROLLBACK');

        captureMessage('Platform validation failed', {
          level: 'warning',
          tags: { component: 'order_actions', validation: 'platform_exists' },
          extra: {
            platformId: validatedData.paymentMethod,
            error: platformValidation.error,
            code: platformValidation.code,
          },
        });

        return {
          success: false,
          message: "La méthode de paiement sélectionnée n'est pas disponible.",
          code: platformValidation.code,
        };
      }

      // 12. Vérifier la cohérence des montants
      const feeValidation = validateApplicationFee(
        validatedData.applicationFee,
        applicationValidation.application.fee,
      );
      if (!feeValidation.valid) {
        await client.query('ROLLBACK');

        captureMessage('Application fee validation failed', {
          level: 'error',
          tags: { component: 'order_actions', validation: 'fee_mismatch' },
          extra: {
            applicationId: validatedData.applicationId,
            ...feeValidation.details,
          },
        });

        return {
          success: false,
          message:
            'Erreur de montant. Veuillez actualiser la page et réessayer.',
          code: feeValidation.code,
        };
      }

      // 13. Vérifier qu'il n'y a pas de commande en double
      const duplicateValidation = await validateNoDuplicateOrder(
        client,
        validatedData,
      );
      if (!duplicateValidation.valid) {
        await client.query('ROLLBACK');

        captureMessage('Duplicate order detected', {
          level: 'warning',
          tags: { component: 'order_actions', validation: 'duplicate_order' },
          extra: {
            applicationId: validatedData.applicationId,
            ...duplicateValidation.details,
          },
        });

        return {
          success: false,
          message:
            'Une commande récente existe déjà pour cette application. Veuillez patienter avant de créer une nouvelle commande.',
          code: duplicateValidation.code,
        };
      }

      // 14. Créer le tableau client info selon la structure de la table
      const clientInfo = [
        validatedData.lastName,
        validatedData.firstName,
        validatedData.email,
        validatedData.phone,
      ];

      // 15. Insérer la commande dans la base de données
      const insertQuery = {
        text: `
          INSERT INTO admin.orders (
            order_client, 
            order_platform_id, 
            order_payment_name, 
            order_payment_number, 
            order_application_id, 
            order_price,
            order_payment_status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7) 
          RETURNING 
            order_id,
            order_created,
            order_payment_status
        `,
        values: [
          clientInfo,
          validatedData.paymentMethod,
          validatedData.accountName,
          validatedData.accountNumber,
          validatedData.applicationId,
          validatedData.applicationFee,
          'unpaid', // Statut par défaut
        ],
      };

      const insertResult = await client.query(insertQuery);
      const newOrder = insertResult.rows[0];

      // 16. Valider que l'insertion a réussi
      if (!newOrder || !newOrder.order_id) {
        await client.query('ROLLBACK');

        captureMessage('Order insertion failed', {
          level: 'error',
          tags: { component: 'order_actions', database: 'insert_failed' },
          extra: {
            applicationId: validatedData.applicationId,
            platformId: validatedData.paymentMethod,
          },
        });

        return {
          success: false,
          message:
            'Erreur lors de la création de la commande. Veuillez réessayer.',
          code: 'INSERT_FAILED',
        };
      }

      // 17. Confirmer la transaction
      await client.query('COMMIT');

      const duration = performance.now() - startTime;

      // 18. Invalider les caches pertinents
      try {
        invalidateProjectCache('order');
        // Optionnel: invalider le cache de l'application pour mettre à jour les statistiques
        invalidateProjectCache('application', validatedData.applicationId);
      } catch (cacheError) {
        // Log l'erreur mais ne pas faire échouer la commande
        captureException(cacheError, {
          tags: { component: 'order_actions', operation: 'cache_invalidation' },
          extra: { orderId: newOrder.order_id },
        });
      }

      // 19. Log de succès
      captureMessage('Order created successfully', {
        level: 'info',
        tags: { component: 'order_actions', operation: 'create_order_success' },
        extra: {
          orderId: newOrder.order_id,
          applicationId: validatedData.applicationId,
          applicationName: applicationValidation.application.name,
          platformName: platformValidation.platform.name,
          orderAmount: validatedData.applicationFee,
          duration,
          dataHash: createSecureLogHash(validatedData).hash,
          sanitizationReport: generateSanitizationReport(sanitizationResult),
        },
      });

      // 20. Log de performance si lent
      if (duration > ORDER_CONFIG.performance.slowQueryThreshold) {
        captureMessage('Slow order creation detected', {
          level:
            duration > ORDER_CONFIG.performance.alertThreshold
              ? 'error'
              : 'warning',
          tags: { component: 'order_actions', performance: 'slow_operation' },
          extra: {
            orderId: newOrder.order_id,
            duration,
            threshold: ORDER_CONFIG.performance.slowQueryThreshold,
          },
        });
      }

      // 21. Retourner le succès
      return {
        success: true,
        message: 'Commande créée avec succès',
        orderId: newOrder.order_id,
        orderDetails: {
          id: newOrder.order_id,
          status: newOrder.order_payment_status,
          created: newOrder.order_created,
          applicationName: applicationValidation.application.name,
          amount: validatedData.applicationFee,
          platform: platformValidation.platform.name,
        },
        performance: {
          duration,
          grade:
            duration < 1000 ? 'excellent' : duration < 3000 ? 'good' : 'slow',
        },
      };
    } catch (transactionError) {
      // Rollback en cas d'erreur dans la transaction
      await client.query('ROLLBACK');
      throw transactionError;
    }
  } catch (error) {
    const duration = performance.now() - startTime;

    // Catégoriser l'erreur selon son type
    let errorCategory = 'unknown';
    let errorLevel = 'error';

    if (/postgres|pg|database|db|connection/i.test(error.message)) {
      errorCategory = 'database';
      captureDatabaseError(error, {
        table: 'admin.orders',
        operation: 'create_order',
        queryType: 'insert_transaction',
        tags: { component: 'order_actions' },
        extra: {
          duration,
          applicationId,
          applicationFee,
        },
      });
    } else if (error.name === 'ValidationError' || error.validationError) {
      errorCategory = 'validation';
      errorLevel = 'warning';
      captureValidationError(error, {
        field: 'order_creation',
        form: 'order',
        validationType: 'server_action',
        tags: { component: 'order_actions' },
        extra: { duration },
      });
    } else {
      captureException(error, {
        tags: {
          component: 'order_actions',
          operation: 'create_order',
          error_category: errorCategory,
        },
        extra: {
          duration,
          applicationId,
          applicationFee,
        },
      });
    }

    // Message d'erreur selon la catégorie
    let userMessage =
      'Une erreur est survenue lors de la création de votre commande.';

    if (errorCategory === 'database') {
      userMessage =
        'Problème de connexion. Veuillez réessayer dans quelques instants.';
    } else if (errorCategory === 'validation') {
      userMessage =
        'Erreur de validation des données. Veuillez vérifier votre saisie.';
    }

    return {
      success: false,
      message: userMessage,
      code: `${errorCategory.toUpperCase()}_ERROR`,
      error: process.env.NODE_ENV === 'production' ? undefined : error.message,
      performance: {
        duration,
        grade: 'error',
      },
    };
  } finally {
    // Toujours libérer la connexion
    if (client) {
      try {
        await client.release();
      } catch (releaseError) {
        captureException(releaseError, {
          tags: { component: 'order_actions', operation: 'client_release' },
        });
      }
    }
  }
}

// =============================
// FONCTION ALTERNATIVE POUR OBJETS
// =============================

/**
 * Crée une commande à partir d'un objet de données (alternative à FormData)
 * @param {Object} data - Données de la commande
 * @returns {Promise<Object>} Résultat de création
 */
export async function createOrderFromObject(data) {
  try {
    // Convertir l'objet en FormData pour réutiliser la logique existante
    const formData = new FormData();

    const fieldMapping = {
      lastName: 'lastName',
      firstName: 'firstName',
      email: 'email',
      phone: 'phone',
      paymentMethod: 'paymentMethod',
      accountName: 'accountName',
      accountNumber: 'accountNumber',
    };

    Object.entries(fieldMapping).forEach(([key, formKey]) => {
      if (data[key] !== undefined && data[key] !== null) {
        formData.append(formKey, String(data[key]));
      }
    });

    // Appeler la fonction principale
    return await createOrder(formData, data.applicationId, data.applicationFee);
  } catch (error) {
    captureException(error, {
      tags: {
        component: 'order_actions',
        operation: 'create_order_from_object',
      },
      extra: {
        dataKeys: data ? Object.keys(data) : [],
      },
    });

    return {
      success: false,
      message: 'Erreur lors du traitement des données de commande.',
      code: 'OBJECT_CONVERSION_ERROR',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message,
    };
  }
}

// =============================
// FONCTIONS UTILITAIRES
// =============================

/**
 * Récupère les détails d'une commande par son ID
 * @param {string} orderId - ID de la commande
 * @returns {Promise<Object>} Détails de la commande
 */
export async function getOrderDetails(orderId) {
  let client = null;

  try {
    // Validation de l'ID
    if (!orderId || typeof orderId !== 'string' || orderId.length !== 36) {
      return {
        success: false,
        message: 'ID de commande invalide',
        code: 'INVALID_ORDER_ID',
      };
    }

    client = await getClient();

    const query = {
      text: `
        SELECT 
          o.order_id,
          o.order_client,
          o.order_price,
          o.order_payment_status,
          o.order_created,
          o.order_updated,
          o.order_paid_at,
          o.order_cancelled_at,
          o.order_cancel_reason,
          a.application_name,
          a.application_id,
          p.platform_name
        FROM admin.orders o
        JOIN catalog.applications a ON o.order_application_id = a.application_id
        JOIN admin.platforms p ON o.order_platform_id = p.platform_id
        WHERE o.order_id = $1
      `,
      values: [orderId],
    };

    const result = await client.query(query);

    if (result.rows.length === 0) {
      return {
        success: false,
        message: 'Commande non trouvée',
        code: 'ORDER_NOT_FOUND',
      };
    }

    const order = result.rows[0];

    return {
      success: true,
      order: {
        id: order.order_id,
        client: {
          lastName: order.order_client[0],
          firstName: order.order_client[1],
          email: order.order_client[2],
          phone: order.order_client[3],
        },
        application: {
          id: order.application_id,
          name: order.application_name,
        },
        platform: order.platform_name,
        amount: parseFloat(order.order_price),
        status: order.order_payment_status,
        dates: {
          created: order.order_created,
          updated: order.order_updated,
          paid: order.order_paid_at,
          cancelled: order.order_cancelled_at,
        },
        cancelReason: order.order_cancel_reason,
      },
    };
  } catch (error) {
    captureDatabaseError(error, {
      table: 'admin.orders',
      operation: 'get_order_details',
      queryType: 'select_join',
      tags: { component: 'order_actions' },
      extra: { orderId },
    });

    return {
      success: false,
      message: 'Erreur lors de la récupération des détails de la commande',
      code: 'DATABASE_ERROR',
    };
  } finally {
    if (client) {
      await client.release();
    }
  }
}

/**
 * Invalide le cache des commandes
 * @param {string} orderId - ID spécifique de la commande (optionnel)
 * @returns {Object} Résultat d'invalidation
 */
export async function invalidateOrderCache(orderId = null) {
  try {
    const invalidatedCount = invalidateProjectCache('order', orderId);

    captureMessage('Order cache invalidated', {
      level: 'info',
      tags: { component: 'order_actions', operation: 'cache_invalidation' },
      extra: {
        orderId,
        invalidatedCount,
        timestamp: new Date().toISOString(),
      },
    });

    return {
      success: true,
      invalidatedCount,
      orderId,
    };
  } catch (error) {
    captureException(error, {
      tags: {
        component: 'order_actions',
        operation: 'cache_invalidation_error',
      },
      extra: { orderId },
    });

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Met à jour le statut de paiement d'une commande
 * @param {string} orderId - ID de la commande
 * @param {string} newStatus - Nouveau statut ('paid', 'failed', 'refunded')
 * @param {string} reason - Raison du changement (optionnel)
 * @returns {Promise<Object>} Résultat de mise à jour
 */
export async function updateOrderPaymentStatus(
  orderId,
  newStatus,
  reason = null,
) {
  let client = null;

  try {
    // Validation des paramètres
    if (!orderId || typeof orderId !== 'string') {
      return {
        success: false,
        message: 'ID de commande invalide',
        code: 'INVALID_ORDER_ID',
      };
    }

    const validStatuses = ['paid', 'failed', 'refunded', 'unpaid'];
    if (!validStatuses.includes(newStatus)) {
      return {
        success: false,
        message: 'Statut de paiement invalide',
        code: 'INVALID_STATUS',
      };
    }

    client = await getClient();
    await client.query('BEGIN');

    try {
      // Vérifier que la commande existe
      const checkQuery = {
        text: 'SELECT order_id, order_payment_status FROM admin.orders WHERE order_id = $1',
        values: [orderId],
      };

      const checkResult = await client.query(checkQuery);

      if (checkResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          message: 'Commande non trouvée',
          code: 'ORDER_NOT_FOUND',
        };
      }

      const currentStatus = checkResult.rows[0].order_payment_status;

      // Préparer les champs à mettre à jour selon le statut
      let updateFields = ['order_payment_status = $2', 'order_updated = NOW()'];
      let queryValues = [orderId, newStatus];
      let valueIndex = 3;

      // Ajouter des timestamps spécifiques selon le statut
      if (newStatus === 'paid' && currentStatus !== 'paid') {
        updateFields.push(`order_paid_at = NOW()`);
      }

      if (newStatus === 'failed' && reason) {
        updateFields.push(`order_cancel_reason = ${valueIndex}`);
        queryValues.push(reason);
        valueIndex++;
      }

      if (
        (newStatus === 'failed' || newStatus === 'refunded') &&
        currentStatus !== newStatus
      ) {
        updateFields.push(`order_cancelled_at = NOW()`);
        if (
          reason &&
          !updateFields.some((f) => f.includes('order_cancel_reason'))
        ) {
          updateFields.push(`order_cancel_reason = ${valueIndex}`);
          queryValues.push(reason);
        }
      }

      // Construire et exécuter la requête de mise à jour
      const updateQuery = {
        text: `
          UPDATE admin.orders 
          SET ${updateFields.join(', ')}
          WHERE order_id = $1
          RETURNING 
            order_id,
            order_payment_status,
            order_updated,
            order_paid_at,
            order_cancelled_at,
            order_cancel_reason
        `,
        values: queryValues,
      };

      const updateResult = await client.query(updateQuery);
      const updatedOrder = updateResult.rows[0];

      await client.query('COMMIT');

      // Invalider le cache
      await invalidateOrderCache(orderId);

      captureMessage('Order payment status updated', {
        level: 'info',
        tags: {
          component: 'order_actions',
          operation: 'update_payment_status',
        },
        extra: {
          orderId,
          oldStatus: currentStatus,
          newStatus,
          reason,
          hasTimestamp:
            newStatus === 'paid'
              ? !!updatedOrder.order_paid_at
              : !!updatedOrder.order_cancelled_at,
        },
      });

      return {
        success: true,
        message: 'Statut de paiement mis à jour avec succès',
        order: {
          id: updatedOrder.order_id,
          status: updatedOrder.order_payment_status,
          updated: updatedOrder.order_updated,
          paidAt: updatedOrder.order_paid_at,
          cancelledAt: updatedOrder.order_cancelled_at,
          cancelReason: updatedOrder.order_cancel_reason,
        },
        statusChange: {
          from: currentStatus,
          to: newStatus,
        },
      };
    } catch (transactionError) {
      await client.query('ROLLBACK');
      throw transactionError;
    }
  } catch (error) {
    captureDatabaseError(error, {
      table: 'admin.orders',
      operation: 'update_payment_status',
      queryType: 'update',
      tags: { component: 'order_actions' },
      extra: { orderId, newStatus, reason },
    });

    return {
      success: false,
      message: 'Erreur lors de la mise à jour du statut de paiement',
      code: 'DATABASE_ERROR',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message,
    };
  } finally {
    if (client) {
      await client.release();
    }
  }
}

/**
 * Récupère les statistiques des commandes
 * @param {Object} filters - Filtres optionnels (période, statut, etc.)
 * @returns {Promise<Object>} Statistiques des commandes
 */
export async function getOrderStatistics(filters = {}) {
  let client = null;

  try {
    client = await getClient();

    // Construire la clause WHERE selon les filtres
    let whereClause = '1 = 1';
    let queryValues = [];
    let valueIndex = 1;

    if (filters.startDate) {
      whereClause += ` AND order_created >= ${valueIndex}`;
      queryValues.push(filters.startDate);
      valueIndex++;
    }

    if (filters.endDate) {
      whereClause += ` AND order_created <= ${valueIndex}`;
      queryValues.push(filters.endDate);
      valueIndex++;
    }

    if (filters.status) {
      whereClause += ` AND order_payment_status = ${valueIndex}`;
      queryValues.push(filters.status);
      valueIndex++;
    }

    if (filters.applicationId) {
      whereClause += ` AND order_application_id = ${valueIndex}`;
      queryValues.push(filters.applicationId);
      valueIndex++;
    }

    const statsQuery = {
      text: `
        SELECT 
          COUNT(*) as total_orders,
          COUNT(*) FILTER (WHERE order_payment_status = 'paid') as paid_orders,
          COUNT(*) FILTER (WHERE order_payment_status = 'unpaid') as unpaid_orders,
          COUNT(*) FILTER (WHERE order_payment_status = 'failed') as failed_orders,
          COUNT(*) FILTER (WHERE order_payment_status = 'refunded') as refunded_orders,
          SUM(order_price) as total_amount,
          SUM(order_price) FILTER (WHERE order_payment_status = 'paid') as paid_amount,
          AVG(order_price) as average_order_value,
          COUNT(*) FILTER (WHERE order_created > NOW() - INTERVAL '24 hours') as orders_last_24h,
          COUNT(*) FILTER (WHERE order_created > NOW() - INTERVAL '7 days') as orders_last_7_days,
          COUNT(*) FILTER (WHERE order_created > NOW() - INTERVAL '30 days') as orders_last_30_days,
          MIN(order_created) as first_order_date,
          MAX(order_created) as last_order_date
        FROM admin.orders 
        WHERE ${whereClause}
      `,
      values: queryValues,
    };

    const statsResult = await client.query(statsQuery);
    const stats = statsResult.rows[0];

    // Calculer des métriques dérivées
    const totalOrders = parseInt(stats.total_orders);
    const paidOrders = parseInt(stats.paid_orders);
    const totalAmount = parseFloat(stats.total_amount) || 0;
    const paidAmount = parseFloat(stats.paid_amount) || 0;

    const conversionRate =
      totalOrders > 0 ? (paidOrders / totalOrders) * 100 : 0;
    const averageOrderValue = parseFloat(stats.average_order_value) || 0;

    return {
      success: true,
      statistics: {
        orders: {
          total: totalOrders,
          paid: paidOrders,
          unpaid: parseInt(stats.unpaid_orders),
          failed: parseInt(stats.failed_orders),
          refunded: parseInt(stats.refunded_orders),
        },
        amounts: {
          total: totalAmount,
          paid: paidAmount,
          average: averageOrderValue,
          currency: 'EUR', // Assuming EUR based on your context
        },
        conversion: {
          rate: Math.round(conversionRate * 100) / 100,
          percentage: `${Math.round(conversionRate * 100) / 100}%`,
        },
        timeline: {
          last24Hours: parseInt(stats.orders_last_24h),
          last7Days: parseInt(stats.orders_last_7_days),
          last30Days: parseInt(stats.orders_last_30_days),
        },
        dateRange: {
          firstOrder: stats.first_order_date,
          lastOrder: stats.last_order_date,
        },
        filters: filters,
        generatedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    captureDatabaseError(error, {
      table: 'admin.orders',
      operation: 'get_order_statistics',
      queryType: 'select_aggregate',
      tags: { component: 'order_actions' },
      extra: { filters },
    });

    return {
      success: false,
      message: 'Erreur lors de la récupération des statistiques',
      code: 'DATABASE_ERROR',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message,
    };
  } finally {
    if (client) {
      await client.release();
    }
  }
}

/**
 * Recherche des commandes avec filtres avancés
 * @param {Object} searchParams - Paramètres de recherche
 * @returns {Promise<Object>} Résultats de recherche
 */
export async function searchOrders(searchParams = {}) {
  let client = null;

  try {
    const {
      email,
      applicationId,
      status,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      limit = 50,
      offset = 0,
      orderBy = 'order_created',
      orderDirection = 'DESC',
    } = searchParams;

    client = await getClient();

    // Construire la requête avec filtres
    let whereConditions = [];
    let queryValues = [];
    let valueIndex = 1;

    if (email) {
      whereConditions.push(`order_client[3] ILIKE ${valueIndex}`);
      queryValues.push(`%${email}%`);
      valueIndex++;
    }

    if (applicationId) {
      whereConditions.push(`order_application_id = ${valueIndex}`);
      queryValues.push(applicationId);
      valueIndex++;
    }

    if (status) {
      whereConditions.push(`order_payment_status = ${valueIndex}`);
      queryValues.push(status);
      valueIndex++;
    }

    if (startDate) {
      whereConditions.push(`order_created >= ${valueIndex}`);
      queryValues.push(startDate);
      valueIndex++;
    }

    if (endDate) {
      whereConditions.push(`order_created <= ${valueIndex}`);
      queryValues.push(endDate);
      valueIndex++;
    }

    if (minAmount) {
      whereConditions.push(`order_price >= ${valueIndex}`);
      queryValues.push(minAmount);
      valueIndex++;
    }

    if (maxAmount) {
      whereConditions.push(`order_price <= ${valueIndex}`);
      queryValues.push(maxAmount);
      valueIndex++;
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

    // Validation de l'ordre
    const validOrderBy = [
      'order_created',
      'order_updated',
      'order_price',
      'order_payment_status',
    ];
    const validDirection = ['ASC', 'DESC'];

    const safeOrderBy = validOrderBy.includes(orderBy)
      ? orderBy
      : 'order_created';
    const safeDirection = validDirection.includes(orderDirection.toUpperCase())
      ? orderDirection.toUpperCase()
      : 'DESC';

    // Ajouter limit et offset
    queryValues.push(Math.min(limit, 100)); // Max 100 résultats
    queryValues.push(Math.max(offset, 0));
    const limitClause = `LIMIT ${valueIndex} OFFSET ${valueIndex + 1}`;

    const searchQuery = {
      text: `
        SELECT 
          o.order_id,
          o.order_client,
          o.order_price,
          o.order_payment_status,
          o.order_created,
          o.order_updated,
          o.order_paid_at,
          a.application_name,
          a.application_id,
          p.platform_name
        FROM admin.orders o
        JOIN catalog.applications a ON o.order_application_id = a.application_id
        JOIN admin.platforms p ON o.order_platform_id = p.platform_id
        ${whereClause}
        ORDER BY o.${safeOrderBy} ${safeDirection}
        ${limitClause}
      `,
      values: queryValues,
    };

    // Compter le total pour la pagination
    const countQuery = {
      text: `
        SELECT COUNT(*) as total
        FROM admin.orders o
        ${whereClause}
      `,
      values: queryValues.slice(0, -2), // Exclure limit et offset
    };

    const [searchResult, countResult] = await Promise.all([
      client.query(searchQuery),
      client.query(countQuery),
    ]);

    const orders = searchResult.rows.map((row) => ({
      id: row.order_id,
      client: {
        lastName: row.order_client[0],
        firstName: row.order_client[1],
        email: row.order_client[2],
        phone: row.order_client[3],
      },
      application: {
        id: row.application_id,
        name: row.application_name,
      },
      platform: row.platform_name,
      amount: parseFloat(row.order_price),
      status: row.order_payment_status,
      dates: {
        created: row.order_created,
        updated: row.order_updated,
        paid: row.order_paid_at,
      },
    }));

    const total = parseInt(countResult.rows[0].total);

    return {
      success: true,
      orders,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
        page: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(total / limit),
      },
      searchParams,
    };
  } catch (error) {
    captureDatabaseError(error, {
      table: 'admin.orders',
      operation: 'search_orders',
      queryType: 'select_search',
      tags: { component: 'order_actions' },
      extra: { searchParams },
    });

    return {
      success: false,
      message: 'Erreur lors de la recherche des commandes',
      code: 'DATABASE_ERROR',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message,
    };
  } finally {
    if (client) {
      await client.release();
    }
  }
}

// =============================
// FONCTIONS DE MONITORING
// =============================

/**
 * Obtient les métriques de performance des commandes
 * @returns {Promise<Object>} Métriques de performance
 */
export async function getOrderPerformanceMetrics() {
  if (process.env.NODE_ENV === 'production') {
    return {
      success: false,
      message: 'Performance metrics not available in production',
    };
  }

  try {
    // Simulation des métriques de performance
    const metrics = {
      orderCreation: {
        averageTime: Math.random() * 2000 + 500, // 0.5-2.5s
        successRate: 95 + Math.random() * 5, // 95-100%
        failureReasons: {
          validation: Math.floor(Math.random() * 10),
          database: Math.floor(Math.random() * 5),
          network: Math.floor(Math.random() * 3),
        },
      },
      cache: {
        hitRate: 80 + Math.random() * 20, // 80-100%
        invalidations: Math.floor(Math.random() * 50),
      },
      database: {
        connectionPoolUsage: Math.random() * 80, // 0-80%
        averageQueryTime: Math.random() * 100 + 10, // 10-110ms
      },
      validation: {
        sanitizationTime: Math.random() * 50 + 5, // 5-55ms
        yupValidationTime: Math.random() * 30 + 10, // 10-40ms
        businessRulesTime: Math.random() * 20 + 5, // 5-25ms
      },
      timestamp: new Date().toISOString(),
    };

    return {
      success: true,
      metrics,
    };
  } catch (error) {
    captureException(error, {
      tags: { component: 'order_actions', operation: 'performance_metrics' },
    });

    return {
      success: false,
      message: 'Erreur lors de la récupération des métriques',
      error: error.message,
    };
  }
}
