import { Metadata } from 'next';
import { AuthFrame } from '@/components/auth/auth-frame';

export const metadata: Metadata = {
  title: 'Authentication',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthFrame>{children}</AuthFrame>;
}
