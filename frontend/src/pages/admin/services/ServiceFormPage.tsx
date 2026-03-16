import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as z from 'zod';
import { ChevronLeft, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

import { adminApi } from '@/services/api/adminApi';
import type { CreateServiceInput, UpdateServiceInput } from '@/services/api/adminApi';
import { SERVICE_TYPE_LABELS, SERVICE_TYPES, type ServiceTypeValue } from '@/constants/serviceTypes';
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

const serviceSchema = z.object({
    DVCLS_TEN: z.string().min(2, 'Tên dịch vụ phải có ít nhất 2 ký tự').max(255),
    DVCLS_LOAI: z.enum(SERVICE_TYPES).optional().or(z.literal('')),
    DVCLS_GIA_DV: z
        .number({ message: 'Giá dịch vụ phải là số' })
        .min(0, 'Giá dịch vụ không được âm'),
});

type ServiceFormValues = z.infer<typeof serviceSchema>;

export default function ServiceFormPage() {
    const { id } = useParams<{ id: string }>();
    const isEditMode = Boolean(id);
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const form = useForm<ServiceFormValues>({
        resolver: zodResolver(serviceSchema),
        defaultValues: {
            DVCLS_TEN: '',
            DVCLS_LOAI: '',
            DVCLS_GIA_DV: 0,
        },
    });

    const { data: serviceData, isLoading: isLoadingService } = useQuery({
        queryKey: ['admin-service', id],
        queryFn: () => adminApi.getServiceById(Number(id)),
        enabled: isEditMode,
    });

    useEffect(() => {
        if (serviceData) {
            const currentType = SERVICE_TYPES.includes(serviceData.DVCLS_LOAI as ServiceTypeValue)
                ? (serviceData.DVCLS_LOAI as ServiceTypeValue)
                : '';
            form.reset({
                DVCLS_TEN: serviceData.DVCLS_TEN || '',
                DVCLS_LOAI: currentType,
                DVCLS_GIA_DV: Number(serviceData.DVCLS_GIA_DV ?? 0),
            });
        }
    }, [serviceData, form]);

    const createMutation = useMutation({
        mutationFn: (data: CreateServiceInput) => adminApi.createService(data),
        onSuccess: () => {
            toast.success('Thêm dịch vụ thành công');
            queryClient.invalidateQueries({ queryKey: ['admin-services'] });
            navigate('/admin/services');
        },
        onError: (error: any) => {
            const message = error?.response?.data?.message || 'Không thể thêm dịch vụ';
            toast.error(Array.isArray(message) ? message.join(', ') : message);
        },
    });

    const updateMutation = useMutation({
        mutationFn: (data: UpdateServiceInput) => adminApi.updateService(Number(id), data),
        onSuccess: () => {
            toast.success('Cập nhật dịch vụ thành công');
            queryClient.invalidateQueries({ queryKey: ['admin-services'] });
            queryClient.invalidateQueries({ queryKey: ['admin-service', id] });
            navigate('/admin/services');
        },
        onError: (error: any) => {
            const message = error?.response?.data?.message || 'Không thể cập nhật dịch vụ';
            toast.error(Array.isArray(message) ? message.join(', ') : message);
        },
    });

    const onSubmit = (values: ServiceFormValues) => {
        const payload: CreateServiceInput = {
            DVCLS_TEN: values.DVCLS_TEN.trim(),
            DVCLS_LOAI: values.DVCLS_LOAI || undefined,
            DVCLS_GIA_DV: Number(values.DVCLS_GIA_DV ?? 0),
        };

        if (isEditMode) {
            updateMutation.mutate(payload);
            return;
        }
        createMutation.mutate(payload);
    };

    const isSubmitting = createMutation.isPending || updateMutation.isPending;

    if (isEditMode && isLoadingService) {
        return (
            <div className="flex justify-center items-center h-64 text-gray-500">
                <Loader2 className="w-8 h-8 animate-spin mr-2" />
                Đang tải dữ liệu dịch vụ...
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link to="/admin/services">
                    <Button variant="outline" size="icon" className="h-9 w-9">
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        {isEditMode ? 'Cập nhật Dịch vụ' : 'Thêm Dịch vụ'}
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Quản lý thông tin dịch vụ theo dữ liệu thực tế trong hệ thống
                    </p>
                </div>
            </div>

            <div className="bg-white p-6 md:p-8 rounded-xl shadow-sm border border-gray-100">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="DVCLS_TEN"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tên dịch vụ <span className="text-red-500">*</span></FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ví dụ: Siêu âm tổng quát" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="DVCLS_LOAI"
                                render={({ field }) => (
                                    <FormItem className="space-y-2">
                                        <FormLabel>Loại dịch vụ</FormLabel>
                                        <AdminSelect
                                            value={field.value || 'NONE'}
                                            onValueChange={(value) => field.onChange(value === 'NONE' ? '' : value)}
                                        >
                                            <FormControl>
                                                <AdminSelectTrigger>
                                                    <AdminSelectValue placeholder="Chọn loại dịch vụ" />
                                                </AdminSelectTrigger>
                                            </FormControl>
                                            <AdminSelectContent className="max-h-72">
                                                <AdminSelectItem value="NONE" className="leading-5">Chưa phân loại</AdminSelectItem>
                                                {SERVICE_TYPES.map((serviceType) => (
                                                    <AdminSelectItem key={serviceType} value={serviceType} className="leading-5">
                                                        {SERVICE_TYPE_LABELS[serviceType]}
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
                                name="DVCLS_GIA_DV"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Giá dịch vụ (VND) <span className="text-red-500">*</span></FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                min="0"
                                                step="1000"
                                                placeholder="Ví dụ: 250000"
                                                {...field}
                                                onChange={(e) => field.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                            <Link to="/admin/services">
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
