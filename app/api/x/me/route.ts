import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getXUserProfile } from '@/lib/x-api-client';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please login first.' },
        { status: 401 }
      );
    }

    const result = await getXUserProfile(session.user.id);

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
