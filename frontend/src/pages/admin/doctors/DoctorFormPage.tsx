import { useEffect, useState, type ChangeEvent } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Save, Loader2, Upload, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

import { adminApi } from '@/services/api/adminApi';
import type { CreateDoctorInput, UpdateDoctorInput } from '@/services/api/adminApi';
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

const doctorSchema = z.object({
    BS_HO_TEN: z
        .string()
        .trim()
        .min(2, 'Họ tên phải có ít nhất 2 ký tự')
        .max(255, 'Họ tên tối đa 255 ký tự'),
    CK_MA: z
        .number({ message: 'Vui lòng chọn chuyên khoa' })
        .min(1, 'Vui lòng chọn chuyên khoa'),
    BS_SDT: z
        .string()
        .trim()
        .max(20, 'Số điện thoại tối đa 20 ký tự')
        .optional()
        .or(z.literal('')),
    BS_EMAIL: z
        .string()
        .trim()
        .email('Email không hợp lệ')
        .max(255, 'Email tối đa 255 ký tự')
        .optional()
        .or(z.literal('')),
    BS_HOC_HAM: z
        .string()
        .trim()
        .max(100, 'Học hàm tối đa 100 ký tự')
        .optional()
        .or(z.literal('')),
    BS_ANH: z
        .string()
        .trim()
        .refine(
            (value) =>
                !value ||
                value.startsWith('http://') ||
                value.startsWith('https://') ||
                value.startsWith('data:image/'),
            { message: 'Ảnh đại diện không hợp lệ' },
        )
        .optional()
        .or(z.literal('')),
});

type DoctorFormValues = z.infer<typeof doctorSchema>;

