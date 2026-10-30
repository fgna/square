import { renderAppIcon } from '@/lib/app-icon';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';
// Reads the icon chosen in Admin → Settings at request time.
export const dynamic = 'force-dynamic';

export default function AppleIcon() {
  return renderAppIcon(180, { rounded: false });
}
