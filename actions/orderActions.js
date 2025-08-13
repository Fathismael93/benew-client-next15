'use server';

import { getClient } from '@/backend/dbConnect';
import {
  captureDatabaseError,
  captureException,
  captureMessage,
} from '../instrumentation';
import {
  validateOrderServer,
  prepareOrderDataFromFormData,
  formatValidationErrors,
} from '@/utils/schemas/schema';
import {
  sanitizeOrderData,
  validateBusinessRules,
  validateSanitizedDataSafety,
} from '@/utils/sanitizers/orderSanitizer';
import { limitBenewAPI } from '@/backend/rateLimiter';
import { headers } from 'next/headers';

const ORDER_CONFIG = {
  rateLimiting: { enabled: true, preset: 'ORDER_ACTIONS' },
  database: { timeout: 15000, retryAttempts: 2 },
  performance: { slowQueryThreshold: 3000, alertThreshold: 5000 },
};

// Validation consolidée des entités
async function validateEntityExists(client, table, field, value, entityName) {
  const query = {
    text: `SELECT * FROM ${table} WHERE ${field} = $1 AND is_active = true`,
    values: [value],
  };

  try {
    const result = await client.query(query);
    return result.rows.length > 0
      ? { valid: true, entity: result.rows[0] }
      : { valid: false, code: `${entityName.toUpperCase()}_NOT_FOUND` };
  } catch (error) {
    captureDatabaseError(error, { table, operation: `validate_${entityName}` });
    return { valid: false, code: 'DATABASE_ERROR' };
  }
}

// Validation métier consolidée
async function validateBusinessLogic(client, orderData) {
  const [appValidation, platformValidation] = await Promise.all([
    validateEntityExists(
      client,
      'catalog.applications',
      'application_id',
      orderData.applicationId,
      'application',
    ),
    validateEntityExists(
      client,
      'admin.platforms',
      'platform_id',
      orderData.paymentMethod,
      'platform',
    ),
  ]);

  if (!appValidation.valid) return appValidation;
  if (!platformValidation.valid) return platformValidation;

  // Validation montant
  const expectedFee = parseFloat(appValidation.entity.application_fee);
  if (Math.abs(orderData.applicationFee - expectedFee) > 0.01) {
    return { valid: false, code: 'PRICE_MISMATCH' };
  }

  // Validation doublons
  try {
    const duplicateCheck = await client.query(
      `SELECT order_id FROM admin.orders 
       WHERE order_client[3] = $1 AND order_application_id = $2 
       AND order_created > NOW() - INTERVAL '10 minutes' 
       AND order_payment_status != 'failed'`,
      [orderData.email, orderData.applicationId],
    );

    if (duplicateCheck.rows.length > 0) {
      return { valid: false, code: 'DUPLICATE_ORDER' };
    }
  } catch (error) {
    // Fail open pour les doublons
    captureException(error, {
      tags: { component: 'order_actions', operation: 'duplicate_check' },
    });
  }

  return {
    valid: true,
    application: appValidation.entity,
    platform: platformValidation.entity,
  };
}

