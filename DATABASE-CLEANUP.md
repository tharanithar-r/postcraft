# Database Cleanup - Duplicate Token Rows

## Problem Identified

The `upsert` operation in the X OAuth callback was missing the `onConflict` parameter, causing it to create **duplicate rows** instead of updating existing ones.

### Symptoms
- Token refresh fails with "Value passed for the token was invalid"
- Issue persists even after reconnecting
- Works briefly after reconnection, then fails again

### Root Cause
```typescript
// BEFORE (BROKEN):
.upsert({
  user_id: user.id,
  platform: "x",
  ...
})
// Creates new row every time instead of updating

// AFTER (FIXED):
.upsert({
  user_id: user.id,
  platform: "x",
  ...
}, {
  onConflict: 'user_id,platform'  // ← This was missing!
})
// Now properly updates existing row
```

## Check for Duplicate Rows

Run this SQL query in your Supabase SQL Editor:

```sql
-- Check for duplicate rows
SELECT 
  user_id, 
  platform, 
  COUNT(*) as row_count,
  array_agg(id) as row_ids,
  array_agg(expires_at) as expiration_dates
FROM social_accounts
GROUP BY user_id, platform
HAVING COUNT(*) > 1;
```

If this returns any rows, you have duplicates!

## Cleanup Duplicate Rows

### Option 1: Keep Most Recent Row (Recommended)

```sql
-- Delete all but the most recent row for each user+platform
DELETE FROM social_accounts
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY user_id, platform 
        ORDER BY created_at DESC
      ) as rn
    FROM social_accounts
  ) t
  WHERE rn > 1
);
```

### Option 2: Manual Cleanup

```sql
-- 1. First, see all rows for your user
SELECT 
  id,
  platform,
  account_username,
  expires_at,
  created_at
FROM social_accounts
WHERE user_id = 'YOUR_USER_ID'
ORDER BY platform, created_at DESC;

-- 2. Delete specific old rows (replace with actual IDs)
DELETE FROM social_accounts
WHERE id IN ('old-row-id-1', 'old-row-id-2');
```

## Verify Cleanup

After cleanup, verify you have only one row per user+platform:

```sql
-- Should return 0 rows
SELECT 
  user_id, 
  platform, 
  COUNT(*) as row_count
FROM social_accounts
GROUP BY user_id, platform
HAVING COUNT(*) > 1;
```

## Prevent Future Duplicates

### 1. Database Constraint (Recommended)

Add a unique constraint to prevent duplicates at the database level:

```sql
-- Add unique constraint
ALTER TABLE social_accounts
ADD CONSTRAINT social_accounts_user_platform_unique 
UNIQUE (user_id, platform);
```

### 2. Verify Fix is Applied

The code fix has been applied in `app/api/auth/x/callback/route.ts`:
- ✅ Added `onConflict: 'user_id,platform'` to upsert

## Testing After Fix

1. **Clean up duplicates** using SQL above
2. **Disconnect X account** in profile
3. **Reconnect X account**
4. **Check database** - should have only 1 row
5. **Wait for token to expire** (or manually set expires_at to past)
6. **Try to post** - should auto-refresh successfully
7. **Check database** - should still have only 1 row (updated, not duplicated)

## Why This Happened

### Without `onConflict`:
```
1st connection: INSERT new row (id: 1) ✅
2nd connection: INSERT new row (id: 2) ❌ (should update id: 1)
3rd connection: INSERT new row (id: 3) ❌ (should update id: 1)

Result: 3 rows, system reads old row with expired token
```

### With `onConflict`:
```
1st connection: INSERT new row (id: 1) ✅
2nd connection: UPDATE row (id: 1) ✅
3rd connection: UPDATE row (id: 1) ✅

Result: 1 row, always has latest token
```

## Additional Checks

### Check Token Expiration Dates

```sql
-- See when your tokens expire
SELECT 
  platform,
  account_username,
  expires_at,
  CASE 
    WHEN expires_at > NOW() THEN 'Valid'
    ELSE 'Expired'
  END as status,
  EXTRACT(EPOCH FROM (expires_at - NOW())) / 3600 as hours_until_expiry
FROM social_accounts
WHERE user_id = 'YOUR_USER_ID'
ORDER BY platform;
```

### Check for Old Tokens

```sql
-- Find tokens older than 2 hours (X tokens typically last 2 hours)
SELECT 
  platform,
  account_username,
  expires_at,
  created_at,
  AGE(NOW(), created_at) as age
FROM social_accounts
WHERE user_id = 'YOUR_USER_ID'
  AND expires_at < NOW()
ORDER BY created_at DESC;
```

## Summary

**Root Cause**: Missing `onConflict` parameter in upsert operation
**Impact**: Duplicate rows created on each reconnection
**Fix Applied**: Added `onConflict: 'user_id,platform'`
**Action Required**: Clean up existing duplicate rows in database
**Prevention**: Add unique constraint to database schema

After cleanup and fix, token refresh should work reliably! 🎉
