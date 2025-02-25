// app/api/orders/route.js
import { NextResponse } from 'next/server';
import { getClient } from '@/utils/dbConnect';

export async function POST(request) {
  console.log('CREATING NEW ORDER');
  const client = await getClient();

  try {
    const data = await request.json();

    // Extract data from the request
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
      if (client) await client.cleanup();
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 },
      );
    }

    // Insert order into database
    const result = await client.query(
      `INSERT INTO orders (
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

    if (client) await client.cleanup();

    return NextResponse.json(
      {
        message: 'Order created successfully',
        orderId: newOrderId,
      },
      { status: 201 },
    );
  } catch (error) {
    if (client) await client.cleanup();
    console.error('Error creating order:', error);
    return NextResponse.json(
      { message: 'Failed to create order', error: error.message },
      { status: 500 },
    );
  } finally {
    await client.cleanup();
  }
}
