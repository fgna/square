# Videos hosted by the platform

Admins can upload MP4 videos for lessons and event recordings instead of
linking YouTube, Vimeo or Loom. The video stays on the instance's server and
plays only inside the platform. External links keep working.

## What members get

- The video plays in the browser's own player (`<video>`), with seeking.
- The API sends members a **signed link that expires after 24 hours**
  (`signUploadPath`, HMAC with `UPLOAD_LINK_SECRET`, falling back to
  `JWT_SECRET`). Without a valid signature the file route answers `403`, so a
  copied link stops working and never works for the public.
- No third party is contacted, so no click-to-load notice is shown.
- As with any video a member may watch, it can be saved or filmed off the
  screen while the link is valid; the signature only prevents passing a
  permanent link around.

## Format

**MP4 or QuickTime MOV with H.264 video** is accepted; every current browser
plays it (a MOV is stored as `.mp4`, the container is the same family). The
server reads the codec from the file's `moov` box after the upload and refuses
**HEVC/H.265** (Firefox and many Windows computers cannot play it) and other
codecs such as ProRes. Recordings from Zoom, Teams or OBS usually already are
MP4/H.264. 720p is enough for most recordings.

Converting on a Mac: QuickTime Player → File → Export As → 720p (H.264); for
1080p choose "Greater Compatibility (H.264)". Or HandBrake (preset "Fast
720p30", "Web Optimized"), or ffmpeg:

```bash
ffmpeg -i input.mov -c:v libx264 -preset medium -crf 23 -vf "scale=-2:720" -c:a aac -b:a 128k -movflags +faststart output.mp4
```

`+faststart` lets playback start before the whole file has loaded.

## Upload

Admins only (`/api/videos/uploads`, role `ADMIN`). The browser sends the file
in 8 MB chunks; an interrupted chunk is retried and the upload continues
where the server stopped. Unfinished uploads are removed after a day.

| Variable | Default | Meaning |
|---|---|---|
| `VIDEO_MAX_SIZE_MB` | `4096` | Largest accepted video |

A reverse proxy in front of the API must accept requests of at least 9 MB
(nginx: `client_max_body_size 50M` is enough) and should not buffer whole
responses for `/uploads/` (nginx default `proxy_buffering` works; range
requests are passed through).

## Storage, backup and clean-up

- Files: `apps/api/uploads/videos/<id>.mp4`, unfinished uploads in
  `apps/api/uploads/videos/.partial/` (never served). In Docker this is the
  uploads volume.
- Videos are always stored on the local disk, also when S3 is configured for
  other uploads (S3 for videos is a possible follow-up).
- Disk space, roughly: 0.5–1 GB per hour at 720p, 1–2 GB at 1080p.
- Replacing a lesson video, deleting a lesson, module, course or recording
  deletes the file once nothing refers to it. With `RECORDING_RETENTION_DAYS`
  set, expired recordings take their uploaded video with them.
- Backups: `uploads/videos/` can be large. Decide separately whether it goes
  into off-site backups; excluding it keeps document/image backups small.

## Not included yet

Server-side conversion (transcoding/HLS), generated thumbnails, S3 storage
for videos, uploads by members.
