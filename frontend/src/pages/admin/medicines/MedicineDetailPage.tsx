import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as z from 'zod';
import { ArrowLeft, FileText, Loader2, Save, Syringe } from 'lucide-react';
import { toast } from 'sonner';

import { adminApi } from '@/services/api/adminApi';
import type { UpdateMedicineBrandInfoInput } from '@/services/api/adminApi';
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

const brandInfoSchema = z.object({
    BD_TEN: z
        .string()
        .trim()
        .min(1, 'Vui lòng nhập tên biệt dược')
        .max(255, 'Tên biệt dược tối đa 255 ký tự'),
    BD_HAM_LUONG: z
        .string()
        .trim()
        .max(255, 'Hàm lượng tối đa 255 ký tự')
        .optional()
        .or(z.literal('')),
    BD_CONG_DUNG: z
        .string()
        .trim()
        .max(2000, 'Công dụng tối đa 2000 ký tự')
        .optional()
        .or(z.literal('')),
    BD_LIEU_DUNG: z
        .string()
        .trim()
        .max(2000, 'Liều dùng tối đa 2000 ký tự')
        .optional()
        .or(z.literal('')),
});

type BrandInfoFormValues = z.infer<typeof brandInfoSchema>;

function formatDate(value: string | null | undefined) {
    if (!value) return '-';
    const datePart = value.length >= 10 ? value.slice(0, 10) : value;
    const [year, month, day] = datePart.split('-');
    if (!year || !month || !day) return datePart;
    return `${day}/${month}/${year}`;
}

function formatCurrency(value: number | string | null | undefined) {
    const amount = Number(value ?? 0);
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
    }).format(amount);
}

export default function MedicineDetailPage() {
    const { id } = useParams<{ id: string }>();
    const medicineId = Number(id);
    const queryClient = useQueryClient();

    const form = useForm<BrandInfoFormValues>({
        resolver: zodResolver(brandInfoSchema),
        defaultValues: {
            BD_TEN: '',
            BD_HAM_LUONG: '',
            BD_CONG_DUNG: '',
            BD_LIEU_DUNG: '',
        },
    });

    const { data: medicineData, isLoading, isError } = useQuery({
        queryKey: ['admin-medicine', id],
        queryFn: () => adminApi.getMedicineById(medicineId),
        enabled: Number.isFinite(medicineId),
    });

    useEffect(() => {
        if (!medicineData) return;
        form.reset({
            BD_TEN: medicineData.BIET_DUOC?.BD_TEN || '',
            BD_HAM_LUONG: medicineData.BIET_DUOC?.BD_HAM_LUONG || '',
            BD_CONG_DUNG: medicineData.BIET_DUOC?.BD_CONG_DUNG || '',
            BD_LIEU_DUNG: medicineData.BIET_DUOC?.BD_LIEU_DUNG || '',
        });
    }, [medicineData, form]);

    const updateBrandMutation = useMutation({
        mutationFn: (payload: UpdateMedicineBrandInfoInput) =>
            adminApi.updateMedicineBrandInfo(medicineId, payload),
        onSuccess: () => {
            toast.success('Cập nhật thông tin biệt dược thành công');
            queryClient.invalidateQueries({ queryKey: ['admin-medicines'] });
            queryClient.invalidateQueries({ queryKey: ['admin-medicine', id] });
        },
        onError: (error: any) => {
            const message = error?.response?.data?.message || 'Không thể cập nhật thông tin biệt dược';
            toast.error(Array.isArray(message) ? message.join(', ') : message);
        },
    });

    const onSubmit = (values: BrandInfoFormValues) => {
        const payload: UpdateMedicineBrandInfoInput = {
            BD_TEN: values.BD_TEN.trim(),
            BD_HAM_LUONG: values.BD_HAM_LUONG?.trim() || undefined,
            BD_CONG_DUNG: values.BD_CONG_DUNG?.trim() || undefined,
            BD_LIEU_DUNG: values.BD_LIEU_DUNG?.trim() || undefined,
        };
        updateBrandMutation.mutate(payload);
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64 text-gray-500">
                <Loader2 className="w-8 h-8 animate-spin mr-2" />
                Đang tải thông tin thuốc...
            </div>
        );
    }

    if (isError || !medicineData) {
        return (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
                Không thể tải thông tin thuốc. Vui lòng quay lại danh sách và thử lại.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Link to="/admin/medicines">
                        <Button variant="outline" size="icon" className="h-9 w-9">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Chi tiết thuốc</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Quản lý thông tin biệt dược của thuốc #{medicineData.T_MA}
                        </p>
                    </div>
                </div>
                <Link to={`/admin/medicines/edit/${medicineData.T_MA}`}>
                    <Button variant="outline">Sửa thông tin thuốc</Button>
                </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                        <Syringe className="h-4 w-4 text-blue-600" />
                        Thông tin thuốc
                    </h2>
                    <div className="mt-4 space-y-3 text-sm">
                        <div className="flex justify-between gap-4">
                            <span className="text-gray-500">Mã thuốc</span>
                            <span className="font-medium text-gray-900">{medicineData.T_MA}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span className="text-gray-500">Tên thuốc</span>
                            <span className="font-medium text-gray-900 text-right">{medicineData.T_TEN_THUOC}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span className="text-gray-500">Nhóm thuốc</span>
                            <span className="text-gray-900 text-right">{medicineData.NHOM_THUOC?.NT_TEN || '-'}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span className="text-gray-500">Nhà sản xuất</span>
                            <span className="text-gray-900 text-right">{medicineData.NHA_SAN_XUAT?.NSX_TEN || '-'}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span className="text-gray-500">Đơn vị tính</span>
                            <span className="text-gray-900 text-right">{medicineData.DON_VI_TINH?.DVT_TEN || '-'}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span className="text-gray-500">Giá</span>
                            <span className="text-gray-900 text-right">{formatCurrency(medicineData.T_GIA_THUOC)}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span className="text-gray-500">Hạn sử dụng</span>
                            <span className="text-gray-900 text-right">{formatDate(medicineData.T_HAN_SU_DUNG)}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-emerald-600" />
                        Thông tin biệt dược
                    </h2>
                    {!medicineData.BIET_DUOC ? (
                        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                            Thuốc này chưa được gắn biệt dược. Nhập thông tin bên dưới để tạo và gắn biệt dược.
                        </div>
                    ) : null}

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 space-y-4">
                            <FormField
                                control={form.control}
                                name="BD_TEN"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Tên biệt dược <span className="text-red-500">*</span></FormLabel>
                                        <FormControl>
                                            <Input placeholder="Ví dụ: Panadol Extra" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="BD_HAM_LUONG"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Hàm lượng</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Ví dụ: Paracetamol 500mg" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="BD_CONG_DUNG"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Công dụng</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Mô tả công dụng chính của biệt dược..."
                                                className="min-h-[90px] resize-y"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="BD_LIEU_DUNG"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Liều dùng</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Hướng dẫn liều dùng tham khảo..."
                                                className="min-h-[90px] resize-y"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="flex justify-end pt-2">
                                <Button
                                    type="submit"
                                    className="bg-blue-600 hover:bg-blue-700 min-w-[180px]"
                                    disabled={updateBrandMutation.isPending}
                                >
                                    {updateBrandMutation.isPending ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Đang lưu...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4 mr-2" />
                                            Lưu thông tin biệt dược
                                        </>
                                    )}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </div>
            </div>
        </div>
    );
}
