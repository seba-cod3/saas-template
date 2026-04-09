import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import path from 'node:path'

/**
 * Extract a File from the request body.
 * Throws 400 if no file is found under the given field name.
 */
export async function extractFile(c: Context, field = 'file'): Promise<File> {
  const body = await c.req.parseBody()
  const file = body[field]

  if (!(file instanceof File)) {
    throw new HTTPException(400, { message: `No file provided in field "${field}"` })
  }

  return file
}

/**
 * Validate that a file's MIME type is in the allowed list.
 * Throws 400 with a descriptive message if not allowed.
 *
 * Usage:
 *   assertFileType(file, ['image/png', 'image/jpeg', 'image/webp'])
 */
export function assertFileType(file: File, allowedMimeTypes: string[]): void {
  if (!allowedMimeTypes.includes(file.type)) {
    throw new HTTPException(400, {
      message: `File type "${file.type}" is not allowed. Allowed: ${allowedMimeTypes.join(', ')}`,
    })
  }
}

/**
 * Get the file extension from a filename (including the dot).
 */
export function getExtension(filename: string): string {
  return path.extname(filename).toLowerCase()
}
