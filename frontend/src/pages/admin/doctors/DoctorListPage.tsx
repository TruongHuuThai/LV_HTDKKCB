import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowUpDown, Download, Edit, Filter, Plus, Search, Trash2, UserRound } from 'lucide-react';
import { toast } from 'sonner';

import {
    adminApi,
    type AdminDoctor,
    type DoctorSortBy,
    type DoctorSortOrder,
} from '@/services/api/adminApi';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    AdminSelect,
    AdminSelectContent,
    AdminSelectItem,
    AdminSelectTrigger,
    AdminSelectValue,
} from '@/components/admin/AdminSelect';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

type SortOption = 'code_asc' | 'code_desc';

const PAGE_SIZE = 10;

const SORT_OPTION_MAP: Record<SortOption, { sortBy: DoctorSortBy; sortOrder: DoctorSortOrder }> = {
    code_asc: { sortBy: 'code', sortOrder: 'asc' },
    code_desc: { sortBy: 'code', sortOrder: 'desc' },
};

export default function DoctorListPage() {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [sortOption, setSortOption] = useState<SortOption>('code_asc');
    const [specialtyFilter, setSpecialtyFilter] = useState('all');
    const [academicTitleFilter, setAcademicTitleFilter] = useState('all');
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
    }, [sortOption, specialtyFilter, academicTitleFilter]);

    const { sortBy, sortOrder } = SORT_OPTION_MAP[sortOption];
    const selectedSpecialtyId = specialtyFilter === 'all' ? undefined : Number(specialtyFilter);
    const selectedAcademicTitle = academicTitleFilter === 'all' ? undefined : academicTitleFilter;

    const { data: specialties = [] } = useQuery({
        queryKey: ['admin-specialties-options'],
        queryFn: () => adminApi.getSpecialties(),
    });

    const { data: academicTitles = [] } = useQuery({
        queryKey: ['admin-doctor-academic-titles'],
        queryFn: () => adminApi.getDoctorAcademicTitles(),
    });

    const { data, isLoading, isError, isFetching } = useQuery({
        queryKey: ['admin-doctors', debouncedSearch, currentPage, sortBy, sortOrder, selectedSpecialtyId, selectedAcademicTitle],
        queryFn: () =>
            adminApi.getDoctors({
                search: debouncedSearch || undefined,
                page: currentPage,
                limit: PAGE_SIZE,
                sortBy,
                sortOrder,
                specialtyId: selectedSpecialtyId,
                academicTitle: selectedAcademicTitle,
            }),
        placeholderData: (previousData) => previousData,
    });

    const doctors = data?.items ?? [];
    const meta = data?.meta;

    useEffect(() => {
        if (meta && currentPage > meta.totalPages) {
            setCurrentPage(meta.totalPages);
        }
    }, [meta, currentPage]);

    const deleteMutation = useMutation({
        mutationFn: (id: number) => adminApi.deleteDoctor(id),
        onSuccess: () => {
            toast.success('Xóa bác s? thành công');
            queryClient.invalidateQueries({ queryKey: ['admin-doctors'] });
            setDeleteErrorMessage(null);
            setDeleteId(null);
        },
        onError: (error: any) => {
            const message =
                error?.response?.data?.message ||
                'Không thể xóa bác sĩ này vì có dữ liệu liên quan đến bảng khác. Vui lòng xử lý dữ liệu liên quan trước khi thử lại.';
            const normalizedMessage = Array.isArray(message) ? message.join(', ') : message;
            setDeleteErrorMessage(normalizedMessage);
            toast.error(normalizedMessage);
        },
    });

    const selectedDoctor = useMemo(
        () => doctors.find((doctor) => doctor.BS_MA === deleteId),
        [doctors, deleteId],
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
                    <h1 className="text-2xl font-bold text-gray-900">Quản lý thông tin bác sĩ</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Quản lý danh sách bác sĩ trong hệ thống
                    </p>
                </div>
                <Link to="/admin/doctors/create">
                    <Button className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Thêm bác s?
                    </Button>
                </Link>
                <Button
                    variant="outline"
                    onClick={() => {
                        void (async () => {
                            try {
                                await adminApi.downloadDoctorsPdf({
                                    search: debouncedSearch || undefined,
                                    sortBy,
                                    sortOrder,
                                    specialtyId: selectedSpecialtyId,
                                    academicTitle: selectedAcademicTitle,
                                });
                                toast.success('Da xuat danh sach bac si PDF.');
                            } catch (error: any) {
                                const message = error?.response?.data?.message || 'Khong the xuat danh sach bac si PDF.';
                                toast.error(Array.isArray(message) ? message.join(', ') : message);
                            }
                        })();
                    }}
                >
                    <Download className="mr-2 h-4 w-4" />
                    Xuat danh sach PDF
                </Button>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                    <div className="relative w-full md:max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                            placeholder="Tìm theo tên hoặc số điện thoại bác sĩ..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9"
                        />
                    </div>

                    <div className="flex w-full flex-col gap-3 sm:flex-row md:w-auto">
                        <div className="w-full sm:w-[220px]">
                            <AdminSelect value={specialtyFilter} onValueChange={setSpecialtyFilter}>
                                <AdminSelectTrigger>
                                    <div className="flex items-center gap-2">
                                        <Filter className="w-4 h-4 text-gray-400" />
                                        <AdminSelectValue placeholder="Lọc chuyên khoa" />
                                    </div>
                                </AdminSelectTrigger>
                                <AdminSelectContent>
                                    <AdminSelectItem value="all">Tất cả khoa</AdminSelectItem>
                                    {specialties.map((specialty) => (
                                        <AdminSelectItem key={specialty.CK_MA} value={specialty.CK_MA.toString()}>
                                            {specialty.CK_TEN}
                                        </AdminSelectItem>
                                    ))}
                                </AdminSelectContent>
                            </AdminSelect>
                        </div>

                        <div className="w-full sm:w-[220px]">
                            <AdminSelect value={academicTitleFilter} onValueChange={setAcademicTitleFilter}>
                                <AdminSelectTrigger>
                                    <AdminSelectValue placeholder="Lọc học hàm" />
                                </AdminSelectTrigger>
                                <AdminSelectContent>
                                    <AdminSelectItem value="all">Tất cả học hàm</AdminSelectItem>
                                    {academicTitles.map((title) => (
                                        <AdminSelectItem key={title} value={title}>
                                            {title}
                                        </AdminSelectItem>
                                    ))}
                                </AdminSelectContent>
                            </AdminSelect>
                        </div>

                        <div className="w-full sm:w-[220px]">
                            <AdminSelect value={sortOption} onValueChange={(val) => setSortOption(val as SortOption)}>
                                <AdminSelectTrigger>
                                    <div className="flex items-center gap-2">
                                        <ArrowUpDown className="w-4 h-4 text-gray-400" />
                                        <AdminSelectValue placeholder="Sắp xếp" />
                                    </div>
                                </AdminSelectTrigger>
                                <AdminSelectContent>
                                    <AdminSelectItem value="code_asc">Mã: tăng dần</AdminSelectItem>
                                    <AdminSelectItem value="code_desc">Mã: giảm dần</AdminSelectItem>
                                </AdminSelectContent>
                            </AdminSelect>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                            <TableHead className="w-[90px]">Mã</TableHead>
                            <TableHead className="min-w-[260px]">Bác sĩ</TableHead>
                            <TableHead>Số điện thoại</TableHead>
                            <TableHead>Chuyên khoa</TableHead>
                            <TableHead>Học hàm</TableHead>
                            <TableHead className="text-right w-[120px]">Thao tác</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-10 text-gray-500">
                                    Đang tải dữ liệu bác sĩ...
                                </TableCell>
                            </TableRow>
                        ) : isError ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-10 text-red-600">
                                    Không thể tải danh sách bác sĩ. Vui lòng thử lại.
                                </TableCell>
                            </TableRow>
                        ) : doctors.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-14 text-gray-500">
                                    {debouncedSearch || specialtyFilter !== 'all' || academicTitleFilter !== 'all'
                                        ? 'Không tìm thấy bác sĩ phù hợp'
                                        : 'Chưa có bác sĩ nào'}
                                </TableCell>
                            </TableRow>
                        ) : (
                            doctors.map((doctor: AdminDoctor) => (
                                <TableRow key={doctor.BS_MA}>
                                    <TableCell className="font-medium text-gray-700">{doctor.BS_MA}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-10 w-10 border border-gray-100">
                                                <AvatarImage src={doctor.BS_ANH || ''} alt={doctor.BS_HO_TEN} className="object-cover" />
                                                <AvatarFallback className="bg-blue-50 text-blue-600">
                                                    <UserRound className="w-5 h-5" />
                                                </AvatarFallback>
                                            </Avatar>
                                            <p className="font-medium text-gray-900">{doctor.BS_HO_TEN}</p>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-gray-700">{doctor.BS_SDT || '-'}</TableCell>
                                    <TableCell>
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700">
                                            {doctor.CHUYEN_KHOA?.CK_TEN || '-'}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-gray-600">{doctor.BS_HOC_HAM || '-'}</TableCell>
                                    <TableCell>
                                        <div className="flex justify-end gap-2">
                                            <Link to={`/admin/doctors/edit/${doctor.BS_MA}`}>
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
                                                            await adminApi.downloadDoctorProfilePdf(doctor.BS_MA);
                                                            toast.success(`Da xuat ho so bac si #${doctor.BS_MA}.`);
                                                        } catch (error: any) {
                                                            const message = error?.response?.data?.message || 'Khong the xuat ho so bac si.';
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
                                                    setDeleteId(doctor.BS_MA);
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
                        ? `Hiển thị ${(meta.page - 1) * meta.limit + (doctors.length ? 1 : 0)}-${(meta.page - 1) * meta.limit + doctors.length} / ${meta.total} bác sĩ`
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
                            Xác nhận xóa bác sĩ
                        </DialogTitle>
                        <DialogDescription>
                            Bạn có chắc chắn muốn xóa bác sĩ này không?
                        </DialogDescription>
                        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                            <p className="font-medium text-red-800">
                                {selectedDoctor?.BS_HO_TEN || `Bác sĩ #${deleteId}`}
                            </p>
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
