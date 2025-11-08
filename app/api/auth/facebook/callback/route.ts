import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.redirect(
        new URL('/login?error=unauthorized', req.url)
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      console.error('Facebook OAuth error:', error);
      return NextResponse.redirect(
        new URL(`/home?error=${error}`, req.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/home?error=missing_params', req.url)
      );
    }

    // Verify state parameter
    const cookieStore = await cookies();
    const storedState = cookieStore.get('facebook_state')?.value;

    if (state !== storedState) {
      return NextResponse.redirect(
        new URL('/home?error=state_mismatch', req.url)
      );
    }

    const tokenResponse = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?` +
      `client_id=${process.env.NEXT_PUBLIC_FACEBOOK_APP_ID}` +
      `&redirect_uri=${encodeURIComponent(process.env.FACEBOOK_REDIRECT_URI!)}` +
      `&client_secret=${process.env.FACEBOOK_APP_SECRET}` +
      `&code=${code}`
    );

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange failed:', errorData);
      return NextResponse.redirect(
        new URL('/home?error=token_exchange_failed', req.url)
      );
    }

    const tokenData = await tokenResponse.json();
    const { access_token, expires_in } = tokenData;

    // Exchange short-lived token for long-lived token (60 days)
    const longLivedTokenResponse = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?` +
      `grant_type=fb_exchange_token` +
      `&client_id=${process.env.NEXT_PUBLIC_FACEBOOK_APP_ID}` +
      `&client_secret=${process.env.FACEBOOK_APP_SECRET}` +
      `&fb_exchange_token=${access_token}`
    );

    if (!longLivedTokenResponse.ok) {
      console.error('Long-lived token exchange failed');
    }

    const longLivedData = await longLivedTokenResponse.json();
    const finalAccessToken = longLivedData.access_token || access_token;
    const finalExpiresIn = longLivedData.expires_in || expires_in;

    console.log("token", finalAccessToken);

    // Get user's Facebook pages
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?access_token=${finalAccessToken}`
    );

    if (!pagesResponse.ok) {
      const errorText = await pagesResponse.text();
      console.error('Failed to fetch pages:', errorText);
      return NextResponse.redirect(
        new URL('/home?error=failed_to_fetch_pages', req.url)
      );
    }

    const pagesData = await pagesResponse.json();
    console.log('[Facebook Callback] Pages response:', JSON.stringify(pagesData, null, 2));
    const pages = pagesData.data || [];

    if (pages.length === 0) {
      console.log('[Facebook Callback] No pages found for user');
      console.log('[Facebook Callback] User needs to create a Facebook Page first');
      
      // Store user's basic Facebook connection even without pages
      // This allows them to see they're connected and get helpful message
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        // Get user's basic info
        const userInfoResponse = await fetch(
          `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${finalAccessToken}`
        );
        const userInfo = await userInfoResponse.json();
        
        console.log('[Facebook Callback] Storing user connection without pages');
        
        // Store basic Facebook connection
        await supabase
          .from('social_accounts')
          .delete()
          .eq('user_id', userData.user.id)
          .eq('platform', 'facebook');

        await supabase
          .from('social_accounts')
          .insert({
            user_id: userData.user.id,
            platform: 'facebook',
            platform_account_id: userInfo.id,
            account_username: userInfo.name,
            access_token: finalAccessToken,
            refresh_token: null,
            expires_at: new Date(Date.now() + finalExpiresIn * 1000).toISOString(),
            platform_data: {
              userId: userInfo.id,
              userName: userInfo.name,
              hasPages: false,
            },
          });
      }
      
      return NextResponse.redirect(
        new URL('/profile?facebook=no_pages&message=create_page', req.url)
      );
    }

    await supabase
      .from('social_accounts')
      .delete()
      .eq('user_id', user.id)
      .eq('platform', 'facebook');

    // Insert each page as a separate row
    const pageInserts = pages.map((page: any) => {
      const pageExpiresAt = page.access_token 
        ? new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString() // 60 days
        : new Date(Date.now() + finalExpiresIn * 1000).toISOString();

      return {
        user_id: user.id,
        platform: 'facebook',
        platform_account_id: page.id,
        account_username: page.name,
        access_token: page.access_token || finalAccessToken,
        refresh_token: null,
        expires_at: pageExpiresAt,
        platform_data: {
          pageId: page.id,
          pageName: page.name,
          category: page.category,
          tasks: page.tasks || [],
        },
      };
    });

    const { error: dbError } = await supabase
      .from('social_accounts')
      .insert(pageInserts);

    if (dbError) {
      console.error('Failed to store pages:', dbError);
      return NextResponse.redirect(
        new URL('/home?error=db_error', req.url)
      );
    }

    // Clean up state cookie
    cookieStore.delete('facebook_state');

    return NextResponse.redirect(
      new URL(`/home?connected=facebook&pages=${pages.length}`, req.url)
    );
  } catch (error) {
    console.error('Facebook OAuth callback error:', error);
    return NextResponse.redirect(
      new URL('/home?error=callback_failed', req.url)
    );
  }
}
