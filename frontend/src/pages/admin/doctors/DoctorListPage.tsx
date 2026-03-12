// src/pages/admin/doctors/DoctorListPage.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Filter, Edit, Trash2, UserRound } from 'lucide-react';
import { toast } from 'sonner';

import { adminApi } from '@/services/api/adminApi';
import type { AdminDoctor } from '@/services/api/adminApi';
import { getSpecialties } from '@/services/api';
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export default function DoctorListPage() {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [specialtyFilter, setSpecialtyFilter] = useState('all');
    const [deleteId, setDeleteId] = useState<number | null>(null);

    // Fetch Specialties for filter dropdown
    const { data: specialties = [] } = useQuery({
        queryKey: ['specialties'],
        queryFn: getSpecialties,
    });

    // Fetch Doctors list
    const { data: doctors = [], isLoading } = useQuery({
        queryKey: ['admin-doctors'],
        queryFn: () => adminApi.getDoctors(),
    });

    // Delete Mutation
    const deleteMutation = useMutation({
        mutationFn: (id: number) => adminApi.deleteDoctor(id),
        onSuccess: () => {
            toast.success('Xóa bác sĩ thành công');
            queryClient.invalidateQueries({ queryKey: ['admin-doctors'] });
            setDeleteId(null);
        },
        onError: () => {
            toast.error('Có lỗi xảy ra khi xóa bác sĩ');
            setDeleteId(null);
        },
    });

    // Filtering logic (client-side for now)
    const filteredDoctors = doctors.filter((doc: AdminDoctor) => {
        const matchesSearch = doc.BS_HO_TEN.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSpecialty = specialtyFilter === 'all' || doc.CK_MA.toString() === specialtyFilter;
        return matchesSearch && matchesSpecialty;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Quản lý Đội ngũ Bác sĩ</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Danh sách tất cả bác sĩ trong hệ thống
                    </p>
                </div>
                <Link to="/admin/doctors/create">
                    <Button className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Thêm Bác sĩ
                    </Button>
                </Link>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                        placeholder="Tìm kiếm theo tên bác sĩ..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <div className="w-full sm:w-64">
                    <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
                        <SelectTrigger>
                            <div className="flex items-center gap-2">
                                <Filter className="w-4 h-4 text-gray-400" />
                                <SelectValue placeholder="Lọc theo chuyên khoa" />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tất cả chuyên khoa</SelectItem>
                            {specialties.map((sp) => (
                                <SelectItem key={sp.CK_MA} value={sp.CK_MA.toString()}>
                                    {sp.CK_TEN}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                            <TableHead className="w-[300px]">Bác sĩ</TableHead>
                            <TableHead>Chuyên khoa</TableHead>
                            <TableHead>Chức vụ</TableHead>
                            <TableHead>Trạng thái</TableHead>
                            <TableHead className="text-right">Thao tác</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-10 text-gray-500">
                                    Đang tải dữ liệu...
                                </TableCell>
                            </TableRow>
                        ) : filteredDoctors.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-10 text-gray-500">
                                    Không tìm thấy bác sĩ nào phù hợp.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredDoctors.map((doctor: AdminDoctor) => (
                                <TableRow key={doctor.BS_MA}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-10 w-10 border border-gray-100">
                                                <AvatarImage src={doctor.BS_ANH || ''} alt={doctor.BS_HO_TEN} className="object-cover" />
                                                <AvatarFallback className="bg-blue-50 text-blue-600">
                                                    <UserRound className="w-5 h-5" />
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="font-medium text-gray-900">{doctor.BS_HO_TEN}</p>
                                                <p className="text-xs text-gray-500 mt-0.5">{doctor.BS_SDT || 'Chưa cập nhật SĐT'}</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700">
                                            {doctor.CHUYEN_KHOA?.CK_TEN || 'Chưa có thông tin'}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-gray-600">
                                        {doctor.BS_HOC_HAM || 'Bác sĩ'}
                                    </TableCell>
                                    <TableCell>
                                        {doctor.TRANG_THAI === 'HIDDEN' ? (
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mr-1.5"></span>
                                                Đang ẩn
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
                                                Hoạt động
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Link to={`/admin/doctors/edit/${doctor.BS_MA}`}>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50">
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                            </Link>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50"
                                                onClick={() => setDeleteId(doctor.BS_MA)}
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

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Xác nhận xóa bác sĩ</DialogTitle>
                        <DialogDescription>
                            Hành động này không thể hoàn tác. Bạn có chắc chắn muốn xóa bác sĩ này khỏi hệ thống?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={() => setDeleteId(null)}>
                            Hủy
                        </Button>
                        <Button 
                            variant="destructive" 
                            onClick={() => deleteId && deleteMutation.mutate(deleteId)}
                            disabled={deleteMutation.isPending}
                        >
                            {deleteMutation.isPending ? 'Đang xóa...' : 'Xác nhận xóa'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
