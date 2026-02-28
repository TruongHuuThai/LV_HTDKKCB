// src/pages/SpecialtyPage.tsx
import { useParams } from 'react-router-dom';
import { Stethoscope } from 'lucide-react';
import { useSpecialties } from '@/hooks/useSpecialties';

export default function SpecialtyPage() {
    const { id } = useParams<{ id: string }>();
    const { data: specialties = [] } = useSpecialties();
    const specialty = specialties.find((s) => String(s.CK_MA) === id);

    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center">
                <Stethoscope className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-[hsl(var(--foreground))]">
                {specialty?.CK_TEN ?? `Chuyên khoa #${id}`}
            </h1>
            <p className="text-[hsl(var(--muted-foreground))] text-center max-w-md">
                {specialty?.CK_MO_TA ?? 'Nội dung trang chuyên khoa đang được phát triển.'}
            </p>
        </div>
    );
}
