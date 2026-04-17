import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowUpDown, Download, Edit, Filter, Plus, Search, Trash2, UserRound } from 'lucide-react';
import { toast } from 'sonner';

import {
    adminApi,
    type AdminPatient,
    type PatientSortBy,
    type PatientSortOrder,
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    AdminSelect,
    AdminSelectContent,
    AdminSelectItem,
    AdminSelectTrigger,
    AdminSelectValue,
} from '@/components/admin/AdminSelect';

type SortOption = 'code_asc' | 'code_desc' | 'name_asc' | 'name_desc';
type GenderFilter = 'all' | 'male' | 'female';
type PatientTypeFilter = 'all' | 'new' | 'returning';

const PAGE_SIZE = 10;

const SORT_OPTION_MAP: Record<SortOption, { sortBy: PatientSortBy; sortOrder: PatientSortOrder }> = {
    code_asc: { sortBy: 'code', sortOrder: 'asc' },
    code_desc: { sortBy: 'code', sortOrder: 'desc' },
    name_asc: { sortBy: 'name', sortOrder: 'asc' },
    name_desc: { sortBy: 'name', sortOrder: 'desc' },
};

function getPatientName(patient: AdminPatient) {
    const parts = [patient.BN_HO_CHU_LOT, patient.BN_TEN].filter((v) => (v || '').trim().length > 0);
    return parts.join(' ').trim() || `Bệnh nhân #${patient.BN_MA}`;
}

function getGenderLabel(isMale: boolean | null) {
    if (isMale === true) return 'Nam';
    if (isMale === false) return 'Nữ';
    return '-';
}

function getPatientTypeLabel(isNew: boolean | null) {
    if (isNew === true) return 'Bệnh nhân mới';
    if (isNew === false) return 'Bệnh nhân cũ';
    return '-';
}

