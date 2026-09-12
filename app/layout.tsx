import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Mini God — A little world in your hands',
  description: 'Shape a living island. Sculpt thin layers of seabed, sand, grass and earth, watch the sea, and follow your islanders.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
