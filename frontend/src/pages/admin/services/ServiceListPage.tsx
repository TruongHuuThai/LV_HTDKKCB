import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit, Trash2, BriefcaseMedical, ArrowUpDown, Filter, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

import {
    adminApi,
    type AdminServiceItem,
    type ServiceSortBy,
    type ServiceSortOrder,
} from '@/services/api/adminApi';
import { SERVICE_TYPE_LABELS, SERVICE_TYPES, type ServiceTypeValue } from '@/constants/serviceTypes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

type SortOption = 'code_desc' | 'code_asc' | 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc';
type PriceFilterOption = 'all' | 'lt_100k' | '100k_500k' | '500k_1m' | 'gt_1m';
type ServiceTypeFilterOption = 'all' | ServiceTypeValue;

const PAGE_SIZE = 10;

const SORT_OPTION_MAP: Record<SortOption, { sortBy: ServiceSortBy; sortOrder: ServiceSortOrder }> = {
    code_desc: { sortBy: 'code', sortOrder: 'desc' },
    code_asc: { sortBy: 'code', sortOrder: 'asc' },
    name_asc: { sortBy: 'name', sortOrder: 'asc' },
    name_desc: { sortBy: 'name', sortOrder: 'desc' },
    price_asc: { sortBy: 'price', sortOrder: 'asc' },
    price_desc: { sortBy: 'price', sortOrder: 'desc' },
};

const PRICE_FILTER_MAP: Record<PriceFilterOption, { minPrice?: number; maxPrice?: number }> = {
    all: {},
    lt_100k: { maxPrice: 100000 },
    '100k_500k': { minPrice: 100000, maxPrice: 500000 },
    '500k_1m': { minPrice: 500000, maxPrice: 1000000 },
    gt_1m: { minPrice: 1000000 },
};

