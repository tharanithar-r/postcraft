import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getXUserProfile } from '@/lib/x-api-client';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please login first.' },
        { status: 401 }
      );
    }

    const result = await getXUserProfile(user.id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to fetch X profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Profile fetched successfully',
      data: result.data,
    });
  } catch (error) {
    console.error('Get X profile error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
