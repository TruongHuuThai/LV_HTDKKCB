export function getApiErrorMessage(error: unknown, fallback: string) {
  const message = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;

  if (Array.isArray(message)) {
    const normalized = message.filter(
      (item): item is string => typeof item === 'string' && item.trim().length > 0,
    );

    if (normalized.length > 0) {
      return normalized.join(' ');
    }
  }

  if (typeof message === 'string' && message.trim().length > 0) {
    return message;
  }

  return fallback;
}
