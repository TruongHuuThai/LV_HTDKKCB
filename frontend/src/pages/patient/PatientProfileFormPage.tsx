import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as z from 'zod';
import {
  ChevronLeft,
  Image as ImageIcon,
  Loader2,
  Save,
  Upload,
  UserRound,
  Phone,
  ShieldCheck,
  MapPin,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  AdminSelect,
  AdminSelectContent,
  AdminSelectItem,
  AdminSelectTrigger,
  AdminSelectValue,
} from '@/components/admin/AdminSelect';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PATIENT_PROFILE_RELATION_OPTIONS } from '@/lib/patientProfiles';
import { patientProfilesApi } from '@/services/api/patientProfilesApi';
import { useAuthStore } from '@/store/useAuthStore';
import { usePatientProfilesStore } from '@/store/usePatientProfilesStore';

const todayIsoDate = new Date().toISOString().slice(0, 10);

const patientProfileSchema = z.object({
  BN_HO_CHU_LOT: z.string().trim().max(255, 'Họ và chữ lót tối đa 255 ký tự').optional().or(z.literal('')),
  BN_TEN: z.string().trim().min(1, 'Vui lòng nhập tên người bệnh').max(255, 'Tên tối đa 255 ký tự'),
  BN_NGAY_SINH: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .refine((value) => !value || value <= todayIsoDate, 'Ngày sinh không được lớn hơn ngày hiện tại'),
  BN_LA_NAM: z.string().min(1, 'Vui lòng chọn giới tính'),
  BN_SDT_DANG_KY: z.string().trim().max(20, 'Số điện thoại tối đa 20 ký tự').optional().or(z.literal('')),
  BN_EMAIL: z.string().trim().email('Email không hợp lệ').optional().or(z.literal('')),
  BN_CCCD: z.string().trim().max(20, 'CCCD tối đa 20 ký tự').optional().or(z.literal('')),
  BN_SO_BHYT: z.string().trim().max(20, 'Số BHYT tối đa 20 ký tự').optional().or(z.literal('')),
  BN_QUOC_GIA: z.string().trim().max(100, 'Quốc gia tối đa 100 ký tự').optional().or(z.literal('')),
  BN_DAN_TOC: z.string().trim().max(100, 'Dân tộc tối đa 100 ký tự').optional().or(z.literal('')),
  BN_SO_DDCN: z.string().trim().max(100, 'Số định danh cá nhân tối đa 100 ký tự').optional().or(z.literal('')),
  LOCATION_TTP_MA: z.string().optional().or(z.literal('')),
  LOCATION_XP_MA: z.string().optional().or(z.literal('')),
  AK_MA: z.string().optional().or(z.literal('')),
  BN_QUAN_HE_VOI_TK: z.string().min(1, 'Vui lòng chọn mối quan hệ'),
  BN_ANH: z
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

type PatientProfileFormValues = z.infer<typeof patientProfileSchema>;

export default function PatientProfileFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const setSelectedProfile = usePatientProfilesStore((state) => state.setSelectedProfile);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [selectedFileName, setSelectedFileName] = useState('');

  const form = useForm<PatientProfileFormValues>({
    resolver: zodResolver(patientProfileSchema),
    defaultValues: {
      BN_HO_CHU_LOT: '',
      BN_TEN: '',
      BN_NGAY_SINH: '',
      BN_LA_NAM: '',
      BN_SDT_DANG_KY: '',
      BN_EMAIL: '',
      BN_CCCD: '',
      BN_SO_BHYT: '',
      BN_QUOC_GIA: 'Việt Nam',
      BN_DAN_TOC: '',
      BN_SO_DDCN: '',
      LOCATION_TTP_MA: '',
      LOCATION_XP_MA: '',
      AK_MA: '',
      BN_QUAN_HE_VOI_TK: 'SELF',
      BN_ANH: '',
    },
  });

  const selectedProvinceId = form.watch('LOCATION_TTP_MA');
  const selectedWardId = form.watch('LOCATION_XP_MA');
  const selectedAreaId = form.watch('AK_MA');

  const locationsQuery = useQuery({
    queryKey: ['patient-profile-location-options'],
    queryFn: () => patientProfilesApi.getLocationOptions(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['patient-profile', id],
    queryFn: () => patientProfilesApi.getDetail(Number(id)),
    enabled: isEditMode,
  });

  const provinces = locationsQuery.data?.provinces ?? [];
  const selectedProvince =
    provinces.find((province) => String(province.TTP_MA) === selectedProvinceId) ?? null;
  const wards = selectedProvince?.XA_PHUONG ?? [];
  const selectedWard =
    wards.find((ward) => String(ward.XP_MA) === selectedWardId) ?? null;
  const areas = selectedWard?.AP_KV ?? [];
  const selectedArea =
    areas.find((area) => String(area.AK_MA) === selectedAreaId) ?? null;

  useEffect(() => {
    if (!data?.profile) return;

    const location = data.profile.location;

    form.reset({
      BN_HO_CHU_LOT: data.profile.BN_HO_CHU_LOT || '',
      BN_TEN: data.profile.BN_TEN || '',
      BN_NGAY_SINH: data.profile.BN_NGAY_SINH ? data.profile.BN_NGAY_SINH.slice(0, 10) : '',
      BN_LA_NAM:
        data.profile.BN_LA_NAM === true
          ? 'male'
          : data.profile.BN_LA_NAM === false
            ? 'female'
            : 'unknown',
      BN_SDT_DANG_KY: data.profile.BN_SDT_DANG_KY || '',
      BN_EMAIL: data.profile.BN_EMAIL || '',
      BN_CCCD: data.profile.BN_CCCD || '',
      BN_SO_BHYT: data.profile.BN_SO_BHYT || '',
      BN_QUOC_GIA: data.profile.BN_QUOC_GIA || 'Việt Nam',
      BN_DAN_TOC: data.profile.BN_DAN_TOC || '',
      BN_SO_DDCN: data.profile.BN_SO_DDCN || '',
      LOCATION_TTP_MA: location?.XA_PHUONG?.TINH_TP?.TTP_MA
        ? String(location.XA_PHUONG.TINH_TP.TTP_MA)
        : '',
      LOCATION_XP_MA: location?.XA_PHUONG?.XP_MA ? String(location.XA_PHUONG.XP_MA) : '',
      AK_MA: data.profile.AK_MA ? String(data.profile.AK_MA) : '',
      BN_QUAN_HE_VOI_TK: data.profile.BN_QUAN_HE_VOI_TK || 'SELF',
      BN_ANH: data.profile.BN_ANH || '',
    });
    setAvatarPreview(data.profile.BN_ANH || '');
    setSelectedFileName('');
  }, [data?.profile, form]);

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
      onChange(result);
      setAvatarPreview(result);
      setSelectedFileName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const createMutation = useMutation({
    mutationFn: patientProfilesApi.create,
    onSuccess: (result) => {
      toast.success('Tạo hồ sơ bệnh nhân thành công');
      queryClient.invalidateQueries({ queryKey: ['patient-profiles'] });
      if (user?.TK_SDT) {
        setSelectedProfile(user.TK_SDT, result.profile.BN_MA);
      }
      navigate(`/patient-profiles/${result.profile.BN_MA}`);
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Không thể tạo hồ sơ bệnh nhân';
      toast.error(Array.isArray(message) ? message.join(', ') : message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Parameters<typeof patientProfilesApi.update>[1]) =>
      patientProfilesApi.update(Number(id), payload),
    onSuccess: (result) => {
      toast.success('Cập nhật hồ sơ bệnh nhân thành công');
      queryClient.invalidateQueries({ queryKey: ['patient-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['patient-profile', id] });
      navigate(`/patient-profiles/${result.profile.BN_MA}`);
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Không thể cập nhật hồ sơ bệnh nhân';
      toast.error(Array.isArray(message) ? message.join(', ') : message);
    },
  });

  const onSubmit = (values: PatientProfileFormValues) => {
    const payload = {
      AK_MA: values.AK_MA ? Number(values.AK_MA) : undefined,
      BN_HO_CHU_LOT: values.BN_HO_CHU_LOT?.trim() || undefined,
      BN_TEN: values.BN_TEN.trim(),
      BN_NGAY_SINH: values.BN_NGAY_SINH?.trim() || undefined,
      BN_LA_NAM:
        values.BN_LA_NAM === 'male'
          ? true
          : values.BN_LA_NAM === 'female'
            ? false
            : undefined,
      BN_SDT_DANG_KY: values.BN_SDT_DANG_KY?.trim() || undefined,
      BN_EMAIL: values.BN_EMAIL?.trim() || undefined,
      BN_CCCD: values.BN_CCCD?.trim() || undefined,
      BN_SO_BHYT: values.BN_SO_BHYT?.trim() || undefined,
      BN_QUOC_GIA: values.BN_QUOC_GIA?.trim() || undefined,
      BN_DAN_TOC: values.BN_DAN_TOC?.trim() || undefined,
      BN_SO_DDCN: values.BN_SO_DDCN?.trim() || undefined,
      BN_MOI: isEditMode ? undefined : true,
      BN_QUAN_HE_VOI_TK: values.BN_QUAN_HE_VOI_TK,
      BN_ANH: values.BN_ANH?.trim() || undefined,
    };

    if (isEditMode) {
      updateMutation.mutate(payload);
      return;
    }

    createMutation.mutate(payload);
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const isFormLoading = isEditMode ? isLoading || locationsQuery.isLoading : locationsQuery.isLoading;

  if (isFormLoading) {
    return (
      <div className="mx-auto flex min-h-[40vh] max-w-3xl items-center justify-center px-4">
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Đang tải hồ sơ bệnh nhân...
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="icon" className="h-9 w-9">
          <Link to={isEditMode ? `/patient-profiles/${id}` : '/profile'}>
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {isEditMode ? 'Cập nhật hồ sơ người bệnh' : 'Tạo hồ sơ bệnh nhân mới'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Điền thông tin người bệnh để dùng khi đặt lịch, theo dõi hồ sơ và quản lý lịch sử khám.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/80 px-4 py-3 text-sm text-slate-700">
        <span className="font-semibold text-blue-700">Các trường có dấu *</span> là bắt buộc.
        Những thông tin còn lại có thể bổ sung sau, nhưng điền đầy đủ ngay từ đầu sẽ giúp tra cứu
        và đối chiếu hồ sơ thuận tiện hơn.
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
            <div className="space-y-6">
              <SectionCard
                icon={<UserRound className="h-4 w-4" />}
                title="Thông tin cơ bản"
                description="Nhóm thông tin nhận diện chính của người bệnh."
              >
                <div className="grid gap-5 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="BN_HO_CHU_LOT"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Họ và chữ lót</FormLabel>
                        <FormControl>
                          <Input placeholder="Ví dụ: Nguyễn Thị" {...field} />
                        </FormControl>
                        <FormDescription>Điền phần họ và tên đệm nếu có.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="BN_TEN"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Tên người bệnh <RequiredMark />
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="Ví dụ: Minh An" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="BN_NGAY_SINH"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ngày sinh</FormLabel>
                        <FormControl>
                          <Input type="date" max={todayIsoDate} {...field} />
                        </FormControl>
                        <FormDescription>Không chọn ngày lớn hơn hiện tại.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="BN_LA_NAM"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Giới tính <RequiredMark />
                        </FormLabel>
                        <AdminSelect value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <AdminSelectTrigger>
                              <AdminSelectValue placeholder="Chọn giới tính" />
                            </AdminSelectTrigger>
                          </FormControl>
                          <AdminSelectContent>
                            <AdminSelectItem value="male">Nam</AdminSelectItem>
                            <AdminSelectItem value="female">Nữ</AdminSelectItem>
                            <AdminSelectItem value="unknown">Chưa xác định</AdminSelectItem>
                          </AdminSelectContent>
                        </AdminSelect>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="BN_QUAN_HE_VOI_TK"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Mối quan hệ với tài khoản <RequiredMark />
                        </FormLabel>
                        <AdminSelect value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <AdminSelectTrigger>
                              <AdminSelectValue placeholder="Chọn mối quan hệ" />
                            </AdminSelectTrigger>
                          </FormControl>
                          <AdminSelectContent>
                            {PATIENT_PROFILE_RELATION_OPTIONS.map((option) => (
                              <AdminSelectItem key={option.value} value={option.value}>
                                {option.label}
                              </AdminSelectItem>
                            ))}
                          </AdminSelectContent>
                        </AdminSelect>
                        <FormDescription>
                          Giúp phân biệt hồ sơ khi một tài khoản quản lý nhiều người bệnh.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                </div>
              </SectionCard>

              <SectionCard
                icon={<Phone className="h-4 w-4" />}
                title="Thông tin liên hệ"
                description="Thông tin liên lạc và đặc điểm cơ bản của người bệnh."
              >
                <div className="grid gap-5 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="BN_SDT_DANG_KY"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Số điện thoại</FormLabel>
                        <FormControl>
                          <Input placeholder="Ví dụ: 0901234567" {...field} />
                        </FormControl>
                        <FormDescription>
                          Dùng để liên hệ cho riêng người bệnh nếu khác số tài khoản.
                        </FormDescription>
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
                          <Input type="email" placeholder="nguoibenh@example.com" {...field} />
                        </FormControl>
                        <FormDescription>Ví dụ: tennguoidung@domain.com</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="BN_QUOC_GIA"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quốc gia</FormLabel>
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
                </div>
              </SectionCard>
            </div>

            <div className="space-y-6">
              <SectionCard
                icon={<ImageIcon className="h-4 w-4" />}
                title="Ảnh đại diện"
                description="Ảnh giúp nhận diện hồ sơ nhanh hơn khi tài khoản quản lý nhiều người bệnh."
              >
                <div className="grid gap-4 lg:grid-cols-[170px_minmax(0,1fr)] xl:grid-cols-1">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt="Ảnh đại diện"
                        className="h-40 w-full rounded-xl object-cover"
                      />
                    ) : (
                      <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-center text-slate-500">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                          <ImageIcon className="h-6 w-6" />
                        </div>
                        <p className="mt-3 text-sm font-medium text-slate-700">Chưa có ảnh đại diện</p>
                        <p className="mt-1 max-w-[14rem] text-xs text-slate-500">
                          Tải ảnh chân dung rõ mặt để dễ nhận biết hồ sơ hơn.
                        </p>
                      </div>
                    )}
                  </div>

                  <FormField
                    control={form.control}
                    name="BN_ANH"
                    render={({ field }) => (
                      <FormItem className="space-y-4">
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <div className="flex flex-wrap items-center gap-3">
                            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">
                              <Upload className="h-4 w-4" />
                              Chọn ảnh
                              <input
                                type="file"
                                accept="image/*,.png,.jpg,.jpeg,.webp"
                                className="hidden"
                                onClick={(event) => {
                                  event.currentTarget.value = '';
                                }}
                                onChange={(event) => handleAvatarFileChange(event, field.onChange)}
                              />
                            </label>
                            {selectedFileName ? (
                              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                                {selectedFileName}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-3 space-y-1 text-xs text-slate-500">
                            <p>Định dạng hỗ trợ: PNG, JPG, JPEG, WEBP</p>
                            <p>Kích thước tối đa: 2MB</p>
                          </div>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </SectionCard>

              <SectionCard
                icon={<ShieldCheck className="h-4 w-4" />}
                title="Giấy tờ & bảo hiểm"
                description="Nhóm thông tin dùng cho đối chiếu và hỗ trợ tiếp nhận."
              >
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-1">
                  <FormField
                    control={form.control}
                    name="BN_CCCD"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CCCD</FormLabel>
                        <FormControl>
                          <Input placeholder="Ví dụ: 079123456789" {...field} />
                        </FormControl>
                        <FormDescription>Nhập theo đúng số trên giấy tờ tùy thân.</FormDescription>
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
                          <Input placeholder="Ví dụ: 001203000123" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="BN_SO_BHYT"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2 xl:col-span-1">
                        <FormLabel>Số BHYT</FormLabel>
                        <FormControl>
                          <Input placeholder="Ví dụ: HS4010123456789" {...field} />
                        </FormControl>
                        <FormDescription>
                          Điền nếu người bệnh có thông tin bảo hiểm cần lưu cùng hồ sơ.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </SectionCard>
              <SectionCard
                icon={<MapPin className="h-4 w-4" />}
                title="Địa chỉ / khu vực"
                description="Chọn theo thứ tự từ tỉnh/thành phố đến ấp/khu vực để hệ thống lưu đúng mã khu vực."
              >
                <div className="grid gap-5">
                  <div className="grid gap-5 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="LOCATION_TTP_MA"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tỉnh/thành phố</FormLabel>
                          <AdminSelect
                            value={field.value}
                            onValueChange={(value) => {
                              field.onChange(value);
                              form.setValue('LOCATION_XP_MA', '');
                              form.setValue('AK_MA', '');
                            }}
                          >
                            <FormControl>
                              <AdminSelectTrigger>
                                <AdminSelectValue placeholder="Chọn tỉnh/thành phố" />
                              </AdminSelectTrigger>
                            </FormControl>
                            <AdminSelectContent>
                              {provinces.map((province) => (
                                <AdminSelectItem key={province.TTP_MA} value={String(province.TTP_MA)}>
                                  {province.TTP_TEN}
                                </AdminSelectItem>
                              ))}
                            </AdminSelectContent>
                          </AdminSelect>
                          <FormDescription>Bước 1: chọn địa bàn cấp tỉnh/thành phố.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="LOCATION_XP_MA"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Xã/phường</FormLabel>
                          <AdminSelect
                            value={field.value}
                            onValueChange={(value) => {
                              field.onChange(value);
                              form.setValue('AK_MA', '');
                            }}
                            disabled={!selectedProvince}
                          >
                            <FormControl>
                              <AdminSelectTrigger>
                                <AdminSelectValue placeholder="Chọn xã/phường" />
                              </AdminSelectTrigger>
                            </FormControl>
                            <AdminSelectContent>
                              {wards.map((ward) => (
                                <AdminSelectItem key={ward.XP_MA} value={String(ward.XP_MA)}>
                                  {ward.XP_TEN}
                                </AdminSelectItem>
                              ))}
                            </AdminSelectContent>
                          </AdminSelect>
                          <FormDescription>
                            {selectedProvince
                              ? 'Bước 2: chọn xã/phường thuộc tỉnh/thành phố đã chọn.'
                              : 'Chọn tỉnh/thành phố trước để tải danh sách xã/phường.'}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="AK_MA"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ấp/khu vực</FormLabel>
                        <AdminSelect
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={!selectedWard}
                        >
                          <FormControl>
                            <AdminSelectTrigger>
                              <AdminSelectValue placeholder="Chọn ấp/khu vực" />
                            </AdminSelectTrigger>
                          </FormControl>
                          <AdminSelectContent>
                            {areas.map((area) => (
                              <AdminSelectItem key={area.AK_MA} value={String(area.AK_MA)}>
                                {area.AK_TEN}
                              </AdminSelectItem>
                            ))}
                          </AdminSelectContent>
                        </AdminSelect>
                        <FormDescription>
                          {selectedWard
                            ? 'Bước 3: chọn ấp/khu vực để hệ thống lưu mã AK_MA.'
                            : 'Chọn xã/phường trước để hiển thị danh sách ấp/khu vực.'}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Khu vực đã chọn
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-900">
                      {selectedArea && selectedWard && selectedProvince
                        ? `${selectedArea.AK_TEN}, ${selectedWard.XP_TEN}, ${selectedProvince.TTP_TEN}`
                        : 'Chưa chọn đủ thông tin khu vực'}
                    </p>
                  </div>
                </div>
              </SectionCard>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">
                Kiểm tra lại thông tin trước khi lưu để hạn chế nhầm hồ sơ khi một tài khoản quản lý
                nhiều người bệnh.
              </p>
              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <Button asChild type="button" variant="outline" className="min-w-[112px]">
                  <Link to={isEditMode ? `/patient-profiles/${id}` : '/profile'}>Hủy</Link>
                </Button>
                <Button
                  type="submit"
                  className="min-w-[148px] bg-blue-600 hover:bg-blue-700"
                  disabled={isSubmitting || locationsQuery.isError}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Đang lưu...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Lưu hồ sơ
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}

function SectionCard({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm ring-0">
      <CardHeader className="border-b border-slate-100 pb-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
            {icon}
          </div>
          <div>
            <CardTitle className="text-base font-semibold text-slate-900">{title}</CardTitle>
            <CardDescription className="mt-1 text-sm text-slate-500">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-5">{children}</CardContent>
    </Card>
  );
}

function RequiredMark() {
  return <span className="ml-1 text-sm font-semibold text-red-500">*</span>;
}
