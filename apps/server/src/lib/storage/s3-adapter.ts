/**
 * S3-Compatible Storage Adapter (Cloudflare R2 / AWS S3)
 *
 * This adapter is ready to use once you install the AWS SDK dependencies.
 * See packages/docs/storage-s3.md for setup instructions.
 *
 * Required dependencies:
 *   pnpm --filter @saas-template/server add @aws-sdk/client-s3 @aws-sdk/lib-storage
 *
 * Required env vars:
 *   ASSET_PROVIDER=s3
 *   S3_BUCKET=your-bucket-name
 *   S3_REGION=auto                          # "auto" for R2, or your AWS region
 *   S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com  # required for R2
 *   S3_ACCESS_KEY_ID=your-access-key
 *   S3_SECRET_ACCESS_KEY=your-secret-key
 */

// import { Readable } from 'node:stream'
// import {
//   S3Client,
//   GetObjectCommand,
//   DeleteObjectCommand,
//   HeadObjectCommand,
// } from '@aws-sdk/client-s3'
// import { Upload } from '@aws-sdk/lib-storage'
// import type { DownloadResult, StorageAdapter, UploadOptions, UploadResult } from './types.js'
//
// export class S3StorageAdapter implements StorageAdapter {
//   private client: S3Client
//   private bucket: string
//
//   constructor() {
//     this.bucket = process.env.S3_BUCKET!
//     if (!this.bucket) throw new Error('S3_BUCKET env var is required')
//
//     this.client = new S3Client({
//       region: process.env.S3_REGION || 'auto',
//       endpoint: process.env.S3_ENDPOINT,
//       credentials: {
//         accessKeyId: process.env.S3_ACCESS_KEY_ID!,
//         secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
//       },
//     })
//   }
//
//   async upload(key: string, stream: ReadableStream | Readable, opts?: UploadOptions): Promise<UploadResult> {
//     const nodeStream = stream instanceof Readable
//       ? stream
//       : Readable.fromWeb(stream as import('node:stream/web').ReadableStream)
//
//     const upload = new Upload({
//       client: this.client,
//       params: {
//         Bucket: this.bucket,
//         Key: key,
//         Body: nodeStream,
//         ContentType: opts?.contentType,
//       },
//     })
//
//     await upload.done()
//     return { key }
//   }
//
//   async download(key: string): Promise<DownloadResult> {
//     const response = await this.client.send(
//       new GetObjectCommand({ Bucket: this.bucket, Key: key }),
//     )
//
//     if (!response.Body) throw new Error(`Empty response for key: ${key}`)
//
//     const webStream = response.Body.transformToWebStream()
//
//     return {
//       stream: webStream,
//       contentType: response.ContentType,
//       contentLength: response.ContentLength,
//     }
//   }
//
//   async delete(key: string): Promise<void> {
//     await this.client.send(
//       new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
//     )
//   }
//
//   async exists(key: string): Promise<boolean> {
//     try {
//       await this.client.send(
//         new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
//       )
//       return true
//     } catch {
//       return false
//     }
//   }
// }
