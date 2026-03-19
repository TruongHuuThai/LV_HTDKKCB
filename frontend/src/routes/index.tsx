// src/routes/index.tsx
import { createBrowserRouter } from 'react-router-dom';

// Layouts
import AuthLayout from '@/layouts/AuthLayout';
import PatientLayout from '@/layouts/PatientLayout';
import DoctorLayout from '@/layouts/DoctorLayout';
import ProtectedRoute from './ProtectedRoute';
import { adminRoutes } from './adminRoutes';

// Pages – Public
import HomePage from '@/pages/HomePage';
import DoctorsPage from '@/pages/doctors/DoctorsPage';
import BookingPage from '@/pages/BookingPage';
import ProfilePage from '@/pages/ProfilePage';
import NotFoundPage from '@/pages/NotFoundPage';

// Pages – Specialty
import SpecialtyListPage from '@/pages/specialty/SpecialtyListPage';
import SpecialtyDetailPage from '@/pages/specialty/SpecialtyDetailPage';

// Pages – About
import AboutPage from '@/pages/about/AboutPage';
import WhyChooseUsPage from '@/pages/about/WhyChooseUsPage';
import FacilitiesPage from '@/pages/about/FacilitiesPage';
import EquipmentInfoPage from '@/pages/facilities/EquipmentInfoPage';

// Pages – Services
import AllServicesOverviewPage from '@/pages/services/AllServicesOverviewPage';
import ServiceCategoryPage from '@/pages/services/ServiceCategoryPage';
import ServicePackageDetailPage from '@/pages/services/ServicePackageDetailPage';

// Pages – News
import NewsCategoryPage from '@/pages/news/NewsCategoryPage';
import NewsDetailPage from '@/pages/news/NewsDetailPage';

// Pages – Guides
import GuideDetailPage from '@/pages/guide/GuideDetailPage';

// Pages – Contact
import ContactPage from '@/pages/contact/ContactPage';

// Pages – Doctor
import DoctorDashboardPage from '@/pages/DoctorDashboardPage';
import DoctorSchedulePage from '@/pages/doctor/DoctorSchedulePage';

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
            { path: '/doi-ngu-bac-si', element: <DoctorsPage /> },
            { path: '/doi-ngu-bac-si/:slug', element: <DoctorsPage /> },
            { path: '/booking', element: <BookingPage /> },
            { path: '/profile', element: <ProfilePage /> },
            // Specialty pages
            { path: '/chuyen-khoa', element: <SpecialtyListPage /> },
            { path: '/chuyen-khoa/:slug', element: <SpecialtyDetailPage /> },
            // About pages
            { path: '/gioi-thieu/ve-chung-toi', element: <AboutPage /> },
            { path: '/gioi-thieu/tai-sao-chon-chung-toi', element: <WhyChooseUsPage /> },
            { path: '/gioi-thieu/co-so-vat-chat', element: <FacilitiesPage /> },
            { path: '/co-so-vat-chat/trang-thiet-bi', element: <EquipmentInfoPage /> },
            // Service pages – 2-level routing: /dich-vu/:categorySlug AND /dich-vu/:categorySlug/:packageSlug
            { path: '/dich-vu/tat-ca', element: <AllServicesOverviewPage /> },
            { path: '/dich-vu/:categorySlug/:packageSlug', element: <ServicePackageDetailPage /> },
            { path: '/dich-vu/:categorySlug', element: <ServiceCategoryPage /> },
            // News pages
            { path: '/tin-tuc/:categorySlug/:articleSlug', element: <NewsDetailPage /> },
            { path: '/tin-tuc/:categorySlug', element: <NewsCategoryPage /> },
            // Guide pages
            { path: '/huong-dan/:slug', element: <GuideDetailPage /> },
            // Contact page
            { path: '/lien-he', element: <ContactPage /> },
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
                    { path: '/doctor/schedules', element: <DoctorSchedulePage /> },
                    // Future: /doctor/appointments, /doctor/profile
                ],
            },
        ],
    },

    // ── Admin private routes ────────────────────────────────
    {
        element: <ProtectedRoute allowedRoles={['ADMIN']} />,
        children: [adminRoutes],
    },

    // ── 404 ────────────────────────────────────────────────
    { path: '*', element: <NotFoundPage /> },
]);

export default router;
