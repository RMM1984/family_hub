"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Building2, FileText, Home, LogOut, Menu, Receipt, Settings, Wallet } from "lucide-react";
import { ReactNode, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/properties", label: "Viviendas", icon: Building2 },
  { href: "/expenses", label: "Gastos", icon: Receipt },
  { href: "/income", label: "Ingresos", icon: Wallet },
  { href: "/documents", label: "Documentos", icon: FileText },
  { href: "/settings", label: "Ajustes", icon: Settings }
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("hogarflow_token") && pathname !== "/login") router.replace("/login");
  }, [pathname, router]);

  function logout() {
    localStorage.removeItem("hogarflow_token");
    router.replace("/login");
  }

  if (pathname === "/login") return <>{children}</>;

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <aside className={cn("fixed inset-y-0 left-0 z-30 w-72 -translate-x-full bg-ink text-white transition lg:static lg:translate-x-0", open && "translate-x-0")}>
        <div className="flex h-16 items-center gap-3 px-5">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-meadow">
            <Home className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-bold">Hogarflow</p>
            <p className="text-xs text-slate-300">Familia Demo</p>
          </div>
        </div>
        <nav className="space-y-1 px-3 py-4">
          {items.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={cn("flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium text-slate-300", active && "bg-white text-ink")}>
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
                {item.label === "Documentos" && <span className="ml-auto rounded-full bg-coral px-2 py-0.5 text-xs text-white">2</span>}
              </Link>
            );
          })}
        </nav>
        <button onClick={logout} className="mx-3 mt-6 flex w-[calc(100%-1.5rem)] items-center gap-3 rounded-md px-3 py-3 text-sm text-slate-300 hover:bg-slate-800">
          <LogOut className="h-5 w-5" />
          Salir
        </button>
      </aside>
      {open && <button aria-label="Cerrar menu" className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:px-8">
          <button aria-label="Abrir menu" className="grid h-10 w-10 place-items-center rounded-md border border-slate-200 lg:hidden" onClick={() => setOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <div>
            <p className="text-sm text-slate-500">Gestion financiera de viviendas</p>
            <h1 className="text-xl font-bold text-ink">Hogarflow</h1>
          </div>
          <div className="hidden rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-meadow sm:block">Produccion</div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
