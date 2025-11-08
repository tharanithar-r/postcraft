import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function DELETE(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please login first.' },
        { status: 401 }
      );
    }

    // Check if disconnecting a specific channel
    const { searchParams } = new URL(req.url);
    const channelId = searchParams.get('channelId');

    if (channelId) {
      // Disconnect specific channel
      const { error: deleteError } = await supabase
        .from('social_accounts')
        .delete()
        .eq('user_id', user.id)
        .eq('platform', 'discord')
        .eq('platform_account_id', channelId);

      if (deleteError) {
        console.error('Failed to delete Discord channel:', deleteError);
        return NextResponse.json(
          { error: 'Failed to disconnect Discord channel' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        message: 'Discord channel disconnected successfully',
      });
    }

    // Disconnect all Discord channels
    // Get Discord channels to revoke tokens
    const { data: channels } = await supabase
      .from('social_accounts')
      .select('access_token')
      .eq('platform', 'discord')
      .eq('user_id', user.id);

    if (channels && channels.length > 0 && channels[0].access_token) {
      try {
        await fetch('https://discord.com/api/oauth2/token/revoke', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: process.env.DISCORD_CLIENT_ID!,
            client_secret: process.env.DISCORD_CLIENT_SECRET!,
            token: channels[0].access_token,
          }),
        });
      } catch (revokeError) {
        console.error('Failed to revoke token on Discord:', revokeError);
      }
    }

    const { error: deleteError } = await supabase
      .from('social_accounts')
      .delete()
      .eq('user_id', user.id)
      .eq('platform', 'discord');

    if (deleteError) {
      console.error('Failed to delete Discord channels:', deleteError);
      return NextResponse.json(
        { error: 'Failed to disconnect Discord channels' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Discord channels disconnected successfully',
    });
  } catch (error) {
    console.error('Disconnect Discord error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
