import type { StorageAdapter } from './types.js'

let _adapter: StorageAdapter | null = null

export async function getStorage(): Promise<StorageAdapter> {
  if (_adapter) return _adapter

  const provider = process.env.ASSET_PROVIDER || 'local'

  switch (provider) {
    case 'local': {
      const { LocalStorageAdapter } = await import('./local-adapter.js')
      _adapter = new LocalStorageAdapter()
      break
    }
    case 's3': {
      // Uncomment s3-adapter.ts and install @aws-sdk/client-s3 first
      // See packages/docs/storage-s3.md
      // const { S3StorageAdapter } = await import('./s3-adapter.js')
      // _adapter = new S3StorageAdapter()
      throw new Error('S3 adapter not enabled. See packages/docs/storage-s3.md')
    }
    default:
      throw new Error(`Unknown ASSET_PROVIDER: ${provider}`)
  }

  return _adapter
}

export type { StorageAdapter, UploadOptions, UploadResult, DownloadResult } from './types.js'
