// app/actions/createOrder.js
'use server';

import { getClient } from 'backend/dbConnect';

export async function createOrder(formData, applicationId, applicationFee) {
  const client = await getClient();

  try {
    // Extract data from formData
    const lastName = formData.get('lastName');
    const firstName = formData.get('firstName');
    const email = formData.get('email');
    const phone = formData.get('phone');
    const paymentMethod = formData.get('paymentMethod');
    const accountName = formData.get('accountName');
    const accountNumber = formData.get('accountNumber');

    // Create client info array
    const clientInfo = [lastName, firstName, email, phone];

    // Validate required fields
    if (
      !lastName ||
      !firstName ||
      !email ||
      !phone ||
      !paymentMethod ||
      !accountName ||
      !accountNumber ||
      !applicationId ||
      !applicationFee
    ) {
      if (client) await client.release();
      return {
        success: false,
        message: 'Missing required fields',
      };
    }

    // Insert order into database
    const result = await client.query(
      `INSERT INTO admin.orders (
        order_client, 
        order_platform_id, 
        order_payment_name, 
        order_payment_number, 
        order_application_id, 
        order_price
      ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING order_id`,
      [
        clientInfo,
        paymentMethod,
        accountName,
        accountNumber,
        applicationId,
        applicationFee,
      ],
    );

    const newOrderId = result.rows[0].order_id;

    if (client) await client.release();

    return {
      success: true,
      message: 'Order created successfully',
      orderId: newOrderId,
    };
  } catch (error) {
    if (client) await client.release();
    console.error('Error creating order:', error);
    return {
      success: false,
      message: 'Failed to create order',
      error: error.message,
    };
  } finally {
    if (client) await client.release();
  }
}

// Alternative version if you prefer to pass an object instead of FormData
export async function createOrderFromObject(data) {
  const client = await getClient();

  try {
    // Extract data from the object
    const {
      lastName,
      firstName,
      email,
      phone,
      paymentMethod,
      accountName,
      accountNumber,
      applicationId,
      applicationFee,
    } = data;

    // Create client info array
    const clientInfo = [lastName, firstName, email, phone];

    // Validate required fields
    if (
      !lastName ||
      !firstName ||
      !email ||
      !phone ||
      !paymentMethod ||
      !accountName ||
      !accountNumber ||
      !applicationId ||
      !applicationFee
    ) {
      if (client) await client.release();
      return {
        success: false,
        message: 'Missing required fields',
      };
    }

    // Insert order into database
    const result = await client.query(
      `INSERT INTO admin.orders (
        order_client, 
        order_platform_id, 
        order_payment_name, 
        order_payment_number, 
        order_application_id, 
        order_price
      ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING order_id`,
      [
        clientInfo,
        paymentMethod,
        accountName,
        accountNumber,
        applicationId,
        applicationFee,
      ],
    );

    const newOrderId = result.rows[0].order_id;

    if (client) await client.release();

    return {
      success: true,
      message: 'Order created successfully',
      orderId: newOrderId,
    };
  } catch (error) {
    if (client) await client.release();
    console.error('Error creating order:', error);
    return {
      success: false,
      message: 'Failed to create order',
      error: error.message,
    };
  } finally {
    if (client) await client.release();
  }
}
