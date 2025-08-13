'use server';

import { getClient } from '@/backend/dbConnect';
import { captureException } from '../instrumentation';
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

export async function createOrder(formData, applicationId, applicationFee) {
  let client = null;

  try {
    // Rate Limiting simple
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
      };
    }

    // Préparer et valider les données
    const rawData = prepareOrderDataFromFormData(
      formData,
      applicationId,
      applicationFee,
    );

    // Sanitization simple
    const sanitizationResult = sanitizeOrderData(rawData);
    if (!sanitizationResult.success) {
      return {
        success: false,
        message: 'Données invalides détectées. Veuillez vérifier votre saisie.',
        code: 'SANITIZATION_FAILED',
      };
    }

    // Validation Yup
    const yupValidation = await validateOrderServer(
      sanitizationResult.sanitized,
    );
    if (!yupValidation.success) {
      return {
        success: false,
        message:
          'Validation échouée: ' + formatValidationErrors(yupValidation.errors),
        code: 'VALIDATION_FAILED',
        errors: yupValidation.errors,
      };
    }

    // Validation métier simple
    const businessRulesValidation = validateBusinessRules(yupValidation.data);
    if (!businessRulesValidation.valid) {
      return {
        success: false,
        message: 'Les informations ne respectent pas nos critères.',
        code: 'BUSINESS_RULES_FAILED',
      };
    }

    // Vérification de sécurité finale
    const safetyCheck = validateSanitizedDataSafety(yupValidation.data);
    if (!safetyCheck.safe) {
      return {
        success: false,
        message: 'Erreur de sécurité des données. Veuillez réessayer.',
        code: 'SAFETY_CHECK_FAILED',
      };
    }

    // Insertion en base de données
    client = await getClient();

    // Vérifier que l'application existe
    const appCheck = await client.query(
      'SELECT application_name, application_fee FROM catalog.applications WHERE application_id = $1 AND is_active = true',
      [yupValidation.data.applicationId],
    );

    if (appCheck.rows.length === 0) {
      return {
        success: false,
        message: "L'application sélectionnée n'est pas disponible.",
        code: 'APPLICATION_NOT_FOUND',
      };
    }

    // Vérifier que la plateforme de paiement existe
    const platformCheck = await client.query(
      'SELECT platform_name FROM admin.platforms WHERE platform_id = $1 AND is_active = true',
      [yupValidation.data.paymentMethod],
    );

    if (platformCheck.rows.length === 0) {
      return {
        success: false,
        message: "La méthode de paiement sélectionnée n'est pas disponible.",
        code: 'PLATFORM_NOT_FOUND',
      };
    }

    // Vérifier le montant
    const expectedFee = parseFloat(appCheck.rows[0].application_fee);
    if (Math.abs(yupValidation.data.applicationFee - expectedFee) > 0.01) {
      return {
        success: false,
        message: 'Erreur de montant. Veuillez actualiser la page et réessayer.',
        code: 'PRICE_MISMATCH',
      };
    }

    // Insertion de la commande
    const clientInfo = [
      yupValidation.data.lastName,
      yupValidation.data.firstName,
      yupValidation.data.email,
      yupValidation.data.phone,
    ];

    const insertResult = await client.query(
      `INSERT INTO admin.orders (
        order_client, order_platform_id, order_payment_name, 
        order_payment_number, order_application_id, order_price, order_payment_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) 
      RETURNING order_id, order_created, order_payment_status`,
      [
        clientInfo,
        yupValidation.data.paymentMethod,
        yupValidation.data.accountName,
        yupValidation.data.accountNumber,
        yupValidation.data.applicationId,
        yupValidation.data.applicationFee,
        'unpaid',
      ],
    );

    const newOrder = insertResult.rows[0];

    if (!newOrder?.order_id) {
      return {
        success: false,
        message:
          'Erreur lors de la création de la commande. Veuillez réessayer.',
        code: 'INSERT_FAILED',
      };
    }

    return {
      success: true,
      message: 'Commande créée avec succès',
      orderId: newOrder.order_id,
      orderDetails: {
        id: newOrder.order_id,
        status: newOrder.order_payment_status,
        created: newOrder.order_created,
        applicationName: appCheck.rows[0].application_name,
        amount: yupValidation.data.applicationFee,
        platform: platformCheck.rows[0].platform_name,
      },
    };
  } catch (error) {
    // Log de l'erreur
    captureException(error, {
      tags: { component: 'order_actions', operation: 'create_order' },
      extra: { applicationId, applicationFee },
    });

    // Message d'erreur selon le type
    let errorMessage =
      'Une erreur est survenue lors de la création de votre commande.';

    if (/postgres|pg|database|db|connection/i.test(error.message)) {
      errorMessage =
        'Problème de connexion. Veuillez réessayer dans quelques instants.';
    } else if (error.name === 'ValidationError') {
      errorMessage =
        'Erreur de validation des données. Veuillez vérifier votre saisie.';
    }

    return {
      success: false,
      message: errorMessage,
      code: 'SYSTEM_ERROR',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message,
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

    // Mapper les données objet vers FormData
    const fields = [
      'lastName',
      'firstName',
      'email',
      'phone',
      'paymentMethod',
      'accountName',
      'accountNumber',
    ];

    fields.forEach((field) => {
      if (data[field] !== undefined && data[field] !== null) {
        formData.append(field, String(data[field]));
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