export async function createOrder(formData, applicationId, applicationFee) {
  const startTime = performance.now();
  let client = null;

  try {
    // Rate Limiting
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
          retryAfter: 300,
        };
      }
    }

    // Préparer et valider les données
    const rawData = prepareOrderDataFromFormData(
      formData,
      applicationId,
      applicationFee,
    );

    const sanitizationResult = sanitizeOrderData(rawData);
    if (!sanitizationResult.success) {
      return {
        success: false,
        message: 'Données invalides détectées. Veuillez vérifier votre saisie.',
        code: 'SANITIZATION_FAILED',
        validationError: true,
      };
    }

    const yupValidation = await validateOrderServer(
      sanitizationResult.sanitized,
    );
    if (!yupValidation.success) {
      return {
        success: false,
        message:
          'Validation échouée: ' + formatValidationErrors(yupValidation.errors),
        code: 'YUP_VALIDATION_FAILED',
        errors: yupValidation.errors,
        validationError: true,
      };
    }

    const businessRulesValidation = validateBusinessRules(yupValidation.data);
    if (!businessRulesValidation.valid) {
      return {
        success: false,
        message:
          'Les informations ne respectent pas nos critères de validation.',
        code: 'BUSINESS_RULES_FAILED',
        violations: businessRulesValidation.violations,
      };
    }

    const safetyCheck = validateSanitizedDataSafety(yupValidation.data);
    if (!safetyCheck.safe) {
      captureMessage('Sanitized data safety check failed', {
        level: 'error',
        tags: { component: 'order_actions' },
      });
      return {
        success: false,
        message: 'Erreur de sécurité des données. Veuillez réessayer.',
        code: 'SAFETY_CHECK_FAILED',
      };
    }

    // Transaction de base de données
    client = await getClient();
    await client.query('BEGIN');

    try {
      const businessValidation = await validateBusinessLogic(
        client,
        yupValidation.data,
      );
      if (!businessValidation.valid) {
        await client.query('ROLLBACK');

        const messages = {
          APPLICATION_NOT_FOUND:
            "L'application sélectionnée n'est pas disponible.",
          PLATFORM_NOT_FOUND:
            "La méthode de paiement sélectionnée n'est pas disponible.",
          PRICE_MISMATCH:
            'Erreur de montant. Veuillez actualiser la page et réessayer.',
          DUPLICATE_ORDER:
            'Une commande récente existe déjà pour cette application.',
        };

        return {
          success: false,
          message: messages[businessValidation.code] || 'Erreur de validation.',
          code: businessValidation.code,
        };
      }

      // Insertion de la commande
      const clientInfo = [
        yupValidation.data.lastName,
        yupValidation.data.firstName,
        yupValidation.data.email,
        yupValidation.data.phone,
      ];

      const insertQuery = {
        text: `INSERT INTO admin.orders (
          order_client, order_platform_id, order_payment_name, 
          order_payment_number, order_application_id, order_price, order_payment_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7) 
        RETURNING order_id, order_created, order_payment_status`,
        values: [
          clientInfo,
          yupValidation.data.paymentMethod,
          yupValidation.data.accountName,
          yupValidation.data.accountNumber,
          yupValidation.data.applicationId,
          yupValidation.data.applicationFee,
          'unpaid',
        ],
      };

      const insertResult = await client.query(insertQuery);
      const newOrder = insertResult.rows[0];

      if (!newOrder?.order_id) {
        await client.query('ROLLBACK');
        return {
          success: false,
          message:
            'Erreur lors de la création de la commande. Veuillez réessayer.',
          code: 'INSERT_FAILED',
        };
      }

      await client.query('COMMIT');

      const duration = performance.now() - startTime;

      // Log seulement si opération lente
      if (duration > ORDER_CONFIG.performance.slowQueryThreshold) {
        captureMessage('Slow order creation detected', {
          level:
            duration > ORDER_CONFIG.performance.alertThreshold
              ? 'error'
              : 'warning',
          tags: { component: 'order_actions', performance: 'slow_operation' },
          extra: { orderId: newOrder.order_id, duration },
        });
      }

      return {
        success: true,
        message: 'Commande créée avec succès',
        orderId: newOrder.order_id,
        orderDetails: {
          id: newOrder.order_id,
          status: newOrder.order_payment_status,
          created: newOrder.order_created,
          applicationName: businessValidation.application.application_name,
          amount: yupValidation.data.applicationFee,
          platform: businessValidation.platform.platform_name,
        },
        performance: {
          duration,
          grade:
            duration < 1000 ? 'excellent' : duration < 3000 ? 'good' : 'slow',
        },
      };
    } catch (transactionError) {
      await client.query('ROLLBACK');
      throw transactionError;
    }
  } catch (error) {
    const duration = performance.now() - startTime;

    // Catégorisation et capture d'erreur
    if (/postgres|pg|database|db|connection/i.test(error.message)) {
      captureDatabaseError(error, {
        table: 'admin.orders',
        operation: 'create_order',
        tags: { component: 'order_actions' },
        extra: { duration, applicationId, applicationFee },
      });
    } else if (error.name === 'ValidationError') {
      captureMessage('Order validation error', {
        level: 'warning',
        tags: { component: 'order_actions', error_type: 'validation' },
        extra: { duration },
      });
    } else {
      captureException(error, {
        tags: { component: 'order_actions', operation: 'create_order' },
        extra: { duration, applicationId, applicationFee },
      });
    }

    const errorMessages = {
      database:
        'Problème de connexion. Veuillez réessayer dans quelques instants.',
      validation:
        'Erreur de validation des données. Veuillez vérifier votre saisie.',
      default: 'Une erreur est survenue lors de la création de votre commande.',
    };

    const errorCategory = /postgres|pg|database|db|connection/i.test(
      error.message,
    )
      ? 'database'
      : error.name === 'ValidationError'
        ? 'validation'
        : 'default';

    return {
      success: false,
      message: errorMessages[errorCategory],
      code: `${errorCategory.toUpperCase()}_ERROR`,
      error: process.env.NODE_ENV === 'production' ? undefined : error.message,
      performance: { duration, grade: 'error' },
    };
  } finally {
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

export async function createOrderFromObject(data) {
  try {
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

    return await createOrder(formData, data.applicationId, data.applicationFee);
  } catch (error) {
    captureException(error, {
      tags: {
        component: 'order_actions',
        operation: 'create_order_from_object',
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
