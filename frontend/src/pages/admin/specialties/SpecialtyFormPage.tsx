import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as z from 'zod';
import { ChevronLeft, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

import { adminApi } from '@/services/api/adminApi';
import type { CreateSpecialtyInput, UpdateSpecialtyInput } from '@/services/api/adminApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';

const specialtySchema = z.object({
    CK_TEN: z
        .string()
        .trim()
        .min(2, 'Tên chuyên khoa phải có ít nhất 2 ký tự')
        .max(255, 'Tên chuyên khoa tối đa 255 ký tự'),
    CK_DOI_TUONG_KHAM: z
        .string()
        .trim()
        .max(255, 'Đối tượng khám tối đa 255 ký tự')
        .optional()
        .or(z.literal('')),
    CK_MO_TA: z
        .string()
        .trim()
        .max(2000, 'Mô tả tối đa 2000 ký tự')
        .optional()
        .or(z.literal('')),
});

type SpecialtyFormValues = z.infer<typeof specialtySchema>;

export default function SpecialtyFormPage() {
    const { id } = useParams<{ id: string }>();
    const isEditMode = Boolean(id);
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const form = useForm<SpecialtyFormValues>({
        resolver: zodResolver(specialtySchema),
        defaultValues: {
            CK_TEN: '',
            CK_DOI_TUONG_KHAM: '',
            CK_MO_TA: '',
        },
    });

    const { data: specialtyData, isLoading: isLoadingSpecialty } = useQuery({
        queryKey: ['admin-specialty', id],
        queryFn: () => adminApi.getSpecialtyById(Number(id)),
        enabled: isEditMode,
    });

    useEffect(() => {
        if (specialtyData) {
            form.reset({
                CK_TEN: specialtyData.CK_TEN || '',
                CK_DOI_TUONG_KHAM: specialtyData.CK_DOI_TUONG_KHAM || '',
                CK_MO_TA: specialtyData.CK_MO_TA || '',
            });
        }
    }, [specialtyData, form]);

    const createMutation = useMutation({
        mutationFn: (data: CreateSpecialtyInput) => adminApi.createSpecialty(data),
        onSuccess: () => {
            toast.success('Thêm chuyên khoa thành công');
            queryClient.invalidateQueries({ queryKey: ['admin-specialties'] });
            queryClient.invalidateQueries({ queryKey: ['specialties'] });
            navigate('/admin/specialties');
        },
        onError: (error: any) => {
            const message = error?.response?.data?.message || 'Không thể thêm chuyên khoa';
            toast.error(Array.isArray(message) ? message.join(', ') : message);
        },
    });

    const updateMutation = useMutation({
        mutationFn: (data: UpdateSpecialtyInput) => adminApi.updateSpecialty(Number(id), data),
        onSuccess: () => {
            toast.success('Cập nhật chuyên khoa thành công');
            queryClient.invalidateQueries({ queryKey: ['admin-specialties'] });
            queryClient.invalidateQueries({ queryKey: ['admin-specialty', id] });
            queryClient.invalidateQueries({ queryKey: ['specialties'] });
            navigate('/admin/specialties');
        },
        onError: (error: any) => {
            const message = error?.response?.data?.message || 'Không thể cập nhật chuyên khoa';
            toast.error(Array.isArray(message) ? message.join(', ') : message);
        },
    });

    const onSubmit = (values: SpecialtyFormValues) => {
        const payload: CreateSpecialtyInput = {
            CK_TEN: values.CK_TEN.trim(),
            CK_DOI_TUONG_KHAM: values.CK_DOI_TUONG_KHAM?.trim() || undefined,
            CK_MO_TA: values.CK_MO_TA?.trim() || undefined,
        };

        if (isEditMode) {
            updateMutation.mutate(payload);
            return;
        }
        createMutation.mutate(payload);
    };

    const isSubmitting = createMutation.isPending || updateMutation.isPending;

    if (isEditMode && isLoadingSpecialty) {
        return (
            <div className="flex justify-center items-center h-64 text-gray-500">
                <Loader2 className="w-8 h-8 animate-spin mr-2" />
                Đang tải dữ liệu chuyên khoa...
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link to="/admin/specialties">
                    <Button variant="outline" size="icon" className="h-9 w-9">
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        {isEditMode ? 'Cập nhật Chuyên khoa' : 'Thêm Chuyên khoa'}
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Quản lý thông tin chuyên khoa theo dữ liệu thực tế trong hệ thống
                    </p>
                </div>
            </div>

            <div className="bg-white p-6 md:p-8 rounded-xl shadow-sm border border-gray-100">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="CK_TEN"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tên chuyên khoa <span className="text-red-500">*</span></FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ví dụ: Nội tổng quát" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="CK_DOI_TUONG_KHAM"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Đối tượng khám</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ví dụ: Người lớn, trẻ em" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="CK_MO_TA"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Mô tả</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Nhập mô tả ngắn về chuyên khoa..."
                                            className="min-h-[120px] resize-y"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                            <Link to="/admin/specialties">
                                <Button type="button" variant="outline" className="min-w-[100px]">
                                    Hủy
                                </Button>
                            </Link>
                            <Button type="submit" className="min-w-[120px] bg-blue-600 hover:bg-blue-700" disabled={isSubmitting}>
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
