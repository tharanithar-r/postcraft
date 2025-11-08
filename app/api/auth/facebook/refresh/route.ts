import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

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

    // Get all Facebook pages for this user
    const { data: pages, error: fetchError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', 'facebook');

    if (fetchError || !pages || pages.length === 0) {
      return NextResponse.json(
        { error: 'No Facebook pages connected' },
        { status: 404 }
      );
    }

    // Refresh each page token
    const refreshResults = [];

    for (const page of pages) {
      try {
        // Exchange current token for new long-lived token
        const response = await fetch(
          `https://graph.facebook.com/v21.0/oauth/access_token?` +
          `grant_type=fb_exchange_token` +
          `&client_id=${process.env.NEXT_PUBLIC_FACEBOOK_APP_ID}` +
          `&client_secret=${process.env.FACEBOOK_APP_SECRET}` +
          `&fb_exchange_token=${page.access_token}`
        );

        if (!response.ok) {
          refreshResults.push({
            pageId: page.platform_account_id,
            pageName: page.account_username,
            success: false,
            error: 'Token refresh failed',
          });
          continue;
        }

        const data = await response.json();
        const newExpiresAt = new Date(
          Date.now() + (data.expires_in || 60 * 24 * 60 * 60) * 1000
        ).toISOString();

        // Update token in database
        const { error: updateError } = await supabase
          .from('social_accounts')
          .update({
            access_token: data.access_token,
            expires_at: newExpiresAt,
          })
          .eq('id', page.id);

        if (updateError) {
          refreshResults.push({
            pageId: page.platform_account_id,
            pageName: page.account_username,
            success: false,
            error: 'Failed to update database',
          });
        } else {
          refreshResults.push({
            pageId: page.platform_account_id,
            pageName: page.account_username,
            success: true,
            expiresAt: newExpiresAt,
          });
        }
      } catch (error) {
        refreshResults.push({
          pageId: page.platform_account_id,
          pageName: page.account_username,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const allSuccess = refreshResults.every(r => r.success);
    const someSuccess = refreshResults.some(r => r.success);

    return NextResponse.json({
      message: allSuccess
        ? 'All tokens refreshed successfully'
        : someSuccess
          ? 'Some tokens refreshed successfully'
          : 'All token refreshes failed',
      results: refreshResults,
    }, {
      status: allSuccess ? 200 : someSuccess ? 207 : 500,
    });
  } catch (error) {
    console.error('Facebook token refresh error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
