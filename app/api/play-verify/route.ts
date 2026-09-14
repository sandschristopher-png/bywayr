// app/api/play-verify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

// Initialize Google Auth Client
// Ensure GOOGLE_APPLICATION_CREDENTIALS env var is set with your service account JSON
const auth = new google.auth.GoogleAuth({
  scopes: ['https://www.googleapis.com/androidpublisher'],
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { receipt, packageName, productId } = body;

    // 1. Validate incoming data
    if (!receipt || !packageName || !productId) {
      return NextResponse.json(
        { error: 'Missing required fields: receipt, packageName, productId' },
        { status: 400 }
      );
    }

    // 2. Strict Package Name Check (Prevent spoofing)
    if (packageName !== 'com.bywayr.app') {
      console.warn(`Suspicious request: Invalid package name ${packageName}`);
      return NextResponse.json(
        { error: 'Invalid package name' },
        { status: 403 }
      );
    }

    // 3. Strict Product ID Check
    if (productId !== 'bywayr_plus_lifetime') {
      console.warn(`Suspicious request: Invalid product ID ${productId}`);
      return NextResponse.json(
        { error: 'Invalid product ID' },
        { status: 403 }
      );
    }

    // 4. Verify Receipt with Google Play API
    const androidPublisher = google.androidpublisher('v3');
    
    // The receipt is typically a JSON string containing the purchase token and signature
    // If your frontend sends the raw purchase token, adjust accordingly. 
    // Assuming 'receipt' here is the purchaseToken from the Google Play Billing library response.
    const purchaseToken = receipt; 

    const verificationResponse = await androidPublisher.purchases.products.get({
      packageName: 'com.bywayr.app',
      productId: 'bywayr_plus_lifetime',
      token: purchaseToken,
      auth: await auth.getClient(),
    });

    const purchaseState = verificationResponse.data.purchaseState;

    // 0 = Purchased, 1 = Pending, 2 = Canceled, 3 = Refunded, 4 = Revoked
    if (purchaseState === 0) {
      return NextResponse.json({
        success: true,
        message: 'Subscription verified',
        // You can optionally return the expiryTimeMillis if needed for expiration logic
        expiryTimeMillis: verificationResponse.data.expiryTimeMillis,
      });
    } else {
      return NextResponse.json(
        { error: 'Purchase not active or invalid state', purchaseState },
        { status: 403 }
      );
    }

  } catch (error) {
    console.error('Verification failed:', error);
    return NextResponse.json(
      { error: 'Internal server error during verification' },
      { status: 500 }
    );
  }
}

// Prevent GET requests to this endpoint
export function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}