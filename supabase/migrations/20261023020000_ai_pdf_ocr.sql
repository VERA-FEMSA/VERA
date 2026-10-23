-- Permit the trusted backend to persist bounded OCR text for an existing
-- private attachment. Browser roles retain no table access; all owner and
-- container filters remain in the server-side update query.
grant update (chunks, status, truncated) on public.vera_ai_attachments to service_role;
