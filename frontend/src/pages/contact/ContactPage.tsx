// src/pages/contact/ContactPage.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    MapPin, Phone, Mail, Clock, Heart,
    ChevronRight, Send, CheckCircle2, Loader2,
} from 'lucide-react';
import { contactData } from '@/data/contactData';

// ── Zod Schema ───────────────────────────────────────────────────────────────
const contactSchema = z.object({
    fullName: z.string().min(1, 'Vui lòng nhập họ và tên'),
    address: z.string().optional(),
    email: z.string().min(1, 'Vui lòng nhập email').email('Email không hợp lệ'),
    phone: z
        .string()
        .min(1, 'Vui lòng nhập số điện thoại')
        .regex(/^(0[3|5|7|8|9])[0-9]{8}$/, 'Số điện thoại không hợp lệ (10 số, đầu số VN)'),
    title: z.string().min(1, 'Vui lòng nhập tiêu đề'),
    content: z.string().min(10, 'Nội dung phải có ít nhất 10 ký tự'),
});

type ContactFormData = z.infer<typeof contactSchema>;

// ── Field wrapper ─────────────────────────────────────────────────────────────
function Field({
    label,
    error,
    required,
    children,
}: {
    label: string;
    error?: string;
    required?: boolean;
    children: React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">
                {label}
                {required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {children}
            {error && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                    <span>⚠</span> {error}
                </p>
            )}
        </div>
    );
}

