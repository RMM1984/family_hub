"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Home, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { login } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@familia-demo.com");
  const [password, setPassword] = useState("Demo1234!");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await login(email, password);
      router.replace("/dashboard");
    } catch {
      setError("No se pudo iniciar sesion. Revisa las credenciales.");
    }
  }

  return (
    <main className="grid min-h-screen bg-slate-50 lg:grid-cols-[1fr_480px]">
      <section className="relative hidden overflow-hidden bg-ink lg:block">
        <img src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=1800&auto=format&fit=crop" alt="Vivienda luminosa" className="h-full w-full object-cover opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/50 to-transparent" />
        <div className="absolute bottom-12 left-12 max-w-xl text-white">
          <div className="mb-5 inline-flex items-center gap-2 rounded-md bg-white/15 px-3 py-2 text-sm backdrop-blur">
            <Home className="h-4 w-4" />
            Hogarflow
          </div>
          <h1 className="text-5xl font-bold leading-tight">Control claro de cada vivienda familiar.</h1>
          <p className="mt-4 text-lg text-slate-100">Gastos, ingresos, documentos y vencimientos en un unico panel.</p>
        </div>
      </section>
      <section className="flex items-center justify-center px-5 py-10">
        <form onSubmit={submit} className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
          <div className="mb-8">
            <div className="mb-4 grid h-12 w-12 place-items-center rounded-md bg-meadow text-white">
              <Home className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-bold text-ink">Entrar en Hogarflow</h2>
            <p className="mt-2 text-sm text-slate-500">Acceso demo preparado para Familia Demo.</p>
          </div>
          <label className="mb-4 block">
            <span className="mb-1 block text-sm font-medium">Email</span>
            <input className="h-11 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-meadow" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="mb-5 block">
            <span className="mb-1 block text-sm font-medium">Contrasena</span>
            <input type="password" className="h-11 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-meadow" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {error && <p className="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-coral">{error}</p>}
          <Button className="w-full bg-meadow hover:bg-green-700">
            <LogIn className="h-4 w-4" />
            Entrar
          </Button>
        </form>
      </section>
    </main>
  );
}
