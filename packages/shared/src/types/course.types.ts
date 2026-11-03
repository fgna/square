export interface LessonAttachment {
  id: string;
  lessonId: string;
  filename: string;
  /** Absolute link to download the file. */
  url: string;
  mimeType: string;
  size: number;
  order: number;
  /** false: members can only view it in the lesson (PDF viewer, audio player). */
  downloadable?: boolean;
}

export type CourseReleaseMode = 'ALL_AT_ONCE' | 'DRIP';

export interface Lesson {
  id: string;
  title: string;
  /** Rich-text HTML, or markdown in older lessons. Empty while locked. */
  content: string;
  order: number;
  moduleId: string;
  createdAt: string;
  /** The YouTube/Vimeo/Loom link or uploaded video path as entered; sent to admins only. */
  videoUrl?: string | null;
  /** The player URL to put in an iframe, derived by the API from videoUrl. */
  videoEmbedUrl?: string | null;
  /** A video uploaded to the platform: signed, expiring file link for a <video> player. */
  videoFileUrl?: string | null;
  /** Admin setting: offer members the video host's download page. */
  videoDownloadable?: boolean;
  /** Set by the API only when videoDownloadable is on and the host offers downloads. */
  videoDownloadUrl?: string | null;
  /** Drip courses: days after the member's start until this lesson opens. */
  releaseAfterDays?: number;
  attachments?: LessonAttachment[];
  /** True while a drip lesson has not opened for this member. */
  locked?: boolean;
  availableAt?: string | null;
}

export interface CourseModule {
  id: string;
  title: string;
  order: number;
  courseId: string;
  lessons: Lesson[];
  createdAt: string;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  coverUrl?: string | null;
  isPublished: boolean;
  releaseMode?: CourseReleaseMode;
  categories?: { category: { id: string; name: string; slug: string } }[];
  duration?: string | null;
  level?: string | null;
  modules: CourseModule[];
  createdAt: string;
  updatedAt: string;
  _count?: {
    modules: number;
    progress: number;
  };
}

export interface Progress {
  id: string;
  userId: string;
  courseId: string;
  completedAt?: string | null;
  percentage: number;
  createdAt: string;
  updatedAt: string;
}

export interface CourseWithProgress extends Course {
  progress?: Progress | null;
}

export interface PaginatedCourses {
  data: Course[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
