// src/pages/AdminDashboardPage.tsx
import { useEffect, useState } from 'react';
import {
    Activity,
    AlertTriangle,
    CalendarCheck,
    CalendarRange,
    Clock,
    Stethoscope,
    TrendingUp,
    UserRound,
    Users,
} from 'lucide-react';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    ComposedChart,
    Line,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

import { adminApi, type DashboardSummary } from '@/services/api/adminApi';
import {
    AdminSelect,
    AdminSelectContent,
    AdminSelectItem,
    AdminSelectTrigger,
    AdminSelectValue,
} from '@/components/admin/AdminSelect';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type SpecialtyOption = {
    CK_MA: number;
    CK_TEN: string;
};

type VisitsDataPoint = {
    date: string;
    totalVisits: number;
    specialtyVisits: number;
};

type TimeSlotsDataPoint = {
    time: string;
    count: number;
};

type RevenueDataPoint = {
    date: string;
    revenue: number;
};

type MetricCardProps = {
    title: string;
    value: number;
    description: string;
    badge: string;
    icon: React.ComponentType<{ className?: string }>;
    iconClassName: string;
    iconBgClassName: string;
    badgeClassName: string;
    isCurrency?: boolean;
};

function formatCurrency(value: number) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
}

function formatDateTime(raw: string) {
    const value = new Date(raw);
    if (Number.isNaN(value.getTime())) return '--';

    return new Intl.DateTimeFormat('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
    }).format(value);
}

function formatRelativeTime(raw: string) {
    const value = new Date(raw);
    if (Number.isNaN(value.getTime())) return 'Không rõ thời điểm';

    const diffMs = Date.now() - value.getTime();
    const diffMinutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));
    if (diffMinutes < 60) return `${diffMinutes} phút trước`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} giờ trước`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} ngày trước`;
}

function getPeriodLabel(year: string, month: string) {
    if (month === 'all') return `Năm ${year}`;
    return `Tháng ${month.padStart(2, '0')}/${year}`;
}

function hasAnyPositiveValue<T>(items: T[], getValue: (item: T) => number) {
    return items.some((item) => getValue(item) > 0);
}

function MetricCard({
    title,
    value,
    description,
    badge,
    icon: Icon,
    iconBgClassName,
    iconClassName,
    badgeClassName,
    isCurrency = false,
}: MetricCardProps) {
    return (
        <Card className="border-gray-100 shadow-sm">
            <CardContent className="flex h-full flex-col gap-4 pt-0">
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                            {title}
                        </p>
                        <p className="text-[1.8rem] font-bold leading-none tracking-tight text-gray-950">
                            {isCurrency ? formatCurrency(value) : value.toLocaleString('vi-VN')}
                        </p>
                    </div>
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${iconBgClassName}`}>
                        <Icon className={`h-6 w-6 ${iconClassName}`} />
                    </div>
                </div>

                <p className="text-sm leading-6 text-gray-600">{description}</p>

                <div className="mt-auto">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${badgeClassName}`}>
                        {badge}
                    </span>
                </div>
            </CardContent>
        </Card>
    );
}

function FilterField({
    label,
    hint,
    children,
}: {
    label: string;
    hint: string;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-1.5">
            <p className="text-sm font-medium text-gray-900">{label}</p>
            {children}
            <p className="text-xs leading-5 text-gray-500">{hint}</p>
        </div>
    );
}

function ChartEmptyState({
    title,
    description,
}: {
    title: string;
    description: string;
}) {
    return (
        <div className="flex h-[260px] items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-6 text-center">
            <div className="max-w-md space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-gray-200">
                    <CalendarRange className="h-5 w-5 text-gray-400" />
                </div>
                <div className="space-y-1">
                    <p className="text-sm font-semibold text-gray-900">{title}</p>
                    <p className="text-sm leading-6 text-gray-500">{description}</p>
                </div>
            </div>
        </div>
    );
}

