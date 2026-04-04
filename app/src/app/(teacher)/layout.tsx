import { ProtectedRoute } from '@/components/layout/protected-route';
import { Navbar } from '@/components/layout/navbar';
import { ROUTES } from '@/lib/constants';

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const navItems = [
    { href: ROUTES.TEACHER_DASHBOARD, label: 'Dashboard' },
    { href: ROUTES.TEACHER_ANALYTICS, label: 'Analytics' },
  ];

  return (
    <ProtectedRoute allowedRoles={['teacher']}>
      <div className="min-h-screen flex flex-col">
        <Navbar items={navItems} />
        <main className="flex-1">{children}</main>
      </div>
    </ProtectedRoute>
  );
}
