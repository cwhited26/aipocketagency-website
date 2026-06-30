// Website Monitoring App — shared types.
//
// The owner registers URLs to watch; a */5 cron polls the due ones and stages a website_alert
// Mission Control card when the observed state changes in a way the owner asked to be told about.

import { z } from 'zod'

/** The poll intervals the surface exposes (5 / 15 / 60 / 360 minutes), in seconds. */
export const CHECK_INTERVALS_SECONDS = [300, 900, 3600, 21600] as const
export type CheckIntervalSeconds = (typeof CHECK_INTERVALS_SECONDS)[number]

/** A response slower than this (ms) trips the slow-response alert. */
export const SLOW_RESPONSE_THRESHOLD_MS = 3000

/** A row of pa_monitored_websites as the diff + cron logic consume it (subset of the table). */
export interface MonitoredWebsite {
  id: string
  ownerId: string
  url: string
  checkIntervalSeconds: number
  alertOnStatusChange: boolean
  alertOnContentChange: boolean
  alertOnSlowResponse: boolean
  /** Days-before-expiry threshold for the SSL alert; 0 disables it. */
  alertOnSslExpiryDays: number
  lastCheckAt: string | null
  lastStatus: number | null
  lastResponseMs: number | null
  lastContentHash: string | null
  lastSslExpiresAt: string | null
  isActive: boolean
}

/** The result of polling one URL during a cron tick. */
export interface CheckResult {
  /** true when the URL answered with a 2xx/3xx and no transport error. */
  ok: boolean
  /** Raw HTTP status, or null when the request errored before a response arrived. */
  status: number | null
  /** Round-trip time in ms (HEAD + GET combined). */
  responseMs: number
  /** SHA-256 of the GET body, or null when the body could not be read. */
  contentHash: string | null
  /** TLS certificate notAfter, or null when not an https URL / not resolvable. */
  sslExpiresAt: string | null
  /** Transport-level error message when the fetch failed, else null. */
  error: string | null
}

/** Why a website_alert card is being staged. */
export type AlertKind = 'status_change' | 'slow_response' | 'content_change' | 'ssl_expiry'

export interface WebsiteAlert {
  kind: AlertKind
  /** One plain-English line for the Mission Control card. */
  summary: string
}

/** Zod schema for the brief the surface POSTs when adding / editing a watched URL. */
export const monitoredWebsiteInputSchema = z.object({
  url: z.string().url().max(2048),
  checkIntervalSeconds: z
    .number()
    .int()
    .refine((n): n is CheckIntervalSeconds => (CHECK_INTERVALS_SECONDS as readonly number[]).includes(n), {
      message: 'check_interval_seconds must be one of 300, 900, 3600, 21600',
    }),
  alertOnStatusChange: z.boolean(),
  alertOnContentChange: z.boolean(),
  alertOnSlowResponse: z.boolean(),
  alertOnSslExpiryDays: z.number().int().min(0).max(365),
})

export type MonitoredWebsiteInput = z.infer<typeof monitoredWebsiteInputSchema>