export default function AdminDashboardPage() {
    const [data, setData] = useState<DashboardSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
    const [selectedMonth, setSelectedMonth] = useState('all');
    const [selectedSpecialty, setSelectedSpecialty] = useState('all');

    const [visitsData, setVisitsData] = useState<VisitsDataPoint[]>([]);
    const [timeSlotsData, setTimeSlotsData] = useState<TimeSlotsDataPoint[]>([]);
    const [revenueData, setRevenueData] = useState<RevenueDataPoint[]>([]);
    const [specialties, setSpecialties] = useState<SpecialtyOption[]>([]);
    const [isLoadingCharts, setIsLoadingCharts] = useState(true);

    const years = Array.from({ length: 3 }).map((_, index) => (new Date().getFullYear() - index).toString());
    const months = Array.from({ length: 12 }).map((_, index) => (index + 1).toString());

    useEffect(() => {
        let isMounted = true;

        const fetchDashboardData = async () => {
            try {
                setIsLoading(true);
                const [summaryResult, specialtiesResult] = await Promise.all([
                    adminApi.getDashboardSummary(),
                    adminApi.getSpecialties(),
                ]);

                if (!isMounted) return;

                setData(summaryResult);
                setSpecialties(
                    specialtiesResult.map((item) => ({
                        CK_MA: item.CK_MA,
                        CK_TEN: item.CK_TEN,
                    })),
                );
            } catch (error) {
                console.error('Failed to fetch dashboard summary:', error);
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        void fetchDashboardData();

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        let isMounted = true;

        const fetchChartData = async () => {
            try {
                setIsLoadingCharts(true);
                const [visitsRes, timeSlotsRes, revenueRes] = await Promise.all([
                    adminApi.getDashboardVisits(
                        selectedYear,
                        selectedMonth,
                        selectedSpecialty === 'all' ? undefined : selectedSpecialty,
                    ),
                    adminApi.getDashboardTimeSlots(selectedYear, selectedMonth),
                    adminApi.getDashboardRevenue(selectedYear, selectedMonth),
                ]);

                if (!isMounted) return;

                setVisitsData(visitsRes);
                setTimeSlotsData(timeSlotsRes);
                setRevenueData(revenueRes);
            } catch (error) {
                console.error('Failed to fetch chart data:', error);
            } finally {
                if (isMounted) {
                    setIsLoadingCharts(false);
                }
            }
        };

        void fetchChartData();

        return () => {
            isMounted = false;
        };
    }, [selectedMonth, selectedSpecialty, selectedYear]);

    const dailyOps = data?.dailyOperations;
    const currentPeriodLabel = getPeriodLabel(selectedYear, selectedMonth);
    const selectedSpecialtyLabel =
        selectedSpecialty === 'all'
            ? 'Tất cả chuyên khoa'
            : specialties.find((item) => item.CK_MA.toString() === selectedSpecialty)?.CK_TEN || 'Chuyên khoa đã chọn';
    const hasVisitsData = hasAnyPositiveValue(visitsData, (item) => item.totalVisits + item.specialtyVisits);
    const hasTimeSlotsData = hasAnyPositiveValue(timeSlotsData, (item) => item.count);
    const hasRevenueData = hasAnyPositiveValue(revenueData, (item) => item.revenue);

    const dashboardStats: MetricCardProps[] = [
        {
            title: 'Doanh thu đã thu hôm nay',
            value: data?.financials?.todayRevenue ?? 0,
            description: 'Tổng tiền từ các giao dịch đã thanh toán thành công trong ngày.',
            badge: 'Theo dõi tài chính trong ngày',
            icon: TrendingUp,
            iconClassName: 'text-emerald-600',
            iconBgClassName: 'bg-emerald-100',
            badgeClassName: 'bg-emerald-50 text-emerald-700',
            isCurrency: true,
        },
        {
            title: 'Lượt khám trong ngày',
            value: dailyOps?.totalPatientsToday ?? 0,
            description: 'Tổng số lượt khám có lịch trong hôm nay, bao gồm các trạng thái xử lý.',
            badge: 'Chỉ số vận hành hôm nay',
            icon: Users,
            iconClassName: 'text-blue-600',
            iconBgClassName: 'bg-blue-100',
            badgeClassName: 'bg-blue-50 text-blue-700',
        },
        {
            title: 'Bệnh nhân đang chờ khám',
            value: dailyOps?.pendingVisitsToday ?? 0,
            description: 'Số lượt đang ở trạng thái chờ khám, cần ưu tiên theo dõi tại quầy tiếp đón.',
            badge: 'Ưu tiên điều phối',
            icon: Clock,
            iconClassName: 'text-amber-600',
            iconBgClassName: 'bg-amber-100',
            badgeClassName: 'bg-amber-50 text-amber-700',
        },
        {
            title: 'Ca khám đã hoàn tất',
            value: dailyOps?.completedVisitsToday ?? 0,
            description: 'Các lượt khám đã được xử lý xong và cập nhật hoàn thành trong ngày.',
            badge: 'Tiến độ trong ngày',
            icon: CalendarCheck,
            iconClassName: 'text-indigo-600',
            iconBgClassName: 'bg-indigo-100',
            badgeClassName: 'bg-indigo-50 text-indigo-700',
        },
        {
            title: 'Bác sĩ có lịch hôm nay',
            value: dailyOps?.doctorsOnDutyToday ?? 0,
            description: 'Số bác sĩ đã được phân công lịch làm việc hoặc lịch trực trong ngày.',
            badge: 'Nhân sự đang phân công',
            icon: Stethoscope,
            iconClassName: 'text-rose-600',
            iconBgClassName: 'bg-rose-100',
            badgeClassName: 'bg-rose-50 text-rose-700',
        },
    ];

    return (
        <div className="space-y-6 pb-12">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1.5">
                    <h1 className="text-2xl font-bold text-gray-900">Tổng quan</h1>
                    <p className="text-sm leading-6 text-gray-500">
                        Theo dõi nhanh tình hình vận hành, lượt khám và doanh thu của hệ thống UMC Clinic.
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                        Hôm nay
                    </span>
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                        {dailyOps?.pendingVisitsToday ?? 0} đang chờ khám
                    </span>
                    <span className="inline-flex items-center rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700">
                        {dailyOps?.canceledVisitsToday ?? 0} lịch đã hủy
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                {isLoading ? (
                    Array.from({ length: 5 }).map((_, index) => (
                        <div key={index} className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-3">
                                    <Skeleton className="h-3 w-28" />
                                    <Skeleton className="h-8 w-24" />
                                </div>
                                <Skeleton className="h-12 w-12 rounded-2xl" />
                            </div>
                            <Skeleton className="mt-5 h-4 w-full" />
                            <Skeleton className="mt-2 h-4 w-5/6" />
                            <Skeleton className="mt-5 h-6 w-28 rounded-full" />
                        </div>
                    ))
                ) : (
                    dashboardStats.map((stat) => <MetricCard key={stat.title} {...stat} />)
                )}
            </div>

            <Card className="border-gray-100 shadow-sm">
                <CardHeader className="gap-4 border-b border-gray-100 pb-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-lg font-semibold text-gray-900">Bộ lọc dữ liệu biểu đồ</CardTitle>
                            <CardDescription>
                                Bộ lọc năm và tháng áp dụng cho tất cả biểu đồ bên dưới. Riêng biểu đồ lượt khám có thêm bộ lọc chuyên khoa riêng.
                            </CardDescription>
                        </div>
                        <div className="inline-flex items-center rounded-full bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600 ring-1 ring-gray-200">
                            Đang xem: {currentPeriodLabel}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-4">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[180px_200px]">
                        <FilterField label="Năm dữ liệu" hint="Dùng cho toàn bộ xu hướng và biểu đồ phụ.">
                            <AdminSelect value={selectedYear} onValueChange={setSelectedYear}>
                                <AdminSelectTrigger>
                                    <AdminSelectValue placeholder="Chọn năm" />
                                </AdminSelectTrigger>
                                <AdminSelectContent>
                                    {years.map((year) => (
                                        <AdminSelectItem key={year} value={year}>
                                            Năm {year}
                                        </AdminSelectItem>
                                    ))}
                                </AdminSelectContent>
                            </AdminSelect>
                        </FilterField>

                        <FilterField label="Tháng" hint="Chọn một tháng cụ thể hoặc xem toàn bộ năm đã chọn.">
                            <AdminSelect value={selectedMonth} onValueChange={setSelectedMonth}>
                                <AdminSelectTrigger>
                                    <AdminSelectValue placeholder="Chọn tháng" />
                                </AdminSelectTrigger>
                                <AdminSelectContent>
                                    <AdminSelectItem value="all">Toàn bộ 12 tháng</AdminSelectItem>
                                    {months.map((month) => (
                                        <AdminSelectItem key={month} value={month}>
                                            Tháng {month}
                                        </AdminSelectItem>
                                    ))}
                                </AdminSelectContent>
                            </AdminSelect>
                        </FilterField>

                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-6">
                <Card className="border-gray-100 shadow-sm">
                    <CardHeader className="gap-4 border-b border-gray-100 pb-4">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                            <div className="space-y-1.5">
                                <CardTitle className="text-lg font-semibold text-gray-900">Biểu đồ lượt khám</CardTitle>
                                <CardDescription>
                                    Cột thể hiện tổng lượt khám trong khoảng thời gian đã chọn. Đường xu hướng dùng để so sánh theo chuyên khoa khi cần đi sâu vào từng nhóm dịch vụ.
                                </CardDescription>
                            </div>

                            <div className="grid gap-1.5 xl:min-w-[240px]">
                                <p className="text-sm font-medium text-gray-900">Chuyên khoa cho đường xu hướng</p>
                                <AdminSelect value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
                                    <AdminSelectTrigger>
                                        <AdminSelectValue placeholder="Chọn chuyên khoa" />
                                    </AdminSelectTrigger>
                                    <AdminSelectContent className="max-h-72">
                                        <AdminSelectItem value="all">Tất cả chuyên khoa</AdminSelectItem>
                                        {specialties.map((specialty) => (
                                            <AdminSelectItem
                                                key={specialty.CK_MA}
                                                value={specialty.CK_MA.toString()}
                                                className="whitespace-normal leading-5"
                                            >
                                                {specialty.CK_TEN}
                                            </AdminSelectItem>
                                        ))}
                                    </AdminSelectContent>
                                </AdminSelect>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                                Cột xám: Tổng lượt khám toàn hệ thống
                            </span>
                            <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                                {selectedSpecialty === 'all'
                                    ? 'Chọn chuyên khoa để bật đường so sánh riêng'
                                    : `Đường xanh: ${selectedSpecialtyLabel}`}
                            </span>
                        </div>
                    </CardHeader>

                    <CardContent className="pt-4">
                        {isLoadingCharts ? (
                            <Skeleton className="h-[300px] w-full rounded-xl" />
                        ) : !hasVisitsData ? (
                            <ChartEmptyState
                                title="Chưa có dữ liệu lượt khám"
                                description={`Không ghi nhận dữ liệu phù hợp trong ${currentPeriodLabel.toLowerCase()}. Hãy thử đổi mốc thời gian hoặc chuyên khoa để kiểm tra lại.`}
                            />
                        ) : (
                            <div className="w-full">
                                <ResponsiveContainer width="100%" height={300}>
                                    <ComposedChart data={visitsData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                        <XAxis
                                            dataKey="date"
                                            stroke="#6b7280"
                                            fontSize={12}
                                            tickLine={false}
                                            axisLine={false}
                                            interval={selectedMonth === 'all' ? 0 : 'preserveStartEnd'}
                                            tickFormatter={(value) =>
                                                typeof value === 'string' ? value.replace('Tháng ', '') : value
                                            }
                                        />
                                        <YAxis
                                            stroke="#6b7280"
                                            fontSize={12}
                                            tickLine={false}
                                            axisLine={false}
                                            allowDecimals={false}
                                        />
                                        <Tooltip
                                            cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                                            contentStyle={{
                                                borderRadius: '12px',
                                                border: '1px solid #e5e7eb',
                                                boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
                                            }}
                                        />
                                        <Bar
                                            dataKey="totalVisits"
                                            name="Tổng lượt khám"
                                            fill="#cbd5e1"
                                            radius={[6, 6, 0, 0]}
                                            maxBarSize={32}
                                        />
                                        {selectedSpecialty !== 'all' ? (
                                            <Line
                                                type="monotone"
                                                dataKey="specialtyVisits"
                                                name={selectedSpecialtyLabel}
                                                stroke="#2563eb"
                                                strokeWidth={3}
                                                dot={{ r: 4 }}
                                                activeDot={{ r: 5 }}
                                            />
                                        ) : null}
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <Card className="border-gray-100 shadow-sm">
                        <CardHeader className="gap-2 border-b border-gray-100 pb-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                    <CardTitle className="text-lg font-semibold text-gray-900">Phân bố khung giờ khám</CardTitle>
                                    <CardDescription>
                                        Giúp nhận diện khung giờ cao điểm để điều phối quầy tiếp đón và bác sĩ.
                                    </CardDescription>
                                </div>
                                <span className="inline-flex items-center rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700">
                                    {currentPeriodLabel}
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-4">
                            {isLoadingCharts ? (
                                <Skeleton className="h-[250px] w-full rounded-xl" />
                            ) : !hasTimeSlotsData ? (
                                <ChartEmptyState
                                    title="Chưa có dữ liệu khung giờ"
                                    description={`Không ghi nhận lượt đăng ký trong ${currentPeriodLabel.toLowerCase()} để phân tích khung giờ.`}
                                />
                            ) : (
                                <ResponsiveContainer width="100%" height={250}>
                                    <BarChart data={timeSlotsData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                        <XAxis
                                            dataKey="time"
                                            stroke="#6b7280"
                                            fontSize={12}
                                            tickLine={false}
                                            axisLine={false}
                                        />
                                        <YAxis
                                            stroke="#6b7280"
                                            fontSize={12}
                                            tickLine={false}
                                            axisLine={false}
                                            allowDecimals={false}
                                        />
                                        <Tooltip
                                            cursor={{ fill: 'rgba(139, 92, 246, 0.08)' }}
                                            contentStyle={{
                                                borderRadius: '12px',
                                                border: '1px solid #e5e7eb',
                                                boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
                                            }}
                                        />
                                        <Bar
                                            dataKey="count"
                                            name="Số lượt đăng ký"
                                            fill="#8b5cf6"
                                            radius={[6, 6, 0, 0]}
                                            maxBarSize={28}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-gray-100 shadow-sm">
                        <CardHeader className="gap-2 border-b border-gray-100 pb-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                    <CardTitle className="text-lg font-semibold text-gray-900">Xu hướng doanh thu</CardTitle>
                                    <CardDescription>
                                        Theo dõi doanh thu từ các lượt khám đã thanh toán thành công trong giai đoạn đã chọn.
                                    </CardDescription>
                                </div>
                                <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                                    {currentPeriodLabel}
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-4">
                            {isLoadingCharts ? (
                                <Skeleton className="h-[250px] w-full rounded-xl" />
                            ) : !hasRevenueData ? (
                                <ChartEmptyState
                                    title="Chưa có dữ liệu doanh thu"
                                    description={`Chưa ghi nhận giao dịch thanh toán thành công trong ${currentPeriodLabel.toLowerCase()}.`}
                                />
                            ) : (
                                <ResponsiveContainer width="100%" height={250}>
                                    <AreaChart data={revenueData} margin={{ top: 10, right: 12, left: 12, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="dashboardRevenueFill" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.22} />
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0.03} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                        <XAxis
                                            dataKey="date"
                                            stroke="#6b7280"
                                            fontSize={12}
                                            tickLine={false}
                                            axisLine={false}
                                            interval={selectedMonth === 'all' ? 0 : 'preserveStartEnd'}
                                            tickFormatter={(value) =>
                                                typeof value === 'string' ? value.replace('Tháng ', '') : value
                                            }
                                        />
                                        <YAxis
                                            stroke="#6b7280"
                                            fontSize={12}
                                            tickLine={false}
                                            axisLine={false}
                                            tickFormatter={(value) =>
                                                new Intl.NumberFormat('vi-VN', {
                                                    notation: 'compact',
                                                    compactDisplay: 'short',
                                                }).format(value)
                                            }
                                        />
                                        <Tooltip
                                            formatter={(value) => formatCurrency(Number(value ?? 0))}
                                            contentStyle={{
                                                borderRadius: '12px',
                                                border: '1px solid #e5e7eb',
                                                boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
                                            }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="revenue"
                                            name="Doanh thu"
                                            stroke="#10b981"
                                            strokeWidth={2.5}
                                            fill="url(#dashboardRevenueFill)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <Card className="border-gray-100 shadow-sm">
                    <CardHeader className="gap-2 border-b border-gray-100 pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                            <UserRound className="h-5 w-5 text-blue-600" />
                            Bác sĩ nổi bật tháng này
                        </CardTitle>
                        <CardDescription>
                            Top bác sĩ có nhiều lượt khám đã hoàn tất nhất trong tháng hiện tại.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                        {isLoading ? (
                            <Skeleton className="h-[220px] w-full rounded-xl" />
                        ) : (data?.topDoctors?.length ?? 0) === 0 ? (
                            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-4 py-8 text-center text-sm text-gray-500">
                                Chưa có dữ liệu lượt khám hoàn tất để xếp hạng bác sĩ trong tháng này.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {data?.topDoctors.map((doctor, index) => (
                                    <div
                                        key={doctor.id}
                                        className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/70 px-3.5 py-3"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                                                {index + 1}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold text-gray-900">{doctor.name}</p>
                                                <p className="truncate text-xs text-gray-500">{doctor.specialty}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-blue-600">
                                                {doctor.visits.toLocaleString('vi-VN')}
                                            </p>
                                            <p className="text-xs text-gray-500">lượt khám</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="border-gray-100 shadow-sm">
                    <CardHeader className="gap-2 border-b border-gray-100 pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                            <Activity className="h-5 w-5 text-sky-600" />
                            Hoạt động gần đây
                        </CardTitle>
                        <CardDescription>
                            5 cập nhật mới nhất để admin theo dõi luồng khám và xử lý phát sinh.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                        {isLoading ? (
                            <Skeleton className="h-[220px] w-full rounded-xl" />
                        ) : (data?.recentActivities?.length ?? 0) === 0 ? (
                            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-4 py-8 text-center text-sm text-gray-500">
                                Chưa có hoạt động nào gần đây để hiển thị.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {data?.recentActivities.map((item) => (
                                    <div
                                        key={item.id}
                                        className="rounded-xl border border-gray-100 bg-white px-3.5 py-3 shadow-sm"
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-700">
                                                {item.patientName.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-semibold text-gray-900">{item.patientName}</p>
                                                <p className="mt-1 text-sm leading-6 text-gray-600">{item.action}</p>
                                                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                                                    <span>{formatRelativeTime(item.createdAt)}</span>
                                                    <span>{formatDateTime(item.createdAt)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="border-gray-100 shadow-sm">
                    <CardHeader className="gap-2 border-b border-gray-100 pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg font-semibold text-rose-700">
                            <AlertTriangle className="h-5 w-5" />
                            Cảnh báo thuốc sắp hết hạn
                        </CardTitle>
                        <CardDescription>
                            Danh sách thuốc sẽ hết hạn trong vòng 30 ngày tới để chủ động xử lý kho.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                        {isLoading ? (
                            <Skeleton className="h-[220px] w-full rounded-xl" />
                        ) : (data?.expiringMedicines?.length ?? 0) === 0 ? (
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-8 text-center text-sm text-emerald-700">
                                Không có thuốc nào sắp hết hạn trong 30 ngày tới.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {data?.expiringMedicines.map((medicine) => {
                                    const expiryDate = new Date(medicine.expiryDate);
                                    const diffDays = Math.max(
                                        0,
                                        Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
                                    );

                                    return (
                                        <div
                                            key={medicine.id}
                                            className="flex items-start justify-between gap-3 rounded-xl border border-rose-100 bg-rose-50/80 px-3.5 py-3"
                                        >
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold text-gray-900">{medicine.name}</p>
                                                <p className="mt-1 text-xs leading-5 text-rose-700">
                                                    Còn {diffDays} ngày, hạn dùng{' '}
                                                    {Number.isNaN(expiryDate.getTime())
                                                        ? '--'
                                                        : expiryDate.toLocaleDateString('vi-VN')}
                                                </p>
                                            </div>
                                            <span className="inline-flex shrink-0 items-center rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-700">
                                                Ưu tiên xử lý
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
