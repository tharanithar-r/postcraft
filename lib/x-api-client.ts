import { createClient } from '@/utils/supabase/server';
import { refreshXToken, isTokenExpired } from './x-token-refresh';

interface XApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
}

interface XApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Make an authenticated request to X API with automatic token refresh
 * @param userId - The user's ID from Supabase Auth
 * @param endpoint - X API endpoint (e.g., '/2/tweets' or '/2/users/me')
 * @param options - Request options (method, body, headers)
 * @returns Response data or error
 */
export async function makeXApiRequest<T = any>(
  userId: string,
  endpoint: string,
  options: XApiRequestOptions = {}
): Promise<XApiResponse<T>> {
  try {
    const supabase = await createClient();

    // Get user's X tokens
    const { data: tokenData, error: fetchError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (fetchError || !tokenData) {
      return {
        success: false,
        error: 'X account not connected',
      };
    }

    let accessToken = tokenData.access_token;

    // Check if token needs refresh
    if (isTokenExpired(tokenData.expires_at)) {
      console.log('Token expired, refreshing...');

      const refreshResult = await refreshXToken(tokenData.refresh_token);

      if (!refreshResult.success) {
        return {
          success: false,
          error: 'Failed to refresh token. Please reconnect your X account.',
        };
      }

      // Update tokens in database
      const supabaseForUpdate = await createClient();
      await supabaseForUpdate
        .from('social_accounts')
        .update({
          access_token: refreshResult.accessToken,
          refresh_token: refreshResult.refreshToken,
          expires_at: refreshResult.expiresAt,
        })
        .eq('user_id', userId);

      accessToken = refreshResult.accessToken!;
    }

    // Make the API request
    const url = endpoint.startsWith('http')
      ? endpoint
      : `https://api.x.com${endpoint}`;

    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('X API request failed:', errorText);
      return {
        success: false,
        error: `X API error: ${response.status}`,
      };
    }

    const data = await response.json();

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('X API request error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}


/**
 * Get the authenticated user's profile
 * @param userId - The user's ID from Supabase Auth
 * @returns User profile data or error
 */
export async function getXUserProfile(
  userId: string
): Promise<XApiResponse> {
  return makeXApiRequest(userId, '/2/users/me', {
    method: 'GET',
  });
}