export default function PatientListPage() {
    const queryClient = useQueryClient();
    const [searchParams, setSearchParams] = useSearchParams();
    const accountPhoneFilter = searchParams.get('accountPhone')?.trim() || '';
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [sortOption, setSortOption] = useState<SortOption>('code_asc');
    const [genderFilter, setGenderFilter] = useState<GenderFilter>('all');
    const [nationalityFilter, setNationalityFilter] = useState('all');
    const [ethnicityFilter, setEthnicityFilter] = useState('all');
    const [patientTypeFilter, setPatientTypeFilter] = useState<PatientTypeFilter>('all');
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
    }, [sortOption, genderFilter, nationalityFilter, ethnicityFilter, patientTypeFilter]);

    const { sortBy, sortOrder } = SORT_OPTION_MAP[sortOption];

    const { data: filterOptions } = useQuery({
        queryKey: ['admin-patient-filter-options'],
        queryFn: () => adminApi.getPatientFilterOptions(),
    });

    const { data, isLoading, isError, isFetching } = useQuery({
        queryKey: [
            'admin-patients',
            debouncedSearch,
            currentPage,
            sortBy,
            sortOrder,
            genderFilter,
            nationalityFilter,
            ethnicityFilter,
            patientTypeFilter,
            accountPhoneFilter,
        ],
        queryFn: () =>
            adminApi.getPatients({
                search: debouncedSearch || undefined,
                page: currentPage,
                limit: PAGE_SIZE,
                sortBy,
                sortOrder,
                gender: genderFilter,
                nationality: nationalityFilter === 'all' ? undefined : nationalityFilter,
                ethnicity: ethnicityFilter === 'all' ? undefined : ethnicityFilter,
                patientType: patientTypeFilter,
                accountPhone: accountPhoneFilter || undefined,
            }),
        placeholderData: (previousData) => previousData,
    });

    const patients = data?.items ?? [];
    const meta = data?.meta;

    useEffect(() => {
        if (meta && currentPage > meta.totalPages) {
            setCurrentPage(meta.totalPages);
        }
    }, [meta, currentPage]);

    const deleteMutation = useMutation({
        mutationFn: (id: number) => adminApi.deletePatient(id),
        onSuccess: () => {
            toast.success('Xóa bệnh nhân thành công');
            queryClient.invalidateQueries({ queryKey: ['admin-patients'] });
            setDeleteErrorMessage(null);
            setDeleteId(null);
        },
        onError: (error: any) => {
            const message =
                error?.response?.data?.message ||
                'Không thể xóa bệnh nhân này vì đã có dữ liệu khám bệnh hoặc thanh toán liên quan.';
            const normalizedMessage = Array.isArray(message) ? message.join(', ') : message;
            setDeleteErrorMessage(normalizedMessage);
            toast.error(normalizedMessage);
        },
    });

    const selectedPatient = useMemo(
        () => patients.find((patient) => patient.BN_MA === deleteId),
        [patients, deleteId],
    );

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
                    <h1 className="text-2xl font-bold text-gray-900">Quản lý thông tin bệnh nhân</h1>
                    <p className="text-sm text-gray-500 mt-1">Quản lý danh sách bệnh nhân trong hệ thống</p>
                </div>
                <Link to="/admin/patients/create">
                    <Button className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Thêm bệnh nhân
                    </Button>
                </Link>
                <Button
                    variant="outline"
                    onClick={() => {
                        void (async () => {
                            try {
                                await adminApi.downloadPatientsPdf({
                                    search: debouncedSearch || undefined,
                                    sortBy,
                                    sortOrder,
                                    gender: genderFilter,
                                    nationality: nationalityFilter === 'all' ? undefined : nationalityFilter,
                                    ethnicity: ethnicityFilter === 'all' ? undefined : ethnicityFilter,
                                    patientType: patientTypeFilter,
                                    accountPhone: accountPhoneFilter || undefined,
                                });
                                toast.success('Da xuat danh sach benh nhan PDF.');
                            } catch (error: any) {
                                const message = error?.response?.data?.message || 'Khong the xuat danh sach benh nhan PDF.';
                                toast.error(Array.isArray(message) ? message.join(', ') : message);
                            }
                        })();
                    }}
                >
                    <Download className="mr-2 h-4 w-4" />
                    Xuat danh sach PDF
                </Button>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
                {accountPhoneFilter ? (
                    <div className="flex flex-col gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700 sm:flex-row sm:items-center sm:justify-between">
                        <span>
                            Đang xem hồ sơ bệnh nhân thuộc tài khoản: <span className="font-semibold">{accountPhoneFilter}</span>
                        </span>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 border-blue-300 text-blue-700 hover:bg-blue-100"
                            onClick={() => {
                                const nextParams = new URLSearchParams(searchParams);
                                nextParams.delete('accountPhone');
                                setSearchParams(nextParams);
                            }}
                        >
                            Bỏ lọc tài khoản
                        </Button>
                    </div>
                ) : null}
                <div className="relative w-full md:max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                        placeholder="Tìm theo họ tên hoặc số điện thoại..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
                    <AdminSelect value={genderFilter} onValueChange={(val) => setGenderFilter(val as GenderFilter)}>
                        <AdminSelectTrigger>
                            <div className="flex items-center gap-2">
                                <Filter className="w-4 h-4 text-gray-400" />
                                <AdminSelectValue placeholder="Giới tính" />
                            </div>
                        </AdminSelectTrigger>
                        <AdminSelectContent>
                            <AdminSelectItem value="all">Tất cả giới tính</AdminSelectItem>
                            <AdminSelectItem value="male">Nam</AdminSelectItem>
                            <AdminSelectItem value="female">Nữ</AdminSelectItem>
                        </AdminSelectContent>
                    </AdminSelect>

                    <AdminSelect value={nationalityFilter} onValueChange={setNationalityFilter}>
                        <AdminSelectTrigger>
                            <AdminSelectValue placeholder="Quốc tịch" />
                        </AdminSelectTrigger>
                        <AdminSelectContent>
                            <AdminSelectItem value="all">Tất cả quốc tịch</AdminSelectItem>
                            {(filterOptions?.nationalities ?? []).map((value) => (
                                <AdminSelectItem key={value} value={value}>
                                    {value}
                                </AdminSelectItem>
                            ))}
                        </AdminSelectContent>
                    </AdminSelect>

                    <AdminSelect value={ethnicityFilter} onValueChange={setEthnicityFilter}>
                        <AdminSelectTrigger>
                            <AdminSelectValue placeholder="Dân tộc" />
                        </AdminSelectTrigger>
                        <AdminSelectContent>
                            <AdminSelectItem value="all">Tất cả dân tộc</AdminSelectItem>
                            {(filterOptions?.ethnicities ?? []).map((value) => (
                                <AdminSelectItem key={value} value={value}>
                                    {value}
                                </AdminSelectItem>
                            ))}
                        </AdminSelectContent>
                    </AdminSelect>

                    <AdminSelect value={patientTypeFilter} onValueChange={(val) => setPatientTypeFilter(val as PatientTypeFilter)}>
                        <AdminSelectTrigger>
                            <AdminSelectValue placeholder="Loại bệnh nhân" />
                        </AdminSelectTrigger>
                        <AdminSelectContent>
                            <AdminSelectItem value="all">Tất cả bệnh nhân</AdminSelectItem>
                            <AdminSelectItem value="new">Bệnh nhân mới</AdminSelectItem>
                            <AdminSelectItem value="returning">Bệnh nhân cũ</AdminSelectItem>
                        </AdminSelectContent>
                    </AdminSelect>

                    <AdminSelect value={sortOption} onValueChange={(val) => setSortOption(val as SortOption)}>
                        <AdminSelectTrigger>
                            <div className="flex items-center gap-2">
                                <ArrowUpDown className="w-4 h-4 text-gray-400" />
                                <AdminSelectValue placeholder="Sắp xếp" />
                            </div>
                        </AdminSelectTrigger>
                        <AdminSelectContent>
                            <AdminSelectItem value="code_asc">Mã: thấp → cao</AdminSelectItem>
                            <AdminSelectItem value="code_desc">Mã: cao → thấp</AdminSelectItem>
                            <AdminSelectItem value="name_asc">Tên: A → Z</AdminSelectItem>
                            <AdminSelectItem value="name_desc">Tên: Z → A</AdminSelectItem>
                        </AdminSelectContent>
                    </AdminSelect>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                            <TableHead className="w-[90px]">Mã</TableHead>
                            <TableHead className="min-w-[260px]">Bệnh nhân</TableHead>
                            <TableHead>Giới tính</TableHead>
                            <TableHead>Số điện thoại</TableHead>
                            <TableHead>Quốc tịch</TableHead>
                            <TableHead>Dân tộc</TableHead>
                            <TableHead>Loại</TableHead>
                            <TableHead className="text-right w-[120px]">Thao tác</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-10 text-gray-500">
                                    Đang tải dữ liệu bệnh nhân...
                                </TableCell>
                            </TableRow>
                        ) : isError ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-10 text-red-600">
                                    Không thể tải danh sách bệnh nhân. Vui lòng thử lại.
                                </TableCell>
                            </TableRow>
                        ) : patients.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-14 text-gray-500">
                                    Chưa có bệnh nhân phù hợp
                                </TableCell>
                            </TableRow>
                        ) : (
                            patients.map((patient) => (
                                <TableRow key={patient.BN_MA}>
                                    <TableCell className="font-medium text-gray-700">{patient.BN_MA}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-10 w-10 border border-gray-100">
                                                <AvatarImage src={patient.BN_ANH || ''} alt={getPatientName(patient)} className="object-cover" />
                                                <AvatarFallback className="bg-blue-50 text-blue-600">
                                                    <UserRound className="w-5 h-5" />
                                                </AvatarFallback>
                                            </Avatar>
                                            <p className="font-medium text-gray-900">{getPatientName(patient)}</p>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-gray-700">{getGenderLabel(patient.BN_LA_NAM)}</TableCell>
                                    <TableCell className="text-gray-700">{patient.BN_SDT_DANG_KY || '-'}</TableCell>
                                    <TableCell className="text-gray-700">{patient.BN_QUOC_GIA || '-'}</TableCell>
                                    <TableCell className="text-gray-700">{patient.BN_DAN_TOC || '-'}</TableCell>
                                    <TableCell>
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700">
                                            {getPatientTypeLabel(patient.BN_MOI)}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex justify-end gap-2">
                                            <Link to={`/admin/patients/edit/${patient.BN_MA}`}>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50">
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                            </Link>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                                                onClick={() => {
                                                    void (async () => {
                                                        try {
                                                            await adminApi.downloadPatientProfilePdf(patient.BN_MA);
                                                            toast.success(`Da xuat ho so benh nhan #${patient.BN_MA}.`);
                                                        } catch (error: any) {
                                                            const message = error?.response?.data?.message || 'Khong the xuat ho so benh nhan.';
                                                            toast.error(Array.isArray(message) ? message.join(', ') : message);
                                                        }
                                                    })();
                                                }}
                                            >
                                                <Download className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50"
                                                onClick={() => {
                                                    setDeleteErrorMessage(null);
                                                    setDeleteId(patient.BN_MA);
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
                        ? `Hiển thị ${(meta.page - 1) * meta.limit + (patients.length ? 1 : 0)}-${(meta.page - 1) * meta.limit + patients.length} / ${meta.total} bệnh nhân`
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
                            Xác nhận xóa bệnh nhân
                        </DialogTitle>
                        <DialogDescription>Bạn có chắc chắn muốn xóa bệnh nhân này không?</DialogDescription>
                        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                            <p className="font-medium text-red-800">{selectedPatient ? getPatientName(selectedPatient) : `Bệnh nhân #${deleteId}`}</p>
                            <p>Hành động này không thể hoàn tác.</p>
                        </div>
                        {deleteErrorMessage ? (
                            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                <p className="font-semibold">Xóa không thành công</p>
                                <p>{deleteErrorMessage}</p>
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
