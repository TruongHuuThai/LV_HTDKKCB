import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Download,
  Loader2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  UserX,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { doctorStatsApi } from '@/services/api/doctorStatsApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AdminSelect,
  AdminSelectContent,
  AdminSelectItem,
  AdminSelectTrigger,
  AdminSelectValue,
} from '@/components/admin/AdminSelect';
import { cn } from '@/lib/utils';
import { logFrontendError } from '@/lib/frontendLogger';

type GroupBy = 'day' | 'week' | 'month';
type QuickRangeKey = 'today' | 'last7' | 'last30' | 'thisMonth';
type InsightTone = 'blue' | 'amber' | 'rose' | 'emerald';

interface InsightItem {
  id: string;
  tone: InsightTone;
  title: string;
  description: string;
  icon: LucideIcon;
}

const QUICK_RANGES: Array<{ key: QuickRangeKey; label: string }> = [
  { key: 'today', label: 'Hôm nay' },
  { key: 'last7', label: '7 ngày qua' },
  { key: 'last30', label: '30 ngày qua' },
  { key: 'thisMonth', label: 'Tháng này' },
];

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

function getRangeByQuickKey(key: QuickRangeKey) {
  const today = new Date();
  const from = new Date(today);
  const to = new Date(today);

  if (key === 'today') {
    return { fromDate: toDateOnlyIso(today), toDate: toDateOnlyIso(today) };
  }

  if (key === 'last7') {
    from.setDate(today.getDate() - 6);
    return { fromDate: toDateOnlyIso(from), toDate: toDateOnlyIso(to) };
  }

  if (key === 'last30') {
    from.setDate(today.getDate() - 29);
    return { fromDate: toDateOnlyIso(from), toDate: toDateOnlyIso(to) };
  }

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  return { fromDate: toDateOnlyIso(monthStart), toDate: toDateOnlyIso(to) };
}

function formatPercent(value?: number | null) {
  const safe = Number.isFinite(value) ? Number(value) : 0;
  return `${safe.toFixed(1)}%`;
}

function QuickRangeChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-9 items-center rounded-full border px-3 text-sm font-medium transition-colors',
        active
          ? 'border-blue-300 bg-blue-50 text-blue-700'
          : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-slate-50',
      )}
    >
      {label}
    </button>
  );
}

function StatsKpiCard({
  title,
  value,
  description,
  icon: Icon,
  tone = 'blue',
}: {
  title: string;
  value: string | number;
  description: string;
  icon: LucideIcon;
  tone?: 'blue' | 'emerald' | 'rose' | 'amber' | 'slate';
}) {
  const tones: Record<typeof tone, string> = {
    blue: 'border-blue-200 bg-blue-50/60 text-blue-950',
    emerald: 'border-emerald-200 bg-emerald-50/60 text-emerald-950',
    rose: 'border-rose-200 bg-rose-50/60 text-rose-950',
    amber: 'border-amber-200 bg-amber-50/60 text-amber-950',
    slate: 'border-slate-200 bg-slate-50/80 text-slate-900',
  };

  const iconTones: Record<typeof tone, string> = {
    blue: 'bg-blue-100 text-blue-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    rose: 'bg-rose-100 text-rose-700',
    amber: 'bg-amber-100 text-amber-700',
    slate: 'bg-slate-100 text-slate-700',
  };

  return (
    <Card className={cn('rounded-2xl shadow-sm', tones[tone])}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-current/70">{title}</p>
            <p className="mt-2 text-3xl font-semibold leading-none">{value}</p>
            <p className="mt-2 text-xs text-current/75">{description}</p>
          </div>
          <span className={cn('inline-flex h-9 w-9 items-center justify-center rounded-xl', iconTones[tone])}>
            <Icon className="h-4.5 w-4.5" />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function KpiSkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, idx) => (
        <Card key={`doctor-stats-kpi-skeleton-${idx}`} className="rounded-2xl border-slate-200">
          <CardContent className="space-y-3 p-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TrendEmptyState({ onResetRange }: { onResetRange: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
      <CalendarRange className="mx-auto h-10 w-10 text-slate-300" />
      <h3 className="mt-4 text-base font-semibold text-slate-900">Chưa có dữ liệu trong khoảng đã chọn</h3>
      <p className="mt-2 text-sm text-slate-500">
        Thử chọn khoảng thời gian khác để xem xu hướng lịch khám theo ngày, tuần hoặc tháng.
      </p>
      <Button variant="outline" className="mt-4" onClick={onResetRange}>
        Chọn lại 30 ngày gần nhất
      </Button>
    </div>
  );
}

