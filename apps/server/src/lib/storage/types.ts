import type { Readable } from 'node:stream'

export interface StorageAdapter {
  upload(key: string, stream: ReadableStream | Readable, opts?: UploadOptions): Promise<UploadResult>
  download(key: string): Promise<DownloadResult>
  delete(key: string): Promise<void>
  exists(key: string): Promise<boolean>
}

export interface UploadOptions {
  contentType?: string
  contentLength?: number
}

export interface UploadResult {
  key: string
  size?: number
}

export interface DownloadResult {
  stream: ReadableStream
  contentType?: string
  contentLength?: number
}
