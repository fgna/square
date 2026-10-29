import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { readLocalFile, UnreadableFileError, UNREADABLE_FILE_HINT } from '@/lib/read-local-file';
import type { Course, CourseReleaseMode } from '@community/shared';

/** A change to the course that reloads it, and the admin list, once saved. */
function useCourseMutation<T>(courseId: string, fn: (vars: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses', courseId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'courses'] });
    },
  });
}

/** Everything the admin course editor reads and changes. */
export function useCourseEditor(courseId: string) {
  const course = useQuery<Course>({
    queryKey: ['courses', courseId],
    queryFn: () => apiClient.get(`/courses/${courseId}`).then((r) => r.data),
  });
  return {
    course,
    updateCourse: useCourseMutation(courseId, (data: Partial<{ title: string; description: string; releaseMode: CourseReleaseMode; coverUrl: string | null; categoryIds: string[] }>) =>
      apiClient.patch(`/courses/${courseId}`, data),
    ),
    addModule: useCourseMutation(courseId, (title: string) => apiClient.post(`/courses/${courseId}/modules`, { title })),
    renameModule: useCourseMutation(courseId, ({ id, title }: { id: string; title: string }) =>
      apiClient.patch(`/courses/modules/${id}`, { title }),
    ),
    deleteModule: useCourseMutation(courseId, (id: string) => apiClient.delete(`/courses/modules/${id}`)),
    moveModule: useCourseMutation(courseId, ({ id, direction }: { id: string; direction: 'up' | 'down' }) =>
      apiClient.post(`/courses/modules/${id}/move`, { direction }),
    ),
    addLesson: useCourseMutation(courseId, ({ moduleId, title }: { moduleId: string; title: string }) =>
      apiClient.post(`/courses/modules/${moduleId}/lessons`, { title }).then((r) => r.data),
    ),
    updateLesson: useCourseMutation(courseId, 
      ({
        id,
        ...data
      }: {
        id: string;
        title?: string;
        content?: string;
        videoUrl?: string | null;
        releaseAfterDays?: number;
        videoDownloadable?: boolean;
      }) =>
        apiClient.patch(`/courses/lessons/${id}`, data),
    ),
    deleteLesson: useCourseMutation(courseId, (id: string) => apiClient.delete(`/courses/lessons/${id}`)),
    moveLesson: useCourseMutation(courseId, ({ id, direction }: { id: string; direction: 'up' | 'down' }) =>
      apiClient.post(`/courses/lessons/${id}/move`, { direction }),
    ),
    moveLessonToModule: useCourseMutation(courseId, ({ id, moduleId }: { id: string; moduleId: string }) =>
      apiClient.post(`/courses/lessons/${id}/module`, { moduleId }),
    ),
    addAttachment: useCourseMutation(courseId, async ({ lessonId, file }: { lessonId: string; file: File }) => {
      const form = new FormData();
      form.append('file', await readableOrExplain(file));
      const { data: upload } = await apiClient.post('/uploads/file', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return apiClient.post(`/courses/lessons/${lessonId}/attachments`, { uploadId: upload.id });
    }),
    setAttachmentDownloadable: useCourseMutation(courseId, ({ id, downloadable }: { id: string; downloadable: boolean }) =>
      apiClient.patch(`/courses/attachments/${id}`, { downloadable }),
    ),
    deleteAttachment: useCourseMutation(courseId, (id: string) => apiClient.delete(`/courses/attachments/${id}`)),
  };
}

/** Uploads an image for lesson text and returns a URL the browser can load. */
export async function uploadLessonImage(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', await readableOrExplain(file));
  const { data } = await apiClient.post('/uploads/image', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  // A path, served through the web app's /uploads rewrite (see next.config).
  return data.url;
}

/** Reads the file first; if that fails, the error says why instead of "could not reach the server". */
export async function readableOrExplain(file: File): Promise<File> {
  try {
    return await readLocalFile(file);
  } catch (err) {
    if (err instanceof UnreadableFileError) {
      // Shaped like an API error so the global toast shows this text.
      throw Object.assign(new Error(err.message), {
        response: { status: 0, data: { message: `${err.message}. ${UNREADABLE_FILE_HINT}` } },
      });
    }
    throw err;
  }
}
