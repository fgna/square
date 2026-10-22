'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import apiClient from '@/lib/api-client';
import { readLocalFile, UNREADABLE_FILE_HINT } from '@/lib/read-local-file';
import { toast } from '@/store/toast.store';

/**
 * Picks an image, uploads it (POST /uploads/image) and hands back its URL.
 * Replaces the "paste an image URL" text fields: nobody has a hosted URL for
 * their course cover or logo, they have a file.
 */
export function ImageUploadField({
  value,
  onChange,
  label,
  previewClassName = 'h-24 w-40',
}: {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  label: string;
  previewClassName?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (picked: File) => {
    setUploading(true);
    try {
      const file = await readLocalFile(picked).catch(() => {
        toast.error('This image could not be read', UNREADABLE_FILE_HINT);
        return null;
      });
      if (!file) return;
      const form = new FormData();
      form.append('file', file);
      const { data } = await apiClient.post('/uploads/image', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // Stored as a path ("/uploads/…"); the web app serves it through its
      // /uploads rewrite, so the picture survives a move to another domain.
      onChange(data.url);
    } catch {
      // The global error toast has already said what went wrong.
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div
        className={`${previewClassName} rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0`}
        style={{ border: '1px dashed var(--theme-border)', background: 'rgba(255,255,255,0.03)' }}
      >
        {value ? (
          <img src={value} alt={label} className="h-full w-full object-contain" />
        ) : (
          <ImagePlus size={20} style={{ color: 'var(--theme-text-muted)' }} />
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          aria-label={label}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void upload(file);
          }}
        />
        <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <ImagePlus size={14} className="mr-1.5" />}
          {value ? 'Replace image' : 'Upload image'}
        </Button>
        {value && (
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>
            <Trash2 size={14} className="mr-1.5" /> Remove
          </Button>
        )}
      </div>
    </div>
  );
}
