# Token Refresh System Guide

## Overview
This guide explains the comprehensive token refresh system implemented for all social media platforms. The system automatically checks and refreshes OAuth tokens before making API calls, ensuring seamless user experience.

## Architecture

### Core Components

#### 1. `lib/token-refresh.ts`
Central token management utility that handles:
- Token expiration checking (with 5-minute buffer)
- Platform-agnostic token refresh (server-side only)
- Multi-platform token refresh in parallel (via API routes)
- Client-safe token checking

**Key Functions:**
- `isTokenExpired(expiresAt, bufferMinutes)` - Checks if token needs refresh
- `refreshPlatformToken(platform, refreshToken)` - **SERVER-SIDE ONLY** - Refreshes token for specific platform
- `checkAndRefreshToken(userId, platform)` - **CLIENT-SAFE** - Checks token and calls API route if refresh needed
- `checkAndRefreshAllPlatforms(userId, platforms)` - **CLIENT-SAFE** - Refreshes multiple platforms in parallel via API routes

#### 2. ChatBot Component Integration
The ChatBot component now:
- Checks all selected platform tokens before generating posts
- Refreshes expired tokens automatically
- Shows user-friendly error messages if reconnection is needed
- Prevents API calls with expired tokens

#### 3. API Routes
All API routes now use Supabase Auth:
- `/api/auth/x/refresh` - Manual token refresh endpoint
- `/api/auth/x/login` - OAuth login flow
- `/api/auth/x/callback` - OAuth callback handler
- `/api/x/me` - Get X user profile
- `/api/x/disconnect` - Disconnect X account

## Token Refresh Flow

### Automatic Refresh (ChatBot)
```
User clicks Send
    ↓
Check all selected platforms (client-side)
    ↓
For each platform:
  - Get token expiration from Supabase
  - Check if expired (5-min buffer)
  - If expired: Call API route /api/auth/{platform}/refresh
    ↓
API Route (server-side):
  - Authenticate user
  - Get refresh token from DB
  - Call platform OAuth API
  - Update Supabase with new token
  - Return success/error
    ↓
If any refresh fails:
  - Show error message
  - Ask user to reconnect
  - Stop post generation
    ↓
If all tokens valid:
  - Proceed with webhook call
  - Generate post
```

### Manual Refresh (API Endpoint)
```
GET /api/auth/x/refresh
    ↓
Authenticate user with Supabase
    ↓
Get X token from database
    ↓
Check if expired
    ↓
If not expired: return current token
If expired: refresh and update
    ↓
Return new token or error
```

## Platform Configuration

### Adding New Platforms
To add support for a new platform (e.g., LinkedIn, Facebook):

1. Add platform config in `lib/token-refresh.ts`:
```typescript
const platformConfigs: Record<string, PlatformConfig> = {
  x: { ... },
  linkedin: {
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    clientId: process.env.NEXT_PUBLIC_LINKEDIN_CLIENT_ID!,
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET!,
  },
  facebook: {
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
    clientId: process.env.NEXT_PUBLIC_FACEBOOK_APP_ID!,
    clientSecret: process.env.FACEBOOK_APP_SECRET!,
  },
};
```

2. Create OAuth routes:
- `/api/auth/[platform]/login/route.ts`
- `/api/auth/[platform]/callback/route.ts`
- `/api/auth/[platform]/refresh/route.ts`

3. Add platform to ChatBot UI (already supports dynamic platforms)

## Error Handling

### Token Refresh Failures
The system handles various failure scenarios:

1. **Token Expired & Refresh Failed (401)**
   - User sees: "Please reconnect your X account in your profile"
   - Action: User must re-authenticate via profile page

2. **Network/Server Error (500)**
   - User sees: "Failed to refresh token. Please try again."
   - Action: User can retry or reconnect

3. **Platform Not Connected (404)**
   - User sees: "X account not connected"
   - Action: User must connect account in profile

### Seamless Experience
- Token checks happen in background
- No loading spinners for token refresh
- Only shows errors if reconnection needed
- Automatic retry on transient failures

## Security Features

1. **Client Secrets Protection**
   - OAuth client secrets NEVER exposed to browser
   - Token refresh happens server-side only via API routes
   - Client-side code only calls API endpoints
   - CORS errors prevented by using API routes

2. **HTTP-Only Cookies**
   - PKCE verifier stored in secure cookies
   - Not accessible via JavaScript
   - Auto-expire after 10 minutes

3. **Token Storage**
   - Tokens stored in Supabase with RLS
   - Only user can access their own tokens
   - Encrypted at rest
   - Client can only read expiration time, not tokens

4. **Token Expiration Buffer**
   - Refreshes 5 minutes before actual expiration
   - Prevents race conditions
   - Ensures tokens always valid

## Testing

### Test Token Refresh
1. Connect X account in profile
2. Wait for token to expire (or manually set expiration in DB)
3. Try to generate a post
4. System should automatically refresh token

### Test Reconnection Flow
1. Manually invalidate refresh token in DB
2. Try to generate a post
3. Should see error message asking to reconnect
4. Reconnect in profile
5. Should work again

## Database Schema

### social_accounts Table
```sql
CREATE TABLE social_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  account_username TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, platform)
);
```

## Environment Variables

Required for each platform:

### X/Twitter
```env
NEXT_PUBLIC_X_CLIENT_ID=your_client_id
X_CLIENT_SECRET=your_client_secret
X_REDIRECT_URI=http://localhost:3000/api/auth/x/callback
```

### LinkedIn (Future)
```env
NEXT_PUBLIC_LINKEDIN_CLIENT_ID=your_client_id
LINKEDIN_CLIENT_SECRET=your_client_secret
LINKEDIN_REDIRECT_URI=http://localhost:3000/api/auth/linkedin/callback
```

### Facebook (Future)
```env
NEXT_PUBLIC_FACEBOOK_APP_ID=your_app_id
FACEBOOK_APP_SECRET=your_app_secret
FACEBOOK_REDIRECT_URI=http://localhost:3000/api/auth/facebook/callback
```

## Monitoring & Debugging

### Console Logs
The system logs important events:
- Token refresh attempts
- Refresh failures with error details
- Platform connection status
- Token expiration checks

### Common Issues

1. **"Token refresh failed: 401"**
   - Cause: Refresh token invalid/expired
   - Solution: User must reconnect account

2. **"Platform x not supported"**
   - Cause: Platform not in platformConfigs
   - Solution: Add platform configuration

3. **"Failed to store refreshed tokens"**
   - Cause: Database update failed
   - Solution: Check Supabase connection and RLS policies

## Best Practices

1. **Always check tokens before API calls**
   - Use `checkAndRefreshAllPlatforms()` before webhook calls
   - Don't assume tokens are valid

2. **Handle errors gracefully**
   - Show clear error messages
   - Guide users to reconnect when needed
   - Don't expose technical details to users

3. **Use parallel refresh**
   - Refresh all platforms simultaneously
   - Reduces wait time for users
   - Better user experience

4. **Set appropriate buffer time**
   - Default 5 minutes works well
   - Adjust based on platform requirements
   - Balance between freshness and API calls

## Future Enhancements

1. **Automatic Background Refresh**
   - Cron job to refresh tokens before expiration
   - Reduces user-facing refresh delays

2. **Token Health Dashboard**
   - Show token status in profile
   - Alert users before expiration
   - Proactive reconnection prompts

3. **Retry Logic**
   - Automatic retry on transient failures
   - Exponential backoff
   - Circuit breaker pattern

4. **Analytics**
   - Track refresh success rates
   - Monitor platform-specific issues
   - Identify patterns in failures
