# Railway Buckets for Meeting Audio Backups

Meeting transcriptions need recoverable audio so failed transcription, summary generation, or block insertion can be retried without asking the user to re-record. We will store meeting audio backups in Railway Buckets through their S3-compatible API, while keeping the visible meeting notes as blocks and treating the persisted Meeting Recording as the processing/recovery artifact. Railway Buckets are private, environment-scoped, and provide the S3 credentials needed by the app, which fits the existing Railway deployment better than adding an external storage provider.

## Consequences

The app prefers app-scoped bucket variables (`AUDIO_BUCKET_NAME`, `AUDIO_BUCKET_ACCESS_KEY_ID`, `AUDIO_BUCKET_SECRET_ACCESS_KEY`, `AUDIO_BUCKET_REGION`, and `AUDIO_BUCKET_ENDPOINT`) in production. Railway's short bucket variables (`BUCKET`, `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY`, `REGION`, and `ENDPOINT`) remain supported as a complete fallback set. Local development can run without bucket storage, but server-side retry from archived audio only works when bucket storage is configured.
