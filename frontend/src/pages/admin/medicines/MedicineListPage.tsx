import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    AlertTriangle,
    ArrowUpDown,
    Eye,
    Edit,
    Filter,
    Pill,
    Plus,
    Search,
    Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import {
    adminApi,
    type AdminMedicineItem,
    type MedicineExpirationStatus,
    type MedicineSortBy,
    type MedicineSortOrder,
} from '@/services/api/adminApi';
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
    AdminSelect,
    AdminSelectContent,
    AdminSelectItem,
    AdminSelectTrigger,
    AdminSelectValue,
} from '@/components/admin/AdminSelect';

type SortOption = 'code_asc' | 'code_desc' | 'price_asc' | 'price_desc';
type PriceFilterOption = 'all' | 'lt_50k' | '50k_100k' | '100k_500k' | 'gt_500k';

const PAGE_SIZE = 10;

const SORT_OPTION_MAP: Record<SortOption, { sortBy: MedicineSortBy; sortOrder: MedicineSortOrder }> = {
    code_asc: { sortBy: 'code', sortOrder: 'asc' },
    code_desc: { sortBy: 'code', sortOrder: 'desc' },
    price_asc: { sortBy: 'price', sortOrder: 'asc' },
    price_desc: { sortBy: 'price', sortOrder: 'desc' },
};

const PRICE_FILTER_MAP: Record<PriceFilterOption, { minPrice?: number; maxPrice?: number }> = {
    all: {},
    lt_50k: { maxPrice: 49999.99 },
    '50k_100k': { minPrice: 50000, maxPrice: 100000 },
    '100k_500k': { minPrice: 100000.01, maxPrice: 500000 },
    gt_500k: { minPrice: 500000.01 },
};

function toDatePart(value: string | null | undefined): string {
    if (!value) return '';
    return value.length >= 10 ? value.slice(0, 10) : value;
}

function getCurrentDatePart(offsetDays = 0): string {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    now.setDate(now.getDate() + offsetDays);
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDate(value: string | null | undefined): string {
    const datePart = toDatePart(value);
    if (!datePart) return '-';
    const [year, month, day] = datePart.split('-');
    if (!year || !month || !day) return datePart;
    return `${day}/${month}/${year}`;
}

function formatCurrency(value: AdminMedicineItem['T_GIA_THUOC']): string {
    const amount = Number(value ?? 0);
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
    }).format(amount);
}

