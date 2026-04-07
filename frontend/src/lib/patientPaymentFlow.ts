const LAST_PAYMENT_CONTEXT_KEY = 'umc-last-payment-context';

export interface LastPaymentContext {
  appointmentId: number;
  createdAt: string;
}

export function setLastPaymentContext(context: LastPaymentContext) {
  localStorage.setItem(LAST_PAYMENT_CONTEXT_KEY, JSON.stringify(context));
}

export function getLastPaymentContext(): LastPaymentContext | null {
  try {
    const raw = localStorage.getItem(LAST_PAYMENT_CONTEXT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastPaymentContext;
    if (!parsed || !parsed.appointmentId) return null;
    return parsed;
  } catch {
    return null;
  }
}
