import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as z from 'zod';
import { ChevronLeft, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

import { adminApi } from '@/services/api/adminApi';
import type { CreateAccountInput, UpdateAccountInput } from '@/services/api/adminApi';
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

const accountSchema = z.object({
    TK_SDT: z.string().trim().min(8, 'Số điện thoại phải có ít nhất 8 ký tự').max(20, 'Số điện thoại tối đa 20 ký tự'),
    TK_PASS: z.string().trim().optional().or(z.literal('')),
    TK_VAI_TRO: z.enum(['ADMIN', 'BAC_SI', 'BENH_NHAN']),
    TK_DA_XOA: z.boolean().optional(),
});

type AccountFormValues = z.infer<typeof accountSchema>;

export default function AccountFormPage() {
    const { id } = useParams<{ id: string }>();
    const isEditMode = Boolean(id);
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const form = useForm<AccountFormValues>({
        resolver: zodResolver(accountSchema),
        defaultValues: {
            TK_SDT: '',
            TK_PASS: '',
            TK_VAI_TRO: 'BENH_NHAN',
            TK_DA_XOA: false,
        },
    });

    const { data: accountData, isLoading: isLoadingAccount } = useQuery({
        queryKey: ['admin-account', id],
        queryFn: () => adminApi.getAccountById(decodeURIComponent(id || '')),
        enabled: isEditMode && !!id,
    });

    useEffect(() => {
        if (accountData) {
            form.reset({
                TK_SDT: accountData.TK_SDT,
                TK_PASS: '',
                TK_VAI_TRO: (accountData.TK_VAI_TRO as 'ADMIN' | 'BAC_SI' | 'BENH_NHAN') || 'BENH_NHAN',
                TK_DA_XOA: Boolean(accountData.TK_DA_XOA),
            });
        }
    }, [accountData, form]);

    const createMutation = useMutation({
        mutationFn: (data: CreateAccountInput) => adminApi.createAccount(data),
        onSuccess: () => {
            toast.success('Thêm tài khoản thành công');
            queryClient.invalidateQueries({ queryKey: ['admin-accounts'] });
            navigate('/admin/accounts');
        },
        onError: (error: any) => {
            const message = error?.response?.data?.message || 'Không thể thêm tài khoản';
            toast.error(Array.isArray(message) ? message.join(', ') : message);
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ accountId, data }: { accountId: string; data: UpdateAccountInput }) =>
            adminApi.updateAccount(accountId, data),
        onSuccess: () => {
            toast.success('Cập nhật tài khoản thành công');
            queryClient.invalidateQueries({ queryKey: ['admin-accounts'] });
            queryClient.invalidateQueries({ queryKey: ['admin-account', id] });
            navigate('/admin/accounts');
        },
        onError: (error: any) => {
            const message = error?.response?.data?.message || 'Không thể cập nhật tài khoản';
            toast.error(Array.isArray(message) ? message.join(', ') : message);
        },
    });

    const onSubmit = (values: AccountFormValues) => {
        if (!isEditMode) {
            if (!values.TK_PASS || values.TK_PASS.trim().length < 6) {
                form.setError('TK_PASS', { message: 'Mật khẩu phải có ít nhất 6 ký tự' });
                return;
            }

            const payload: CreateAccountInput = {
                TK_SDT: values.TK_SDT.trim(),
                TK_PASS: values.TK_PASS.trim(),
                TK_VAI_TRO: values.TK_VAI_TRO,
            };
            createMutation.mutate(payload);
            return;
        }

        const payload: UpdateAccountInput = {
            TK_VAI_TRO: values.TK_VAI_TRO,
            TK_DA_XOA: Boolean(values.TK_DA_XOA),
            ...(values.TK_PASS?.trim() ? { TK_PASS: values.TK_PASS.trim() } : {}),
        };

        updateMutation.mutate({ accountId: decodeURIComponent(id || ''), data: payload });
    };

    const isSubmitting = createMutation.isPending || updateMutation.isPending;

    if (isEditMode && isLoadingAccount) {
        return (
            <div className="flex justify-center items-center h-64 text-gray-500">
                <Loader2 className="w-8 h-8 animate-spin mr-2" />
                Đang tải dữ liệu tài khoản...
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link to="/admin/accounts">
                    <Button variant="outline" size="icon" className="h-9 w-9">
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        {isEditMode ? 'Cập nhật Tài khoản' : 'Thêm Tài khoản'}
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Quản lý thông tin tài khoản và phân quyền theo dữ liệu thực tế</p>
                </div>
            </div>

            <div className="bg-white p-6 md:p-8 rounded-xl shadow-sm border border-gray-100">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="TK_SDT"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Số điện thoại tài khoản <span className="text-red-500">*</span></FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ví dụ: 0901234567" {...field} disabled={isEditMode} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="TK_VAI_TRO"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Vai trò <span className="text-red-500">*</span></FormLabel>
                                    <AdminSelect value={field.value} onValueChange={(val) => field.onChange(val)}>
                                        <FormControl>
                                            <AdminSelectTrigger>
                                                <AdminSelectValue placeholder="Chọn vai trò" />
                                            </AdminSelectTrigger>
                                        </FormControl>
                                        <AdminSelectContent>
                                            <AdminSelectItem value="ADMIN">Quản trị viên</AdminSelectItem>
                                            <AdminSelectItem value="BAC_SI">Bác sĩ</AdminSelectItem>
                                            <AdminSelectItem value="BENH_NHAN">Bệnh nhân</AdminSelectItem>
                                        </AdminSelectContent>
                                    </AdminSelect>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="TK_PASS"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        {isEditMode ? 'Mật khẩu mới (để trống nếu không đổi)' : 'Mật khẩu'}
                                        {!isEditMode ? <span className="text-red-500"> *</span> : null}
                                    </FormLabel>
                                    <FormControl>
                                        <Input type="password" placeholder="Ít nhất 6 ký tự" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {isEditMode ? (
                            <div className="space-y-2">
                                <FormLabel>Mật khẩu hiện tại (dạng mã hóa)</FormLabel>
                                <Input value={accountData?.TK_PASS || ''} readOnly className="bg-gray-50 text-gray-600" />
                            </div>
                        ) : null}

                        {isEditMode ? (
                            <FormField
                                control={form.control}
                                name="TK_DA_XOA"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Trạng thái tài khoản</FormLabel>
                                        <AdminSelect
                                            value={field.value ? 'deleted' : 'active'}
                                            onValueChange={(val) => field.onChange(val === 'deleted')}
                                        >
                                            <FormControl>
                                                <AdminSelectTrigger>
                                                    <AdminSelectValue placeholder="Chọn trạng thái" />
                                                </AdminSelectTrigger>
                                            </FormControl>
                                            <AdminSelectContent>
                                                <AdminSelectItem value="active">Đang hoạt động</AdminSelectItem>
                                                <AdminSelectItem value="deleted">Đã xóa</AdminSelectItem>
                                            </AdminSelectContent>
                                        </AdminSelect>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        ) : null}

                        <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                            <Link to="/admin/accounts">
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
