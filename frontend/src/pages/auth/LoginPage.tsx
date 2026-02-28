// src/pages/auth/LoginPage.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Phone, Lock, ArrowRight, Heart, Loader2, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authService } from '@/services/authService';
import { useAuthStore } from '@/store/useAuthStore';

// ─── Zod schema ──────────────────────────────────────────
const loginSchema = z.object({
    TK_SDT: z
        .string()
        .min(1, 'Vui lòng nhập số điện thoại')
        .regex(/^\d{10}$/, 'Số điện thoại phải là 10 chữ số'),
    TK_PASS: z
        .string()
        .min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
});

type LoginFormData = z.infer<typeof loginSchema>;

// ─── Medical illustration SVG ───────────────────────────
function MedicalIllustration() {
    return (
        <svg viewBox="0 0 400 400" className="w-full max-w-sm mx-auto opacity-90" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Doctor figure */}
            <circle cx="200" cy="100" r="55" fill="white" fillOpacity="0.15" />
            <circle cx="200" cy="90" r="32" fill="white" fillOpacity="0.9" />
            {/* Lab coat body */}
            <rect x="160" y="135" width="80" height="90" rx="10" fill="white" fillOpacity="0.9" />
            {/* Stethoscope */}
            <path d="M183 155 Q175 175 185 185 Q200 195 215 185 Q225 175 217 155" stroke="hsl(210,90%,40%)" strokeWidth="3" fill="none" strokeLinecap="round" />
            <circle cx="200" cy="195" r="6" fill="hsl(210,90%,40%)" />
            {/* Cross symbol */}
            <rect x="192" y="148" width="16" height="5" rx="2.5" fill="hsl(0,72%,51%)" />
            <rect x="197" y="143" width="5" height="16" rx="2.5" fill="hsl(0,72%,51%)" />
            {/* Clipboard */}
            <rect x="250" y="150" width="65" height="85" rx="8" fill="white" fillOpacity="0.85" />
            <rect x="258" y="165" width="48" height="4" rx="2" fill="hsl(210,30%,80%)" />
            <rect x="258" y="177" width="40" height="4" rx="2" fill="hsl(210,30%,80%)" />
            <rect x="258" y="189" width="44" height="4" rx="2" fill="hsl(210,30%,80%)" />
            <rect x="258" y="201" width="30" height="4" rx="2" fill="hsl(210,30%,80%)" />
            {/* Calendar */}
            <rect x="85" y="155" width="60" height="70" rx="8" fill="white" fillOpacity="0.85" />
            <rect x="85" y="155" width="60" height="22" rx="8" fill="hsl(210,90%,50%)" fillOpacity="0.8" />
            <rect x="85" y="165" width="60" height="12" fill="hsl(210,90%,50%)" fillOpacity="0.8" />
            <circle cx="103" cy="200" r="5" fill="hsl(210,90%,70%)" fillOpacity="0.6" />
            <circle cx="115" cy="200" r="5" fill="hsl(210,90%,70%)" fillOpacity="0.6" />
            <circle cx="127" cy="200" r="5" fill="hsl(0,72%,51%)" fillOpacity="0.8" />
            <circle cx="103" cy="213" r="5" fill="hsl(210,90%,70%)" fillOpacity="0.6" />
            <circle cx="115" cy="213" r="5" fill="hsl(210,90%,70%)" fillOpacity="0.6" />
            {/* Decorative circles */}
            <circle cx="60" cy="80" r="30" fill="white" fillOpacity="0.07" />
            <circle cx="350" cy="320" r="50" fill="white" fillOpacity="0.07" />
            <circle cx="330" cy="60" r="20" fill="white" fillOpacity="0.1" />
            {/* Heart pulse line */}
            <path d="M60 290 L100 290 L115 265 L130 315 L145 280 L160 290 L340 290" stroke="white" strokeWidth="2.5" strokeOpacity="0.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            {/* Text labels */}
            <text x="200" y="320" textAnchor="middle" fill="white" fillOpacity="0.9" fontSize="18" fontWeight="600" fontFamily="system-ui">Chăm sóc sức khỏe</text>
            <text x="200" y="345" textAnchor="middle" fill="white" fillOpacity="0.7" fontSize="13" fontFamily="system-ui">mọi lúc, mọi nơi</text>
        </svg>
    );
}

