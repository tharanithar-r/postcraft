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

    const { data: tokenData } = await supabase
      .from('social_accounts')
      .select('access_token')
      .eq('user_id', user.id)
      .single();

    if (tokenData?.access_token) {
      try {
        await fetch('https://api.x.com/2/oauth2/revoke', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${Buffer.from(
              `${process.env.NEXT_PUBLIC_X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`
            ).toString('base64')}`,
          },
          body: new URLSearchParams({
            token: tokenData.access_token,
            token_type_hint: 'access_token',
            client_id: process.env.NEXT_PUBLIC_X_CLIENT_ID!,
          }),
        });
      } catch (revokeError) {
        console.error('Failed to revoke token on X:', revokeError);
      }
    }

    // Delete tokens from Supabase
    const { error: deleteError } = await supabase
      .from('social_accounts')
      .delete()
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Failed to delete tokens:', deleteError);
      return NextResponse.json(
        { error: 'Failed to disconnect X account' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'X account disconnected successfully',
    });
  } catch (error) {
    console.error('Disconnect X error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
