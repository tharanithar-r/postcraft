import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { refreshPlatformToken, isTokenExpired } from '@/lib/token-refresh';

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

        // Get all Discord channels for this user
        const { data: channels, error: fetchError } = await supabase
            .from('social_accounts')
            .select('*')
            .eq('user_id', user.id)
            .eq('platform', 'discord');

        if (fetchError || !channels || channels.length === 0) {
            return NextResponse.json(
                { error: 'Discord channels not connected' },
                { status: 404 }
            );
        }

        // Check if any token is expired
        const anyExpired = channels.some((channel) =>
            isTokenExpired(channel.expires_at)
        );

        if (!anyExpired) {
            return NextResponse.json({
                message: 'All tokens are still valid',
                channels: channels.length,
            });
        }

        const firstChannel = channels[0];
        const refreshResult = await refreshPlatformToken(
            'discord',
            firstChannel.refresh_token
        );

        if (!refreshResult.success) {
            const statusCode = refreshResult.needsReconnect ? 401 : 500;
            return NextResponse.json(
                {
                    error: refreshResult.error || 'Token refresh failed',
                    needsReconnect: refreshResult.needsReconnect,
                },
                { status: statusCode }
            );
        }

        const { error: updateError } = await supabase
            .from('social_accounts')
            .update({
                access_token: refreshResult.accessToken,
                refresh_token: refreshResult.refreshToken,
                expires_at: refreshResult.expiresAt,
            })
            .eq('user_id', user.id)
            .eq('platform', 'discord');

        if (updateError) {
            console.error('Failed to update tokens:', updateError);
            return NextResponse.json(
                { error: 'Failed to store refreshed tokens' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            message: 'Tokens refreshed successfully',
            channels: channels.length,
            expiresAt: refreshResult.expiresAt,
        });
    } catch (error) {
        console.error('Discord token refresh endpoint error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
