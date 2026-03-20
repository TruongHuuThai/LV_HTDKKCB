export const PATIENT_PROFILE_RELATION_OPTIONS = [
  { value: 'SELF', label: 'Bản thân' },
  { value: 'CHILD', label: 'Con' },
  { value: 'PARENT', label: 'Cha/mẹ' },
  { value: 'RELATIVE', label: 'Người thân' },
] as const;

export function getPatientProfileFullName(profile: {
  BN_HO_CHU_LOT?: string | null;
  BN_TEN?: string | null;
  fullName?: string | null;
}) {
  if (profile.fullName?.trim()) return profile.fullName.trim();
  return [profile.BN_HO_CHU_LOT, profile.BN_TEN]
    .map((item) => item?.trim() || '')
    .filter(Boolean)
    .join(' ')
    .trim();
}

export function getPatientGenderLabel(value?: boolean | null) {
  if (value === true) return 'Nam';
  if (value === false) return 'Nữ';
  return 'Chưa xác định';
}

export function getPatientRelationshipLabel(value?: string | null) {
  const normalized = (value || '').trim().toUpperCase();
  const matched = PATIENT_PROFILE_RELATION_OPTIONS.find(
    (item) => item.value === normalized,
  );
  return matched?.label || value || 'Khác';
}

export function formatCurrencyVnd(value?: number | string | null) {
  const numericValue =
    typeof value === 'string' ? Number.parseFloat(value) : value ?? 0;
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(numericValue) ? numericValue : 0);
}
