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

    // Get page ID from query params (optional - if not provided, delete all)
    const searchParams = req.nextUrl.searchParams;
    const pageId = searchParams.get('pageId');

    if (pageId) {
      // Delete specific page
      const { error: deleteError } = await supabase
        .from('social_accounts')
        .delete()
        .eq('user_id', user.id)
        .eq('platform', 'facebook')
        .eq('platform_account_id', pageId);

      if (deleteError) {
        console.error('Failed to disconnect Facebook page:', deleteError);
        return NextResponse.json(
          { error: 'Failed to disconnect Facebook page' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        message: 'Facebook page disconnected successfully',
        pageId,
      });
    } else {
      // Delete all Facebook pages for this user
      const { error: deleteError } = await supabase
        .from('social_accounts')
        .delete()
        .eq('user_id', user.id)
        .eq('platform', 'facebook');

      if (deleteError) {
        console.error('Failed to disconnect Facebook pages:', deleteError);
        return NextResponse.json(
          { error: 'Failed to disconnect Facebook pages' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        message: 'All Facebook pages disconnected successfully',
      });
    }
  } catch (error) {
    console.error('Disconnect Facebook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
