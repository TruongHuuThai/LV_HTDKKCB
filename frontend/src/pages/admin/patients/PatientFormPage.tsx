import { useEffect, useState, type ChangeEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as z from 'zod';
import { ChevronLeft, Image as ImageIcon, Loader2, Save, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { adminApi } from '@/services/api/adminApi';
import type { CreatePatientInput, UpdatePatientInput } from '@/services/api/adminApi';
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

const patientSchema = z.object({
    TK_SDT: z.string().trim().max(20, 'Số điện thoại tài khoản tối đa 20 ký tự').optional().or(z.literal('')),
    BN_HO_CHU_LOT: z.string().trim().max(255, 'Họ và chữ lót tối đa 255 ký tự').optional().or(z.literal('')),
    BN_TEN: z.string().trim().min(1, 'Vui lòng nhập tên bệnh nhân').max(255, 'Tên tối đa 255 ký tự'),
    BN_LA_NAM: z.boolean().nullable().optional(),
    BN_SDT_DANG_KY: z.string().trim().max(20, 'Số điện thoại tối đa 20 ký tự').optional().or(z.literal('')),
    BN_EMAIL: z.string().trim().email('Email không hợp lệ').max(255, 'Email tối đa 255 ký tự').optional().or(z.literal('')),
    BN_CCCD: z.string().trim().max(20, 'CCCD tối đa 20 ký tự').optional().or(z.literal('')),
    BN_QUOC_GIA: z.string().trim().max(100, 'Quốc tịch tối đa 100 ký tự').optional().or(z.literal('')),
    BN_DAN_TOC: z.string().trim().max(100, 'Dân tộc tối đa 100 ký tự').optional().or(z.literal('')),
    BN_SO_DDCN: z.string().trim().max(100, 'Số định danh cá nhân tối đa 100 ký tự').optional().or(z.literal('')),
    BN_MOI: z.boolean().nullable().optional(),
    BN_ANH: z
        .string()
        .trim()
        .refine((value) => !value || value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:image/'), {
            message: 'Ảnh đại diện không hợp lệ',
        })
        .optional()
        .or(z.literal('')),
});

type PatientFormValues = z.infer<typeof patientSchema>;

export default function PatientFormPage() {
    const { id } = useParams<{ id: string }>();
    const isEditMode = Boolean(id);
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [avatarPreview, setAvatarPreview] = useState('');
    const [selectedFileName, setSelectedFileName] = useState('');

    const form = useForm<PatientFormValues>({
        resolver: zodResolver(patientSchema),
        defaultValues: {
            TK_SDT: '',
            BN_HO_CHU_LOT: '',
            BN_TEN: '',
            BN_LA_NAM: true,
            BN_SDT_DANG_KY: '',
            BN_EMAIL: '',
            BN_CCCD: '',
            BN_QUOC_GIA: '',
            BN_DAN_TOC: '',
            BN_SO_DDCN: '',
            BN_MOI: true,
            BN_ANH: '',
        },
    });

    const { data: patientData, isLoading: isLoadingPatient } = useQuery({
        queryKey: ['admin-patient', id],
        queryFn: () => adminApi.getPatientById(Number(id)),
        enabled: isEditMode,
    });

    useEffect(() => {
        if (patientData) {
            form.reset({
                TK_SDT: patientData.TK_SDT || '',
                BN_HO_CHU_LOT: patientData.BN_HO_CHU_LOT || '',
                BN_TEN: patientData.BN_TEN || '',
                BN_LA_NAM: patientData.BN_LA_NAM ?? null,
                BN_SDT_DANG_KY: patientData.BN_SDT_DANG_KY || '',
                BN_EMAIL: patientData.BN_EMAIL || '',
                BN_CCCD: patientData.BN_CCCD || '',
                BN_QUOC_GIA: patientData.BN_QUOC_GIA || '',
                BN_DAN_TOC: patientData.BN_DAN_TOC || '',
                BN_SO_DDCN: patientData.BN_SO_DDCN || '',
                BN_MOI: patientData.BN_MOI ?? null,
                BN_ANH: patientData.BN_ANH || '',
            });
            setAvatarPreview(patientData.BN_ANH || '');
            setSelectedFileName('');
        }
    }, [patientData, form]);

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
        mutationFn: (data: CreatePatientInput) => adminApi.createPatient(data),
        onSuccess: () => {
            toast.success('Thêm bệnh nhân thành công');
            queryClient.invalidateQueries({ queryKey: ['admin-patients'] });
            navigate('/admin/patients');
        },
        onError: (error: any) => {
            const message = error?.response?.data?.message || 'Không thể thêm bệnh nhân';
            toast.error(Array.isArray(message) ? message.join(', ') : message);
        },
    });

    const updateMutation = useMutation({
        mutationFn: (data: UpdatePatientInput) => adminApi.updatePatient(Number(id), data),
        onSuccess: () => {
            toast.success('Cập nhật bệnh nhân thành công');
            queryClient.invalidateQueries({ queryKey: ['admin-patients'] });
            queryClient.invalidateQueries({ queryKey: ['admin-patient', id] });
            navigate('/admin/patients');
        },
        onError: (error: any) => {
            const message = error?.response?.data?.message || 'Không thể cập nhật bệnh nhân';
            toast.error(Array.isArray(message) ? message.join(', ') : message);
        },
    });

    const onSubmit = (values: PatientFormValues) => {
        const payload: CreatePatientInput = {
            TK_SDT: values.TK_SDT?.trim() || undefined,
            BN_HO_CHU_LOT: values.BN_HO_CHU_LOT?.trim() || undefined,
            BN_TEN: values.BN_TEN.trim(),
            BN_LA_NAM: values.BN_LA_NAM ?? undefined,
            BN_SDT_DANG_KY: values.BN_SDT_DANG_KY?.trim() || undefined,
            BN_EMAIL: values.BN_EMAIL?.trim() || undefined,
            BN_CCCD: values.BN_CCCD?.trim() || undefined,
            BN_QUOC_GIA: values.BN_QUOC_GIA?.trim() || undefined,
            BN_DAN_TOC: values.BN_DAN_TOC?.trim() || undefined,
            BN_SO_DDCN: values.BN_SO_DDCN?.trim() || undefined,
            BN_MOI: values.BN_MOI ?? undefined,
            BN_ANH: values.BN_ANH?.trim() || undefined,
        };

        if (isEditMode) {
            updateMutation.mutate(payload as UpdatePatientInput);
            return;
        }
        createMutation.mutate(payload);
    };

    const isSubmitting = createMutation.isPending || updateMutation.isPending;

    if (isEditMode && isLoadingPatient) {
        return (
            <div className="flex justify-center items-center h-64 text-gray-500">
                <Loader2 className="w-8 h-8 animate-spin mr-2" />
                Đang tải dữ liệu bệnh nhân...
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link to="/admin/patients">
                    <Button variant="outline" size="icon" className="h-9 w-9">
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        {isEditMode ? 'Cập nhật Thông tin Bệnh nhân' : 'Thêm Bệnh nhân'}
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Quản lý thông tin bệnh nhân theo dữ liệu thực tế trong hệ thống</p>
                </div>
            </div>

            <div className="bg-white p-6 md:p-8 rounded-xl shadow-sm border border-gray-100">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="TK_SDT"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Tài khoản quản lý (SĐT)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Ví dụ: 0901234567" {...field} />
                                        </FormControl>
                                        <p className="text-xs text-gray-500">Mỗi tài khoản quản lý tối đa 10 hồ sơ bệnh nhân.</p>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="BN_HO_CHU_LOT"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Họ và chữ lót</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Ví dụ: Nguyễn Văn" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="BN_TEN"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Tên <span className="text-red-500">*</span></FormLabel>
                                        <FormControl>
                                            <Input placeholder="Ví dụ: An" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="BN_LA_NAM"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Giới tính</FormLabel>
                                        <AdminSelect
                                            value={field.value === null || field.value === undefined ? 'unknown' : field.value ? 'male' : 'female'}
                                            onValueChange={(val) => {
                                                if (val === 'male') field.onChange(true);
                                                else if (val === 'female') field.onChange(false);
                                                else field.onChange(null);
                                            }}
                                        >
                                            <FormControl>
                                                <AdminSelectTrigger>
                                                    <AdminSelectValue placeholder="Chọn giới tính" />
                                                </AdminSelectTrigger>
                                            </FormControl>
                                            <AdminSelectContent>
                                                <AdminSelectItem value="unknown">Chưa xác định</AdminSelectItem>
                                                <AdminSelectItem value="male">Nam</AdminSelectItem>
                                                <AdminSelectItem value="female">Nữ</AdminSelectItem>
                                            </AdminSelectContent>
                                        </AdminSelect>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="BN_MOI"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Loại bệnh nhân</FormLabel>
                                        <AdminSelect
                                            value={field.value === null || field.value === undefined ? 'unknown' : field.value ? 'new' : 'returning'}
                                            onValueChange={(val) => {
                                                if (val === 'new') field.onChange(true);
                                                else if (val === 'returning') field.onChange(false);
                                                else field.onChange(null);
                                            }}
                                        >
                                            <FormControl>
                                                <AdminSelectTrigger>
                                                    <AdminSelectValue placeholder="Chọn loại bệnh nhân" />
                                                </AdminSelectTrigger>
                                            </FormControl>
                                            <AdminSelectContent>
                                                <AdminSelectItem value="unknown">Chưa xác định</AdminSelectItem>
                                                <AdminSelectItem value="new">Bệnh nhân mới</AdminSelectItem>
                                                <AdminSelectItem value="returning">Bệnh nhân cũ</AdminSelectItem>
                                            </AdminSelectContent>
                                        </AdminSelect>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="BN_SDT_DANG_KY"
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
                                name="BN_EMAIL"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Ví dụ: benhnhan@umc.vn" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="BN_QUOC_GIA"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Quốc tịch</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Ví dụ: Việt Nam" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="BN_DAN_TOC"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Dân tộc</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Ví dụ: Kinh" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="BN_CCCD"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>CCCD</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Ví dụ: 079123456789" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="BN_SO_DDCN"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Số định danh cá nhân</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Ví dụ: DD123456" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="BN_ANH"
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
                                                alt="Ảnh đại diện bệnh nhân"
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

                        <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                            <Link to="/admin/patients">
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
