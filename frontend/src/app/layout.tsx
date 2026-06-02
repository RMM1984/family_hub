import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/lib/queryClient";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "Hogarflow",
  description: "Gestion financiera de viviendas familiares"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
