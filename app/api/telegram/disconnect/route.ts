import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please login first.' },
        { status: 401 }
      );
    }

    // Get channelId from query params
    const searchParams = req.nextUrl.searchParams;
    const channelId = searchParams.get('channelId');

    if (!channelId) {
      return NextResponse.json(
        { error: 'Channel ID is required' },
        { status: 400 }
      );
    }

    // Delete specific channel
    const { error: deleteError } = await supabase
      .from('social_accounts')
      .delete()
      .eq('user_id', user.id)
      .eq('platform', 'telegram')
      .eq('platform_account_id', channelId);

    if (deleteError) {
      console.error('Failed to disconnect Telegram channel:', deleteError);
      return NextResponse.json(
        { error: 'Failed to disconnect Telegram channel' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Telegram channel disconnected successfully',
      channelId,
    });
  } catch (error) {
    console.error('Disconnect Telegram error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
