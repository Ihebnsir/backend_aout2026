# Messaging attachment API

## Storage mechanism

The backend uses a conversation-scoped storage abstraction. The default provider is local under the configured `ATTACHMENT_STORAGE_DIR` directory; Cloudflare R2 and private Supabase Storage are also supported through `ATTACHMENT_STORAGE_PROVIDER`. Files use unpredictable, server-generated names. The original client filename is kept only as display metadata and is never used as a storage path.

For Supabase, set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_STORAGE_BUCKET`. The service-role key is backend-only. The bucket must remain private; the backend reads and deletes objects through the storage SDK after the existing conversation authorization checks, and never creates public URLs.

## Upload endpoint

POST /api/conversations/:id/attachments

- Requires authentication.
- Requires the user to belong to the conversation as a learner, centre participant, or admin for support conversations.
- Uses multipart/form-data with a single `file` field.
- Accepts only MIME types in the allowlist below.
- Rejects oversized files using `MAX_ATTACHMENT_SIZE`.
- Rejects attempts to upload unsupported, malicious, or empty files.

Example response:

```json
{
  "success": true,
  "data": {
    "attachment": {
      "id": "...",
      "originalName": "document.pdf",
      "storedName": "attachment-...pdf",
      "mimeType": "application/pdf",
      "size": 94203,
      "url": "/api/conversations/:id/attachments/:attachmentId"
    }
  }
}
```

## Download endpoint

GET /api/conversations/:conversationId/attachments/:attachmentId

- Requires authentication.
- Verifies that the authenticated user is a participant in the conversation before serving the file.
- Returns the file with the correct `Content-Type` and a download-friendly `Content-Disposition` header.
- Rejects forged conversation IDs and invalid attachment IDs with 404/403 responses.

## Allowed file types

- application/pdf
- image/png
- image/jpeg
- image/webp
- text/plain
- application/msword
- application/vnd.openxmlformats-officedocument.wordprocessingml.document
- application/vnd.ms-excel
- application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
- application/vnd.ms-powerpoint
- application/vnd.openxmlformats-officedocument.presentationml.presentation

## Limits

- `MAX_ATTACHMENT_SIZE`: default 10 MB
- `MAX_ATTACHMENTS_PER_MESSAGE`: default 5

## Authorization behavior

- Learners and centres can only access attachments for conversations they already belong to.
- Admins can access support conversation attachments only when the conversation is a valid support thread.
- Unrelated users receive 403 or 404.
- The backend verifies the conversation membership before serving file content; attachment IDs alone are not trusted.

## Message attachment schema

The attachment metadata stored in the message document contains only non-binary metadata:

- `id`
- `originalName`
- `storedName`
- `mimeType`
- `size`
- `url`
- `createdAt`

The actual binary file is never stored inside MongoDB.

## Security limitations

This implementation does not perform malware scanning or AV analysis. That limitation is documented intentionally because no malware scanning service is configured in this backend. The local filesystem abstraction is still secure against path traversal, public exposure, and unauthorized access by verifying conversation membership before file reads.

## Storage provider configuration

- `ATTACHMENT_STORAGE_PROVIDER=local` (default): uses `ATTACHMENT_STORAGE_DIR`.
- `ATTACHMENT_STORAGE_PROVIDER=r2`: requires the existing `R2_*` settings.
- `ATTACHMENT_STORAGE_PROVIDER=supabase`: requires all three `SUPABASE_*` settings above. Incomplete Supabase configuration fails at the backend provider boundary and never falls back to local storage.
