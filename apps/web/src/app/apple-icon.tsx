import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#090d16',
          color: '#c5a880',
          fontSize: 90,
          fontWeight: 700,
          fontFamily: 'sans-serif',
        }}
      >
        C
      </div>
    ),
    size,
  );
}
