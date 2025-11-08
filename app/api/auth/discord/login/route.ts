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

    const clientId = process.env.DISCORD_CLIENT_ID;
    const redirectUri = process.env.DISCORD_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return NextResponse.json(
        { error: 'Discord credentials not configured' },
        { status: 500 }
      );
    }

    // Bot permissions: VIEW_CHANNEL + SEND_MESSAGES + EMBED_LINKS + ATTACH_FILES + READ_MESSAGE_HISTORY
    const permissions = '117760';
    
    const scopes = 'bot identify guilds';

    const state = Math.random().toString(36).substring(7);

    const authUrl = new URL('https://discord.com/oauth2/authorize');
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', scopes);
    authUrl.searchParams.append('permissions', permissions);
    authUrl.searchParams.append('state', state);

    const response = NextResponse.redirect(authUrl.toString());
    
    response.cookies.set('discord_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
    });

    return response;
  } catch (error) {
    console.error('Discord login error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Discord login' },
      { status: 500 }
    );
  }
}