function InsightsPanel({ items }: { items: InsightItem[] }) {
  const toneClasses: Record<InsightTone, string> = {
    blue: 'border-blue-200 bg-blue-50 text-blue-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    rose: 'border-rose-200 bg-rose-50 text-rose-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  };

  return (
    <Card className="rounded-2xl border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Điểm cần chú ý</CardTitle>
        <CardDescription>Gợi ý hành động nhanh dựa trên dữ liệu hiện có trong khoảng thời gian đã chọn.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.id} className={cn('rounded-xl border px-4 py-3', toneClasses[item.tone])}>
              <div className="flex items-start gap-2">
                <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-1 text-sm text-current/80">{item.description}</p>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default function DoctorDashboardPage() {
  const defaultRange = useMemo(() => getDefaultRange(), []);
  const [fromDate, setFromDate] = useState(defaultRange.fromDate);
  const [toDate, setToDate] = useState(defaultRange.toDate);
  const [groupBy, setGroupBy] = useState<GroupBy>('day');
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

  const kpis = useMemo(
    () => [
      {
        title: 'Tổng lịch hẹn',
        value: summary?.totalAppointments ?? 0,
        description: 'Tổng số lịch trong khoảng đã chọn',
        icon: CalendarDays,
        tone: 'blue' as const,
      },
      {
        title: 'Đã khám',
        value: summary?.completedAppointments ?? 0,
        description: 'Số ca đã hoàn tất khám',
        icon: CheckCircle2,
        tone: 'emerald' as const,
      },
      {
        title: 'Đã hủy',
        value: summary?.canceledAppointments ?? 0,
        description: 'Tổng lịch hủy bởi bệnh nhân/hệ thống',
        icon: XCircle,
        tone: 'rose' as const,
      },
      {
        title: 'No-show',
        value: summary?.noShowAppointments ?? 0,
        description: 'Bệnh nhân vắng mặt không đến khám',
        icon: UserX,
        tone: 'amber' as const,
      },
      {
        title: 'Lịch hôm nay',
        value: summary?.todayAppointments ?? 0,
        description: 'Khối lượng khám trong ngày hiện tại',
        icon: CalendarClock,
        tone: 'blue' as const,
      },
      {
        title: 'Lịch tuần này',
        value: summary?.thisWeekAppointments ?? 0,
        description: 'Tổng lịch trong tuần hiện tại',
        icon: CalendarRange,
        tone: 'blue' as const,
      },
      {
        title: 'Tỷ lệ hủy',
        value: formatPercent(summary?.cancellationRate),
        description: 'Cần theo dõi nếu tăng bất thường',
        icon: TrendingDown,
        tone: 'rose' as const,
      },
      {
        title: 'Tỷ lệ no-show',
        value: formatPercent(summary?.noShowRate),
        description: 'Tỷ lệ bệnh nhân không đến khám',
        icon: AlertTriangle,
        tone: 'amber' as const,
      },
    ],
    [summary],
  );

  const maxTrendTotal = useMemo(() => Math.max(...trends.map((item) => item.total), 0), [trends]);

  const insights = useMemo<InsightItem[]>(() => {
    if (!summary) {
      return [
        {
          id: 'loading-insight',
          tone: 'blue',
          title: 'Đang tổng hợp dữ liệu',
          description: 'Hệ thống đang cập nhật chỉ số để tạo insight phù hợp cho bác sĩ.',
          icon: CalendarRange,
        },
      ];
    }

    const next: InsightItem[] = [];

    if (summary.totalAppointments === 0) {
      next.push({
        id: 'empty-range',
        tone: 'amber',
        title: 'Chưa có lịch trong khoảng thời gian này',
        description: 'Bạn có thể mở rộng khoảng ngày để xem thêm dữ liệu khám và xu hướng làm việc.',
        icon: CalendarRange,
      });
      return next;
    }

    if (summary.todayAppointments === 0) {
      next.push({
        id: 'today-empty',
        tone: 'blue',
        title: 'Hôm nay chưa có lịch khám',
        description: 'Kiểm tra lịch tuần để xác nhận các ca sắp tới hoặc cập nhật yêu cầu điều chỉnh.',
        icon: CalendarClock,
      });
    }

    if ((summary.noShowRate ?? 0) >= 12) {
      next.push({
        id: 'high-no-show',
        tone: 'rose',
        title: 'Tỷ lệ no-show đang cao',
        description: `No-show hiện ở mức ${formatPercent(summary.noShowRate)}. Nên rà soát các ca nhắc hẹn trước giờ khám.`,
        icon: AlertTriangle,
      });
    }

    if ((summary.cancellationRate ?? 0) >= 10) {
      next.push({
        id: 'high-cancel',
        tone: 'amber',
        title: 'Tỷ lệ hủy cần theo dõi',
        description: `Tỷ lệ hủy hiện là ${formatPercent(summary.cancellationRate)}. Hãy kiểm tra các ca cần xác nhận sớm.`,
        icon: TrendingDown,
      });
    }

    if (trends.length >= 2) {
      const last = trends[trends.length - 1];
      const previous = trends[trends.length - 2];
      const delta = last.total - previous.total;

      if (delta > 0) {
        next.push({
          id: 'trend-up',
          tone: 'emerald',
          title: 'Khối lượng lịch khám đang tăng',
          description: `Mốc gần nhất tăng ${delta} lịch so với mốc trước. Cân nhắc chuẩn bị thêm thời gian xử lý hồ sơ.`,
          icon: TrendingUp,
        });
      }

      if (delta < 0) {
        next.push({
          id: 'trend-down',
          tone: 'amber',
          title: 'Khối lượng lịch khám đang giảm',
          description: `Mốc gần nhất giảm ${Math.abs(delta)} lịch so với mốc trước. Có thể mở rộng khung lọc để đánh giá chính xác hơn.`,
          icon: TrendingDown,
        });
      }
    }

    if (next.length === 0) {
      next.push({
        id: 'stable',
        tone: 'emerald',
        title: 'Phân bổ lịch khám ổn định',
        description: 'Hiện chưa có bất thường lớn về hủy/no-show. Bạn có thể tiếp tục theo dõi nhịp khám như hiện tại.',
        icon: CheckCircle2,
      });
    }

    return next.slice(0, 3);
  }, [summary, trends]);

  const activeQuickKey = useMemo<QuickRangeKey | null>(() => {
    const matched = QUICK_RANGES.find((item) => {
      const range = getRangeByQuickKey(item.key);
      return range.fromDate === fromDate && range.toDate === toDate;
    });
    return matched?.key || null;
  }, [fromDate, toDate]);

  const handleQuickRange = (key: QuickRangeKey) => {
    const range = getRangeByQuickKey(key);
    setFromDate(range.fromDate);
    setToDate(range.toDate);
  };

  const handleExportPdf = async () => {
    try {
      setExporting(true);
      await doctorStatsApi.downloadPdf(params);
      toast.success('Đã xuất báo cáo PDF thành công.');
    } catch (error) {
      logFrontendError('doctor-dashboard-export-pdf', error, params);
      toast.error('Không thể xuất báo cáo PDF lúc này.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 p-8">
      <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Thống kê phục vụ bác sĩ</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Theo dõi khối lượng khám, hiệu suất làm việc và xuất báo cáo trong khoảng thời gian đã chọn.
            </p>
          </div>
          <Button onClick={handleExportPdf} disabled={exporting} className="w-full gap-1.5 bg-blue-600 hover:bg-blue-700 lg:w-auto">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Xuất PDF
          </Button>
        </div>
      </section>

      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Bộ lọc thời gian</CardTitle>
          <CardDescription>Chọn khoảng thời gian và cách nhóm dữ liệu để theo dõi hiệu suất phù hợp.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Từ ngày</label>
              <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Đến ngày</label>
              <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Nhóm dữ liệu</label>
              <AdminSelect value={groupBy} onValueChange={(value) => setGroupBy(value as GroupBy)}>
                <AdminSelectTrigger>
                  <AdminSelectValue placeholder="Chọn kiểu nhóm" />
                </AdminSelectTrigger>
                <AdminSelectContent>
                  <AdminSelectItem value="day">Theo ngày</AdminSelectItem>
                  <AdminSelectItem value="week">Theo tuần</AdminSelectItem>
                  <AdminSelectItem value="month">Theo tháng</AdminSelectItem>
                </AdminSelectContent>
              </AdminSelect>
            </div>
            <div className="flex items-end gap-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  const range = getDefaultRange();
                  setFromDate(range.fromDate);
                  setToDate(range.toDate);
                }}
              >
                Mặc định 30 ngày
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {QUICK_RANGES.map((item) => (
              <QuickRangeChip
                key={item.key}
                active={activeQuickKey === item.key}
                label={item.label}
                onClick={() => handleQuickRange(item.key)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {summaryQuery.isError ? (
        <Card className="rounded-2xl border-rose-200 bg-rose-50 shadow-sm">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-rose-700">
            <p>Không thể tải dữ liệu thống kê lúc này. Vui lòng thử lại.</p>
            <Button variant="outline" className="border-rose-200 bg-white text-rose-700" onClick={() => summaryQuery.refetch()}>
              <RefreshCw className="mr-1 h-4 w-4" />
              Thử lại
            </Button>
          </CardContent>
        </Card>
      ) : summaryQuery.isLoading ? (
        <KpiSkeletonGrid />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {kpis.map((kpi) => (
            <StatsKpiCard
              key={kpi.title}
              title={kpi.title}
              value={kpi.value}
              description={kpi.description}
              icon={kpi.icon}
              tone={kpi.tone}
            />
          ))}
        </div>
      )}

      <InsightsPanel items={insights} />

      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Xu hướng lịch khám</CardTitle>
          <CardDescription>
            Theo dõi biến động số lịch, ca đã khám và tỷ lệ hủy/no-show theo mốc {groupBy === 'day' ? 'ngày' : groupBy === 'week' ? 'tuần' : 'tháng'}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {trendsQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, idx) => (
                <div key={`doctor-trend-skeleton-${idx}`} className="space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ))}
            </div>
          ) : trendsQuery.isError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              <p>Không thể tải dữ liệu xu hướng. Vui lòng thử lại.</p>
              <Button variant="outline" className="mt-3 border-rose-200 bg-white text-rose-700" onClick={() => trendsQuery.refetch()}>
                <RefreshCw className="mr-1 h-4 w-4" />
                Thử lại
              </Button>
            </div>
          ) : trends.length === 0 ? (
            <TrendEmptyState onResetRange={() => handleQuickRange('last30')} />
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50">
                    <tr className="border-b border-slate-200">
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Mốc</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Tổng</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Đã khám</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Đã hủy</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">No-show</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Tỷ lệ hoàn tất</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Mức tải</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trends.map((item, index) => {
                      const completionRate = item.total > 0 ? (item.completed / item.total) * 100 : 0;
                      const loadWidth = maxTrendTotal > 0 ? (item.total / maxTrendTotal) * 100 : 0;
                      return (
                        <tr key={`${item.label}-${index}`} className="border-b border-slate-100 even:bg-slate-50/40">
                          <td className="px-3 py-2 font-medium text-slate-700">{item.label}</td>
                          <td className="px-3 py-2 text-slate-700">{item.total}</td>
                          <td className="px-3 py-2 text-emerald-700">{item.completed}</td>
                          <td className="px-3 py-2 text-rose-700">{item.canceled}</td>
                          <td className="px-3 py-2 text-amber-700">{item.noShow}</td>
                          <td className="px-3 py-2 text-slate-700">{formatPercent(completionRate)}</td>
                          <td className="px-3 py-2">
                            <div className="h-2.5 w-32 overflow-hidden rounded-full bg-slate-100">
                              <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.max(loadWidth, item.total > 0 ? 8 : 0)}%` }} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
