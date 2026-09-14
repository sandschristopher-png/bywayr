// app/api/play-verify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { purchaseToken, receipt, packageName, productId } = body;

    // Accept either purchaseToken (our app) or receipt (legacy shape)
    const token = purchaseToken || receipt;

    // 1. Validate incoming data
    if (!token || !packageName || !productId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // 2. Strict Package Name Check (Prevent spoofing)
    if (packageName !== 'com.bywayr.app' && packageName !== 'bywayr.app') {
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
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });
    const authClient = await auth.getClient();

    const androidPublisher = google.androidpublisher({
      version: 'v3',
      auth: authClient as any,
    }) as any;

    const verificationResponse = await androidPublisher.purchases.products.get({
      packageName: 'com.bywayr.app',
      productId: 'bywayr_plus_lifetime',
      token: token,
    });

    const purchaseState = verificationResponse?.data?.purchaseState;

    // 0 = Purchased, 1 = Pending, 2 = Canceled, 3 = Refunded, 4 = Revoked
    if (purchaseState === 0) {
      return NextResponse.json({ verified: true });
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