// src/routes/adminRoutes.tsx
import type { RouteObject } from 'react-router-dom';
import AdminLayout from '@/layouts/AdminLayout';
import AdminDashboardPage from '@/pages/AdminDashboardPage';

// Admin Doctors Form & List
import DoctorListPage from '@/pages/admin/doctors/DoctorListPage';
import DoctorFormPage from '@/pages/admin/doctors/DoctorFormPage';

export const adminRoutes: RouteObject = {
    element: <AdminLayout />,
    children: [
        {
            path: '/admin/dashboard',
            element: <AdminDashboardPage />,
        },
        {
            path: '/admin/doctors',
            element: <DoctorListPage />,
        },
        {
            path: '/admin/doctors/create',
            element: <DoctorFormPage />,
        },
        {
            path: '/admin/doctors/edit/:id',
            element: <DoctorFormPage />,
        },
        // Other admin routes to be added here
    ],
};
