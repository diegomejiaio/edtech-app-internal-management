import type { Metadata } from "next";
import { IBM_Plex_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { AuthProvider, QueryProvider, ThemeProvider } from "@/providers";
import { Toaster } from "@/components/ui/sonner";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-ibm-plex-sans",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-space-grotesk",
});

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
      <body className={`${ibmPlexSans.variable} ${spaceGrotesk.variable} font-sans antialiased`}>
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
