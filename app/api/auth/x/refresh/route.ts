import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { refreshPlatformToken, isTokenExpired } from '@/lib/token-refresh';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please login first.' },
        { status: 401 }
      );
    }

    const { data: tokenData, error: fetchError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', 'x')
      .single();

    if (fetchError || !tokenData) {
      return NextResponse.json(
        { error: 'X account not connected' },
        { status: 404 }
      );
    }

    if (!isTokenExpired(tokenData.expires_at)) {
      return NextResponse.json({
        message: 'Token is still valid',
        expiresAt: tokenData.expires_at,
      });
    }

    const refreshResult = await refreshPlatformToken('x', tokenData.refresh_token);

    if (!refreshResult.success) {
      const statusCode = refreshResult.needsReconnect ? 401 : 500;
      return NextResponse.json(
        {
          error: refreshResult.error || 'Token refresh failed',
          needsReconnect: refreshResult.needsReconnect
        },
        { status: statusCode }
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
      .eq('user_id', user.id)
      .eq('platform', 'x');

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
