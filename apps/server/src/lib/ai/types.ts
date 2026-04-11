import type { AiProvider } from '@repo/shared/ai'

export type { AiProvider }

export interface CatalogEntry {
  provider: AiProvider
  model: string
  enabled: boolean
  displayName: string
  supportsAttachments: boolean
  supportsTools: boolean
  maxContextTokens: number
  pricing: {
    promptPerMTokUsd: number
    completionPerMTokUsd: number
  }
}

export interface UsageCapture {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  finishReason: string
  toolCount: number
}
