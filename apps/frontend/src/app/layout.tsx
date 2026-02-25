// apps/frontend/src/app/layout.tsx
import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'ERP MDV Oftalmologia',
  description: 'Sistema ERP multi-unidade para clínicas oftalmológicas',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
