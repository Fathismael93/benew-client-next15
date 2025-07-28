'use server';

import { getClient } from '@/backend/dbConnect';
import {
  captureDatabaseError,
  captureException,
  captureMessage,
} from '@/instrumentation';
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
import { invalidateProjectCache } from '@/utils/cache';
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

      // Invalidation cache
      try {
        invalidateProjectCache('order');
        invalidateProjectCache('application', yupValidation.data.applicationId);
      } catch (cacheError) {
        captureException(cacheError, {
          tags: { component: 'order_actions', operation: 'cache_invalidation' },
        });
      }

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

export async function getOrderDetails(orderId) {
  let client = null;

  try {
    if (!orderId || typeof orderId !== 'string' || orderId.length !== 36) {
      return {
        success: false,
        message: 'ID de commande invalide',
        code: 'INVALID_ORDER_ID',
      };
    }

    client = await getClient();

    const query = {
      text: `SELECT 
        o.order_id, o.order_client, o.order_price, o.order_payment_status,
        o.order_created, o.order_updated, o.order_paid_at, o.order_cancelled_at,
        o.order_cancel_reason, a.application_name, a.application_id, p.platform_name
      FROM admin.orders o
      JOIN catalog.applications a ON o.order_application_id = a.application_id
      JOIN admin.platforms p ON o.order_platform_id = p.platform_id
      WHERE o.order_id = $1`,
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

export async function updateOrderPaymentStatus(
  orderId,
  newStatus,
  reason = null,
) {
  let client = null;

  try {
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
      const checkResult = await client.query(
        'SELECT order_id, order_payment_status FROM admin.orders WHERE order_id = $1',
        [orderId],
      );

      if (checkResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          message: 'Commande non trouvée',
          code: 'ORDER_NOT_FOUND',
        };
      }

      const currentStatus = checkResult.rows[0].order_payment_status;

      let updateFields = ['order_payment_status = $2', 'order_updated = NOW()'];
      let queryValues = [orderId, newStatus];
      let valueIndex = 3;

      if (newStatus === 'paid' && currentStatus !== 'paid') {
        updateFields.push('order_paid_at = NOW()');
      }

      if (newStatus === 'failed' && reason) {
        updateFields.push(`order_cancel_reason = $${valueIndex}`);
        queryValues.push(reason);
        valueIndex++;
      }

      if (
        (newStatus === 'failed' || newStatus === 'refunded') &&
        currentStatus !== newStatus
      ) {
        updateFields.push('order_cancelled_at = NOW()');
        if (
          reason &&
          !updateFields.some((f) => f.includes('order_cancel_reason'))
        ) {
          updateFields.push(`order_cancel_reason = $${valueIndex}`);
          queryValues.push(reason);
        }
      }

      const updateQuery = {
        text: `UPDATE admin.orders 
               SET ${updateFields.join(', ')}
               WHERE order_id = $1
               RETURNING order_id, order_payment_status, order_updated, 
                        order_paid_at, order_cancelled_at, order_cancel_reason`,
        values: queryValues,
      };

      const updateResult = await client.query(updateQuery);
      const updatedOrder = updateResult.rows[0];

      await client.query('COMMIT');

      // Invalidation cache
      try {
        invalidateProjectCache('order', orderId);
      } catch (cacheError) {
        captureException(cacheError, {
          tags: { component: 'order_actions', operation: 'cache_invalidation' },
        });
      }

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
        statusChange: { from: currentStatus, to: newStatus },
      };
    } catch (transactionError) {
      await client.query('ROLLBACK');
      throw transactionError;
    }
  } catch (error) {
    captureDatabaseError(error, {
      table: 'admin.orders',
      operation: 'update_payment_status',
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

export async function getOrderStatistics(filters = {}) {
  let client = null;

  try {
    client = await getClient();

    let whereClause = '1 = 1';
    let queryValues = [];
    let valueIndex = 1;

    if (filters.startDate) {
      whereClause += ` AND order_created >= $${valueIndex}`;
      queryValues.push(filters.startDate);
      valueIndex++;
    }

    if (filters.endDate) {
      whereClause += ` AND order_created <= $${valueIndex}`;
      queryValues.push(filters.endDate);
      valueIndex++;
    }

    if (filters.status) {
      whereClause += ` AND order_payment_status = $${valueIndex}`;
      queryValues.push(filters.status);
      valueIndex++;
    }

    if (filters.applicationId) {
      whereClause += ` AND order_application_id = $${valueIndex}`;
      queryValues.push(filters.applicationId);
      valueIndex++;
    }

    const statsQuery = {
      text: `SELECT 
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
      WHERE ${whereClause}`,
      values: queryValues,
    };

    const statsResult = await client.query(statsQuery);
    const stats = statsResult.rows[0];

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
          currency: 'EUR',
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
        filters,
        generatedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    captureDatabaseError(error, {
      table: 'admin.orders',
      operation: 'get_order_statistics',
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

    let whereConditions = [];
    let queryValues = [];
    let valueIndex = 1;

    if (email) {
      whereConditions.push(`order_client[3] ILIKE $${valueIndex}`);
      queryValues.push(`%${email}%`);
      valueIndex++;
    }

    if (applicationId) {
      whereConditions.push(`order_application_id = $${valueIndex}`);
      queryValues.push(applicationId);
      valueIndex++;
    }

    if (status) {
      whereConditions.push(`order_payment_status = $${valueIndex}`);
      queryValues.push(status);
      valueIndex++;
    }

    if (startDate) {
      whereConditions.push(`order_created >= $${valueIndex}`);
      queryValues.push(startDate);
      valueIndex++;
    }

    if (endDate) {
      whereConditions.push(`order_created <= $${valueIndex}`);
      queryValues.push(endDate);
      valueIndex++;
    }

    if (minAmount) {
      whereConditions.push(`order_price >= $${valueIndex}`);
      queryValues.push(minAmount);
      valueIndex++;
    }

    if (maxAmount) {
      whereConditions.push(`order_price <= $${valueIndex}`);
      queryValues.push(maxAmount);
      valueIndex++;
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

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

    queryValues.push(Math.min(limit, 100), Math.max(offset, 0));
    const limitClause = `LIMIT $${valueIndex} OFFSET $${valueIndex + 1}`;

    const searchQuery = {
      text: `SELECT 
        o.order_id, o.order_client, o.order_price, o.order_payment_status,
        o.order_created, o.order_updated, o.order_paid_at,
        a.application_name, a.application_id, p.platform_name
      FROM admin.orders o
      JOIN catalog.applications a ON o.order_application_id = a.application_id
      JOIN admin.platforms p ON o.order_platform_id = p.platform_id
      ${whereClause}
      ORDER BY o.${safeOrderBy} ${safeDirection}
      ${limitClause}`,
      values: queryValues,
    };

    const countQuery = {
      text: `SELECT COUNT(*) as total FROM admin.orders o ${whereClause}`,
      values: queryValues.slice(0, -2),
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

export async function invalidateOrderCache(orderId = null) {
  try {
    const invalidatedCount = invalidateProjectCache('order', orderId);
    return { success: true, invalidatedCount, orderId };
  } catch (error) {
    captureException(error, {
      tags: {
        component: 'order_actions',
        operation: 'cache_invalidation_error',
      },
      extra: { orderId },
    });
    return { success: false, error: error.message };
  }
}
