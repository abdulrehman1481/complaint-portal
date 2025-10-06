# Database Active Column Fix

## Issue Description
The application was encountering the error "column 'active' does not exist" when performing various operations like:
- Assigning complaints in Department Admin Dashboard
- Fetching complaints in Field Agent Dashboard
- Updating complaint statuses

## Root Cause
The database schema contained SQL functions (`log_complaint_status_change` and `log_activity`) that incorrectly referenced an `active` column in the `auth.users` table, which doesn't exist. The functions were using:
```sql
(select auth.uid() from auth.users where active = true limit 1)
```

## Solution
The issue has been fixed by:
1. Correcting the SQL functions to use `auth.uid()` directly without the WHERE clause
2. Adding missing RPC functions needed by the frontend

## Files Fixed
- `src/databaseschema/db.sql` - Updated problematic functions
- `src/databaseschema/fix_active_column_issue.sql` - Database fix script
- `src/databaseschema/add_missing_rpc_functions.sql` - Added missing RPC functions

## How to Apply the Fix

### Method 1: Run the Fix Scripts (Recommended)
1. Connect to your Supabase database
2. Run the fix script:
   ```sql
   -- Apply the active column fix
   -- Copy and paste the content from: src/databaseschema/fix_active_column_issue.sql
   ```
3. Run the missing functions script:
   ```sql
   -- Add missing RPC functions
   -- Copy and paste the content from: src/databaseschema/add_missing_rpc_functions.sql
   ```

### Method 2: Reset Database Schema
If you prefer to start fresh:
1. Drop existing problematic functions
2. Run the updated `src/databaseschema/db.sql` file

## Verification
After applying the fix, verify that:
1. Complaint assignment works in Department Admin Dashboard
2. Field Agent Dashboard loads without errors
3. Complaint status updates work properly
4. No "column active does not exist" errors appear in the console

## Functions Fixed
- `public.log_complaint_status_change()` - Fixed auth.uid() usage
- `public.log_activity()` - Fixed auth.uid() usage
- `public.simple_update_complaint_status()` - Added missing function
- `public.safe_update_complaint()` - Added missing function

This fix resolves all "active column" related errors across all dashboards.