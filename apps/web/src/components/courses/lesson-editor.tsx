'use client';

import { useRef, useState } from 'react';
import { FileText, Loader2, Paperclip, Trash2, Video } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/feed/rich-text-editor';
import { formatFileSize, isViewableInBrowser } from './lesson-view';
import { Switch } from '@/components/ui/switch';
import { uploadLessonImage, useCourseEditor } from '@/hooks/use-course-editor';
import type { Lesson } from '@community/shared';
import { VideoUploadButton } from '@/components/common/video-upload-button';
import { isHostedVideoPath } from '@/lib/upload-video';

// Mirrors the API's FILE_TYPES for POST /uploads/file.
const ATTACHMENT_TYPES = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.mp3,.m4a,.wav';

/**
 * Edits one lesson: title, video link, the text under the video, when it
 * opens (drip courses only) and its downloads. Files are attached as soon as
 * they are picked; the rest is saved with "Save lesson".
 */
export function LessonEditor({
  courseId,
  lesson,
  drip,
  onClose,
}: {
  courseId: string;
  lesson: Lesson;
  drip: boolean;
  onClose: () => void;
}) {
  const editor = useCourseEditor(courseId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(lesson.title);
  const [videoUrl, setVideoUrl] = useState(lesson.videoUrl ?? '');
  const [content, setContent] = useState(lesson.content);
  const [releaseAfterDays, setReleaseAfterDays] = useState(lesson.releaseAfterDays ?? 0);
  const [videoDownloadable, setVideoDownloadable] = useState(lesson.videoDownloadable ?? false);
  // YouTube offers no downloads, so there is nothing to link to.
  const videoHostAllowsDownload = /vimeo\.com|loom\.com/i.test(videoUrl);

  // The dialog shows the lesson as last loaded, so attachments added or
  // removed here appear once the course query has reloaded.
  const current =
    editor.course.data?.modules.flatMap((m) => m.lessons).find((l) => l.id === lesson.id) ?? lesson;
  const modules = editor.course.data?.modules ?? [];

  const save = () => {
    editor.updateLesson.mutate(
      {
        id: lesson.id,
        title: title.trim(),
        content,
        videoUrl: videoUrl.trim() || null,
        videoDownloadable: videoDownloadable && videoHostAllowsDownload,
        ...(drip && { releaseAfterDays }),
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit lesson</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="lesson-title">Title</Label>
            <Input id="lesson-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          {modules.length > 1 && (
            <div className="space-y-1.5">
              <Label htmlFor="lesson-module">Module</Label>
              {/* Moves right away and appends the lesson to the chosen module. */}
              <select
                id="lesson-module"
                className="w-full rounded-md px-3 py-2 text-sm"
                style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)', color: 'var(--theme-text)' }}
                value={current.moduleId}
                disabled={editor.moveLessonToModule.isPending}
                onChange={(e) => editor.moveLessonToModule.mutate({ id: lesson.id, moduleId: e.target.value })}
              >
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="lesson-video" className="flex items-center gap-1.5">
              <Video size={14} /> Video
            </Label>
            <Input
              id="lesson-video"
              placeholder="https://vimeo.com/… · https://youtu.be/… · https://www.loom.com/share/…"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
            />
            <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
              Paste the share link from YouTube (unlisted works), Vimeo or Loom, or upload an MP4 or MOV so the video
              stays on this platform. Leave empty for a lesson without video.
            </p>
            <VideoUploadButton onUploaded={(url) => setVideoUrl(url)} />
            {/* Uploaded videos play only inside the platform; there is no download page. */}
            {!isHostedVideoPath(videoUrl) && (
              <label
                className="flex items-start gap-2 text-sm pt-1"
                style={{ color: videoHostAllowsDownload ? 'var(--theme-text)' : 'var(--theme-text-muted)' }}
              >
                <Switch
                  checked={videoDownloadable && videoHostAllowsDownload}
                  onCheckedChange={setVideoDownloadable}
                  disabled={!videoHostAllowsDownload}
                  aria-label="Members may download this video"
                />
                <span>
                  Members may download this video
                  <span className="block text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                    {videoHostAllowsDownload
                      ? 'Shows a link to the video’s page on Vimeo/Loom. Also switch on downloads in the video’s settings there.'
                      : 'Only for Vimeo and Loom videos — YouTube offers no downloads.'}
                  </span>
                </span>
              </label>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Text under the video</Label>
            <RichTextEditor
              content={lesson.content}
              onChange={setContent}
              placeholder="What this lesson is about, exercises, links…"
              onUploadImage={uploadLessonImage}
            />
          </div>

          {drip && (
            <div className="space-y-1.5">
              <Label htmlFor="lesson-days">Opens after</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="lesson-days"
                  type="number"
                  min={0}
                  max={3650}
                  className="w-24"
                  value={releaseAfterDays}
                  onChange={(e) => setReleaseAfterDays(Math.max(0, Number(e.target.value) || 0))}
                />
                <span className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>
                  days after the member starts the course {releaseAfterDays === 0 && '(right away)'}
                </span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Paperclip size={14} /> Downloads
            </Label>
            {(current.attachments ?? []).length > 0 && (
              <ul className="space-y-1.5">
                {(current.attachments ?? []).map((file) => (
                  <li
                    key={file.id}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm"
                    style={{ border: '1px solid var(--theme-border)', color: 'var(--theme-text)' }}
                  >
                    <FileText size={16} style={{ color: 'var(--theme-primary)' }} />
                    <span className="flex-1 truncate">{file.filename}</span>
                    <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                      {formatFileSize(file.size)}
                    </span>
                    <label
                      className="flex items-center gap-1.5 text-xs"
                      style={{ color: 'var(--theme-text-muted)' }}
                      title={
                        isViewableInBrowser(file.mimeType)
                          ? 'Off: members can only view it in the lesson'
                          : 'Browsers cannot display Word, Excel or PowerPoint. For view-only, upload a PDF version.'
                      }
                    >
                      <Switch
                        checked={file.downloadable !== false}
                        disabled={!isViewableInBrowser(file.mimeType) || editor.setAttachmentDownloadable.isPending}
                        onCheckedChange={(downloadable) =>
                          editor.setAttachmentDownloadable.mutate({ id: file.id, downloadable })
                        }
                        aria-label={`Allow downloading ${file.filename}`}
                      />
                      Download
                    </label>
                    <button
                      type="button"
                      aria-label={`Remove ${file.filename}`}
                      onClick={() => editor.deleteAttachment.mutate(file.id)}
                      className="p-1 rounded hover:bg-white/5"
                    >
                      <Trash2 size={14} style={{ color: 'var(--theme-danger)' }} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={ATTACHMENT_TYPES}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) editor.addAttachment.mutate({ lessonId: lesson.id, file });
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={editor.addAttachment.isPending}
            >
              {editor.addAttachment.isPending ? (
                <Loader2 size={14} className="animate-spin mr-1.5" />
              ) : (
                <Paperclip size={14} className="mr-1.5" />
              )}
              Add file
            </Button>
            <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
              PDF, Word, Excel, PowerPoint or audio (MP3, M4A, WAV), up to 50 MB. Switch “Download” off to let
              members only view a PDF or listen to audio in the lesson. Word, Excel and PowerPoint can only be
              downloaded — for view-only, upload a PDF version.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={save} disabled={!title.trim() || editor.updateLesson.isPending}>
            {editor.updateLesson.isPending && <Loader2 size={14} className="animate-spin mr-1.5" />}
            Save lesson
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
