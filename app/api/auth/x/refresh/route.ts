import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { supabase } from '@/lib/supabase';
import { refreshXToken, isTokenExpired } from '@/lib/x-token-refresh';

/**
 * API endpoint to manually refresh X OAuth tokens
 * GET /api/auth/x/refresh
 */
export async function GET(req: NextRequest) {
  try {
    // Check if user is authenticated
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please login first.' },
        { status: 401 }
      );
    }

    // Get user's current X tokens from Supabase
    const { data: tokenData, error: fetchError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', session.user.id)
      .single();

    if (fetchError || !tokenData) {
      return NextResponse.json(
        { error: 'X account not connected' },
        { status: 404 }
      );
    }

    // Check if token needs refresh
    if (!isTokenExpired(tokenData.expires_at)) {
      return NextResponse.json({
        message: 'Token is still valid',
        expiresAt: tokenData.expires_at,
      });
    }

    // Refresh the token
    const refreshResult = await refreshXToken(tokenData.refresh_token);

    if (!refreshResult.success) {
      return NextResponse.json(
        { error: refreshResult.error || 'Token refresh failed' },
        { status: 500 }
      );
    }

    // Update tokens in Supabase
    const { error: updateError } = await supabase
      .from('social_accounts')
      .update({
        access_token: refreshResult.accessToken,
        refresh_token: refreshResult.refreshToken,
        expires_at: refreshResult.expiresAt,
      })
      .eq('user_id', session.user.id);

    if (updateError) {
      console.error('Failed to update tokens:', updateError);
      return NextResponse.json(
        { error: 'Failed to store refreshed tokens' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Token refreshed successfully',
      expiresAt: refreshResult.expiresAt,
    });
  } catch (error) {
    console.error('Token refresh endpoint error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
