# Token Refresh Quick Reference

## What Changed

### ✅ New Universal Token System
- Created `lib/token-refresh.ts` for all platforms
- Replaces platform-specific refresh logic
- Supports X, LinkedIn, Facebook (ready to add)

### ✅ ChatBot Now Refreshes Tokens Proactively
- Checks all selected platforms before webhook call
- Refreshes expired tokens automatically
- Shows clear errors if reconnection needed

### ✅ All API Routes Use Supabase Auth
- Migrated from NextAuth to pure Supabase
- Consistent authentication everywhere
- Better RLS support

## Key Functions

### `checkAndRefreshAllPlatforms(userId, platforms)`
Use this before making API calls with multiple platforms:
```typescript
const results = await checkAndRefreshAllPlatforms(userId, ['x', 'linkedin'])
// Returns: { x: { success: true, ... }, linkedin: { success: true, ... } }
```

### `checkAndRefreshToken(userId, platform)`
Use this for single platform:
```typescript
const result = await checkAndRefreshToken(userId, 'x')
// Returns: { success: true, accessToken: '...', ... }
```

### `isTokenExpired(expiresAt, bufferMinutes)`
Check if token needs refresh:
```typescript
const expired = isTokenExpired('2024-01-01T00:00:00Z', 5)
// Returns: true if expired or within 5 minutes of expiration
```

## Error Handling

### Token Needs Reconnection
```typescript
if (!result.success && result.needsReconnect) {
  toast.error(`Please reconnect your ${platform} account`)
}
```

### Token Refresh Failed
```typescript
if (!result.success) {
  console.error(result.error)
  // Handle error
}
```

## Adding New Platform

1. Add to `platformConfigs` in `lib/token-refresh.ts`:
```typescript
newplatform: {
  tokenUrl: 'https://api.newplatform.com/oauth/token',
  clientId: process.env.NEXT_PUBLIC_NEWPLATFORM_CLIENT_ID!,
  clientSecret: process.env.NEWPLATFORM_CLIENT_SECRET!,
}
```

2. Create OAuth routes:
- `/api/auth/newplatform/login/route.ts`
- `/api/auth/newplatform/callback/route.ts`

3. Add environment variables

4. Done! ChatBot automatically supports it

## Testing

### Test Token Refresh
```bash
# 1. Connect account in profile
# 2. Generate a post
# 3. Should work seamlessly

# To test expiration:
# 1. Manually set expires_at to past date in DB
# 2. Try to generate post
# 3. Should auto-refresh and work
```

### Test Reconnection Flow
```bash
# 1. Invalidate refresh_token in DB
# 2. Try to generate post
# 3. Should see "Please reconnect" message
# 4. Reconnect in profile
# 5. Should work again
```

## Files Modified

### New Files
- `lib/token-refresh.ts` - Universal token refresh
- `TOKEN-REFRESH-GUIDE.md` - Full documentation
- `IMPLEMENTATION-SUMMARY.md` - Implementation details
- `QUICK-REFERENCE.md` - This file

### Updated Files
- `components/chatBot.tsx` - Token refresh before webhook
- `app/api/auth/x/refresh/route.ts` - Uses new utility
- `app/api/x/me/route.ts` - Supabase auth

### Unchanged (Already Good)
- `app/api/auth/x/login/route.ts` - Already Supabase
- `app/api/auth/x/callback/route.ts` - Already Supabase
- `app/api/x/disconnect/route.ts` - Already Supabase

## Common Issues

### "Platform x not supported"
Add platform to `platformConfigs` in `lib/token-refresh.ts`

### "Please reconnect your account"
User's refresh token is invalid - they need to reconnect in profile

### Token refresh takes too long
Use `checkAndRefreshAllPlatforms()` for parallel refresh

## Best Practices

✅ Always check tokens before API calls
✅ Use parallel refresh for multiple platforms
✅ Show clear error messages to users
✅ Guide users to reconnect when needed
✅ Log errors for debugging

❌ Don't assume tokens are valid
❌ Don't refresh tokens after API calls fail
❌ Don't expose technical errors to users
❌ Don't refresh tokens sequentially

## Quick Commands

### Check token status
```typescript
const expired = isTokenExpired(tokenData.expires_at)
console.log(`Token expired: ${expired}`)
```

### Refresh single platform
```typescript
const result = await checkAndRefreshToken(userId, 'x')
if (result.success) {
  console.log('Token refreshed:', result.expiresAt)
}
```

### Refresh multiple platforms
```typescript
const results = await checkAndRefreshAllPlatforms(userId, ['x', 'linkedin'])
const allSuccess = Object.values(results).every(r => r.success)
```

## Support

For detailed information, see:
- `TOKEN-REFRESH-GUIDE.md` - Complete system documentation
- `IMPLEMENTATION-SUMMARY.md` - What was implemented
- `CHATBOT-FEATURE-GUIDE.md` - ChatBot feature guide
