// src/pages/AdminDashboardPage.tsx
import { useEffect, useState } from 'react';
import { Users, Stethoscope, Clock, CalendarCheck, UserRound, AlertTriangle, TrendingUp } from 'lucide-react';
import { adminApi, type DashboardSummary } from '../services/api/adminApi';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Line, AreaChart, Area } from 'recharts';
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function AdminDashboardPage() {
    const [data, setData] = useState<DashboardSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
    const [selectedMonth, setSelectedMonth] = useState<string>('all');
    const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');

    const [visitsData, setVisitsData] = useState<any[]>([]);
    const [timeSlotsData, setTimeSlotsData] = useState<any[]>([]);
    const [revenueData, setRevenueData] = useState<any[]>([]);
    const [specialties, setSpecialties] = useState<{CK_MA: number, CK_TEN: string}[]>([]);
    
    const [isLoadingCharts, setIsLoadingCharts] = useState(true);

    const years = Array.from({length: 3}).map((_, i) => (new Date().getFullYear() - i).toString());
    const months = Array.from({length: 12}).map((_, i) => (i + 1).toString());

    useEffect(() => {
        let isMounted = true;
        
        const fetchDashboardData = async () => {
            try {
                setIsLoading(true);
                const [summaryResult, specialtiesResult] = await Promise.all([
                    adminApi.getDashboardSummary(),
                    adminApi.getSpecialties()
                ]);
                if (isMounted) {
                    setData(summaryResult);
                    
                    let rawSpecs = Array.isArray(specialtiesResult) 
                        ? specialtiesResult 
                        : (specialtiesResult as any)?.data || [];

                    const formattedSpecs = rawSpecs.map((s: any) => ({
                        CK_MA: s.CK_MA ?? s.cK_MA ?? s.ck_ma ?? s.ck_Ma ?? s.id,
                        CK_TEN: s.CK_TEN ?? s.cK_TEN ?? s.ck_ten ?? s.ck_Ten ?? s.name ?? "Unknown"
                    }));
                    setSpecialties(formattedSpecs);
                }
            } catch (error: any) {
                console.error("Failed to fetch dashboard summary:", error);
                if (error.response && error.response.data) {
                    console.error("Dashboard summary API response:", error.response.data.message || error.response.data);
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        fetchDashboardData();
        return () => { isMounted = false; };
    }, []);

    useEffect(() => {
        let isMounted = true;
        const fetchChartData = async () => {
            try {
                setIsLoadingCharts(true);
                const [visitsRes, timeSlotsRes, revenueRes] = await Promise.all([
                    adminApi.getDashboardVisits(selectedYear, selectedMonth, selectedSpecialty === 'all' ? undefined : selectedSpecialty),
                    adminApi.getDashboardTimeSlots(selectedYear, selectedMonth),
                    adminApi.getDashboardRevenue(selectedYear, selectedMonth)
                ]);
                
                if (isMounted) {
                    setVisitsData(visitsRes);
                    setTimeSlotsData(timeSlotsRes);
                    setRevenueData(revenueRes);
                }
            } catch (error) {
                console.error("Failed to fetch chart data:", error);
            } finally {
                if (isMounted) {
                    setIsLoadingCharts(false);
                }
            }
        };

        fetchChartData();
        return () => { isMounted = false; };
    }, [selectedYear, selectedMonth, selectedSpecialty]);

    const dailyOps = data?.dailyOperations;
    const statsConfig = [
        {
            title: 'Doanh thu hôm nay',
            value: data?.financials?.todayRevenue ?? 0,
            change: 'Chỉ tính thanh toán thành công',
            icon: TrendingUp,
            color: 'text-emerald-600',
            bgColor: 'bg-emerald-100',
            isCurrency: true
        },
        {
            title: 'Lượt khám hôm nay',
            value: dailyOps?.totalPatientsToday ?? 0,
            change: 'Tổng số lượt đăng ký',
            icon: Users,
            color: 'text-blue-600',
            bgColor: 'bg-blue-100',
        },
        {
            title: 'Đang chờ khám',
            value: dailyOps?.pendingVisitsToday ?? 0,
            change: 'Bệnh nhân đang đợi',
            icon: Clock,
            color: 'text-amber-600',
            bgColor: 'bg-amber-100',
        },
        {
            title: 'Đã hoàn thành',
            value: dailyOps?.completedVisitsToday ?? 0,
            change: 'Ca khám đã xong',
            icon: CalendarCheck,
            color: 'text-indigo-600',
            bgColor: 'bg-indigo-100',
        },
        {
            title: 'Bác sĩ trực hôm nay',
            value: dailyOps?.doctorsOnDutyToday ?? 0,
            change: 'BS có lịch làm việc',
            icon: Stethoscope,
            color: 'text-rose-600',
            bgColor: 'bg-rose-100',
        },
    ];

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
    };

    return (
        <div className="space-y-6 pb-12">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Tổng quan</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Theo dõi các chỉ số quan trọng của hệ thống UMC Clinic.
                </p>
            </div>

            {/* Stats Cards - Today's Operations */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
                {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col gap-3">
                            <Skeleton className="w-12 h-12 rounded-lg shrink-0" />
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-8 w-1/2 mt-1" />
                            <Skeleton className="h-3 w-2/3 mt-2" />
                        </div>
                    ))
                ) : (
                    statsConfig.map((stat, idx) => (
                        <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-start gap-4 transition-shadow hover:shadow-md">
                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${stat.bgColor}`}>
                                <stat.icon className={`w-6 h-6 ${stat.color}`} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-500">{stat.title}</p>
                                <p className="text-2xl font-bold text-gray-900 mt-0.5">
                                    {stat.isCurrency ? formatCurrency(stat.value) : stat.value.toLocaleString('vi-VN')}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">{stat.change}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-wrap items-center gap-4">
                <span className="text-sm font-semibold text-gray-700">Bộ lọc biểu đồ:</span>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="w-[120px] bg-white">
                        <SelectValue placeholder="Chọn năm" />
                    </SelectTrigger>
                    <SelectContent className="bg-white z-50">
                        {years.map(year => (
                            <SelectItem key={year} value={year}>Năm {year}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="w-[150px] bg-white">
                        <SelectValue placeholder="Chọn tháng" />
                    </SelectTrigger>
                    <SelectContent className="bg-white z-50">
                        <SelectItem value="all" className="py-2 text-sm font-medium">Tất cả các tháng</SelectItem>
                        {months.map(month => (
                            <SelectItem key={month} value={month.toString()}>Tháng {month}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 gap-6">
                
                {/* Chart 1: Visits (Row 1 - Full Width) */}
                <Card className="col-span-1 min-w-0 shadow-sm border border-gray-100">
                    <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-2">
                        <div className="space-y-1">
                            <CardTitle className="text-lg font-bold text-gray-800">Biểu đồ lượt khám</CardTitle>
                            <p className="text-sm text-gray-500">Tổng quan lượt khám và theo khoa cụ thể</p>
                        </div>
                        <div className="mt-4 sm:mt-0 sm:ml-4">
                            <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
                                <SelectTrigger className="w-full sm:w-[220px] bg-white border-gray-200 shadow-sm">
                                    <SelectValue placeholder="Chọn chuyên khoa" />
                                </SelectTrigger>
                                <SelectContent className="z-50 max-h-72 min-w-[220px] overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-md">
                                    <SelectItem value="all" className="py-2 text-sm font-medium">Tất cả Khoa</SelectItem>
                                    {specialties.map(spec => (
                                        <SelectItem
                                            key={spec.CK_MA}
                                            value={spec.CK_MA.toString()}
                                            className="py-2 text-sm leading-5 whitespace-normal break-words"
                                        >
                                            {spec.CK_TEN}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {isLoadingCharts ? (
                            <Skeleton className="w-full h-[350px]" />
                        ) : (
                            <div className="w-full min-w-0 mt-4">
                                <ResponsiveContainer width="100%" height={350}>
                                    <ComposedChart data={visitsData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                        <XAxis 
                                            dataKey="date" 
                                            stroke="#888888" 
                                            fontSize={12} 
                                            tickLine={false} 
                                            axisLine={false} 
                                            interval={selectedMonth === 'all' ? 0 : 'preserveStartEnd'}
                                            tickFormatter={(value) => typeof value === 'string' ? value.replace('Tháng ', '') : value}
                                        />
                                        <YAxis 
                                            stroke="#888888" 
                                            fontSize={12} 
                                            tickLine={false} 
                                            axisLine={false} 
                                            allowDecimals={false}
                                        />
                                        <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '8px', border: '1px solid #f3f4f6', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                                        <Bar dataKey="totalVisits" name="Tổng Số Lượt Khám" fill="#e2e8f0" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                        <Line type="monotone" name={`Lượt Khám Khoa ${selectedSpecialty !== 'all' ? specialties.find(s => s.CK_MA.toString() === selectedSpecialty)?.CK_TEN || '' : ''}`} dataKey="specialtyVisits" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Chart 2 & 3: Time Slots & Revenue (Row 2 - Two Columns) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
                    
                    {/* Chart 2: Time Slots */}
                    <Card className="min-w-0 shadow-sm border border-gray-100">
                        <CardHeader>
                            <CardTitle className="text-lg font-bold text-gray-800">Phân bố khung giờ khám</CardTitle>
                            <p className="text-sm text-gray-500">Nhận diện giờ cao điểm</p>
                        </CardHeader>
                        <CardContent>
                            {isLoadingCharts ? (
                                <Skeleton className="w-full h-[300px]" />
                            ) : (
                                <div className="w-full min-w-0 mt-4">
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={timeSlotsData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                            <XAxis 
                                                dataKey="time" 
                                                stroke="#888888" 
                                                fontSize={12} 
                                                tickLine={false} 
                                                axisLine={false} 
                                            />
                                            <YAxis 
                                                stroke="#888888" 
                                                fontSize={12} 
                                                tickLine={false} 
                                                axisLine={false} 
                                                allowDecimals={false}
                                            />
                                            <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '8px', border: '1px solid #f3f4f6', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                                            <Bar dataKey="count" name="Số lượng" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Chart 3: Revenue */}
                    <Card className="min-w-0 shadow-sm border border-gray-100">
                        <CardHeader>
                            <CardTitle className="text-lg font-bold text-gray-800">Thống kê doanh thu</CardTitle>
                            <p className="text-sm text-gray-500">Doanh thu từ các lịch khám đã thanh toán</p>
                        </CardHeader>
                        <CardContent>
                            {isLoadingCharts ? (
                                <Skeleton className="w-full h-[300px]" />
                            ) : (
                                <div className="w-full min-w-0 mt-4">
                                    <ResponsiveContainer width="100%" height={300}>
                                        <AreaChart data={revenueData} margin={{ top: 20, right: 20, bottom: 20, left: 40 }}>
                                            <defs>
                                                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#d1fae5" stopOpacity={0.8}/>
                                                    <stop offset="95%" stopColor="#d1fae5" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                            <XAxis 
                                                dataKey="date" 
                                                stroke="#888888" 
                                                fontSize={12} 
                                                tickLine={false} 
                                                axisLine={false} 
                                                interval={selectedMonth === 'all' ? 0 : 'preserveStartEnd'}
                                                tickFormatter={(value) => typeof value === 'string' ? value.replace('Tháng ', '') : value}
                                            />
                                            <YAxis 
                                                stroke="#888888" 
                                                fontSize={12} 
                                                tickLine={false} 
                                                axisLine={false} 
                                                tickFormatter={(value) => new Intl.NumberFormat('vi-VN', { notation: "compact", compactDisplay: "short" }).format(value)}
                                            />
                                            <Tooltip 
                                                formatter={(value: any) => formatCurrency(Number(value))}
                                                contentStyle={{borderRadius: '8px', border: '1px solid #f3f4f6', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} 
                                            />
                                            <Area type="monotone" name="Doanh Thu" dataKey="revenue" stroke="#10b981" fillOpacity={1} fill="url(#colorRevenue)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                </div>
            </div>

            {/* Bottom Row: Widgets */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                {/* Top Doctors Widget */}
                <Card className="shadow-sm border border-gray-100">
                    <CardHeader>
                        <CardTitle className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <UserRound className="w-5 h-5 text-blue-600" />
                            Bác sĩ nổi bật (Tháng này)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <Skeleton className="w-full h-[200px]" />
                        ) : (
                            <div className="space-y-4">
                                {data?.topDoctors?.length === 0 ? (
                                    <p className="text-sm text-gray-500 text-center py-4">Chưa có dữ liệu khám bệnh tháng này.</p>
                                ) : (
                                    data?.topDoctors?.map((doc, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold overflow-hidden">
                                                    {doc.avatar ? (
                                                        <img src={doc.avatar} alt={doc.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        doc.name.charAt(0)
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">{doc.name}</p>
                                                    <p className="text-xs text-gray-500">{doc.specialty}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-bold text-blue-600">{doc.visits}</p>
                                                <p className="text-xs text-gray-500">lượt khám</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Expiring Medicines Alert Widget */}
                <Card className="shadow-sm border border-gray-100">
                    <CardHeader>
                        <CardTitle className="text-lg font-bold text-rose-600 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5" />
                            Cảnh báo thuốc sắp hết hạn
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <Skeleton className="w-full h-[200px]" />
                        ) : (
                            <div className="space-y-3">
                                {data?.expiringMedicines?.length === 0 ? (
                                    <div className="p-4 bg-emerald-50 rounded-lg text-emerald-700 text-sm flex items-center gap-2">
                                        Không có thuốc nào sắp hết hạn trong 30 ngày tới.
                                    </div>
                                ) : (
                                    data?.expiringMedicines?.map((med, idx) => {
                                        const expiryDate = new Date(med.expiryDate);
                                        const now = new Date();
                                        const diffTime = Math.abs(expiryDate.getTime() - now.getTime());
                                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                        
                                        return (
                                            <div key={idx} className="flex items-center justify-between p-3 border-l-4 border-rose-500 bg-rose-50 rounded-r-lg">
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">{med.name}</p>
                                                    <p className="text-xs text-rose-600 mt-1">
                                                        Còn {diffDays} ngày (HSD: {expiryDate.toLocaleDateString('vi-VN')})
                                                    </p>
                                                </div>
                                                <span className="px-2 py-1 bg-rose-100 text-rose-700 text-xs font-medium rounded-full">
                                                    Sắp Hết Hạn
                                                </span>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

