// src/routes/index.tsx
import { createBrowserRouter } from 'react-router-dom';

// Layouts
import AuthLayout from '@/layouts/AuthLayout';
import PatientLayout from '@/layouts/PatientLayout';
import DoctorLayout from '@/layouts/DoctorLayout';
import AdminLayout from '@/layouts/AdminLayout';
import ProtectedRoute from './ProtectedRoute';

// Pages – Public
import HomePage from '@/pages/HomePage';
import DoctorsPage from '@/pages/DoctorsPage';
import BookingPage from '@/pages/BookingPage';
import ProfilePage from '@/pages/ProfilePage';
import SpecialtyPage from '@/pages/SpecialtyPage';
import NotFoundPage from '@/pages/NotFoundPage';

// Pages – About
import AboutPage from '@/pages/about/AboutPage';
import WhyChooseUsPage from '@/pages/about/WhyChooseUsPage';
import FacilitiesPage from '@/pages/about/FacilitiesPage';

// Pages – Doctor
import DoctorDashboardPage from '@/pages/DoctorDashboardPage';

// Pages – Admin
import AdminDashboardPage from '@/pages/AdminDashboardPage';

// Pages – Auth
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';

const router = createBrowserRouter([
    // ── Auth routes (no Navbar/Footer) ─────────────────────
    {
        element: <AuthLayout />,
        children: [
            { path: '/login', element: <LoginPage /> },
            { path: '/register', element: <RegisterPage /> },
        ],
    },

    // ── Patient / Public routes (Navbar + Footer) ───────────
    {
        element: <PatientLayout />,
        children: [
            { path: '/', element: <HomePage /> },
            { path: '/doctors', element: <DoctorsPage /> },
            { path: '/booking', element: <BookingPage /> },
            { path: '/profile', element: <ProfilePage /> },
            { path: '/chuyen-khoa', element: <DoctorsPage /> },
            { path: '/chuyen-khoa/:id', element: <SpecialtyPage /> },
            // About pages
            { path: '/gioi-thieu/ve-chung-toi', element: <AboutPage /> },
            { path: '/gioi-thieu/tai-sao-chon-chung-toi', element: <WhyChooseUsPage /> },
            { path: '/gioi-thieu/co-so-vat-chat', element: <FacilitiesPage /> },
        ],
    },

    // ── Doctor private routes ───────────────────────────────
    {
        element: <ProtectedRoute allowedRoles={['BAC_SI']} />,
        children: [
            {
                element: <DoctorLayout />,
                children: [
                    { path: '/doctor/dashboard', element: <DoctorDashboardPage /> },
                    // Future: /doctor/schedules, /doctor/appointments, /doctor/profile
                ],
            },
        ],
    },

    // ── Admin private routes ────────────────────────────────
    {
        element: <ProtectedRoute allowedRoles={['ADMIN']} />,
        children: [
            {
                element: <AdminLayout />,
                children: [
                    { path: '/admin/dashboard', element: <AdminDashboardPage /> },
                    // Future: /admin/doctors, /admin/patients, /admin/specialties
                ],
            },
        ],
    },

    // ── 404 ────────────────────────────────────────────────
    { path: '*', element: <NotFoundPage /> },
]);

export default router;
