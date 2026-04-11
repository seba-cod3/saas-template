import type { AiProvider, CatalogEntry } from './types.js'

export type { CatalogEntry }

// TODO: Handle this dynamically
export const CATALOG: CatalogEntry[] = [
  {
    provider: 'openai',
    model: 'gpt-4o-mini',
    enabled: true,
    displayName: 'GPT-4o Mini',
    supportsAttachments: true,
    supportsTools: true,
    maxContextTokens: 128_000,
    pricing: { promptPerMTokUsd: 0.15, completionPerMTokUsd: 0.6 },
  },
  {
    provider: 'openai',
    model: 'gpt-4o',
    enabled: true,
    displayName: 'GPT-4o',
    supportsAttachments: true,
    supportsTools: true,
    maxContextTokens: 128_000,
    pricing: { promptPerMTokUsd: 2.5, completionPerMTokUsd: 10.0 },
  },
  {
    provider: 'anthropic',
    model: 'claude-haiku-4-5-20251001',
    enabled: true,
    displayName: 'Claude Haiku 4.5',
    supportsAttachments: true,
    supportsTools: true,
    maxContextTokens: 200_000,
    pricing: { promptPerMTokUsd: 0.8, completionPerMTokUsd: 4.0 },
  },
  {
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
    enabled: true,
    displayName: 'Claude Sonnet 4.5',
    supportsAttachments: true,
    supportsTools: true,
    maxContextTokens: 200_000,
    pricing: { promptPerMTokUsd: 3.0, completionPerMTokUsd: 15.0 },
  },
]

export function toPublicCatalog() {
  return CATALOG.filter((c) => c.enabled).map(({ provider, model, enabled }) => ({
    provider,
    model,
    enabled,
  }))
}

export function getEntry(provider: AiProvider, model: string): CatalogEntry | null {
  return CATALOG.find((c) => c.provider === provider && c.model === model) ?? null
}
