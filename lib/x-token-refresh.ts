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
}

export async function refreshXToken(
  refreshToken: string
): Promise<RefreshResult> {
  try {
    const response = await fetch('https://api.x.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${process.env.NEXT_PUBLIC_X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.NEXT_PUBLIC_X_CLIENT_ID!,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token refresh failed:', errorText);
      return {
        success: false,
        error: `Token refresh failed: ${response.status}`,
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
    console.error('Token refresh error:', error);
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
  const expirationTime = new Date(expiresAt).getTime();
  const bufferTime = bufferMinutes * 60 * 1000;
  const now = Date.now();

  return now >= expirationTime - bufferTime;
}