export default function LoginPage() {
    const { setAuth } = useAuthStore();
    const navigate = useNavigate();
    const [showPassword, setShowPassword] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
    });

    const onSubmit = async (data: LoginFormData) => {
        setServerError(null);
        try {
            const res = await authService.login(data.TK_SDT, data.TK_PASS);
            setAuth(res.access_token, res.refresh_token, res.user);

            // Redirect based on role
            if (res.user.TK_VAI_TRO === 'ADMIN') navigate('/admin/dashboard', { replace: true });
            else if (res.user.TK_VAI_TRO === 'BAC_SI') navigate('/doctor/dashboard', { replace: true });
            else navigate('/', { replace: true });
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            setServerError(msg ?? 'Đăng nhập thất bại. Vui lòng thử lại.');
        }
    };

    return (
        <div className="flex flex-1 w-full">
            {/* ─── Left: Illustration ───────────────────────────── */}
            <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-[hsl(210,90%,38%)] via-[hsl(205,85%,43%)] to-[hsl(195,80%,48%)] flex-col items-center justify-center p-12 relative overflow-hidden">
                {/* Background decoration */}
                <div className="absolute top-0 left-0 w-72 h-72 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2" />
                <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full translate-x-1/3 translate-y-1/3" />

                <div className="relative z-10 text-center">
                    <MedicalIllustration />
                    <div className="mt-8 space-y-2">
                        <h2 className="text-2xl font-bold text-white">Hệ thống UMC Clinic</h2>
                        <p className="text-white/70 text-sm leading-relaxed max-w-xs mx-auto">
                            Đặt lịch khám, theo dõi hồ sơ sức khỏe và kết nối với bác sĩ chuyên khoa
                        </p>
                    </div>
                    <div className="mt-8 flex justify-center gap-6 text-white/60 text-sm">
                        {['500+ Bác sĩ', '50+ Chuyên khoa', '100k+ Bệnh nhân'].map((s) => (
                            <div key={s} className="text-center">
                                <div className="text-white font-bold text-base">{s.split(' ')[0]}</div>
                                <div className="text-xs">{s.split(' ').slice(1).join(' ')}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ─── Right: Login Form ────────────────────────────── */}
            <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-white">
                <div className="w-full max-w-md">
                    {/* Mobile logo */}
                    <div className="lg:hidden flex items-center gap-2 mb-8">
                        <div className="w-8 h-8 bg-[hsl(var(--primary))] rounded-lg flex items-center justify-center">
                            <Heart className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-lg font-bold text-[hsl(var(--primary))]">UMC Clinic</span>
                    </div>

                    {/* Heading */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-[hsl(var(--foreground))] mb-2">Đăng nhập</h1>
                        <p className="text-[hsl(var(--muted-foreground))]">
                            Chào mừng trở lại! Vui lòng đăng nhập để tiếp tục.
                        </p>
                    </div>

                    {/* Server error */}
                    {serverError && (
                        <div className="mb-5 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                            <span>{serverError}</span>
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
                        {/* Phone number */}
                        <div className="space-y-1.5">
                            <Label htmlFor="TK_SDT">Số điện thoại</Label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                                <Input
                                    id="TK_SDT"
                                    type="tel"
                                    inputMode="numeric"
                                    maxLength={10}
                                    placeholder="0912 345 678"
                                    className={`pl-10 ${errors.TK_SDT ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                                    {...register('TK_SDT', {
                                        onChange: (e) => {
                                            // Chỉ cho nhập số
                                            e.target.value = e.target.value.replace(/\D/g, '');
                                        },
                                    })}
                                />
                            </div>
                            {errors.TK_SDT && (
                                <p className="text-red-500 text-xs flex items-center gap-1.5 mt-1">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                    {errors.TK_SDT.message}
                                </p>
                            )}
                        </div>

                        {/* Password */}
                        <div className="space-y-1.5">
                            <Label htmlFor="TK_PASS">Mật khẩu</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                                <Input
                                    id="TK_PASS"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Nhập mật khẩu"
                                    className={`pl-10 pr-10 ${errors.TK_PASS ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                                    {...register('TK_PASS')}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            {errors.TK_PASS && (
                                <p className="text-red-500 text-xs flex items-center gap-1.5 mt-1">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                    {errors.TK_PASS.message}
                                </p>
                            )}
                        </div>

                        {/* Submit */}
                        <Button type="submit" className="w-full h-11 mt-2" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Đang đăng nhập...</>
                            ) : (
                                <>Đăng nhập <ArrowRight className="w-4 h-4 ml-2" /></>
                            )}
                        </Button>
                    </form>

                    {/* Footer links */}
                    <div className="mt-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
                        Chưa có tài khoản?{' '}
                        <Link
                            to="/register"
                            className="font-medium text-[hsl(var(--primary))] hover:underline underline-offset-4"
                        >
                            Đăng ký ngay
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
