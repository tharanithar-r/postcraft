import { createClient } from '@/utils/supabase/client';

interface RefreshTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface RefreshResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  error?: string;
  needsReconnect?: boolean;
}

interface PlatformConfig {
  tokenUrl: string;
  revokeUrl?: string;
  clientId: string;
  clientSecret: string;
  getUserUrl?: string;
}

// Server-side only configuration
const platformConfigs: Record<string, PlatformConfig> = {
  x: {
    tokenUrl: 'https://api.x.com/2/oauth2/token',
    revokeUrl: 'https://api.x.com/2/oauth2/revoke',
    clientId: process.env.NEXT_PUBLIC_X_CLIENT_ID!,
    clientSecret: process.env.X_CLIENT_SECRET!,
    getUserUrl: 'https://api.x.com/2/users/me',
  },
  // Add more platforms here as needed
  // linkedin: { ... },
  // facebook: { ... },
};

export async function refreshPlatformToken(
  platform: string,
  refreshToken: string
): Promise<RefreshResult> {
  const config = platformConfigs[platform.toLowerCase()];

  if (!config) {
    return {
      success: false,
      error: `Platform ${platform} not supported`,
    };
  }

  try {
    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${config.clientId}:${config.clientSecret}`
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: config.clientId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${platform} token refresh failed:`, errorText);

      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText };
      }

      const needsReconnect = response.status === 401 || response.status === 400;

      // Provide more helpful error message
      let errorMessage = `Token refresh failed: ${response.status}`;
      if (errorData.error_description) {
        errorMessage = errorData.error_description;
      } else if (errorData.error) {
        errorMessage = errorData.error;
      }

      if (needsReconnect) {
        errorMessage = `Your ${platform.toUpperCase()} account needs to be reconnected. Please visit your profile to reconnect.`;
      }

      return {
        success: false,
        error: errorMessage,
        needsReconnect,
      };
    }

    const data: RefreshTokenResponse = await response.json();

    const expiresAt = new Date(
      Date.now() + data.expires_in * 1000
    ).toISOString();

    return {
      success: true,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
    };
  } catch (error) {
    console.error(`${platform} token refresh error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export function isTokenExpired(
  expiresAt: string,
  bufferMinutes: number = 5
): boolean {
  // Ensure the date string has a timezone indicator
  const dateString = expiresAt.endsWith('Z') ? expiresAt : `${expiresAt}Z`;
  const expirationTime = new Date(dateString).getTime();
  const bufferTime = bufferMinutes * 60 * 1000;
  const now = Date.now();

  return now >= expirationTime - bufferTime;
}

export async function checkAndRefreshToken(
  userId: string,
  platform: string
): Promise<RefreshResult> {
  const supabase = createClient();

  try {
    // First, check if token exists and get its expiration
    const { data: tokenData, error: fetchError } = await supabase
      .from('social_accounts')
      .select('expires_at')
      .eq('user_id', userId)
      .eq('platform', platform)
      .single();

    if (fetchError || !tokenData) {
      return {
        success: false,
        error: `${platform} account not connected`,
        needsReconnect: true,
      };
    }

    // Check if token is still valid (not expired)
    const expired = isTokenExpired(tokenData.expires_at);

    if (!expired) {
      // Token is still valid, no need to refresh
      return {
        success: true,
        expiresAt: tokenData.expires_at,
      };
    }

    // Token is expired, call API route to refresh it
    const response = await fetch(`/api/auth/${platform.toLowerCase()}/refresh`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error || 'Token refresh failed',
        needsReconnect: errorData.needsReconnect || response.status === 401,
      };
    }

    const result = await response.json();

    return {
      success: true,
      expiresAt: result.expiresAt,
    };
  } catch (error) {
    console.error(`Check and refresh token error for ${platform}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function checkAndRefreshAllPlatforms(
  userId: string,
  platforms: string[]
): Promise<Record<string, RefreshResult>> {
  const results: Record<string, RefreshResult> = {};

  // Check and refresh all platforms in parallel
  await Promise.all(
    platforms.map(async (platform) => {
      results[platform] = await checkAndRefreshToken(userId, platform);
    })
  );

  return results;
}