export default function MedicineListPage() {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [sortOption, setSortOption] = useState<SortOption>('code_asc');
    const [groupFilter, setGroupFilter] = useState('all');
    const [manufacturerFilter, setManufacturerFilter] = useState('all');
    const [priceFilter, setPriceFilter] = useState<PriceFilterOption>('all');
    const [expirationFilter, setExpirationFilter] = useState<MedicineExpirationStatus>('all');
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);

    const todayDatePart = useMemo(() => getCurrentDatePart(0), []);
    const nearDatePart = useMemo(() => getCurrentDatePart(7), []);

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            setDebouncedSearch(searchTerm.trim());
            setCurrentPage(1);
        }, 400);

        return () => window.clearTimeout(timeout);
    }, [searchTerm]);

    useEffect(() => {
        setCurrentPage(1);
    }, [sortOption, groupFilter, manufacturerFilter, priceFilter, expirationFilter]);

    const { sortBy, sortOrder } = SORT_OPTION_MAP[sortOption];
    const { minPrice, maxPrice } = PRICE_FILTER_MAP[priceFilter];
    const selectedGroupId = groupFilter === 'all' ? undefined : Number(groupFilter);
    const selectedManufacturerId = manufacturerFilter === 'all' ? undefined : Number(manufacturerFilter);

    const { data: filterOptions } = useQuery({
        queryKey: ['admin-medicine-filter-options'],
        queryFn: () => adminApi.getMedicineFilterOptions(),
    });

    const { data, isLoading, isError, isFetching } = useQuery({
        queryKey: [
            'admin-medicines',
            debouncedSearch,
            currentPage,
            sortBy,
            sortOrder,
            selectedGroupId,
            selectedManufacturerId,
            minPrice,
            maxPrice,
            expirationFilter,
        ],
        queryFn: () =>
            adminApi.getMedicines({
                search: debouncedSearch || undefined,
                page: currentPage,
                limit: PAGE_SIZE,
                sortBy,
                sortOrder,
                groupId: selectedGroupId,
                manufacturerId: selectedManufacturerId,
                minPrice,
                maxPrice,
                expirationStatus: expirationFilter,
            }),
        placeholderData: (previousData) => previousData,
    });

    const medicines = data?.items ?? [];
    const meta = data?.meta;

    useEffect(() => {
        if (meta && currentPage > meta.totalPages) {
            setCurrentPage(meta.totalPages);
        }
    }, [meta, currentPage]);

    const deleteMutation = useMutation({
        mutationFn: (id: number) => adminApi.deleteMedicine(id),
        onSuccess: () => {
            toast.success('Xóa thuốc thành công');
            queryClient.invalidateQueries({ queryKey: ['admin-medicines'] });
            setDeleteErrorMessage(null);
            setDeleteId(null);
        },
        onError: (error: any) => {
            const message = error?.response?.data?.message || 'Không thể xóa thuốc vì đã phát sinh dữ liệu kê đơn liên quan.';
            const normalizedMessage = Array.isArray(message) ? message.join(', ') : message;
            setDeleteErrorMessage(normalizedMessage);
            toast.error(normalizedMessage);
        },
    });

    const selectedMedicine = useMemo(
        () => medicines.find((medicine) => medicine.T_MA === deleteId),
        [medicines, deleteId],
    );

    const getExpirationBadge = (value: string | null | undefined) => {
        const datePart = toDatePart(value);

        if (!datePart) {
            return {
                label: 'Chưa cập nhật',
                className: 'bg-gray-100 text-gray-600',
            };
        }

        if (datePart < todayDatePart) {
            return {
                label: 'Quá hạn',
                className: 'bg-red-50 text-red-700',
            };
        }

        if (datePart <= nearDatePart) {
            return {
                label: 'Cận hạn (7 ngày)',
                className: 'bg-amber-50 text-amber-700',
            };
        }

        return {
            label: 'Còn hạn',
            className: 'bg-emerald-50 text-emerald-700',
        };
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
                    <h1 className="text-2xl font-bold text-gray-900">Quản lý Thuốc</h1>
                    <p className="text-sm text-gray-500 mt-1">Quản trị danh sách thuốc đang sử dụng trong hệ thống</p>
                </div>
                <Link to="/admin/medicines/create">
                    <Button className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Thêm thuốc
                    </Button>
                </Link>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
                <div className="relative w-full md:max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                        placeholder="Tìm kiếm theo tên thuốc..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
                    <AdminSelect value={groupFilter} onValueChange={setGroupFilter}>
                        <AdminSelectTrigger>
                            <div className="flex items-center gap-2">
                                <Filter className="w-4 h-4 text-gray-400" />
                                <AdminSelectValue placeholder="Nhóm thuốc" />
                            </div>
                        </AdminSelectTrigger>
                        <AdminSelectContent>
                            <AdminSelectItem value="all">Tất cả nhóm</AdminSelectItem>
                            {(filterOptions?.groups ?? []).map((group) => (
                                <AdminSelectItem key={group.NT_MA} value={group.NT_MA.toString()}>
                                    {group.NT_TEN}
                                </AdminSelectItem>
                            ))}
                        </AdminSelectContent>
                    </AdminSelect>

                    <AdminSelect value={manufacturerFilter} onValueChange={setManufacturerFilter}>
                        <AdminSelectTrigger>
                            <AdminSelectValue placeholder="Nhà sản xuất" />
                        </AdminSelectTrigger>
                        <AdminSelectContent>
                            <AdminSelectItem value="all">Tất cả nhà sản xuất</AdminSelectItem>
                            {(filterOptions?.manufacturers ?? []).map((manufacturer) => (
                                <AdminSelectItem key={manufacturer.NSX_MA} value={manufacturer.NSX_MA.toString()}>
                                    {manufacturer.NSX_TEN}
                                </AdminSelectItem>
                            ))}
                        </AdminSelectContent>
                    </AdminSelect>

                    <AdminSelect value={priceFilter} onValueChange={(value) => setPriceFilter(value as PriceFilterOption)}>
                        <AdminSelectTrigger>
                            <AdminSelectValue placeholder="Mức giá" />
                        </AdminSelectTrigger>
                        <AdminSelectContent>
                            <AdminSelectItem value="all">Tất cả mức giá</AdminSelectItem>
                            <AdminSelectItem value="lt_50k">Dưới 50.000đ</AdminSelectItem>
                            <AdminSelectItem value="50k_100k">50.000đ - 100.000đ</AdminSelectItem>
                            <AdminSelectItem value="100k_500k">100.000đ - 500.000đ</AdminSelectItem>
                            <AdminSelectItem value="gt_500k">Trên 500.000đ</AdminSelectItem>
                        </AdminSelectContent>
                    </AdminSelect>

                    <AdminSelect
                        value={expirationFilter}
                        onValueChange={(value) => setExpirationFilter(value as MedicineExpirationStatus)}
                    >
                        <AdminSelectTrigger>
                            <AdminSelectValue placeholder="Hạn sử dụng" />
                        </AdminSelectTrigger>
                        <AdminSelectContent>
                            <AdminSelectItem value="all">Tất cả</AdminSelectItem>
                            <AdminSelectItem value="valid">Còn hạn</AdminSelectItem>
                            <AdminSelectItem value="expiring">Cận hạn (còn 7 ngày)</AdminSelectItem>
                            <AdminSelectItem value="expired">Quá hạn</AdminSelectItem>
                        </AdminSelectContent>
                    </AdminSelect>

                    <AdminSelect value={sortOption} onValueChange={(value) => setSortOption(value as SortOption)}>
                        <AdminSelectTrigger>
                            <div className="flex items-center gap-2">
                                <ArrowUpDown className="w-4 h-4 text-gray-400" />
                                <AdminSelectValue placeholder="Sắp xếp" />
                            </div>
                        </AdminSelectTrigger>
                        <AdminSelectContent>
                            <AdminSelectItem value="code_asc">Mã: thấp → cao</AdminSelectItem>
                            <AdminSelectItem value="code_desc">Mã: cao → thấp</AdminSelectItem>
                            <AdminSelectItem value="price_asc">Giá: thấp → cao</AdminSelectItem>
                            <AdminSelectItem value="price_desc">Giá: cao → thấp</AdminSelectItem>
                        </AdminSelectContent>
                    </AdminSelect>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                            <TableHead className="w-[80px]">Mã</TableHead>
                            <TableHead className="min-w-[200px]">Tên thuốc</TableHead>
                            <TableHead>Nhóm thuốc</TableHead>
                            <TableHead>Nhà sản xuất</TableHead>
                            <TableHead>Đơn vị</TableHead>
                            <TableHead className="w-[170px]">Giá</TableHead>
                            <TableHead className="w-[130px]">Hạn dùng</TableHead>
                            <TableHead className="w-[160px]">Trạng thái</TableHead>
                            <TableHead className="text-right w-[150px]">Thao tác</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={9} className="text-center py-10 text-gray-500">
                                    Đang tải dữ liệu thuốc...
                                </TableCell>
                            </TableRow>
                        ) : isError ? (
                            <TableRow>
                                <TableCell colSpan={9} className="text-center py-10 text-red-600">
                                    Không thể tải danh sách thuốc. Vui lòng thử lại.
                                </TableCell>
                            </TableRow>
                        ) : medicines.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9} className="text-center py-14">
                                    <div className="flex flex-col items-center gap-2 text-gray-500">
                                        <Pill className="w-9 h-9 text-gray-300" />
                                        <p className="text-sm font-medium text-gray-700">
                                            {debouncedSearch || groupFilter !== 'all' || manufacturerFilter !== 'all' || priceFilter !== 'all' || expirationFilter !== 'all'
                                                ? 'Không tìm thấy thuốc phù hợp'
                                                : 'Chưa có thuốc nào'}
                                        </p>
                                        <p className="text-xs">
                                            {debouncedSearch || groupFilter !== 'all' || manufacturerFilter !== 'all' || priceFilter !== 'all' || expirationFilter !== 'all'
                                                ? 'Hãy thử thay đổi bộ lọc để tìm kết quả phù hợp.'
                                                : 'Hãy thêm thuốc đầu tiên để bắt đầu quản lý.'}
                                        </p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            medicines.map((medicine) => {
                                const status = getExpirationBadge(medicine.T_HAN_SU_DUNG);
                                return (
                                    <TableRow key={medicine.T_MA}>
                                        <TableCell className="font-medium text-gray-700">{medicine.T_MA}</TableCell>
                                        <TableCell>
                                            <p className="font-medium text-gray-900">{medicine.T_TEN_THUOC}</p>
                                            <p className="text-xs text-gray-500 mt-0.5">{medicine.BIET_DUOC?.BD_TEN || 'Chưa gán biệt dược'}</p>
                                        </TableCell>
                                        <TableCell className="text-gray-700">{medicine.NHOM_THUOC?.NT_TEN || '-'}</TableCell>
                                        <TableCell className="text-gray-700">{medicine.NHA_SAN_XUAT?.NSX_TEN || '-'}</TableCell>
                                        <TableCell className="text-gray-700">{medicine.DON_VI_TINH?.DVT_TEN || '-'}</TableCell>
                                        <TableCell className="font-medium text-gray-800">{formatCurrency(medicine.T_GIA_THUOC)}</TableCell>
                                        <TableCell className="text-gray-700">{formatDate(medicine.T_HAN_SU_DUNG)}</TableCell>
                                        <TableCell>
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${status.className}`}>
                                                {status.label}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex justify-end gap-2">
                                                <Link to={`/admin/medicines/detail/${medicine.T_MA}`}>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50">
                                                        <Eye className="w-4 h-4" />
                                                    </Button>
                                                </Link>
                                                <Link to={`/admin/medicines/edit/${medicine.T_MA}`}>
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
                                                        setDeleteId(medicine.T_MA);
                                                    }}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <p className="text-sm text-gray-600">
                    {meta
                        ? `Hiển thị ${(meta.page - 1) * meta.limit + (medicines.length ? 1 : 0)}-${(meta.page - 1) * meta.limit + medicines.length} / ${meta.total} thuốc`
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
                            Xác nhận xóa thuốc
                        </DialogTitle>
                        <DialogDescription>Bạn có chắc chắn muốn xóa thuốc này không?</DialogDescription>
                        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                            <p className="font-medium text-red-800">
                                {selectedMedicine?.T_TEN_THUOC || `Thuốc #${deleteId}`}
                            </p>
                            <p>Hành động này không thể hoàn tác.</p>
                        </div>
                        {deleteErrorMessage ? (
                            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                <p className="font-semibold">Xóa không thành công</p>
                                <p>{deleteErrorMessage}</p>
                                <p className="mt-1 text-xs text-red-600">
                                    Gợi ý: Thuốc đã phát sinh đơn kê nên được cập nhật hoặc ngừng sử dụng thay vì xóa.
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
