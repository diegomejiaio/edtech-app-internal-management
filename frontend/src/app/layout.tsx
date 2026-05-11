import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider, QueryProvider, ThemeProvider } from "@/providers";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Espacio Pro",
  description: "Gestión de inscripciones, horarios y pagos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <AuthProvider>
          <ThemeProvider>
            <QueryProvider>{children}</QueryProvider>
            <Toaster position="bottom-right" richColors />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
