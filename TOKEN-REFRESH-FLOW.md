# Token Refresh Flow Diagram

## Complete System Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER ACTIONS                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Select Platforms │
                    │  (X, LinkedIn)    │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Enter Prompt    │
                    │  Click Send      │
                    └──────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    CHATBOT COMPONENT                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │ checkAndRefreshAllPlatforms() │
              │   (lib/token-refresh.ts)      │
              └───────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
          ┌──────────────┐    ┌──────────────┐
          │ Check X      │    │ Check        │
          │ Token        │    │ LinkedIn     │
          └──────────────┘    └──────────────┘
                    │                   │
                    ▼                   ▼
          ┌──────────────┐    ┌──────────────┐
          │ Get from     │    │ Get from     │
          │ Supabase     │    │ Supabase     │
          └──────────────┘    └──────────────┘
                    │                   │
                    ▼                   ▼
          ┌──────────────┐    ┌──────────────┐
          │ isTokenExpired│   │ isTokenExpired│
          │ (5 min buffer)│   │ (5 min buffer)│
          └──────────────┘    └──────────────┘
                    │                   │
          ┌─────────┴─────────┐         │
          │                   │         │
          ▼                   ▼         ▼
    ┌──────────┐      ┌──────────────────────┐
    │ Valid    │      │ Expired - Refresh    │
    │ Return   │      │ refreshPlatformToken()│
    └──────────┘      └──────────────────────┘
          │                   │
          │                   ▼
          │         ┌──────────────────┐
          │         │ Call Platform    │
          │         │ OAuth API        │
          │         └──────────────────┘
          │                   │
          │         ┌─────────┴─────────┐
          │         │                   │
          │         ▼                   ▼
          │   ┌──────────┐      ┌──────────────┐
          │   │ Success  │      │ Failed       │
          │   │ Update DB│      │ needsReconnect│
          │   └──────────┘      └──────────────┘
          │         │                   │
          └─────────┴───────────────────┘
                    │
                    ▼
          ┌──────────────────┐
          │ All Results      │
          │ Collected        │
          └──────────────────┘
                    │
          ┌─────────┴─────────┐
          │                   │
          ▼                   ▼
    ┌──────────┐      ┌──────────────────┐
    │ All      │      │ Some Failed      │
    │ Success  │      │ needsReconnect   │
    └──────────┘      └──────────────────┘
          │                   │
          ▼                   ▼
    ┌──────────┐      ┌──────────────────┐
    │ Call     │      │ Show Error       │
    │ Webhook  │      │ "Reconnect X"    │
    └──────────┘      └──────────────────┘
          │                   │
          ▼                   ▼
    ┌──────────┐      ┌──────────────────┐
    │ Generate │      │ Stop Process     │
    │ Post     │      │ User Action      │
    └──────────┘      └──────────────────┘
```

## Token Expiration Check Logic

```
┌─────────────────────────────────────────────────────────────────┐
│                    isTokenExpired()                              │
└─────────────────────────────────────────────────────────────────┘

Input: expiresAt = "2024-01-01T12:00:00Z"
       bufferMinutes = 5

Step 1: Parse expiration time
        expirationTime = 1704110400000 (milliseconds)

Step 2: Calculate buffer
        bufferTime = 5 * 60 * 1000 = 300000 ms

Step 3: Get current time
        now = Date.now()

Step 4: Compare
        if (now >= expirationTime - bufferTime)
            return true  // Expired or within 5 minutes
        else
            return false // Still valid

Example:
        expiresAt: 12:00:00
        buffer: 5 minutes
        now: 11:56:00 → return true (refresh now!)
        now: 11:54:00 → return false (still good)
```

## Platform Token Refresh Flow

```
┌─────────────────────────────────────────────────────────────────┐
│              refreshPlatformToken(platform, refreshToken)        │
└─────────────────────────────────────────────────────────────────┘

Step 1: Get platform config
        ┌──────────────────────────┐
        │ platformConfigs[platform]│
        │ - tokenUrl               │
        │ - clientId               │
        │ - clientSecret           │
        └──────────────────────────┘
                │
                ▼
Step 2: Call OAuth API
        ┌──────────────────────────┐
        │ POST tokenUrl            │
        │ Authorization: Basic ... │
        │ Body:                    │
        │   grant_type: refresh... │
        │   refresh_token: ...     │
        │   client_id: ...         │
        └──────────────────────────┘
                │
        ┌───────┴───────┐
        │               │
        ▼               ▼
   ┌─────────┐    ┌─────────────┐
   │ Success │    │ Failed      │
   │ 200 OK  │    │ 401/400     │
   └─────────┘    └─────────────┘
        │               │
        ▼               ▼
   ┌─────────┐    ┌─────────────────┐
   │ Parse   │    │ needsReconnect  │
   │ Response│    │ = true          │
   └─────────┘    └─────────────────┘
        │               │
        ▼               ▼
   ┌─────────┐    ┌─────────────────┐
   │ Return  │    │ Return error    │
   │ {       │    │ {               │
   │ success │    │ success: false  │
   │ tokens  │    │ needsReconnect  │
   │ }       │    │ }               │
   └─────────┘    └─────────────────┘
