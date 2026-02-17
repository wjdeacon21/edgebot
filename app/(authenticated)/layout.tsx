import { Sidebar } from "@/components/sidebar";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="ml-52 flex-1">{children}</main>
    </div>
  );
}
