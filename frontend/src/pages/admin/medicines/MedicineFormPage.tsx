import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as z from 'zod';
import { ChevronLeft, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

import { adminApi } from '@/services/api/adminApi';
import type { CreateMedicineInput, UpdateMedicineInput } from '@/services/api/adminApi';
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

const medicineSchema = z.object({
    T_TEN_THUOC: z.string().trim().min(2, 'Tên thuốc phải có ít nhất 2 ký tự').max(255, 'Tên thuốc tối đa 255 ký tự'),
    NT_MA: z.number().int().positive().nullable().optional(),
    NSX_MA: z.number().int().positive().nullable().optional(),
    DVT_MA: z.number().int().positive().nullable().optional(),
    BD_MA: z.number().int().positive().nullable().optional(),
    T_GIA_THUOC: z
        .number({ message: 'Giá thuốc phải là số' })
        .min(0, 'Giá thuốc không được âm'),
    T_HAN_SU_DUNG: z
        .string()
        .optional()
        .or(z.literal(''))
        .refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value), {
            message: 'Ngày hết hạn không hợp lệ',
        }),
});

type MedicineFormValues = z.infer<typeof medicineSchema>;

function toDateInputValue(value: string | null | undefined): string {
    if (!value) return '';
    return value.length >= 10 ? value.slice(0, 10) : value;
}

function ensureSelectedOption<T extends Record<string, number | string>>(
    options: T[],
    valueKey: keyof T,
    labelKey: keyof T,
    selectedId: number | null | undefined,
    selectedLabel: string | null | undefined,
): T[] {
    if (selectedId == null || !selectedLabel) {
        return options;
    }

    if (options.some((option) => Number(option[valueKey]) === selectedId)) {
        return options;
    }

    return [
        {
            [valueKey]: selectedId,
            [labelKey]: selectedLabel,
        } as T,
        ...options,
    ];
}

function getSelectedLabel<T extends Record<string, number | string>>(
    options: T[],
    valueKey: keyof T,
    labelKey: keyof T,
    selectedId: number | null | undefined,
    fallbackLabel: string | null | undefined,
): string | undefined {
    if (selectedId == null) {
        return undefined;
    }

    const matchedOption = options.find((option) => Number(option[valueKey]) === selectedId);

    if (matchedOption) {
        return String(matchedOption[labelKey]);
    }

    return fallbackLabel ?? undefined;
}

