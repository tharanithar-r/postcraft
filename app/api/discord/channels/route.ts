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

    const { data: channels, error: fetchError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', 'discord')
      .order('account_username', { ascending: true });

    if (fetchError) {
      console.error('Failed to fetch Discord channels:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch Discord channels' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      channels: channels || [],
      count: channels?.length || 0,
    });
  } catch (error) {
    console.error('Get Discord channels error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