export default function DoctorFormPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const isEditMode = !!id;
    const [avatarPreview, setAvatarPreview] = useState('');
    const [selectedFileName, setSelectedFileName] = useState('');

    const { data: specialties = [] } = useQuery({
        queryKey: ['admin-specialties-options'],
        queryFn: () => adminApi.getSpecialties(),
    });

    const { data: doctorData, isLoading: isLoadingDoctor } = useQuery({
        queryKey: ['admin-doctor', id],
        queryFn: () => adminApi.getDoctorById(Number(id)),
        enabled: isEditMode,
    });

    const form = useForm<DoctorFormValues>({
        resolver: zodResolver(doctorSchema),
        defaultValues: {
            BS_HO_TEN: '',
            CK_MA: 0,
            BS_SDT: '',
            BS_EMAIL: '',
            BS_HOC_HAM: '',
            BS_ANH: '',
        },
    });

    useEffect(() => {
        if (doctorData) {
            form.reset({
                BS_HO_TEN: doctorData.BS_HO_TEN || '',
                CK_MA: doctorData.CK_MA || 0,
                BS_SDT: doctorData.BS_SDT || '',
                BS_EMAIL: doctorData.BS_EMAIL || '',
                BS_HOC_HAM: doctorData.BS_HOC_HAM || '',
                BS_ANH: doctorData.BS_ANH || '',
            });
            setAvatarPreview(doctorData.BS_ANH || '');
            setSelectedFileName('');
        }
    }, [doctorData, form]);

    const handleAvatarFileChange = (
        event: ChangeEvent<HTMLInputElement>,
        onChange: (value: string) => void,
    ) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Vui lòng chọn tệp ảnh hợp lệ');
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            toast.error('Kích thước ảnh tối đa 2MB');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const result = typeof reader.result === 'string' ? reader.result : '';
            if (!result) {
                toast.error('Không thể đọc tệp ảnh');
                return;
            }
            onChange(result);
            setAvatarPreview(result);
            setSelectedFileName(file.name);
        };
        reader.onerror = () => {
            toast.error('Không thể đọc tệp ảnh');
        };
        reader.readAsDataURL(file);
    };

    const createMutation = useMutation({
        mutationFn: (data: CreateDoctorInput) => adminApi.createDoctor(data),
        onSuccess: () => {
            toast.success('Thêm bác sĩ thành công');
            queryClient.invalidateQueries({ queryKey: ['admin-doctors'] });
            navigate('/admin/doctors');
        },
        onError: (error: any) => {
            const message = error?.response?.data?.message || 'Không thể thêm bác sĩ';
            toast.error(Array.isArray(message) ? message.join(', ') : message);
        },
    });

    const updateMutation = useMutation({
        mutationFn: (data: UpdateDoctorInput) => adminApi.updateDoctor(Number(id), data),
        onSuccess: () => {
            toast.success('Cập nhật bác sĩ thành công');
            queryClient.invalidateQueries({ queryKey: ['admin-doctors'] });
            queryClient.invalidateQueries({ queryKey: ['admin-doctor', id] });
            navigate('/admin/doctors');
        },
        onError: (error: any) => {
            const message = error?.response?.data?.message || 'Không thể cập nhật bác sĩ';
            toast.error(Array.isArray(message) ? message.join(', ') : message);
        },
    });

    const onSubmit = (values: DoctorFormValues) => {
        const payload: CreateDoctorInput = {
            BS_HO_TEN: values.BS_HO_TEN.trim(),
            CK_MA: Number(values.CK_MA),
            BS_SDT: values.BS_SDT?.trim() || undefined,
            BS_EMAIL: values.BS_EMAIL?.trim() || undefined,
            BS_HOC_HAM: values.BS_HOC_HAM?.trim() || undefined,
            BS_ANH: values.BS_ANH?.trim() || undefined,
        };

        if (isEditMode) {
            updateMutation.mutate(payload as UpdateDoctorInput);
            return;
        }
        createMutation.mutate(payload);
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
                        {isEditMode ? 'Cập nhật thông tin bác sĩ' : 'Thêm Bác sĩ'}
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Quản lý thông tin bác sĩ theo dữ liệu thực tế trong hệ thống
                    </p>
                </div>
            </div>

            <div className="bg-white p-6 md:p-8 rounded-xl shadow-sm border border-gray-100">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="BS_HO_TEN"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Họ và Tên <span className="text-red-500">*</span></FormLabel>
                                        <FormControl>
                                            <Input placeholder="Ví dụ: Nguyễn Văn A" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="CK_MA"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Chuyên khoa <span className="text-red-500">*</span></FormLabel>
                                        <AdminSelect
                                            onValueChange={(val) => field.onChange(Number(val))}
                                            value={field.value ? field.value.toString() : ''}
                                        >
                                            <FormControl>
                                                <AdminSelectTrigger>
                                                    <AdminSelectValue placeholder="Chọn chuyên khoa" />
                                                </AdminSelectTrigger>
                                            </FormControl>
                                            <AdminSelectContent>
                                                {specialties.map((specialty) => (
                                                    <AdminSelectItem key={specialty.CK_MA} value={specialty.CK_MA.toString()}>
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
                                name="BS_SDT"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Số điện thoại</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Ví dụ: 0901234567" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="BS_EMAIL"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Ví dụ: bacsi@umc.vn" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="BS_HOC_HAM"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Học hàm</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Ví dụ: PGS.TS.BS" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="BS_ANH"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Ảnh đại diện</FormLabel>
                                        <FormControl>
                                            <div className="space-y-3">
                                                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50">
                                                    <Upload className="h-4 w-4" />
                                                    Chọn ảnh
                                                    <input
                                                        type="file"
                                                        accept="image/*,.png,.jpg,.jpeg,.webp,.gif,.bmp"
                                                        className="hidden"
                                                        onClick={(event) => {
                                                            event.currentTarget.value = '';
                                                        }}
                                                        onChange={(event) => handleAvatarFileChange(event, field.onChange)}
                                                    />
                                                </label>
                                                <p className="text-xs text-gray-500">
                                                    {selectedFileName || 'Hỗ trợ PNG, JPG, JPEG, WEBP, GIF, BMP (tối đa 2MB)'}
                                                </p>
                                            </div>
                                        </FormControl>
                                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                                            {avatarPreview ? (
                                                <img
                                                    src={avatarPreview}
                                                    alt="Ảnh đại diện bác sĩ"
                                                    className="h-28 w-28 rounded-md border border-gray-200 bg-white object-cover"
                                                />
                                            ) : (
                                                <div className="flex h-28 w-28 items-center justify-center rounded-md border border-dashed border-gray-300 bg-white text-gray-400">
                                                    <ImageIcon className="h-6 w-6" />
                                                </div>
                                            )}
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

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
