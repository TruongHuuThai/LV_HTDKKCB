import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowUpDown, Building2, Edit, Filter, MapPin, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import {
    adminApi,
    type RoomSortBy,
    type RoomSortOrder,
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

type SortOption = 'name_asc' | 'name_desc' | 'code_asc' | 'code_desc';

const PAGE_SIZE = 10;

const SORT_OPTION_MAP: Record<SortOption, { sortBy: RoomSortBy; sortOrder: RoomSortOrder }> = {
    name_asc: { sortBy: 'name', sortOrder: 'asc' },
    name_desc: { sortBy: 'name', sortOrder: 'desc' },
    code_asc: { sortBy: 'code', sortOrder: 'asc' },
    code_desc: { sortBy: 'code', sortOrder: 'desc' },
};

export default function RoomListPage() {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [sortOption, setSortOption] = useState<SortOption>('code_asc');
    const [specialtyFilter, setSpecialtyFilter] = useState('all');
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
    }, [sortOption, specialtyFilter]);

    const { sortBy, sortOrder } = SORT_OPTION_MAP[sortOption];
    const selectedSpecialtyId = specialtyFilter === 'all' ? undefined : Number(specialtyFilter);

    const { data: specialties } = useQuery({
        queryKey: ['specialties'],
        queryFn: () => adminApi.getSpecialties(),
    });

    const { data, isLoading, isError, isFetching } = useQuery({
        queryKey: ['admin-rooms', debouncedSearch, currentPage, sortBy, sortOrder, specialtyFilter],
        queryFn: () =>
            adminApi.getRooms({
                search: debouncedSearch || undefined,
                page: currentPage,
                limit: PAGE_SIZE,
                sortBy,
                sortOrder,
                specialtyId: selectedSpecialtyId,
            }),
        placeholderData: (previousData) => previousData,
    });

    const rooms = data?.items ?? [];
    const meta = data?.meta;

    useEffect(() => {
        if (meta && currentPage > meta.totalPages) {
            setCurrentPage(meta.totalPages);
        }
    }, [meta, currentPage]);

    const deleteMutation = useMutation({
        mutationFn: (id: number) => adminApi.deleteRoom(id),
        onSuccess: () => {
            toast.success('Xóa phòng thành công');
            queryClient.invalidateQueries({ queryKey: ['admin-rooms'] });
            queryClient.invalidateQueries({ queryKey: ['admin-schedule-options'] });
            setDeleteErrorMessage(null);
            setDeleteId(null);
        },
        onError: (error: any) => {
            const message =
                error?.response?.data?.message ||
                'Không thể xóa phòng này vì đã có lịch hoặc dữ liệu liên quan. Vui lòng xử lý dữ liệu liên quan trước khi thử lại.';
            const normalizedMessage = Array.isArray(message) ? message.join(', ') : message;
            setDeleteErrorMessage(normalizedMessage);
            toast.error(normalizedMessage);
        },
    });

    const selectedRoom = useMemo(
        () => rooms.find((room) => room.P_MA === deleteId),
        [rooms, deleteId],
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
                    <h1 className="text-2xl font-bold text-gray-900">Quản lý phòng</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Quản trị phòng khám trong khu vực cơ sở vật chất của hệ thống
                    </p>
                </div>
                <Link to="/admin/facilities/create">
                    <Button className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Thêm phòng
                    </Button>
                </Link>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                    <div className="relative w-full md:max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                            placeholder="Tìm theo tên phòng, vị trí hoặc chuyên khoa..."
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
                                    <AdminSelectItem value="all">Tất cả chuyên khoa</AdminSelectItem>
                                    {(specialties ?? []).map((specialty) => (
                                        <AdminSelectItem key={specialty.CK_MA} value={String(specialty.CK_MA)}>
                                            {specialty.CK_TEN}
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
                                    <AdminSelectItem value="name_asc">Tên: A → Z</AdminSelectItem>
                                    <AdminSelectItem value="name_desc">Tên: Z → A</AdminSelectItem>
                                    <AdminSelectItem value="code_asc">Mã: thấp → cao</AdminSelectItem>
                                    <AdminSelectItem value="code_desc">Mã: cao → thấp</AdminSelectItem>
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
                            <TableHead>Tên phòng</TableHead>
                            <TableHead>Chuyên khoa</TableHead>
                            <TableHead>Vị trí</TableHead>
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
                                    Không thể tải danh sách phòng. Vui lòng thử lại.
                                </TableCell>
                            </TableRow>
                        ) : rooms.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-14">
                                    <div className="flex flex-col items-center gap-2 text-gray-500">
                                        <Building2 className="w-9 h-9 text-gray-300" />
                                        <p className="text-sm font-medium text-gray-700">
                                            {debouncedSearch || specialtyFilter !== 'all'
                                                ? 'Không tìm thấy phòng phù hợp'
                                                : 'Chưa có phòng nào'}
                                        </p>
                                        <p className="text-xs">
                                            {debouncedSearch || specialtyFilter !== 'all'
                                                ? 'Hãy thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.'
                                                : 'Hãy thêm phòng đầu tiên để bắt đầu quản lý.'}
                                        </p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            rooms.map((room) => (
                                <TableRow key={room.P_MA}>
                                    <TableCell className="font-medium text-gray-700">{room.P_MA}</TableCell>
                                    <TableCell className="font-medium text-gray-900">{room.P_TEN}</TableCell>
                                    <TableCell className="text-gray-700">{room.CHUYEN_KHOA?.CK_TEN || '-'}</TableCell>
                                    <TableCell className="text-gray-600">
                                        {room.P_VI_TRI ? (
                                            <span className="inline-flex items-center gap-1.5">
                                                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                                                {room.P_VI_TRI}
                                            </span>
                                        ) : (
                                            '-'
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex justify-end gap-2">
                                            <Link to={`/admin/facilities/edit/${room.P_MA}`}>
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
                                                    setDeleteId(room.P_MA);
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
                        ? `Hiển thị ${(meta.page - 1) * meta.limit + (rooms.length ? 1 : 0)}-${(meta.page - 1) * meta.limit + rooms.length} / ${meta.total} phòng`
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
                            Xác nhận xóa phòng
                        </DialogTitle>
                        <DialogDescription>
                            Bạn có chắc chắn muốn xóa phòng này không?
                        </DialogDescription>
                        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                            <p className="font-medium text-red-800">
                                {selectedRoom?.P_TEN || `Phòng #${deleteId}`}
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
