import { ProtectedRoute } from "@/components/layout/protected-route";
import { Navbar } from "@/components/layout/navbar";
import { ROUTES } from "@/lib/constants";

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const navItems = [
    { href: ROUTES.STUDENT_CHAT, label: "Chat" },
    { href: ROUTES.STUDENT_EXAM, label: "Exam Mode" },
  ];

  return (
    <ProtectedRoute allowedRoles={["student"]}>
      <div className="h-dvh flex flex-col overflow-hidden">
        <Navbar items={navItems} />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </ProtectedRoute>
  );
}
