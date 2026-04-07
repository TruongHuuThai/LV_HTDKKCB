import { Link, useSearchParams } from 'react-router-dom';
import { useMemo } from 'react';
import { AlertCircle, CheckCircle2, Clock3, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppointmentPaymentStatus, useRetryPayment } from '@/hooks/usePatientAppointments';
import { getLastPaymentContext, setLastPaymentContext } from '@/lib/patientPaymentFlow';
import { canOpenPaymentUrl, getPaymentStatusLabel, isRetryPaymentAllowed } from '@/lib/appointments';
import { getPatientFlowErrorMessage } from '@/lib/patientFlowError';
import { logFrontendError } from '@/lib/frontendLogger';

function parseAppointmentId(search: URLSearchParams) {
  const candidates = [search.get('appointmentId'), search.get('dkMa'), search.get('DK_MA')];
  for (const value of candidates) {
    const parsed = Number.parseInt(value || '', 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  const fromStorage = getLastPaymentContext();
  return fromStorage?.appointmentId || 0;
}

export default function PaymentResultPage() {
  const [searchParams] = useSearchParams();
  const appointmentId = useMemo(() => parseAppointmentId(searchParams), [searchParams]);
  const hintedSuccess = searchParams.get('success');
  const paymentRef = searchParams.get('ref');

  const paymentStatusQuery = useAppointmentPaymentStatus(appointmentId);
  const retryMutation = useRetryPayment();

  const paymentStatus = paymentStatusQuery.data?.payment?.normalizedStatus;
  const paymentUrl = retryMutation.data?.payment_url;

  const inferredState = useMemo(() => {
    if (paymentStatus === 'paid') return 'success';
    if (paymentStatus === 'pending') return 'pending';
    if (paymentStatus === 'failed' || paymentStatus === 'expired' || paymentStatus === 'unpaid') return 'failed';
    if (hintedSuccess === 'true') return 'pending';
    if (hintedSuccess === 'false') return 'failed';
    return 'pending';
  }, [paymentStatus, hintedSuccess]);

  const handleRetryPayment = () => {
    if (!appointmentId) {
      toast.error('Không xác ð?nh ðý?c l?ch h?n ð? thanh toán l?i.');
      return;
    }

    retryMutation.mutate(appointmentId, {
      onSuccess: (result) => {
        setLastPaymentContext({ appointmentId, createdAt: new Date().toISOString() });
        if (canOpenPaymentUrl(result.payment_url)) {
          window.location.assign(result.payment_url as string);
          return;
        }
        toast.success('Ð? t?o yêu c?u thanh toán l?i. Vui l?ng vào chi ti?t l?ch h?n ð? ti?p t?c.');
      },
      onError: (error) => {
        logFrontendError('payment-result-retry', error, { appointmentId });
        toast.error(getPatientFlowErrorMessage(error, 'Không th? thanh toán l?i lúc này.'));
      },
    });
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle>K?t qu? thanh toán</CardTitle>
          <CardDescription>
            H? th?ng luôn xác minh l?i tr?ng thái t? backend ð? ð?m b?o chính xác, không ch? d?a trên URL tr? v?.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!appointmentId ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
              Không xác ð?nh ðý?c l?ch h?n t? phiên thanh toán trý?c ðó. Vui l?ng vào m?c L?ch h?n c?a tôi ð? ki?m tra.
            </div>
          ) : null}

          {paymentStatusQuery.isLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-600">
              Ðang xác minh tr?ng thái thanh toán...
            </div>
          ) : paymentStatusQuery.isError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
              {getPatientFlowErrorMessage(paymentStatusQuery.error, 'Không th? xác minh tr?ng thái thanh toán.')} 
              <Button
                variant="outline"
                className="ml-3"
                onClick={() => paymentStatusQuery.refetch()}
              >
                Ki?m tra l?i
              </Button>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 p-6">
              <div className="flex items-start gap-4">
                {inferredState === 'success' ? (
                  <CheckCircle2 className="mt-0.5 h-8 w-8 text-emerald-600" />
                ) : inferredState === 'failed' ? (
                  <AlertCircle className="mt-0.5 h-8 w-8 text-red-600" />
                ) : (
                  <Clock3 className="mt-0.5 h-8 w-8 text-amber-600" />
                )}
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold text-slate-900">
                    {inferredState === 'success'
                      ? 'Thanh toán thành công'
                      : inferredState === 'failed'
                        ? 'Thanh toán chýa thành công'
                        : 'Thanh toán ðang ðý?c x? l?'}
                  </h2>
                  <p className="text-sm text-slate-600">
                    Tr?ng thái hi?n t?i: {paymentStatus ? getPaymentStatusLabel(paymentStatus) : 'Chýa có d? li?u thanh toán'}
                  </p>
                  {paymentRef ? <p className="text-xs text-slate-500">M? tham chi?u c?ng thanh toán: {paymentRef}</p> : null}
                  {appointmentId ? <p className="text-xs text-slate-500">M? l?ch h?n: #{appointmentId}</p> : null}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/appointments/my">Xem l?ch h?n c?a tôi</Link>
            </Button>
            {appointmentId ? (
              <Button asChild variant="outline">
                <Link to={`/appointments/${appointmentId}`}>Xem chi ti?t l?ch h?n</Link>
              </Button>
            ) : null}
            <Button variant="outline" asChild>
              <Link to="/booking">Ð?t l?ch m?i</Link>
            </Button>
            {paymentStatus && isRetryPaymentAllowed(paymentStatus) ? (
              <Button
                variant="outline"
                onClick={handleRetryPayment}
                disabled={retryMutation.isPending}
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                {retryMutation.isPending ? 'Ðang t?o thanh toán l?i...' : 'Thanh toán l?i'}
              </Button>
            ) : null}
          </div>

          <p className="text-sm text-slate-500">
            N?u tr?ng thái v?n ? m?c "Ðang x? l?" quá lâu, b?n có th? ki?m tra l?i sau vài phút ho?c liên h? qu?y h? tr?.
          </p>
        </CardContent>
      </Card>

      {canOpenPaymentUrl(paymentUrl) ? (
        <Card className="mt-6 border-blue-100 bg-blue-50">
          <CardContent className="py-4 text-sm text-blue-800">
            N?u tr?nh duy?t không t? chuy?n hý?ng, b?n có th? dùng l?i liên k?t thanh toán v?a t?o.
            <a className="ml-2 font-medium underline" href={paymentUrl as string}>
              M? c?ng thanh toán
            </a>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
