import { createFileRoute } from '@tanstack/react-router'
import { chat, maxIterations, toServerSentEventsResponse } from '@tanstack/ai'
import { anthropicText } from '@tanstack/ai-anthropic'
import { openaiText } from '@tanstack/ai-openai'
import { geminiText } from '@tanstack/ai-gemini'
import { ollamaText } from '@tanstack/ai-ollama'

import { fetchUserFromRequest } from '@/data/getSignedInUserId'
import { forbiddenOriginResponse, isOriginAllowed } from '@/utils/csrf'
import { getGuitars, recommendGuitarToolDef } from '@/lib/demo-guitar-tools'

const SYSTEM_PROMPT = `You are a helpful assistant for a store that sells guitars.

CRITICAL INSTRUCTIONS - YOU MUST FOLLOW THIS EXACT WORKFLOW:

When a user asks for a guitar recommendation:
1. FIRST: Use the getGuitars tool (no parameters needed)
2. SECOND: Use the recommendGuitar tool with the ID of the guitar you want to recommend
3. NEVER write a recommendation directly - ALWAYS use the recommendGuitar tool

IMPORTANT:
- The recommendGuitar tool will display the guitar in a special, appealing format
- You MUST use recommendGuitar for ANY guitar recommendation
- ONLY recommend guitars from our inventory (use getGuitars first)
- The recommendGuitar tool has a buy button - this is how customers purchase
- Do NOT describe the guitar yourself - let the recommendGuitar tool do it
`

// Per-user in-memory rate limiter: 20 requests / 60s. Replace with Redis in prod (multi-instance).
const RATE_WINDOW_MS = 60_000
const RATE_LIMIT = 20
const rateBuckets = new Map<string, { count: number; windowStart: number }>()
let lastSweep = Date.now()

// Evict expired buckets so the map stays bounded by active-users-per-window
// instead of growing once per user that ever hit the endpoint.
function sweepExpired(now: number) {
  if (now - lastSweep < RATE_WINDOW_MS) return
  lastSweep = now
  for (const [key, bucket] of rateBuckets) {
    if (now - bucket.windowStart >= RATE_WINDOW_MS) rateBuckets.delete(key)
  }
}

function rateLimit(
  userId: string,
): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now()
  sweepExpired(now)
  const bucket = rateBuckets.get(userId)
  if (!bucket || now - bucket.windowStart >= RATE_WINDOW_MS) {
    rateBuckets.set(userId, { count: 1, windowStart: now })
    return { ok: true }
  }
  if (bucket.count >= RATE_LIMIT) {
    const retryAfter = Math.ceil(
      (RATE_WINDOW_MS - (now - bucket.windowStart)) / 1000,
    )
    return { ok: false, retryAfter }
  }
  bucket.count += 1
  return { ok: true }
}

export const Route = createFileRoute('/demo/api/ai/chat')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const requestSignal = request.signal
        if (requestSignal.aborted) return new Response(null, { status: 499 })

        if (!isOriginAllowed(request)) return forbiddenOriginResponse()

        const user = await fetchUserFromRequest(request)
        if (!user) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const limit = rateLimit(user.id)
        if (!limit.ok) {
          return new Response(JSON.stringify({ error: 'Too Many Requests' }), {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': String(limit.retryAfter),
            },
          })
        }

        const abortController = new AbortController()

        try {
          const body = await request.json()
          const { messages } = body

          let provider: string = 'ollama'
          let model: string = 'mistral:7b'
          if (process.env.ANTHROPIC_API_KEY) {
            provider = 'anthropic'
            model = 'claude-haiku-4-5'
          } else if (process.env.OPENAI_API_KEY) {
            provider = 'openai'
            model = 'gpt-4o'
          } else if (process.env.GEMINI_API_KEY) {
            provider = 'gemini'
            model = 'gemini-2.0-flash-exp'
          }

          const adapterConfig = {
            anthropic: () =>
              anthropicText((model || 'claude-haiku-4-5') as any),
            openai: () => openaiText((model || 'gpt-4o') as any),
            gemini: () => geminiText((model || 'gemini-2.0-flash-exp') as any),
            ollama: () => ollamaText((model || 'mistral:7b') as any),
          }

          const adapter = adapterConfig[provider]()

          const stream = chat({
            adapter,
            tools: [getGuitars, recommendGuitarToolDef],
            systemPrompts: [SYSTEM_PROMPT],
            agentLoopStrategy: maxIterations(5),
            messages,
            abortController,
          })

          return toServerSentEventsResponse(stream, { abortController })
        } catch (error: any) {
          if (error.name === 'AbortError' || abortController.signal.aborted) {
            return new Response(null, { status: 499 })
          }
          return new Response(
            JSON.stringify({ error: 'Failed to process chat request' }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }
      },
    },
  },
})
