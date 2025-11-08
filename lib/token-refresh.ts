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

const platformConfigs: Record<string, PlatformConfig> = {
  x: {
    tokenUrl: 'https://api.x.com/2/oauth2/token',
    revokeUrl: 'https://api.x.com/2/oauth2/revoke',
    clientId: process.env.NEXT_PUBLIC_X_CLIENT_ID!,
    clientSecret: process.env.X_CLIENT_SECRET!,
    getUserUrl: 'https://api.x.com/2/users/me',
  },
  facebook: {
    tokenUrl: 'https://graph.facebook.com/v21.0/oauth/access_token',
    clientId: process.env.NEXT_PUBLIC_FACEBOOK_APP_ID!,
    clientSecret: process.env.FACEBOOK_APP_SECRET!,
    getUserUrl: 'https://graph.facebook.com/me',
  },
  discord: {
    tokenUrl: 'https://discord.com/api/oauth2/token',
    revokeUrl: 'https://discord.com/api/oauth2/token/revoke',
    clientId: process.env.DISCORD_CLIENT_ID!,
    clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    getUserUrl: 'https://discord.com/api/v10/users/@me',
  },
  // Add more platforms here as needed
  // linkedin: { ... },
};

export async function refreshPlatformToken(
  platform: string,
  refreshToken: string,
  accessToken?: string
): Promise<RefreshResult> {
  const config = platformConfigs[platform.toLowerCase()];

  if (!config) {
    return {
      success: false,
      error: `Platform ${platform} not supported`,
    };
  }

  try {
    let response: Response;

    if (platform.toLowerCase() === 'facebook') {
      const tokenToExchange = accessToken || refreshToken;
      response = await fetch(
        `${config.tokenUrl}?` +
        `grant_type=fb_exchange_token` +
        `&client_id=${config.clientId}` +
        `&client_secret=${config.clientSecret}` +
        `&fb_exchange_token=${tokenToExchange}`
      );
    } else if (platform.toLowerCase() === 'discord') {
      response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: config.clientId,
          client_secret: config.clientSecret,
        }),
      });
    } else {
      response = await fetch(config.tokenUrl, {
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
        }),
      });
    }

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
      Date.now() + (data.expires_in || 60 * 24 * 60 * 60) * 1000 // Default 60 days for Facebook
    ).toISOString();

    return {
      success: true,
      accessToken: data.access_token,
      refreshToken: data.refresh_token || undefined, // Facebook doesn't return refresh_token
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
    if (platform.toLowerCase() === 'telegram') {
      const { data: channels, error: fetchError } = await supabase
        .from('social_accounts')
        .select('id')
        .eq('user_id', userId)
        .eq('platform', 'telegram');

      if (fetchError || !channels || channels.length === 0) {
        return {
          success: false,
          error: `${platform} account not connected`,
          needsReconnect: true,
        };
      }

      // Telegram bot tokens never expire
      return {
        success: true,
        expiresAt: undefined, // No expiration
      };
    }

    // For Discord and Facebook, we need to check all channels/pages, not just one account
    if (platform.toLowerCase() === 'discord') {
      const { data: channels, error: fetchError } = await supabase
        .from('social_accounts')
        .select('expires_at')
        .eq('user_id', userId)
        .eq('platform', 'discord');

      if (fetchError || !channels || channels.length === 0) {
        return {
          success: false,
          error: `${platform} channels not connected`,
          needsReconnect: true,
        };
      }

      // Check if any channel token is expired
      const anyExpired = channels.some(channel => isTokenExpired(channel.expires_at));

      if (!anyExpired) {
        return {
          success: true,
          expiresAt: channels[0].expires_at,
        };
      }

      // Call refresh endpoint for all channels
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
    }

    // For Facebook, we need to check all pages, not just
    if (platform.toLowerCase() === 'facebook') {
      const { data: pages, error: fetchError } = await supabase
        .from('social_accounts')
        .select('expires_at')
        .eq('user_id', userId)
        .eq('platform', 'facebook');

      if (fetchError || !pages || pages.length === 0) {
        return {
          success: false,
          error: `${platform} account not connected`,
          needsReconnect: true,
        };
      }

      // Check if any page token is expired
      const anyExpired = pages.some(page => isTokenExpired(page.expires_at));

      if (!anyExpired) {
        return {
          success: true,
          expiresAt: pages[0].expires_at,
        };
      }

      // Call refresh endpoint for all pages
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
        expiresAt: result.results?.[0]?.expiresAt,
      };
    }

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

    const expired = isTokenExpired(tokenData.expires_at);

    if (!expired) {
      return {
        success: true,
        expiresAt: tokenData.expires_at,
      };
    }

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

  await Promise.all(
    platforms.map(async (platform) => {
      results[platform] = await checkAndRefreshToken(userId, platform);
    })
  );

  return results;
}
