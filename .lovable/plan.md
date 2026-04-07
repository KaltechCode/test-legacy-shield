# Harden RLS on `public.leads`

## Current State

The `leads` table currently has five RLS policies, including two SELECT policies:

- "Authenticated users can view own leads" (SELECT)
- "Admins can view all leads" (SELECT)
- "Service role can insert leads" (INSERT)
- "Users can update verification status on own leads" (UPDATE)
- "Admins can update all leads" (UPDATE)

The goal is to lock down direct client-side SELECT access entirely, since all lead reads go through Edge Functions using `service_role`.

## What Will Change

1. Confirm RLS is enabled and forced on `public.leads`.
2. Revoke ALL privileges from `anon` and `authenticated` roles on `public.leads`.
3. Grant ALL privileges to `service_role` on `public.leads`.
4. Drop the two existing SELECT policies ("Authenticated users can view own leads" and "Admins can view all leads").
5. Create a new RESTRICTIVE SELECT policy that denies all SELECT to `anon` and `authenticated` (using `false`).
6. Leave INSERT and UPDATE policies untouched (they are already restrictive and service_role bypasses RLS anyway).

## What Will NOT Change

- No frontend code changes.
- No Edge Function changes.
- No schema/column changes.
- No changes to other tables.
- INSERT and UPDATE policies remain as-is.

## Technical Details (SQL Migration)

```text
-- 1. Enable RLS (idempotent)
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads FORCE ROW LEVEL SECURITY;

-- 2. Revoke all from anon and authenticated
REVOKE ALL ON public.leads FROM anon;
REVOKE ALL ON public.leads FROM authenticated;

-- 3. Grant full access to service_role
GRANT ALL ON public.leads TO service_role;

-- 4. Drop existing SELECT policies
DROP POLICY IF EXISTS "Authenticated users can view own leads" ON public.leads;
DROP POLICY IF EXISTS "Admins can view all leads" ON public.leads;

-- 5. Deny all direct SELECT for anon and authenticated
DROP POLICY IF EXISTS "Deny direct select access" ON public.leads;

CREATE POLICY "Deny direct select access"
  ON public.leads
  AS RESTRICTIVE
  FOR SELECT
  TO anon, authenticated
  USING (false);
```

All statements are idempotent and safe to run.