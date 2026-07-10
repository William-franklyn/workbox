-- ============================================================
-- 024: Goal write protection
-- Run in Supabase SQL editor.
--
-- Participant checks for goal progress live in the API routes, which use
-- the service role. Without this, any signed-in user could bypass them by
-- writing goals/key_results directly with the client-side SDK (verified
-- during testing). Reads stay open; writes must go through the server.
-- ============================================================

revoke insert, update, delete on table goals from authenticated, anon;
revoke insert, update, delete on table key_results from authenticated, anon;
revoke insert, update, delete on table goal_members from authenticated, anon;