export default function ServiceListPage() {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [sortOption, setSortOption] = useState<SortOption>('code_desc');
    const [priceFilter, setPriceFilter] = useState<PriceFilterOption>('all');
    const [typeFilter, setTypeFilter] = useState<ServiceTypeFilterOption>('all');
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            setDebouncedSearch(searchTerm.trim());
            setCurrentPage(1);
        }, 400);

        return () => window.clearTimeout(timeout);
    }, [searchTerm]);

    useEffect(() => {
        setCurrentPage(1);
    }, [sortOption, priceFilter, typeFilter]);

    const { sortBy, sortOrder } = SORT_OPTION_MAP[sortOption];
    const { minPrice, maxPrice } = PRICE_FILTER_MAP[priceFilter];
    const selectedServiceType = typeFilter === 'all' ? undefined : typeFilter;

    const { data, isLoading, isError, isFetching } = useQuery({
        queryKey: ['admin-services', debouncedSearch, currentPage, sortBy, sortOrder, minPrice, maxPrice, selectedServiceType],
        queryFn: () =>
            adminApi.getServices({
                search: debouncedSearch || undefined,
                page: currentPage,
                limit: PAGE_SIZE,
                sortBy,
                sortOrder,
                minPrice,
                maxPrice,
                serviceType: selectedServiceType,
            }),
        placeholderData: (previousData) => previousData,
    });

    const services = data?.items ?? [];
    const meta = data?.meta;

    useEffect(() => {
        if (meta && currentPage > meta.totalPages) {
            setCurrentPage(meta.totalPages);
        }
    }, [meta, currentPage]);

    const deleteMutation = useMutation({
        mutationFn: (id: number) => adminApi.deleteService(id),
        onSuccess: () => {
            toast.success('Xóa dịch vụ thành công');
            queryClient.invalidateQueries({ queryKey: ['admin-services'] });
            setDeleteErrorMessage(null);
            setDeleteId(null);
        },
        onError: (error: any) => {
            const message = error?.response?.data?.message || 'Không thể xóa dịch vụ vì đã phát sinh dữ liệu khám liên quan.';
            const normalizedMessage = Array.isArray(message) ? message.join(', ') : message;
            setDeleteErrorMessage(normalizedMessage);
            toast.error(normalizedMessage);
        },
    });

    const selectedService = useMemo(
        () => services.find((s) => s.DVCLS_MA === deleteId),
        [services, deleteId],
    );

    const formatCurrency = (value: AdminServiceItem['DVCLS_GIA_DV']) => {
        const amount = Number(value ?? 0);
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    };

    const getServiceTypeLabel = (type: AdminServiceItem['DVCLS_LOAI']) => {
        if (!type) {
            return 'Chưa phân loại';
        }
        return SERVICE_TYPE_LABELS[type as ServiceTypeValue] || type;
    };

    const buildPageList = (page: number, totalPages: number) => {
        const windowSize = 5;
        const start = Math.max(1, page - Math.floor(windowSize / 2));
        const end = Math.min(totalPages, start + windowSize - 1);
        const adjustedStart = Math.max(1, end - windowSize + 1);
        return Array.from({ length: end - adjustedStart + 1 }, (_, i) => adjustedStart + i);
    };

    const pageNumbers = buildPageList(currentPage, meta?.totalPages ?? 1);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Quản lý Dịch vụ</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Quản trị danh sách dịch vụ cận lâm sàng trong hệ thống
                    </p>
                </div>
                <Link to="/admin/services/create">
                    <Button className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Thêm dịch vụ
                    </Button>
                </Link>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                    <div className="relative w-full md:max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                            placeholder="Tìm kiếm theo tên dịch vụ..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9"
                        />
                    </div>

                    <div className="flex w-full flex-col gap-3 sm:flex-row md:w-auto">
                        <div className="w-full sm:w-[220px]">
                            <Select value={priceFilter} onValueChange={(val) => setPriceFilter(val as PriceFilterOption)}>
                                <SelectTrigger className="w-full bg-white">
                                    <div className="flex items-center gap-2">
                                        <Filter className="w-4 h-4 text-gray-400" />
                                        <SelectValue placeholder="Lọc giá" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent className="bg-white z-50">
                                    <SelectItem value="all">Tất cả mức giá</SelectItem>
                                    <SelectItem value="lt_100k">Dưới 100.000đ</SelectItem>
                                    <SelectItem value="100k_500k">100.000đ - 500.000đ</SelectItem>
                                    <SelectItem value="500k_1m">500.000đ - 1.000.000đ</SelectItem>
                                    <SelectItem value="gt_1m">Trên 1.000.000đ</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="w-full sm:w-[220px]">
                            <Select value={typeFilter} onValueChange={(val) => setTypeFilter(val as ServiceTypeFilterOption)}>
                                <SelectTrigger className="w-full bg-white">
                                    <SelectValue placeholder="Lọc loại dịch vụ" />
                                </SelectTrigger>
                                <SelectContent className="bg-white z-50">
                                    <SelectItem value="all">Tất cả loại</SelectItem>
                                    {SERVICE_TYPES.map((serviceType) => (
                                        <SelectItem key={serviceType} value={serviceType}>
                                            {SERVICE_TYPE_LABELS[serviceType]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="w-full sm:w-[220px]">
                            <Select value={sortOption} onValueChange={(val) => setSortOption(val as SortOption)}>
                                <SelectTrigger className="w-full bg-white">
                                    <div className="flex items-center gap-2">
                                        <ArrowUpDown className="w-4 h-4 text-gray-400" />
                                        <SelectValue placeholder="Sắp xếp" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent className="bg-white z-50">
                                    <SelectItem value="code_asc">Mã: thấp → cao</SelectItem>
                                    <SelectItem value="code_desc">Mã: cao → thấp</SelectItem>
                                    <SelectItem value="name_asc">Tên: A → Z</SelectItem>
                                    <SelectItem value="name_desc">Tên: Z → A</SelectItem>
                                    <SelectItem value="price_asc">Giá: thấp → cao</SelectItem>
                                    <SelectItem value="price_desc">Giá: cao → thấp</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                            <TableHead className="w-[100px]">Mã</TableHead>
                            <TableHead>Tên dịch vụ</TableHead>
                            <TableHead className="w-[180px]">Loại</TableHead>
                            <TableHead className="w-[180px]">Giá</TableHead>
                            <TableHead className="text-right w-[120px]">Thao tác</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-10 text-gray-500">
                                    Đang tải dữ liệu...
                                </TableCell>
                            </TableRow>
                        ) : isError ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-10 text-red-600">
                                    Không thể tải danh sách dịch vụ. Vui lòng thử lại.
                                </TableCell>
                            </TableRow>
                        ) : services.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-14">
                                    <div className="flex flex-col items-center gap-2 text-gray-500">
                                        <BriefcaseMedical className="w-9 h-9 text-gray-300" />
                                        <p className="text-sm font-medium text-gray-700">
                                            {debouncedSearch || priceFilter !== 'all' || typeFilter !== 'all'
                                                ? 'Không tìm thấy dịch vụ phù hợp'
                                                : 'Chưa có dịch vụ nào'}
                                        </p>
                                        <p className="text-xs">
                                            {debouncedSearch || priceFilter !== 'all' || typeFilter !== 'all'
                                                ? 'Hãy thử thay đổi bộ lọc để tìm kết quả phù hợp.'
                                                : 'Hãy thêm dịch vụ đầu tiên để bắt đầu quản lý.'}
                                        </p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            services.map((service) => (
                                <TableRow key={service.DVCLS_MA}>
                                    <TableCell className="font-medium text-gray-700">{service.DVCLS_MA}</TableCell>
                                    <TableCell>
                                        <p className="font-medium text-gray-900">{service.DVCLS_TEN}</p>
                                    </TableCell>
                                    <TableCell>
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700">
                                            {getServiceTypeLabel(service.DVCLS_LOAI)}
                                        </span>
                                    </TableCell>
                                    <TableCell className="font-medium text-gray-800">{formatCurrency(service.DVCLS_GIA_DV)}</TableCell>
                                    <TableCell>
                                        <div className="flex justify-end gap-2">
                                            <Link to={`/admin/services/edit/${service.DVCLS_MA}`}>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50">
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                            </Link>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50"
                                                onClick={() => {
                                                    setDeleteErrorMessage(null);
                                                    setDeleteId(service.DVCLS_MA);
                                                }}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <p className="text-sm text-gray-600">
                    {meta
                        ? `Hiển thị ${(meta.page - 1) * meta.limit + (services.length ? 1 : 0)}-${(meta.page - 1) * meta.limit + services.length} / ${meta.total} dịch vụ`
                        : 'Đang tải dữ liệu...'}
                    {isFetching && !isLoading ? ' • Đang cập nhật...' : ''}
                </p>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        disabled={!meta || meta.page <= 1}
                    >
                        Trước
                    </Button>
                    {pageNumbers.map((pageNum) => (
                        <Button
                            key={pageNum}
                            variant={pageNum === (meta?.page ?? 1) ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            className={pageNum === (meta?.page ?? 1) ? 'bg-blue-600 hover:bg-blue-700' : ''}
                        >
                            {pageNum}
                        </Button>
                    ))}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((prev) => Math.min(meta?.totalPages ?? prev, prev + 1))}
                        disabled={!meta || meta.page >= meta.totalPages}
                    >
                        Sau
                    </Button>
                </div>
            </div>

            <Dialog
                open={!!deleteId}
                onOpenChange={(open) => {
                    if (!open) {
                        setDeleteId(null);
                        setDeleteErrorMessage(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <AlertTriangle className="h-5 w-5" />
                            Xác nhận xóa dịch vụ
                        </DialogTitle>
                        <DialogDescription>
                            Bạn có chắc chắn muốn xóa dịch vụ này không?
                        </DialogDescription>
                        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                            <p className="font-medium text-red-800">
                                {selectedService?.DVCLS_TEN || `Dịch vụ #${deleteId}`}
                            </p>
                            <p>Hành động này không thể hoàn tác.</p>
                        </div>
                        {deleteErrorMessage ? (
                            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                <p className="font-semibold">Xóa không thành công</p>
                                <p>{deleteErrorMessage}</p>
                                <p className="mt-1 text-xs text-red-600">
                                    Gợi ý: Với dịch vụ đã phát sinh hồ sơ khám, hãy chuyển sang ngừng sử dụng hoặc cập nhật thông tin dịch vụ.
                                </p>
                            </div>
                        ) : null}
                    </DialogHeader>
                    <DialogFooter className="mt-4">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setDeleteId(null);
                                setDeleteErrorMessage(null);
                            }}
                        >
                            {deleteErrorMessage ? 'Đóng' : 'Hủy'}
                        </Button>
                        {!deleteErrorMessage ? (
                            <Button
                                variant="destructive"
                                onClick={() => deleteId && deleteMutation.mutate(deleteId)}
                                disabled={deleteMutation.isPending}
                            >
                                {deleteMutation.isPending ? 'Đang xóa...' : 'Xác nhận xóa'}
                            </Button>
                        ) : null}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
