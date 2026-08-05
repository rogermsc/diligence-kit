import { NextRequest, NextResponse } from 'next/server'

type LimitRule = {
  name: string
  match: (p: string) => boolean
  requests: number
  windowMs: number
}

const LIMITS: LimitRule[] = [
  { name: 'auth:login',       match: p => p.startsWith('/api/auth/login'),        requests: 10, windowMs: 60_000 },
  { name: 'auth:logout',      match: p => p.startsWith('/api/auth/logout'),       requests: 20, windowMs: 60_000 },
  { name: 'auth:check',       match: p => p.startsWith('/api/auth/check'),        requests: 20, windowMs: 60_000 },
  { name: 'automation:start', match: p => p.startsWith('/api/automation/start'),  requests: 50, windowMs: 60_000 },
  { name: 'automation:create',match: p => p.startsWith('/api/automation/create'), requests: 20, windowMs: 60_000 },
  { name: 'upload-document',  match: p => p.endsWith('/upload-document'),         requests: 50, windowMs: 60_000 },
  { name: 'confirm',          match: p => p.endsWith('/confirm'),                 requests: 20, windowMs: 60_000 },
  { name: 'retry',            match: p => p.endsWith('/retry'),                   requests: 10, windowMs: 60_000 },
  { name: 'chat',             match: p => p.startsWith('/api/chat'),              requests: 30, windowMs: 60_000 },
]

// In-memory store — works for single-replica; replace with Redis for multi-replica
const store = new Map<string, { count: number; resetAt: number }>()

// Periodically clean expired windows to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key)
  }
}, 60_000)

function getRule(pathname: string): LimitRule | null {
  return LIMITS.find(rule => rule.match(pathname)) ?? null
}

const IPv4_RE = /^(\d{1,3}\.){3}\d{1,3}$/

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (forwarded && IPv4_RE.test(forwarded)) return forwarded

  const realIp = request.headers.get('x-real-ip')?.trim()
  if (realIp && IPv4_RE.test(realIp)) return realIp

  return 'unknown'
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const rule = getRule(pathname)

  if (!rule) return NextResponse.next()

  const ip = getClientIp(request)
  // Use rule name instead of full pathname so different automationIds share the same bucket
  const key = `${ip}:${rule.name}`
  const now = Date.now()

  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + rule.windowMs })
    return NextResponse.next()
  }

  if (entry.count >= rule.requests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(rule.requests),
          'X-RateLimit-Reset': String(Math.ceil(entry.resetAt / 1000)),
        },
      }
    )
  }

  entry.count++
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/api/auth/login',
    '/api/auth/logout',
    '/api/auth/check',
    '/api/automation/start/:path*',
    '/api/automation/create/:path*',
    '/api/automation/:path*/upload-document',
    '/api/automation/:path*/confirm',
    '/api/automation/:path*/retry',
    '/api/chat/:path*',
  ],
}
