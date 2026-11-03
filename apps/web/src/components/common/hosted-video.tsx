/**
 * A video uploaded to the platform itself. The link is signed and expires,
 * so it does not work outside the platform; no third party is involved.
 * No download button and no context menu ("Save video as…"): videos are for
 * watching here. This does not stop a determined viewer, it only avoids
 * inviting downloads.
 */
export function HostedVideo({ src, title }: { src: string; title: string }) {
  return (
    <div className="w-full overflow-hidden rounded-lg" style={{ background: '#000' }}>
      <video
        src={src}
        title={title}
        controls
        preload="metadata"
        playsInline
        controlsList="nodownload"
        onContextMenu={(e) => e.preventDefault()}
        className="block w-full"
        style={{ aspectRatio: '16 / 9' }}
      />
    </div>
  );
}
