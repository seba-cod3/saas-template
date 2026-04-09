# S3-Compatible Storage (Cloudflare R2 / AWS S3)

The asset piping system supports S3-compatible providers out of the box. The default documented provider is **Cloudflare R2** (S3-compatible, no egress fees), but it works with AWS S3 as well.

## Setup

### 1. Install dependencies

```bash
pnpm --filter @saas-template/server add @aws-sdk/client-s3 @aws-sdk/lib-storage
```

### 2. Uncomment the S3 adapter

Open `apps/server/src/lib/storage/s3-adapter.ts` and uncomment the entire implementation.

### 3. Configure environment variables

Add to `apps/server/.env`:

```env
ASSET_PROVIDER=s3
S3_BUCKET=your-bucket-name
S3_REGION=auto
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
```

#### Cloudflare R2

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) > R2 Object Storage
2. Create a bucket
3. Go to **Manage R2 API Tokens** > Create API Token
4. Copy the **Access Key ID**, **Secret Access Key**, and the **Endpoint URL**
5. `S3_REGION` should be `auto` for R2
6. `S3_ENDPOINT` is `https://<account-id>.r2.cloudflarestorage.com`

#### AWS S3

1. Create an S3 bucket in your AWS account
2. Create an IAM user with `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `s3:HeadObject` permissions on the bucket
3. `S3_REGION` should be your bucket's region (e.g., `us-east-1`)
4. `S3_ENDPOINT` can be omitted (uses the default AWS endpoint)

### 4. Restart the server

The factory in `lib/storage/index.ts` will pick up `ASSET_PROVIDER=s3` and load the S3 adapter.

## How it works

- **Upload**: Uses `@aws-sdk/lib-storage`'s `Upload` class for streaming multipart upload. The file stream from the client is piped directly to S3 — no temp file on the server.
- **Download**: Uses `GetObjectCommand`. The response body is converted to a web `ReadableStream` and piped directly to the HTTP response.
- **Delete**: Uses `DeleteObjectCommand`.
- **Exists**: Uses `HeadObjectCommand` (no data transfer, just metadata check).

All operations are streaming — the server acts as a proxy, never storing files on disk.