```

## Database Update Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                  Update Tokens in Supabase                       │
└─────────────────────────────────────────────────────────────────┘

After successful refresh:

        ┌──────────────────────────┐
        │ supabase                 │
        │   .from('social_accounts')│
        │   .update({              │
        │     access_token: new    │
        │     refresh_token: new   │
        │     expires_at: new      │
        │   })                     │
        │   .eq('user_id', userId) │
        │   .eq('platform', 'x')   │
        └──────────────────────────┘
                │
        ┌───────┴───────┐
        │               │
        ▼               ▼
   ┌─────────┐    ┌─────────────┐
   │ Success │    │ Failed      │
   │ Updated │    │ Log Error   │
   └─────────┘    └─────────────┘
        │               │
        ▼               ▼
   ┌─────────┐    ┌─────────────┐
   │ Return  │    │ Return      │
   │ Success │    │ Error       │
   └─────────┘    └─────────────┘
```

## Error Handling Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      Error Scenarios                             │
└─────────────────────────────────────────────────────────────────┘

Scenario 1: Token Expired, Refresh Success
        User Action → Check Token → Expired → Refresh → Success
        Result: ✅ Continue with API call (seamless)

Scenario 2: Token Expired, Refresh Failed (401)
        User Action → Check Token → Expired → Refresh → 401
        Result: ❌ Show "Please reconnect X account"
        Action: User goes to profile → Reconnect

Scenario 3: Token Expired, Refresh Failed (500)
        User Action → Check Token → Expired → Refresh → 500
        Result: ❌ Show "Failed to refresh. Try again"
        Action: User can retry

Scenario 4: Platform Not Connected
        User Action → Check Token → Not Found
        Result: ❌ Show "X account not connected"
        Action: User goes to profile → Connect

Scenario 5: Multiple Platforms, One Fails
        User Action → Check [X, LinkedIn]
        X: ✅ Success
        LinkedIn: ❌ Needs reconnect
        Result: ❌ Show "Please reconnect LinkedIn"
        Action: User reconnects LinkedIn only
```

## Parallel Refresh Optimization

```
┌─────────────────────────────────────────────────────────────────┐
│              Sequential vs Parallel Refresh                      │
└─────────────────────────────────────────────────────────────────┘

Sequential (OLD - Slow):
        Check X (500ms)
            ↓
        Check LinkedIn (500ms)
            ↓
        Check Facebook (500ms)
            ↓
        Total: 1500ms ❌

Parallel (NEW - Fast):
        Check X (500ms)      ┐
        Check LinkedIn (500ms)├─ Promise.all()
        Check Facebook (500ms)┘
            ↓
        Total: 500ms ✅

Implementation:
        await Promise.all(
          platforms.map(async (platform) => {
            results[platform] = await checkAndRefreshToken(userId, platform)
          })
        )
```

## User Experience Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    User Perspective                              │
└─────────────────────────────────────────────────────────────────┘

Happy Path (Token Valid):
        1. Select platforms
        2. Enter prompt
        3. Click Send
        4. [Background: Token check - 0ms visible delay]
        5. See "Generating..." immediately
        6. Post generated ✅

Happy Path (Token Expired):
        1. Select platforms
        2. Enter prompt
        3. Click Send
        4. [Background: Token refresh - 0ms visible delay]
        5. See "Generating..." immediately
        6. Post generated ✅

Unhappy Path (Reconnect Needed):
        1. Select platforms
        2. Enter prompt
        3. Click Send
        4. [Background: Token refresh fails]
        5. See error: "Please reconnect your X account in your profile"
        6. Click profile
        7. Click "Connect X"
        8. OAuth flow
        9. Return to ChatBot
        10. Try again - works! ✅
```

## API Route Flow

```
┌─────────────────────────────────────────────────────────────────┐
│              GET /api/auth/x/refresh                             │
└─────────────────────────────────────────────────────────────────┘

Request:
        GET /api/auth/x/refresh
        Cookie: supabase-auth-token

Flow:
        1. Authenticate with Supabase
           ↓
        2. Get user from session
           ↓
        3. Fetch X tokens from DB
           ↓
        4. Check if expired
           ↓
        5. If not expired: return current
           If expired: refresh
           ↓
        6. Update DB with new tokens
           ↓
        7. Return success

Response (Success):
        {
          "message": "Token refreshed successfully",
          "expiresAt": "2024-01-01T12:00:00Z"
        }

Response (Error):
        {
          "error": "Token refresh failed",
          "needsReconnect": true
        }
```

## Security Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Security Measures                             │
└─────────────────────────────────────────────────────────────────┘

1. Authentication
        ┌──────────────────────────┐
        │ Supabase Auth            │
        │ - Session validation     │
        │ - User ID verification   │
        └──────────────────────────┘

2. Token Storage
        ┌──────────────────────────┐
        │ Supabase Database        │
        │ - RLS enabled            │
        │ - Encrypted at rest      │
        │ - User can only access   │
        │   their own tokens       │
        └──────────────────────────┘

3. PKCE Flow
        ┌──────────────────────────┐
        │ HTTP-Only Cookies        │
        │ - Code verifier          │
        │ - State parameter        │
        │ - 10 minute expiry       │
        │ - Secure flag in prod    │
        └──────────────────────────┘

4. Token Refresh
        ┌──────────────────────────┐
        │ OAuth 2.0 Standard       │
        │ - Client credentials     │
        │ - Refresh token rotation │
        │ - Automatic expiration   │
        └──────────────────────────┘
```

## Summary

This token refresh system provides:
- ✅ Proactive token validation
- ✅ Automatic refresh before API calls
- ✅ Parallel processing for speed
- ✅ Clear error messages
- ✅ Seamless user experience
- ✅ Multi-platform support
- ✅ Secure token management
- ✅ Easy platform addition
