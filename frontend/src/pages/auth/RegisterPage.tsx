// src/pages/auth/RegisterPage.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import {
    Eye, EyeOff, Phone, Lock, User, Mail,
    ArrowRight, Loader2, AlertCircle, CheckCircle2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authService } from '@/services/authService';

// ─── Zod schema ──────────────────────────────────────────
const registerSchema = z
    .object({
        BN_HO_CHU_LOT: z
            .string()
            .min(1, 'Vui lòng nhập họ và chữ lót')
            .max(50, 'Họ chữ lót không được quá 50 ký tự'),
        BN_TEN: z
            .string()
            .min(1, 'Vui lòng nhập tên')
            .max(20, 'Tên không được quá 20 ký tự'),
        TK_SDT: z
            .string()
            .regex(/^\d{10}$/, 'Số điện thoại phải là 10 chữ số'),
        BN_EMAIL: z
            .union([
                z.string().email('Email không hợp lệ'),
                z.literal(''),
            ])
            .optional(),
        TK_PASS: z
            .string()
            .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
            .regex(/[A-Z]/, 'Mật khẩu phải có ít nhất 1 chữ hoa')
            .regex(/[0-9]/, 'Mật khẩu phải có ít nhất 1 chữ số'),
        confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu'),
    })
    .refine((d) => d.TK_PASS === d.confirmPassword, {
        message: 'Mật khẩu xác nhận không khớp',
        path: ['confirmPassword'],
    });

type RegisterFormData = z.infer<typeof registerSchema>;

// ─── Password strength indicator ─────────────────────────
function PasswordStrength({ password }: { password: string }) {
    const checks = [
        { label: 'Tối thiểu 8 ký tự', ok: password.length >= 8 },
        { label: '1 chữ hoa (A-Z)', ok: /[A-Z]/.test(password) },
        { label: '1 chữ số (0-9)', ok: /[0-9]/.test(password) },
    ];
    if (!password) return null;
    return (
        <div className="mt-2 space-y-1">
            {checks.map(({ label, ok }) => (
                <div key={label} className="flex items-center gap-1.5 text-xs">
                    <CheckCircle2 className={`w-3.5 h-3.5 ${ok ? 'text-green-500' : 'text-[hsl(var(--muted-foreground))]'}`} />
                    <span className={ok ? 'text-green-600' : 'text-[hsl(var(--muted-foreground))]'}>{label}</span>
                </div>
            ))}
        </div>
    );
}

// ─── Reusable field error ─────────────────────────────────
function FieldError({ message }: { message?: string }) {
    if (!message) return null;
    return (
        <p className="text-red-500 text-xs flex items-center gap-1.5 mt-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {message}
        </p>
    );
}

