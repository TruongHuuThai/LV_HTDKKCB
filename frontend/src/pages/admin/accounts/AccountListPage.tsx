import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Edit, Plus, Search, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';

import { adminApi } from '@/services/api/adminApi';
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

type RoleFilter = 'all' | 'ADMIN' | 'BAC_SI' | 'BENH_NHAN';
type DeletedFilter = 'all' | 'active' | 'deleted';

const PAGE_SIZE = 10;

const ROLE_LABELS: Record<string, string> = {
    ADMIN: 'Quản trị viên',
    BAC_SI: 'Bác sĩ',
    BENH_NHAN: 'Bệnh nhân',
};

export default function AccountListPage() {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
    const [deletedFilter, setDeletedFilter] = useState<DeletedFilter>('all');
    const [deleteId, setDeleteId] = useState<string | null>(null);
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
    }, [roleFilter, deletedFilter]);

    const { data, isLoading, isError, isFetching } = useQuery({
        queryKey: ['admin-accounts', debouncedSearch, currentPage, roleFilter, deletedFilter],
        queryFn: () =>
            adminApi.getAccounts({
                search: debouncedSearch || undefined,
                page: currentPage,
                limit: PAGE_SIZE,
                role: roleFilter,
                deletedStatus: deletedFilter,
            }),
        placeholderData: (previousData) => previousData,
    });

    const accounts = data?.items ?? [];
    const meta = data?.meta;

    useEffect(() => {
        if (meta && currentPage > meta.totalPages) {
            setCurrentPage(meta.totalPages);
        }
    }, [meta, currentPage]);

    const deleteMutation = useMutation({
        mutationFn: (id: string) => adminApi.deleteAccount(id),
        onSuccess: () => {
            toast.success('Xóa tài khoản thành công');
            queryClient.invalidateQueries({ queryKey: ['admin-accounts'] });
            setDeleteErrorMessage(null);
            setDeleteId(null);
        },
        onError: (error: any) => {
            const message =
                error?.response?.data?.message ||
                'Không thể xóa tài khoản này vì có dữ liệu liên quan.';
            const normalizedMessage = Array.isArray(message) ? message.join(', ') : message;
            setDeleteErrorMessage(normalizedMessage);
            toast.error(normalizedMessage);
        },
    });

    const selectedAccount = useMemo(
        () => accounts.find((account) => account.TK_SDT === deleteId),
        [accounts, deleteId],
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
                    <h1 className="text-2xl font-bold text-gray-900">Quản lý tài khoản và phân quyền</h1>
                    <p className="text-sm text-gray-500 mt-1">Quản lý tài khoản đăng nhập, vai trò và hồ sơ bệnh nhân đi kèm</p>
                </div>
                <Link to="/admin/accounts/create">
                    <Button className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Thêm tài khoản
                    </Button>
                </Link>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                    <div className="relative w-full md:max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                            placeholder="Tìm theo số điện thoại tài khoản..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoComplete="off"
                            className="pl-9"
                        />
                    </div>

                    <div className="flex w-full flex-col gap-3 sm:flex-row md:w-auto">
                        <div className="w-full sm:w-[220px]">
                            <AdminSelect value={roleFilter} onValueChange={(val) => setRoleFilter(val as RoleFilter)}>
                                <AdminSelectTrigger>
                                    <AdminSelectValue placeholder="Lọc vai trò" />
                                </AdminSelectTrigger>
                                <AdminSelectContent>
                                    <AdminSelectItem value="all">Tất cả vai trò</AdminSelectItem>
                                    <AdminSelectItem value="ADMIN">Quản trị viên</AdminSelectItem>
                                    <AdminSelectItem value="BAC_SI">Bác sĩ</AdminSelectItem>
                                    <AdminSelectItem value="BENH_NHAN">Bệnh nhân</AdminSelectItem>
                                </AdminSelectContent>
                            </AdminSelect>
                        </div>

                        <div className="w-full sm:w-[220px]">
                            <AdminSelect value={deletedFilter} onValueChange={(val) => setDeletedFilter(val as DeletedFilter)}>
                                <AdminSelectTrigger>
                                    <AdminSelectValue placeholder="Trạng thái" />
                                </AdminSelectTrigger>
                                <AdminSelectContent>
                                    <AdminSelectItem value="all">Tất cả trạng thái</AdminSelectItem>
                                    <AdminSelectItem value="active">Đang hoạt động</AdminSelectItem>
                                    <AdminSelectItem value="deleted">Đã xóa</AdminSelectItem>
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
                            <TableHead>Tài khoản</TableHead>
                            <TableHead>Thông tin mật khẩu</TableHead>
                            <TableHead>Vai trò</TableHead>
                            <TableHead>Trạng thái</TableHead>
                            <TableHead>Hồ sơ bệnh nhân</TableHead>
                            <TableHead className="text-right w-[220px]">Thao tác</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-10 text-gray-500">
                                    Đang tải dữ liệu tài khoản...
                                </TableCell>
                            </TableRow>
                        ) : isError ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-10 text-red-600">
                                    Không thể tải danh sách tài khoản. Vui lòng thử lại.
                                </TableCell>
                            </TableRow>
                        ) : accounts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-14 text-gray-500">
                                    Chưa có tài khoản phù hợp
                                </TableCell>
                            </TableRow>
                        ) : (
                            accounts.map((account) => (
                                <TableRow key={account.TK_SDT}>
                                    <TableCell className="font-medium text-gray-900">{account.TK_SDT}</TableCell>
                                    <TableCell>
                                        <div className="space-y-2">
                                            <p className="text-xs font-mono text-gray-700">{account.TK_PASS_MASKED || '---'}</p>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700">
                                            {ROLE_LABELS[account.TK_VAI_TRO || ''] || '-'}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <span
                                            className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${
                                                account.TK_DA_XOA
                                                    ? 'bg-red-50 text-red-700'
                                                    : 'bg-emerald-50 text-emerald-700'
                                            }`}
                                        >
                                            {account.TK_DA_XOA ? 'Đã xóa' : 'Đang hoạt động'}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <span
                                                className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${
                                                    account.managedPatientLimitReached
                                                        ? 'bg-amber-50 text-amber-700'
                                                        : 'bg-slate-100 text-slate-700'
                                                }`}
                                            >
                                                {account.managedPatientCount}/10
                                            </span>
                                            {account.managedPatientLimitReached ? (
                                                <span className="text-xs text-amber-700">Đã đạt giới hạn</span>
                                            ) : null}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex justify-end gap-2">
                                            <Link to={`/admin/patients?accountPhone=${encodeURIComponent(account.TK_SDT)}`}>
                                                <Button variant="outline" size="sm" className="h-8">
                                                    <Users className="w-4 h-4 mr-1" />
                                                    Hồ sơ bệnh nhân
                                                </Button>
                                            </Link>
                                            <Link to={`/admin/accounts/edit/${encodeURIComponent(account.TK_SDT)}`}>
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
                                                    setDeleteId(account.TK_SDT);
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
                        ? `Hiển thị ${(meta.page - 1) * meta.limit + (accounts.length ? 1 : 0)}-${(meta.page - 1) * meta.limit + accounts.length} / ${meta.total} tài khoản`
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
                            Xác nhận xóa tài khoản
                        </DialogTitle>
                        <DialogDescription>Bạn có chắc chắn muốn xóa tài khoản này không?</DialogDescription>
                        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                            <p className="font-medium text-red-800">{selectedAccount?.TK_SDT || deleteId}</p>
                            <p>Hành động này sẽ chuyển tài khoản về trạng thái đã xóa.</p>
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
