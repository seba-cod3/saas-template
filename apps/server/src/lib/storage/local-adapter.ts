import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import type { DownloadResult, StorageAdapter, UploadOptions, UploadResult } from './types.js'

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.zip': 'application/zip',
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  return MIME_TYPES[ext] || 'application/octet-stream'
}

export class LocalStorageAdapter implements StorageAdapter {
  private dir: string

  constructor() {
    this.dir = path.resolve(process.env.ASSET_LOCAL_DIR || 'dev_only/uploads')
  }

  private resolvePath(key: string): string {
    return path.join(this.dir, key)
  }

  private async ensureDir(filePath: string): Promise<void> {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
  }

  async upload(key: string, stream: ReadableStream | Readable, _opts?: UploadOptions): Promise<UploadResult> {
    const filePath = this.resolvePath(key)
    await this.ensureDir(filePath)

    const nodeStream = stream instanceof Readable
      ? stream
      : Readable.fromWeb(stream as import('node:stream/web').ReadableStream)

    const writeStream = fs.createWriteStream(filePath)

    await new Promise<void>((resolve, reject) => {
      nodeStream.pipe(writeStream)
      writeStream.on('finish', resolve)
      writeStream.on('error', reject)
      nodeStream.on('error', reject)
    })

    const stat = await fs.promises.stat(filePath)
    return { key, size: stat.size }
  }

  async download(key: string): Promise<DownloadResult> {
    const filePath = this.resolvePath(key)
    const stat = await fs.promises.stat(filePath)
    const nodeStream = fs.createReadStream(filePath)
    const webStream = Readable.toWeb(nodeStream) as ReadableStream

    return {
      stream: webStream,
      contentType: getMimeType(filePath),
      contentLength: stat.size,
    }
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolvePath(key)
    await fs.promises.unlink(filePath)
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.promises.access(this.resolvePath(key))
      return true
    } catch {
      return false
    }
  }
}
