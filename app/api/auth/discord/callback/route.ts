import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

interface DiscordChannel {
  id: string;
  name: string;
  type: number;
}

interface DiscordGuild {
  id: string;
  name: string;
}

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
    const guildId = searchParams.get('guild_id');
    const error = searchParams.get('error');

    if (error) {
      console.error('Discord OAuth error:', error);
      return NextResponse.redirect(
        new URL(`/profile?error=${error}`, req.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/profile?error=missing_params', req.url)
      );
    }

    // Verify state
    const cookieStore = await cookies();
    const storedState = cookieStore.get('discord_state')?.value;

    if (state !== storedState) {
      return NextResponse.redirect(
        new URL('/profile?error=state_mismatch', req.url)
      );
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI!,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Discord token exchange failed:', errorData);
      return NextResponse.redirect(
        new URL('/profile?error=token_exchange_failed', req.url)
      );
    }

    const tokenData: DiscordTokenResponse = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    let guildName = 'Unknown Server';
    if (guildId) {
      try {
        const guildResponse = await fetch(
          `https://discord.com/api/v10/guilds/${guildId}`,
          {
            headers: {
              Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
            },
          }
        );

        if (guildResponse.ok) {
          const guildData: DiscordGuild = await guildResponse.json();
          guildName = guildData.name;
        }
      } catch (error) {
        console.error('Failed to fetch guild info:', error);
      }
    }

    let channels: DiscordChannel[] = [];
    if (guildId) {
      try {
        const channelsResponse = await fetch(
          `https://discord.com/api/v10/guilds/${guildId}/channels`,
          {
            headers: {
              Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
            },
          }
        );

        if (channelsResponse.ok) {
          const allChannels: DiscordChannel[] = await channelsResponse.json();
          channels = allChannels.filter(
            (channel) => channel.type === 0 || channel.type === 5
          );
        }
      } catch (error) {
        console.error('Failed to fetch channels:', error);
      }
    }

    if (channels.length === 0) {
      return NextResponse.redirect(
        new URL('/profile?error=no_channels_found', req.url)
      );
    }

    const channelInserts = channels.map((channel) => ({
      user_id: user.id,
      platform: 'discord',
      platform_account_id: channel.id,
      account_username: channel.name,
      access_token,
      refresh_token,
      expires_at: expiresAt,
      platform_data: {
        guild_id: guildId,
        guild_name: guildName,
        botToken: process.env.DISCORD_BOT_TOKEN!,
        channel_type: channel.type,
      },
    }));

    const { error: dbError } = await supabase
      .from('social_accounts')
      .upsert(channelInserts, {
        onConflict: 'user_id,platform,platform_account_id',
      });

    if (dbError) {
      console.error('Failed to store Discord channels:', dbError);
      return NextResponse.redirect(
        new URL('/profile?error=db_error', req.url)
      );
    }

    cookieStore.delete('discord_state');

    return NextResponse.redirect(
      new URL(`/profile?connected=discord&channels=${channels.length}`, req.url)
    );
  } catch (error) {
    console.error('Discord OAuth callback error:', error);
    return NextResponse.redirect(
      new URL('/profile?error=callback_failed', req.url)
    );
  }
}
