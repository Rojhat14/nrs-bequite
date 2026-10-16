export const USD_TRY_RATE_POLICY = {
  provider: 'ecb-euro-reference',
  maxRateAgeHours: 96,
  revalidateSeconds: 300,
  fetchTimeoutMs: 8000,
  updateScheduleUtc: '15 17 * * 1-5',
} as const

export const MAX_RATE_AGE_MS = USD_TRY_RATE_POLICY.maxRateAgeHours * 60 * 60 * 1000