export default function MedicineFormPage() {
    const { id } = useParams<{ id: string }>();
    const isEditMode = Boolean(id);
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const form = useForm<MedicineFormValues>({
        resolver: zodResolver(medicineSchema),
        defaultValues: {
            T_TEN_THUOC: '',
            NT_MA: null,
            NSX_MA: null,
            DVT_MA: null,
            BD_MA: null,
            T_GIA_THUOC: 0,
            T_HAN_SU_DUNG: '',
        },
    });

    const { data: filterOptions, isLoading: isLoadingOptions } = useQuery({
        queryKey: ['admin-medicine-filter-options'],
        queryFn: () => adminApi.getMedicineFilterOptions(),
    });

    const { data: medicineData, isLoading: isLoadingMedicine } = useQuery({
        queryKey: ['admin-medicine', id],
        queryFn: () => adminApi.getMedicineById(Number(id)),
        enabled: isEditMode,
    });

    const groupOptions = ensureSelectedOption(
        filterOptions?.groups ?? [],
        'NT_MA',
        'NT_TEN',
        medicineData?.NT_MA,
        medicineData?.NHOM_THUOC?.NT_TEN,
    );

    const manufacturerOptions = ensureSelectedOption(
        filterOptions?.manufacturers ?? [],
        'NSX_MA',
        'NSX_TEN',
        medicineData?.NSX_MA,
        medicineData?.NHA_SAN_XUAT?.NSX_TEN,
    );

    const unitOptions = ensureSelectedOption(
        filterOptions?.units ?? [],
        'DVT_MA',
        'DVT_TEN',
        medicineData?.DVT_MA,
        medicineData?.DON_VI_TINH?.DVT_TEN,
    );

    const brandOptions = ensureSelectedOption(
        filterOptions?.brands ?? [],
        'BD_MA',
        'BD_TEN',
        medicineData?.BD_MA,
        medicineData?.BIET_DUOC?.BD_TEN,
    );

    const selectedGroupLabel = getSelectedLabel(
        groupOptions,
        'NT_MA',
        'NT_TEN',
        form.watch('NT_MA'),
        medicineData?.NHOM_THUOC?.NT_TEN,
    );

    const selectedManufacturerLabel = getSelectedLabel(
        manufacturerOptions,
        'NSX_MA',
        'NSX_TEN',
        form.watch('NSX_MA'),
        medicineData?.NHA_SAN_XUAT?.NSX_TEN,
    );

    const selectedUnitLabel = getSelectedLabel(
        unitOptions,
        'DVT_MA',
        'DVT_TEN',
        form.watch('DVT_MA'),
        medicineData?.DON_VI_TINH?.DVT_TEN,
    );

    const selectedBrandLabel = getSelectedLabel(
        brandOptions,
        'BD_MA',
        'BD_TEN',
        form.watch('BD_MA'),
        medicineData?.BIET_DUOC?.BD_TEN,
    );

    useEffect(() => {
        if (medicineData) {
            form.reset({
                T_TEN_THUOC: medicineData.T_TEN_THUOC || '',
                NT_MA: medicineData.NT_MA ?? null,
                NSX_MA: medicineData.NSX_MA ?? null,
                DVT_MA: medicineData.DVT_MA ?? null,
                BD_MA: medicineData.BD_MA ?? null,
                T_GIA_THUOC: Number(medicineData.T_GIA_THUOC ?? 0),
                T_HAN_SU_DUNG: toDateInputValue(medicineData.T_HAN_SU_DUNG),
            });
        }
    }, [medicineData, form]);

    const createMutation = useMutation({
        mutationFn: (data: CreateMedicineInput) => adminApi.createMedicine(data),
        onSuccess: () => {
            toast.success('Thêm thuốc thành công');
            queryClient.invalidateQueries({ queryKey: ['admin-medicines'] });
            navigate('/admin/medicines');
        },
        onError: (error: any) => {
            const message = error?.response?.data?.message || 'Không thể thêm thuốc';
            toast.error(Array.isArray(message) ? message.join(', ') : message);
        },
    });

    const updateMutation = useMutation({
        mutationFn: (data: UpdateMedicineInput) => adminApi.updateMedicine(Number(id), data),
        onSuccess: () => {
            toast.success('Cập nhật thuốc thành công');
            queryClient.invalidateQueries({ queryKey: ['admin-medicines'] });
            queryClient.invalidateQueries({ queryKey: ['admin-medicine', id] });
            navigate('/admin/medicines');
        },
        onError: (error: any) => {
            const message = error?.response?.data?.message || 'Không thể cập nhật thuốc';
            toast.error(Array.isArray(message) ? message.join(', ') : message);
        },
    });

    const onSubmit = (values: MedicineFormValues) => {
        const payload: CreateMedicineInput = {
            T_TEN_THUOC: values.T_TEN_THUOC.trim(),
            NT_MA: values.NT_MA ?? null,
            NSX_MA: values.NSX_MA ?? null,
            DVT_MA: values.DVT_MA ?? null,
            BD_MA: values.BD_MA ?? null,
            T_GIA_THUOC: Number(values.T_GIA_THUOC ?? 0),
            T_HAN_SU_DUNG: values.T_HAN_SU_DUNG?.trim() ? values.T_HAN_SU_DUNG.trim() : null,
        };

        if (isEditMode) {
            updateMutation.mutate(payload as UpdateMedicineInput);
            return;
        }

        createMutation.mutate(payload);
    };

    const isSubmitting = createMutation.isPending || updateMutation.isPending;

    if (isEditMode && isLoadingMedicine) {
        return (
            <div className="flex justify-center items-center h-64 text-gray-500">
                <Loader2 className="w-8 h-8 animate-spin mr-2" />
                Đang tải dữ liệu thuốc...
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link to="/admin/medicines">
                    <Button variant="outline" size="icon" className="h-9 w-9">
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        {isEditMode ? 'Cập nhật Thuốc' : 'Thêm Thuốc'}
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Quản lý thông tin thuốc theo dữ liệu thực tế trong hệ thống
                    </p>
                </div>
            </div>

            <div className="bg-white p-6 md:p-8 rounded-xl shadow-sm border border-gray-100">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="T_TEN_THUOC"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tên thuốc <span className="text-red-500">*</span></FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ví dụ: Paracetamol 500mg" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="NT_MA"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nhóm thuốc</FormLabel>
                                        <AdminSelect
                                            value={field.value != null ? field.value.toString() : 'NONE'}
                                            onValueChange={(value) => field.onChange(value === 'NONE' ? null : Number(value))}
                                        >
                                            <FormControl>
                                                <AdminSelectTrigger>
                                                    <AdminSelectValue placeholder="Chọn nhóm thuốc">
                                                        {selectedGroupLabel}
                                                    </AdminSelectValue>
                                                </AdminSelectTrigger>
                                            </FormControl>
                                            <AdminSelectContent>
                                                <AdminSelectItem value="NONE">Chưa phân nhóm</AdminSelectItem>
                                                {groupOptions.map((group) => (
                                                    <AdminSelectItem key={group.NT_MA} value={group.NT_MA.toString()}>
                                                        {group.NT_TEN}
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
                                name="NSX_MA"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nhà sản xuất</FormLabel>
                                        <AdminSelect
                                            value={field.value != null ? field.value.toString() : 'NONE'}
                                            onValueChange={(value) => field.onChange(value === 'NONE' ? null : Number(value))}
                                        >
                                            <FormControl>
                                                <AdminSelectTrigger>
                                                    <AdminSelectValue placeholder="Chọn nhà sản xuất">
                                                        {selectedManufacturerLabel}
                                                    </AdminSelectValue>
                                                </AdminSelectTrigger>
                                            </FormControl>
                                            <AdminSelectContent>
                                                <AdminSelectItem value="NONE">Chưa chọn nhà sản xuất</AdminSelectItem>
                                                {manufacturerOptions.map((manufacturer) => (
                                                    <AdminSelectItem key={manufacturer.NSX_MA} value={manufacturer.NSX_MA.toString()}>
                                                        {manufacturer.NSX_TEN}
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
                                name="DVT_MA"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Đơn vị tính</FormLabel>
                                        <AdminSelect
                                            value={field.value != null ? field.value.toString() : 'NONE'}
                                            onValueChange={(value) => field.onChange(value === 'NONE' ? null : Number(value))}
                                        >
                                            <FormControl>
                                                <AdminSelectTrigger>
                                                    <AdminSelectValue placeholder="Chọn đơn vị tính">
                                                        {selectedUnitLabel}
                                                    </AdminSelectValue>
                                                </AdminSelectTrigger>
                                            </FormControl>
                                            <AdminSelectContent>
                                                <AdminSelectItem value="NONE">Chưa chọn đơn vị</AdminSelectItem>
                                                {unitOptions.map((unit) => (
                                                    <AdminSelectItem key={unit.DVT_MA} value={unit.DVT_MA.toString()}>
                                                        {unit.DVT_TEN}
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
                                name="BD_MA"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Biệt dược</FormLabel>
                                        <AdminSelect
                                            value={field.value != null ? field.value.toString() : 'NONE'}
                                            onValueChange={(value) => field.onChange(value === 'NONE' ? null : Number(value))}
                                        >
                                            <FormControl>
                                                <AdminSelectTrigger>
                                                    <AdminSelectValue placeholder="Chọn biệt dược">
                                                        {selectedBrandLabel}
                                                    </AdminSelectValue>
                                                </AdminSelectTrigger>
                                            </FormControl>
                                            <AdminSelectContent>
                                                <AdminSelectItem value="NONE">Chưa chọn biệt dược</AdminSelectItem>
                                                {brandOptions.map((brand) => (
                                                    <AdminSelectItem key={brand.BD_MA} value={brand.BD_MA.toString()}>
                                                        {brand.BD_TEN}
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
                                name="T_GIA_THUOC"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Giá thuốc (VND) <span className="text-red-500">*</span></FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                min="0"
                                                step="1000"
                                                placeholder="Ví dụ: 120000"
                                                {...field}
                                                onChange={(e) => field.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="T_HAN_SU_DUNG"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Hạn sử dụng</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                            <Link to="/admin/medicines">
                                <Button type="button" variant="outline" className="min-w-[100px]">
                                    Hủy
                                </Button>
                            </Link>
                            <Button type="submit" className="min-w-[120px] bg-blue-600 hover:bg-blue-700" disabled={isSubmitting || isLoadingOptions}>
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
