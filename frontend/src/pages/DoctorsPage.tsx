// src/pages/DoctorsPage.tsx
import { Stethoscope } from 'lucide-react';

export default function DoctorsPage() {
    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[hsl(var(--primary)/0.1)] flex items-center justify-center">
                <Stethoscope className="w-8 h-8 text-[hsl(var(--primary))]" />
            </div>
            <h1 className="text-3xl font-bold text-[hsl(var(--foreground))]">Danh sách bác sĩ</h1>
            <p className="text-[hsl(var(--muted-foreground))] text-center max-w-md">
                Danh sách bác sĩ đang được phát triển. Vui lòng quay lại sau.
            </p>
        </div>
    );
}
