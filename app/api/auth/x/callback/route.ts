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
      console.error('X OAuth error:', error);
      return NextResponse.redirect(
        new URL(`/profile?error=${error}`, req.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/profile?error=missing_params', req.url)
      );
    }

    // Retrieve stored PKCE verifier and state from cookies
    const cookieStore = await cookies();
    const storedVerifier = cookieStore.get('x_code_verifier')?.value;
    const storedState = cookieStore.get('x_state')?.value;

    if (state !== storedState) {
      return NextResponse.redirect(
        new URL('/profile?error=state_mismatch', req.url)
      );
    }

    if (!storedVerifier) {
      return NextResponse.redirect(
        new URL('/profile?error=missing_verifier', req.url)
      );
    }

    const tokenResponse = await fetch('https://api.x.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${process.env.NEXT_PUBLIC_X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: process.env.NEXT_PUBLIC_X_CLIENT_ID!,
        redirect_uri: process.env.X_REDIRECT_URI!,
        code_verifier: storedVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange failed:', errorData);
      return NextResponse.redirect(
        new URL('/profile?error=token_exchange_failed', req.url)
      );
    }

    const tokenData = await tokenResponse.json();
    console.log("token:", tokenData);
    const { access_token, refresh_token, expires_in } = tokenData;

    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    let username = null;
    let userID = null;
    try {
      const userResponse = await fetch('https://api.x.com/2/users/me', {
        headers: {
          'Authorization': `Bearer ${access_token}`,
        },
      });

      if (userResponse.ok) {
        const userData = await userResponse.json();
        username = userData.data?.username;
        userID = userData.data?.id;
      }
    } catch (error) {
      console.error('Failed to fetch X username:', error);
    }

    const { error: dbError } = await supabase
      .from('social_accounts')
      .upsert({
        user_id: user.id,
        platform: "x",
        platform_account_id: userID,
        account_username: username,
        access_token,
        refresh_token,
        expires_at: expiresAt,
      }, { onConflict: 'user_id,platform,platform_account_id' });

    if (dbError) {
      console.error('Failed to store tokens:', dbError);
      return NextResponse.redirect(
        new URL('/profile?error=db_error', req.url)
      );
    }

    cookieStore.delete('x_code_verifier');
    cookieStore.delete('x_state');

    return NextResponse.redirect(
      new URL('/profile?connected=x', req.url)
    );
  } catch (error) {
    console.error('X OAuth callback error:', error);
    return NextResponse.redirect(
      new URL('/profile?error=callback_failed', req.url)
    );
  }
}