const inputClass =
    'w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all';

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ContactPage() {
    const [submitted, setSubmitted] = useState(false);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<ContactFormData>({
        resolver: zodResolver(contactSchema),
    });

    const onSubmit = async (data: ContactFormData) => {
        // Simulate network call
        await new Promise((r) => setTimeout(r, 800));
        console.log('[ContactForm] Submitted:', data);
        setSubmitted(true);
        reset();
        setTimeout(() => setSubmitted(false), 5000);
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* ── Breadcrumb ────────────────────────────────────────── */}
            <div className="bg-white border-b border-gray-100">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-1.5 text-sm text-gray-500">
                    <Link to="/" className="hover:text-blue-700 transition-colors">
                        Trang chủ
                    </Link>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                    <span className="text-blue-700 font-medium">Liên hệ</span>
                </div>
            </div>

            {/* ── Hero Banner ───────────────────────────────────────── */}
            <div className="w-full overflow-hidden" style={{ height: '320px' }}>
                <img
                    src={contactData.bannerImageUrl}
                    alt="Liên hệ UMC Clinic"
                    className="w-full h-full object-cover"
                />
            </div>

            {/* ── Header Section ────────────────────────────────────── */}
            <div className="text-center py-10">
                <h1 className="text-3xl md:text-4xl font-extrabold uppercase text-blue-900 tracking-widest">
                    {contactData.title}
                </h1>
                <div className="mt-3 flex items-center justify-center gap-2">
                    <span className="block w-16 h-0.5 bg-blue-300 rounded-full" />
                    <span className="block w-3 h-3 rounded-full bg-blue-600" />
                    <span className="block w-16 h-0.5 bg-blue-300 rounded-full" />
                </div>
            </div>

            {/* ── Main Grid ─────────────────────────────────────────── */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

                    {/* ── Left: Contact Info Card (2/5) ─────────────── */}
                    <div className="lg:col-span-2">
                        <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-2xl p-8 shadow-lg shadow-blue-500/25 flex flex-col gap-6 h-full">
                            {/* Logo icon */}
                            <div className="flex flex-col items-center gap-3 pb-4 border-b border-white/20">
                                <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center shadow-inner">
                                    <Heart className="w-8 h-8 text-white" />
                                </div>
                                <h2 className="text-base font-bold uppercase text-center leading-snug tracking-wide">
                                    {contactData.hospitalName}
                                </h2>
                            </div>

                            {/* Info rows */}
                            <div className="flex flex-col gap-5">
                                <div className="flex items-start gap-3">
                                    <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center shrink-0 mt-0.5">
                                        <MapPin className="w-4.5 h-4.5 text-blue-100" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-blue-200 font-semibold uppercase tracking-wider mb-0.5">Địa chỉ</p>
                                        <p className="text-sm text-white/90 leading-relaxed">{contactData.address}</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                                        <Phone className="w-4.5 h-4.5 text-blue-100" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-blue-200 font-semibold uppercase tracking-wider mb-0.5">Điện thoại</p>
                                        <a href={`tel:${contactData.phone}`} className="text-sm text-white font-semibold hover:text-blue-200 transition-colors">
                                            {contactData.phone}
                                        </a>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                                        <Mail className="w-4.5 h-4.5 text-blue-100" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-blue-200 font-semibold uppercase tracking-wider mb-0.5">Email</p>
                                        <a href={`mailto:${contactData.email}`} className="text-sm text-white/90 hover:text-white transition-colors break-all">
                                            {contactData.email}
                                        </a>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                                        <Clock className="w-4.5 h-4.5 text-blue-100" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-blue-200 font-semibold uppercase tracking-wider mb-0.5">Giờ làm việc</p>
                                        <p className="text-sm text-white/90 leading-relaxed">{contactData.workingHours}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Right: Contact Form (3/5) ─────────────────── */}
                    <div className="lg:col-span-3">
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                            {/* Intro text */}
                            <p className="text-sm text-gray-500 text-center leading-relaxed mb-7 italic">
                                {contactData.introText}
                            </p>

                            {/* Success Banner */}
                            {submitted && (
                                <div className="mb-6 flex items-center gap-3 bg-green-50 border border-green-200 text-green-700 rounded-xl px-5 py-4 text-sm font-medium">
                                    <CheckCircle2 className="w-5 h-5 shrink-0 text-green-500" />
                                    Tin nhắn của bạn đã được gửi thành công! Chúng tôi sẽ phản hồi trong thời gian sớm nhất.
                                </div>
                            )}

                            <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
                                {/* Row 1: Họ tên + Địa chỉ */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Field label="Họ và tên" error={errors.fullName?.message} required>
                                        <input
                                            {...register('fullName')}
                                            placeholder="Nguyễn Văn A"
                                            className={inputClass}
                                        />
                                    </Field>
                                    <Field label="Địa chỉ" error={errors.address?.message}>
                                        <input
                                            {...register('address')}
                                            placeholder="Số nhà, đường, quận, tỉnh..."
                                            className={inputClass}
                                        />
                                    </Field>
                                </div>

                                {/* Row 2: Email + SĐT */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Field label="Email" error={errors.email?.message} required>
                                        <input
                                            {...register('email')}
                                            type="email"
                                            placeholder="example@email.com"
                                            className={inputClass}
                                        />
                                    </Field>
                                    <Field label="Số điện thoại" error={errors.phone?.message} required>
                                        <input
                                            {...register('phone')}
                                            type="tel"
                                            placeholder="0901234567"
                                            className={inputClass}
                                        />
                                    </Field>
                                </div>

                                {/* Row 3: Tiêu đề */}
                                <Field label="Tiêu đề" error={errors.title?.message} required>
                                    <input
                                        {...register('title')}
                                        placeholder="Tiêu đề tin nhắn của bạn"
                                        className={inputClass}
                                    />
                                </Field>

                                {/* Row 4: Nội dung */}
                                <Field label="Nội dung" error={errors.content?.message} required>
                                    <textarea
                                        {...register('content')}
                                        rows={5}
                                        placeholder="Mô tả chi tiết câu hỏi hoặc vấn đề của bạn..."
                                        className={`${inputClass} resize-none`}
                                    />
                                </Field>

                                {/* Submit */}
                                <div className="flex justify-end pt-1">
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="inline-flex items-center gap-2 px-7 py-2.5 rounded-full bg-cyan-500 hover:bg-cyan-600 disabled:bg-cyan-300 text-white text-sm font-semibold transition-all duration-200 shadow-sm hover:shadow-md"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Đang gửi...
                                            </>
                                        ) : (
                                            <>
                                                <Send className="w-4 h-4" />
                                                Gửi
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
