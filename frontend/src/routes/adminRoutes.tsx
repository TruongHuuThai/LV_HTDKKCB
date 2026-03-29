// src/routes/adminRoutes.tsx
import type { RouteObject } from 'react-router-dom';
import AdminLayout from '@/layouts/AdminLayout';
import AdminDashboardPage from '@/pages/AdminDashboardPage';

// Admin Doctors Form & List
import DoctorListPage from '@/pages/admin/doctors/DoctorListPage';
import DoctorFormPage from '@/pages/admin/doctors/DoctorFormPage';
import ServiceListPage from '@/pages/admin/services/ServiceListPage';
import ServiceFormPage from '@/pages/admin/services/ServiceFormPage';
import MedicineListPage from '@/pages/admin/medicines/MedicineListPage';
import MedicineFormPage from '@/pages/admin/medicines/MedicineFormPage';
import MedicineDetailPage from '@/pages/admin/medicines/MedicineDetailPage';
import SpecialtyListPage from '@/pages/admin/specialties/SpecialtyListPage';
import SpecialtyFormPage from '@/pages/admin/specialties/SpecialtyFormPage';
import PatientListPage from '@/pages/admin/patients/PatientListPage';
import PatientFormPage from '@/pages/admin/patients/PatientFormPage';
import AccountListPage from '@/pages/admin/accounts/AccountListPage';
import AccountFormPage from '@/pages/admin/accounts/AccountFormPage';
import AdminScheduleWorkflowPage from '@/pages/admin/schedules/AdminScheduleWorkflowPage';
import AdminDoctorSchedulePlanningPage from '@/pages/admin/schedules/AdminDoctorSchedulePlanningPage';
import RoomListPage from '@/pages/admin/facilities/RoomListPage';
import RoomFormPage from '@/pages/admin/facilities/RoomFormPage';

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
        {
            path: '/admin/services',
            element: <ServiceListPage />,
        },
        {
            path: '/admin/services/create',
            element: <ServiceFormPage />,
        },
        {
            path: '/admin/services/edit/:id',
            element: <ServiceFormPage />,
        },
        {
            path: '/admin/medicines',
            element: <MedicineListPage />,
        },
        {
            path: '/admin/medicines/create',
            element: <MedicineFormPage />,
        },
        {
            path: '/admin/medicines/edit/:id',
            element: <MedicineFormPage />,
        },
        {
            path: '/admin/medicines/detail/:id',
            element: <MedicineDetailPage />,
        },
        {
            path: '/admin/specialties',
            element: <SpecialtyListPage />,
        },
        {
            path: '/admin/specialties/create',
            element: <SpecialtyFormPage />,
        },
        {
            path: '/admin/specialties/edit/:id',
            element: <SpecialtyFormPage />,
        },
        {
            path: '/admin/patients',
            element: <PatientListPage />,
        },
        {
            path: '/admin/patients/create',
            element: <PatientFormPage />,
        },
        {
            path: '/admin/patients/edit/:id',
            element: <PatientFormPage />,
        },
        {
            path: '/admin/accounts',
            element: <AccountListPage />,
        },
        {
            path: '/admin/accounts/create',
            element: <AccountFormPage />,
        },
        {
            path: '/admin/accounts/edit/:id',
            element: <AccountFormPage />,
        },
        {
            path: '/admin/facilities',
            element: <RoomListPage />,
        },
        {
            path: '/admin/facilities/create',
            element: <RoomFormPage />,
        },
        {
            path: '/admin/facilities/edit/:id',
            element: <RoomFormPage />,
        },
        {
            path: '/admin/schedules',
            element: <AdminScheduleWorkflowPage />,
        },
        {
            path: '/admin/schedules/plan',
            element: <AdminDoctorSchedulePlanningPage />,
        },
        // Other admin routes to be added here
    ],
};
