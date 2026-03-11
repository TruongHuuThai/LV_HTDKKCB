// src/hooks/useSpecialties.ts
import { useQuery } from '@tanstack/react-query';
import { getSpecialties } from '@/services/api';

// Re-export for convenience
export type { Specialty } from '@/services/api';

export function useSpecialties() {
    return useQuery({
        queryKey: ['specialties'],
        queryFn: getSpecialties,
        staleTime: 5 * 60 * 1000,   // cache 5 phút
        retry: 1,                    // chỉ retry 1 lần khi lỗi
        refetchOnWindowFocus: false,
    });
}
