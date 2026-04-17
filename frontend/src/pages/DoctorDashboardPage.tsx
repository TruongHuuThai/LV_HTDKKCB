import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, Loader2 } from 'lucide-react';

import { doctorStatsApi } from '@/services/api/doctorStatsApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  AdminSelect,
  AdminSelectContent,
  AdminSelectItem,
  AdminSelectTrigger,
  AdminSelectValue,
} from '@/components/admin/AdminSelect';
import { logFrontendError } from '@/lib/frontendLogger';

function toDateOnlyIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function getDefaultRange() {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 29);
  return { fromDate: toDateOnlyIso(from), toDate: toDateOnlyIso(to) };
}

export default function DoctorDashboardPage() {
  const defaultRange = useMemo(() => getDefaultRange(), []);
  const [fromDate, setFromDate] = useState(defaultRange.fromDate);
  const [toDate, setToDate] = useState(defaultRange.toDate);
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');
  const [exporting, setExporting] = useState(false);

  const params = useMemo(
    () => ({
      fromDate,
      toDate,
      groupBy,
    }),
    [fromDate, toDate, groupBy],
  );

  const summaryQuery = useQuery({
    queryKey: ['doctor-stats-summary', params],
    queryFn: () => doctorStatsApi.getSummary(params),
  });

  const trendsQuery = useQuery({
    queryKey: ['doctor-stats-trends', params],
    queryFn: () => doctorStatsApi.getTrends(params),
  });

  const summary = summaryQuery.data;
  const trends = trendsQuery.data?.items || [];

  const handleExportPdf = async () => {
    try {
      setExporting(true);
      await doctorStatsApi.downloadPdf(params);
      toast.success('Da xuat bao cao PDF cho bac si.');
    } catch (error) {
      logFrontendError('doctor-dashboard-export-pdf', error, params);
      toast.error('Khong the xuat bao cao PDF luc nay.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Thong ke phuc vu bac si</h1>
          <p className="mt-1 text-sm text-gray-500">
            Theo doi khoi luong kham va xuat bao cao PDF theo khoang thoi gian.
          </p>
        </div>
        <Button onClick={handleExportPdf} disabled={exporting} className="w-full lg:w-auto">
          {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Xuat thong ke PDF
        </Button>
      </div>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-base">Bo loc thong ke</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          <AdminSelect value={groupBy} onValueChange={(value) => setGroupBy(value as 'day' | 'week' | 'month')}>
            <AdminSelectTrigger>
              <AdminSelectValue placeholder="Chon kieu nhom" />
            </AdminSelectTrigger>
            <AdminSelectContent>
              <AdminSelectItem value="day">Theo ngay</AdminSelectItem>
              <AdminSelectItem value="week">Theo tuan</AdminSelectItem>
              <AdminSelectItem value="month">Theo thang</AdminSelectItem>
            </AdminSelectContent>
          </AdminSelect>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tong lich hen" value={summary?.totalAppointments} loading={summaryQuery.isLoading} />
        <StatCard label="Da kham" value={summary?.completedAppointments} loading={summaryQuery.isLoading} />
        <StatCard label="Da huy" value={summary?.canceledAppointments} loading={summaryQuery.isLoading} />
        <StatCard label="No-show" value={summary?.noShowAppointments} loading={summaryQuery.isLoading} />
        <StatCard label="Lich hom nay" value={summary?.todayAppointments} loading={summaryQuery.isLoading} />
        <StatCard label="Lich tuan nay" value={summary?.thisWeekAppointments} loading={summaryQuery.isLoading} />
        <StatCard label="Ty le huy (%)" value={summary?.cancellationRate} loading={summaryQuery.isLoading} />
        <StatCard label="Ty le no-show (%)" value={summary?.noShowRate} loading={summaryQuery.isLoading} />
      </div>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-base">Xu huong lich kham</CardTitle>
        </CardHeader>
        <CardContent>
          {trendsQuery.isLoading ? (
            <p className="text-sm text-slate-500">Dang tai du lieu xu huong...</p>
          ) : trendsQuery.isError ? (
            <p className="text-sm text-rose-600">Khong the tai xu huong thong ke.</p>
          ) : trends.length === 0 ? (
            <p className="text-sm text-slate-500">Khong co du lieu trong khoang da chon.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">Moc</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">Tong</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">Da kham</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">Da huy</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">No-show</th>
                  </tr>
                </thead>
                <tbody>
                  {trends.map((item) => (
                    <tr key={item.label} className="border-b border-slate-100">
                      <td className="px-3 py-2 text-slate-700">{item.label}</td>
                      <td className="px-3 py-2 text-slate-700">{item.total}</td>
                      <td className="px-3 py-2 text-slate-700">{item.completed}</td>
                      <td className="px-3 py-2 text-slate-700">{item.canceled}</td>
                      <td className="px-3 py-2 text-slate-700">{item.noShow}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  loading,
}: {
  label: string;
  value: number | undefined;
  loading: boolean;
}) {
  return (
    <Card className="border-slate-200">
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-slate-900">{loading ? '...' : value ?? 0}</p>
      </CardContent>
    </Card>
  );
}
