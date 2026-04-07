export function logFrontendError(scope: string, error: unknown, metadata?: Record<string, unknown>) {
  // Placeholder to integrate Sentry/Datadog later without changing callsites.
  // Keep this centralized for pilot-production diagnostics.
  // eslint-disable-next-line no-console
  console.error(`[frontend:${scope}]`, { error, ...metadata });
}
