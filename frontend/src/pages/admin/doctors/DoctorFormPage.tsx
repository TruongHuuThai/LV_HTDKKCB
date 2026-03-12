// src/pages/admin/doctors/DoctorFormPage.tsx
import { useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { adminApi } from '@/services/api/adminApi';
import type { CreateDoctorInput, UpdateDoctorInput } from '@/services/api/adminApi';
import { getSpecialties } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

// Validation Schema
const doctorSchema = z.object({
    BS_HO_TEN: z.string().min(2, 'Họ tên phải có ít nhất 2 ký tự').max(100),
    CK_MA: z.number({
        message: 'Vui lòng chọn chuyên khoa'
    }).min(1, 'Vui lòng chọn chuyên khoa'),
    BS_HOC_HAM: z.string().optional().nullable(),
    BS_KINH_NGHIEM: z.number({
        message: 'Kinh nghiệm phải là số'
    }).optional().nullable(),
    BS_GIOI_THIEU: z.string().nullable().optional(),
    BS_ANH: z.string().url('Link ảnh không hợp lệ').optional().nullable().or(z.literal('')),
    TRANG_THAI: z.string(),
});

type DoctorFormValues = z.infer<typeof doctorSchema>;

export default function DoctorFormPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const isEditMode = !!id;

    // Fetch Specialties
    const { data: specialties = [] } = useQuery({
        queryKey: ['specialties'],
        queryFn: getSpecialties,
    });

    // Fetch Doctor Info if Edit Mode
    const { data: doctorData, isLoading: isLoadingDoctor } = useQuery({
        queryKey: ['admin-doctor', id],
        queryFn: () => adminApi.getDoctorById(Number(id)),
        enabled: isEditMode,
    });

    // Form setup
    const form = useForm<DoctorFormValues>({
        resolver: zodResolver(doctorSchema),
        defaultValues: {
            BS_HO_TEN: '',
            BS_HOC_HAM: '',
            CK_MA: 0,
            BS_KINH_NGHIEM: 0,
            BS_GIOI_THIEU: '',
            BS_ANH: '',
            TRANG_THAI: 'ACTIVE',
        },
    });

    // Populate form when data is loaded
    useEffect(() => {
        if (doctorData) {
            form.reset({
                BS_HO_TEN: doctorData.BS_HO_TEN,
                BS_HOC_HAM: doctorData.BS_HOC_HAM || '',
                CK_MA: doctorData.CK_MA,
                BS_KINH_NGHIEM: doctorData.BS_KINH_NGHIEM || 0,
                BS_GIOI_THIEU: doctorData.BS_GIOI_THIEU || '',
                BS_ANH: doctorData.BS_ANH || '',
                TRANG_THAI: doctorData.TRANG_THAI || 'ACTIVE',
            });
        }
    }, [doctorData, form]);

    // Create Mutation
    const createMutation = useMutation({
        mutationFn: (data: CreateDoctorInput) => adminApi.createDoctor(data),
        onSuccess: () => {
            toast.success('Thêm bác sĩ thành công!');
            queryClient.invalidateQueries({ queryKey: ['admin-doctors'] });
            navigate('/admin/doctors');
        },
        onError: () => {
            toast.error('Có lỗi xảy ra khi thêm dữ liệu');
        },
    });

    // Update Mutation
    const updateMutation = useMutation({
        mutationFn: (data: UpdateDoctorInput) => adminApi.updateDoctor(Number(id), data),
        onSuccess: () => {
            toast.success('Cập nhật thông tin thành công!');
            queryClient.invalidateQueries({ queryKey: ['admin-doctors'] });
            queryClient.invalidateQueries({ queryKey: ['admin-doctor', id] });
            navigate('/admin/doctors');
        },
        onError: () => {
            toast.error('Có lỗi xảy ra khi cập nhật dữ liệu');
        },
    });

    const onSubmit = (values: DoctorFormValues) => {
        // Prepare the payload, removing null values if needed or passing them
        const payload = {
            ...values,
            CK_MA: Number(values.CK_MA)
        };

        if (isEditMode) {
            updateMutation.mutate(payload as UpdateDoctorInput);
        } else {
            createMutation.mutate(payload as CreateDoctorInput);
        }
    };

    const isSubmitting = createMutation.isPending || updateMutation.isPending;

    if (isEditMode && isLoadingDoctor) {
        return (
            <div className="flex justify-center items-center h-64 text-gray-500">
                <Loader2 className="w-8 h-8 animate-spin mr-2" />
                Đang tải dữ liệu bác sĩ...
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link to="/admin/doctors">
                    <Button variant="outline" size="icon" className="h-9 w-9">
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        {isEditMode ? 'Cập nhật Thông tin Bác sĩ' : 'Thêm Bác sĩ Mới'}
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Điền đầy đủ thông tin để lưu vào hệ thống
                    </p>
                </div>
            </div>

            <div className="bg-white p-6 md:p-8 rounded-xl shadow-sm border border-gray-100">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Họ Tên */}
                            <FormField<DoctorFormValues>
                                control={form.control}
                                name="BS_HO_TEN"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-gray-700">Họ và Tên <span className="text-red-500">*</span></FormLabel>
                                        <FormControl>
                                            <Input placeholder="Vd: Nguyễn Văn A" {...field} value={field.value as string || ''} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Chuyên khoa */}
                            <FormField
                                control={form.control}
                                name="CK_MA"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-gray-700">Chuyên khoa <span className="text-red-500">*</span></FormLabel>
                                        <Select
                                            onValueChange={(val) => field.onChange(Number(val))}
                                            value={field.value ? field.value.toString() : ""}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Chọn chuyên khoa hợp lệ" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {specialties.map((sp) => (
                                                    <SelectItem key={sp.CK_MA} value={sp.CK_MA.toString()}>
                                                        {sp.CK_TEN}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Học hàm/Học vị */}
                            <FormField
                                control={form.control}
                                name="BS_HOC_HAM"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-gray-700">Học hàm / Học vị</FormLabel>
                                        <Select
                                            onValueChange={field.onChange}
                                            value={field.value?.toString() || ""}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Chọn học vị" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="BS">Bác sĩ (BS)</SelectItem>
                                                <SelectItem value="ThS.BS">Thạc sĩ, Bác sĩ (ThS.BS)</SelectItem>
                                                <SelectItem value="TS.BS">Tiến sĩ, Bác sĩ (TS.BS)</SelectItem>
                                                <SelectItem value="BSCKI">Bác sĩ CKI (BS.CKI)</SelectItem>
                                                <SelectItem value="BSCKII">Bác sĩ CKII (BS.CKII)</SelectItem>
                                                <SelectItem value="PGS.TS.BS">PGS.TS.BS</SelectItem>
                                                <SelectItem value="GS.TS.BS">GS.TS.BS</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Kinh nghiệm */}
                            <FormField
                                control={form.control}
                                name="BS_KINH_NGHIEM"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-gray-700">Số năm kinh nghiệm</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                min="0"
                                                placeholder="Vd: 10"
                                                {...field}
                                                onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                                                value={field.value === null || field.value === undefined ? '' : field.value}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* URL Ảnh */}
                        <FormField
                            control={form.control}
                            name="BS_ANH"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-gray-700">URL Ảnh đại diện</FormLabel>
                                    <div className="flex gap-4 items-start">
                                        <div className="flex-1">
                                            <FormControl>
                                                <Input placeholder="https://example.com/image.jpg" {...field} value={(field.value as string) || ''} />
                                            </FormControl>
                                            <FormDescription className="mt-1.5">
                                                Nhập đường dẫn trực tiếp tới ảnh đại diện của bác sĩ.
                                            </FormDescription>
                                        </div>
                                        {field.value && (
                                            <div className="w-16 h-16 rounded-md border border-gray-200 overflow-hidden shrink-0 mt-1">
                                                <img src={field.value as string} alt="Preview" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                                            </div>
                                        )}
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Giới thiệu */}
                        <FormField
                            control={form.control}
                            name="BS_GIOI_THIEU"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-gray-700">Giới thiệu / Tiểu sử</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Tóm tắt về kinh nghiệm chuyên môn, thế mạnh của bác sĩ..."
                                            className="min-h-[120px] resize-y"
                                            {...field}
                                            value={(field.value as string) || ''}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Trạng thái (chỉ hiện khi edit) */}
                        {isEditMode && (
                            <FormField
                                control={form.control}
                                name="TRANG_THAI"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-gray-700">Trạng thái hoạt động</FormLabel>
                                        <Select
                                            onValueChange={field.onChange}
                                            value={field.value as string}
                                        >
                                            <FormControl>
                                                <SelectTrigger className="w-[200px]">
                                                    <SelectValue placeholder="Trạng thái" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="ACTIVE">Hoạt động (Hiển thị)</SelectItem>
                                                <SelectItem value="HIDDEN">Đang ẩn</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                            <Link to="/admin/doctors">
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
                                        Lưu Thay Đổi
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