export default function RegisterPage() {
    const navigate = useNavigate();
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors, isSubmitting },
    } = useForm<RegisterFormData>({
        resolver: zodResolver(registerSchema),
        defaultValues: {
            BN_HO_CHU_LOT: '',
            BN_TEN: '',
            TK_SDT: '',
            BN_EMAIL: '',
            TK_PASS: '',
            confirmPassword: '',
        },
    });



    const onSubmit = async (data: RegisterFormData) => {
        setServerError(null);
        try {
            await authService.register({
                TK_SDT: data.TK_SDT,
                TK_PASS: data.TK_PASS,
                BN_HO_CHU_LOT: data.BN_HO_CHU_LOT,
                BN_TEN: data.BN_TEN,
                BN_EMAIL: data.BN_EMAIL || undefined,
            });
            navigate('/login', { state: { registered: true } });
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            setServerError(msg ?? 'Đăng ký thất bại. Vui lòng thử lại.');
        }
    };

    const inputError = (field: keyof RegisterFormData) =>
        errors[field] ? 'border-red-400 focus-visible:ring-red-400' : '';

    return (
        <div className="flex flex-1 w-full">
            {/* ─── Left: Illustration ───────────────────────────── */}
            <div className="hidden lg:flex lg:w-2/5 bg-gradient-to-br from-[hsl(210,90%,38%)] via-[hsl(200,80%,42%)] to-[hsl(185,75%,45%)] flex-col items-center justify-center p-12 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-72 h-72 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2" />
                <div className="absolute bottom-0 right-0 w-80 h-80 bg-white/5 rounded-full translate-x-1/3 translate-y-1/3" />
                <div className="relative z-10 text-white text-center">
                    <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-white/20">
                        <User className="w-12 h-12 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold mb-3">Tạo tài khoản</h2>
                    <p className="text-white/70 text-sm leading-relaxed mb-8 max-w-xs mx-auto">
                        Đăng ký để đặt lịch khám, theo dõi kết quả xét nghiệm và quản lý hồ sơ sức khỏe của bạn.
                    </p>
                    <div className="space-y-3 text-left max-w-xs mx-auto">
                        {[
                            'Xem lịch sử khám bệnh',
                            'Nhận thông báo nhắc lịch',
                            'Kết quả xét nghiệm trực tuyến',
                            'Bảo mật thông tin tuyệt đối',
                        ].map((b) => (
                            <div key={b} className="flex items-center gap-2.5 text-sm text-white/80">
                                <CheckCircle2 className="w-4 h-4 text-green-300 shrink-0" />
                                {b}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ─── Right: Register Form ─────────────────────────── */}
            <div className="flex-1 flex items-start justify-center p-6 sm:p-10 bg-white overflow-y-auto">
                <div className="w-full max-w-xl py-4">
                    {/* Heading */}
                    <div className="mb-6">
                        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))] mb-1.5">
                            Đăng ký tài khoản bệnh nhân
                        </h1>
                        <p className="text-[hsl(var(--muted-foreground))] text-sm">
                            Điền đầy đủ thông tin bên dưới để tạo tài khoản.
                        </p>
                    </div>

                    {/* Server error */}
                    {serverError && (
                        <div className="mb-5 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                            <span>{serverError}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                        {/* Full name — 2 columns */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="BN_HO_CHU_LOT">Họ và chữ lót <span className="text-red-500">*</span></Label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                                    <Input
                                        id="BN_HO_CHU_LOT"
                                        placeholder="Nguyễn Văn"
                                        className={`pl-10 ${inputError('BN_HO_CHU_LOT')}`}
                                        {...register('BN_HO_CHU_LOT')}
                                    />
                                </div>
                                <FieldError message={errors.BN_HO_CHU_LOT?.message} />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="BN_TEN">Tên <span className="text-red-500">*</span></Label>
                                <Input
                                    id="BN_TEN"
                                    placeholder="An"
                                    className={inputError('BN_TEN')}
                                    {...register('BN_TEN')}
                                />
                                <FieldError message={errors.BN_TEN?.message} />
                            </div>
                        </div>

                        {/* Phone */}
                        <div className="space-y-1.5">
                            <Label htmlFor="TK_SDT">Số điện thoại <span className="text-red-500">*</span></Label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                                <Input
                                    id="TK_SDT"
                                    type="tel"
                                    inputMode="numeric"
                                    maxLength={10}
                                    placeholder="0912 345 678"
                                    className={`pl-10 ${inputError('TK_SDT')}`}
                                    {...register('TK_SDT', {
                                        onChange: (e) => {
                                            e.target.value = e.target.value.replace(/\D/g, '');
                                        },
                                    })}
                                />
                            </div>
                            <FieldError message={errors.TK_SDT?.message} />
                        </div>

                        {/* Email (optional) */}
                        <div className="space-y-1.5">
                            <Label htmlFor="BN_EMAIL">
                                Email <span className="text-[hsl(var(--muted-foreground))] font-normal text-xs">(không bắt buộc)</span>
                            </Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                                <Input
                                    id="BN_EMAIL"
                                    type="email"
                                    placeholder="email@example.com"
                                    className={`pl-10 ${inputError('BN_EMAIL')}`}
                                    {...register('BN_EMAIL')}
                                />
                            </div>
                            <FieldError message={errors.BN_EMAIL?.message} />
                        </div>

                        {/* Password */}
                        <div className="space-y-1.5">
                            <Label htmlFor="TK_PASS">Mật khẩu <span className="text-red-500">*</span></Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                                <Input
                                    id="TK_PASS"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Mật khẩu (tối thiểu 8 ký tự)"
                                    className={`pl-10 pr-10 ${inputError('TK_PASS')}`}
                                    {...register('TK_PASS')}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            <FieldError message={errors.TK_PASS?.message} />
                            {/* eslint-disable-next-line react-hooks/incompatible-library */}
                            <PasswordStrength password={watch('TK_PASS')} />
                        </div>

                        {/* Confirm password */}
                        <div className="space-y-1.5">
                            <Label htmlFor="confirmPassword">Xác nhận mật khẩu <span className="text-red-500">*</span></Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                                <Input
                                    id="confirmPassword"
                                    type={showConfirm ? 'text' : 'password'}
                                    placeholder="Nhập lại mật khẩu"
                                    className={`pl-10 pr-10 ${inputError('confirmPassword')}`}
                                    {...register('confirmPassword')}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirm(!showConfirm)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                                >
                                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            <FieldError message={errors.confirmPassword?.message} />
                        </div>

                        {/* Submit */}
                        <Button type="submit" className="w-full h-11 mt-2" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Đang đăng ký...</>
                            ) : (
                                <>Tạo tài khoản <ArrowRight className="w-4 h-4 ml-2" /></>
                            )}
                        </Button>
                    </form>

                    {/* Login link */}
                    <div className="mt-5 text-center text-sm text-[hsl(var(--muted-foreground))]">
                        Đã có tài khoản?{' '}
                        <Link
                            to="/login"
                            className="font-medium text-[hsl(var(--primary))] hover:underline underline-offset-4"
                        >
                            Đăng nhập
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
