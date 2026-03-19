import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as z from 'zod';
import { ChevronLeft, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

import { adminApi } from '@/services/api/adminApi';
import type { CreateRoomInput, UpdateRoomInput } from '@/services/api/adminApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import {
    AdminSelect,
    AdminSelectContent,
    AdminSelectItem,
    AdminSelectTrigger,
    AdminSelectValue,
} from '@/components/admin/AdminSelect';

const roomSchema = z.object({
    CK_MA: z.number({ message: 'Vui lòng chọn chuyên khoa' }).int().positive('Vui lòng chọn chuyên khoa'),
    P_TEN: z
        .string()
        .trim()
        .min(2, 'Tên phòng phải có ít nhất 2 ký tự')
        .max(255, 'Tên phòng tối đa 255 ký tự'),
    P_VI_TRI: z
        .string()
        .trim()
        .max(255, 'Vị trí tối đa 255 ký tự')
        .optional()
        .or(z.literal('')),
});

type RoomFormValues = z.infer<typeof roomSchema>;

export default function RoomFormPage() {
    const { id } = useParams<{ id: string }>();
    const isEditMode = Boolean(id);
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const form = useForm<RoomFormValues>({
        resolver: zodResolver(roomSchema),
        defaultValues: {
            CK_MA: 0,
            P_TEN: '',
            P_VI_TRI: '',
        },
    });

    const { data: specialties, isLoading: isLoadingSpecialties } = useQuery({
        queryKey: ['specialties'],
        queryFn: () => adminApi.getSpecialties(),
    });

    const { data: roomData, isLoading: isLoadingRoom } = useQuery({
        queryKey: ['admin-room', id],
        queryFn: () => adminApi.getRoomById(Number(id)),
        enabled: isEditMode,
    });

    useEffect(() => {
        if (roomData) {
            form.reset({
                CK_MA: roomData.CK_MA,
                P_TEN: roomData.P_TEN || '',
                P_VI_TRI: roomData.P_VI_TRI || '',
            });
        }
    }, [roomData, form]);

    const selectedSpecialtyLabel =
        specialties?.find((specialty) => specialty.CK_MA === form.watch('CK_MA'))?.CK_TEN ||
        roomData?.CHUYEN_KHOA?.CK_TEN;

    const createMutation = useMutation({
        mutationFn: (data: CreateRoomInput) => adminApi.createRoom(data),
        onSuccess: () => {
            toast.success('Thêm phòng thành công');
            queryClient.invalidateQueries({ queryKey: ['admin-rooms'] });
            queryClient.invalidateQueries({ queryKey: ['admin-schedule-options'] });
            navigate('/admin/facilities');
        },
        onError: (error: any) => {
            const message = error?.response?.data?.message || 'Không thể thêm phòng';
            toast.error(Array.isArray(message) ? message.join(', ') : message);
        },
    });

    const updateMutation = useMutation({
        mutationFn: (data: UpdateRoomInput) => adminApi.updateRoom(Number(id), data),
        onSuccess: () => {
            toast.success('Cập nhật phòng thành công');
            queryClient.invalidateQueries({ queryKey: ['admin-rooms'] });
            queryClient.invalidateQueries({ queryKey: ['admin-room', id] });
            queryClient.invalidateQueries({ queryKey: ['admin-schedule-options'] });
            navigate('/admin/facilities');
        },
        onError: (error: any) => {
            const message = error?.response?.data?.message || 'Không thể cập nhật phòng';
            toast.error(Array.isArray(message) ? message.join(', ') : message);
        },
    });

    const onSubmit = (values: RoomFormValues) => {
        const payload: CreateRoomInput = {
            CK_MA: Number(values.CK_MA),
            P_TEN: values.P_TEN.trim(),
            P_VI_TRI: values.P_VI_TRI?.trim() || undefined,
        };

        if (isEditMode) {
            updateMutation.mutate(payload);
            return;
        }

        createMutation.mutate(payload);
    };

    const isSubmitting = createMutation.isPending || updateMutation.isPending;

    if (isEditMode && isLoadingRoom) {
        return (
            <div className="flex justify-center items-center h-64 text-gray-500">
                <Loader2 className="w-8 h-8 animate-spin mr-2" />
                Đang tải dữ liệu phòng...
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link to="/admin/facilities">
                    <Button variant="outline" size="icon" className="h-9 w-9">
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        {isEditMode ? 'Cập nhật Phòng' : 'Thêm Phòng'}
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Quản lý thông tin phòng khám theo dữ liệu thực tế trong hệ thống
                    </p>
                </div>
            </div>

            <div className="bg-white p-6 md:p-8 rounded-xl shadow-sm border border-gray-100">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="P_TEN"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tên phòng <span className="text-red-500">*</span></FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ví dụ: Phòng khám Nội tổng quát 01" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="CK_MA"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Chuyên khoa <span className="text-red-500">*</span></FormLabel>
                                        <AdminSelect
                                            value={field.value > 0 ? String(field.value) : 'NONE'}
                                            onValueChange={(value) => field.onChange(value === 'NONE' ? 0 : Number(value))}
                                        >
                                            <FormControl>
                                                <AdminSelectTrigger>
                                                    <AdminSelectValue placeholder="Chọn chuyên khoa">
                                                        {selectedSpecialtyLabel}
                                                    </AdminSelectValue>
                                                </AdminSelectTrigger>
                                            </FormControl>
                                            <AdminSelectContent>
                                                <AdminSelectItem value="NONE">Chưa chọn chuyên khoa</AdminSelectItem>
                                                {(specialties ?? []).map((specialty) => (
                                                    <AdminSelectItem key={specialty.CK_MA} value={String(specialty.CK_MA)}>
                                                        {specialty.CK_TEN}
                                                    </AdminSelectItem>
                                                ))}
                                            </AdminSelectContent>
                                        </AdminSelect>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="P_VI_TRI"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Vị trí</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Ví dụ: Tầng 2 - Khu A" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                            <Link to="/admin/facilities">
                                <Button type="button" variant="outline" className="min-w-[100px]">
                                    Hủy
                                </Button>
                            </Link>
                            <Button
                                type="submit"
                                className="min-w-[120px] bg-blue-600 hover:bg-blue-700"
                                disabled={isSubmitting || isLoadingSpecialties}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Đang lưu...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4 mr-2" />
                                        Lưu thay đổi
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </Form>
            </div>
        </div>
    );
}
