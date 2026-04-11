import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'
import type { AiProvider } from './types.js'

export function resolveModel(provider: AiProvider, model: string): LanguageModel {
  switch (provider) {
    case 'openai':
      return openai(model)
    case 'anthropic':
      return anthropic(model)
    default: {
      const _exhaustive: never = provider
      throw new Error(`Unknown AI provider: ${_exhaustive}`)
    }
  }
}
