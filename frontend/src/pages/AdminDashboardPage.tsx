// src/pages/AdminDashboardPage.tsx
import { useEffect, useState } from 'react';
import { Users, Stethoscope, PackageSearch, MessageSquare } from 'lucide-react';
import { adminApi, type DashboardSummary } from '../services/api/adminApi';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

export default function AdminDashboardPage() {
    const [data, setData] = useState<DashboardSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        
        const fetchDashboardData = async () => {
            try {
                setIsLoading(true);
                const result = await adminApi.getDashboardSummary();
                if (isMounted) {
                    setData(result);
                }
            } catch (error) {
                console.error("Failed to fetch dashboard summary:", error);
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        fetchDashboardData();
        return () => { isMounted = false; };
    }, []);

    const statsConfig = [
        {
            title: 'Tổng số Bệnh nhân',
            value: data?.stats?.totalPatients ?? 0,
            change: 'Cập nhật hôm nay',
            icon: Users,
            color: 'text-blue-600',
            bgColor: 'bg-blue-100',
        },
        {
            title: 'Tổng số Bác sĩ',
            value: data?.stats?.totalDoctors ?? 0,
            change: 'Bác sĩ đang hoạt động',
            icon: Stethoscope,
            color: 'text-emerald-600',
            bgColor: 'bg-emerald-100',
        },
        {
            title: 'Dịch vụ đang mở',
            value: data?.stats?.activeServices ?? 0,
            change: 'Tổng số dịch vụ',
            icon: PackageSearch,
            color: 'text-amber-600',
            bgColor: 'bg-amber-100',
        },
        {
            title: 'Tin nhắn Liên hệ mới',
            value: data?.stats?.newContacts ?? 0,
            change: 'Tin nhắn trong hôm nay',
            icon: MessageSquare,
            color: 'text-rose-600',
            bgColor: 'bg-rose-100',
        },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Tổng quan</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Theo dõi các chỉ số quan trọng của hệ thống UMC Clinic.
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col gap-3">
                            <div className="w-12 h-12 rounded-lg bg-gray-200 animate-pulse shrink-0" />
                            <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
                            <div className="h-8 bg-gray-200 rounded animate-pulse w-1/2 mt-1"></div>
                            <div className="h-3 bg-gray-200 rounded animate-pulse w-2/3 mt-2"></div>
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
                                <p className="text-2xl font-bold text-gray-900 mt-0.5">{stat.value.toLocaleString('vi-VN')}</p>
                                <p className="text-xs text-gray-400 mt-1">{stat.change}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Placeholder for future charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 lg:col-span-2 min-h-[400px]">
                    <h3 className="text-lg font-semibold text-gray-900">Biểu đồ Lượt khám</h3>
                    {isLoading ? (
                         <div className="w-full h-[300px] mt-4 bg-gray-100 animate-pulse rounded-lg"></div>
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 text-sm mt-4 border-2 border-dashed border-gray-200 rounded-lg min-h-[300px] bg-gray-50">
                            <span className="text-gray-400 mb-2 mt-4 text-center px-4 max-w-sm">Biểu đồ hiện đang được cập nhật, dữ liệu lượt đăng ký 7 ngày gần nhất:</span>
                            <div className="flex gap-4 mt-4 flex-wrap justify-center mb-6">
                                {data?.chartData?.map(d => (
                                    <div key={d.name} className="flex flex-col items-center bg-white p-3 rounded shadow-sm border relative overflow-hidden group">
                                        <span className="text-xs text-gray-500 font-medium mb-1 z-10">{d.name}</span>
                                        <span className="text-lg font-bold text-blue-600 z-10">{d.visits}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 min-h-[400px]">
                    <h3 className="text-lg font-semibold text-gray-900">Hoạt động gần đây</h3>
                    <div className="flex flex-col gap-4 mt-6">
                        {isLoading ? (
                             Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="flex items-start gap-3 w-full">
                                    <div className="w-2 h-2 rounded-full bg-gray-300 mt-2 shrink-0 animate-pulse" />
                                    <div className="flex-1 space-y-2 py-1">
                                        <div className="h-4 bg-gray-200 rounded animate-pulse w-full"></div>
                                        <div className="h-3 bg-gray-200 rounded animate-pulse w-1/3"></div>
                                    </div>
                                </div>
                            ))
                        ) : data?.recentActivities?.length === 0 ? (
                            <p className="text-sm text-gray-500 mt-4 italic text-center">Chưa có hoạt động nào gần đây.</p>
                        ) : (
                            data?.recentActivities?.map((activity) => (
                                <div key={activity.id} className="flex items-start gap-3">
                                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 shrink-0" />
                                    <div>
                                        <p className="text-sm text-gray-700">
                                            <span className="font-semibold text-gray-900">{activity.patientName}</span> {activity.action}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            {formatDistanceToNow(new Date(activity.createdAt), {
                                                addSuffix: true,
                                                locale: vi
                                            })}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

