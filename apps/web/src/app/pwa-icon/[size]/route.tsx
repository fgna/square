import { renderAppIcon } from '@/lib/app-icon';

// Reads the icon chosen in Admin → Settings at request time.
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ size: string }> },
) {
  const { size: requestedSize } = await params;
  if (requestedSize !== '192' && requestedSize !== '512') {
    return new Response('Not found', { status: 404 });
  }
  return renderAppIcon(Number(requestedSize), { rounded: true });
}
