import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ size: string }> },
) {
  const { size: requestedSize } = await params;
  if (requestedSize !== '192' && requestedSize !== '512') {
    return new Response('Not found', { status: 404 });
  }
  const size = Number(requestedSize);
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          background: '#090d16',
          color: '#c5a880',
          fontSize: Math.round(size * 0.49),
          fontWeight: 700,
          fontFamily: 'sans-serif',
          borderRadius: size * 0.18,
        }}
      >
        C
      </div>
    ),
    {
      width: size,
      height: size,
      headers: { 'Cache-Control': 'public, max-age=86400' },
    },
  );
}
