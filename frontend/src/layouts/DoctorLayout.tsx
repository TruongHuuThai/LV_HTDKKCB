import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { CalendarDays, ChevronRight, LayoutDashboard, Menu, Stethoscope } from 'lucide-react';

import AppSidebar from '@/components/layout/AppSidebar';
import { cn } from '@/lib/utils';
import { authService } from '@/services/authService';
import { useAuthStore } from '@/store/useAuthStore';

const sidebarItems = [
  { label: 'Thống kê phục vụ bác sĩ', to: '/doctor/dashboard', icon: LayoutDashboard, exact: true },
  { label: 'Lịch làm việc của tôi', to: '/doctor/schedules', icon: CalendarDays, exact: true },
  { label: 'Khám bệnh', to: '/doctor/appointments', icon: Stethoscope, exact: true },
];

const pathTitleMap: Record<string, string> = {
  '/doctor/dashboard': 'Thống kê phục vụ bác sĩ',
  '/doctor/schedules': 'Lịch làm việc của tôi',
  '/doctor/appointments': 'Khám bệnh',
};

export default function DoctorLayout() {
  const { user, refreshToken, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  const doctorDisplayName = user?.TEN_HIEN_THI?.trim() || user?.BS_HO_TEN?.trim() || user?.TK_SDT || '---';
  const collapsed = !isPinned && !isHovering;
  const pageTitle = pathTitleMap[location.pathname] || 'Khu vực bác sĩ';

  useEffect(() => {
    const stored = localStorage.getItem('doctor-sidebar-pinned');
    if (stored) setIsPinned(stored === '1');
  }, []);

  useEffect(() => {
    localStorage.setItem('doctor-sidebar-pinned', isPinned ? '1' : '0');
  }, [isPinned]);

  const handleLogout = async () => {
    try {
      if (refreshToken) await authService.logout(refreshToken);
    } finally {
      clearAuth();
      navigate('/login');
    }
  };

  return (
    <div
      className="relative h-screen overflow-hidden bg-[hsl(210,30%,97%)]"
      style={
        {
          ['--sidebar-rail-width' as never]: '80px',
          ['--sidebar-expanded-width' as never]: '264px',
        } as React.CSSProperties
      }
    >
      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside
        style={{ ['--sidebar-width' as never]: collapsed ? 'var(--sidebar-rail-width)' : 'var(--sidebar-expanded-width)' }}
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-[var(--sidebar-width)] overflow-hidden bg-slate-950 text-slate-100 shadow-2xl transition-[width,transform] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] md:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <div className="h-full w-[var(--sidebar-expanded-width)]">
          <AppSidebar
            variant="doctor"
            brandLabel="UMC Clinic"
            brandTo="/doctor/dashboard"
            roleLabel="Bác sĩ"
            displayName={doctorDisplayName}
            initials="BS"
            items={sidebarItems}
            activePath={location.pathname}
            collapsed={collapsed}
            pinned={isPinned}
            onTogglePin={() => setIsPinned((prev) => !prev)}
            onNavigate={() => setSidebarOpen(false)}
            onLogout={handleLogout}
          />
        </div>
      </aside>

      <div className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden pl-0 md:pl-[var(--sidebar-rail-width)]">
        <header className="h-14 shrink-0 border-b border-slate-200 bg-white px-4 md:invisible md:h-0 md:border-none">
          <div className="flex h-full items-center gap-3">
            <button
              className="-ml-2 rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center text-sm font-medium text-slate-600">
              Bác sĩ
              <ChevronRight className="mx-1 h-4 w-4" />
              <span className="text-slate-900">{pageTitle}</span>
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
