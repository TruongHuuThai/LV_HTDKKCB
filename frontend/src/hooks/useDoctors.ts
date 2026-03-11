// src/hooks/useDoctors.ts
import { useQuery } from '@tanstack/react-query';
import { getDoctors } from '@/services/api';

/**
 * Hook để lấy danh sách bác sĩ từ API.
 * @param specialtyId - nếu cung cấp, chỉ lấy bác sĩ của chuyên khoa này (CK_MA)
 */
export function useDoctors(specialtyId?: number) {
    return useQuery({
        queryKey: ['doctors', specialtyId ?? 'all'],
        queryFn: () => getDoctors(specialtyId),
        staleTime: 5 * 60 * 1000,
        retry: 1,
        refetchOnWindowFocus: false,
    });
}
