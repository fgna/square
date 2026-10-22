export const PREMIUM_FEATURES = {
  LEARNING_GROUPS: 'learning_groups',
  ASSESSMENTS: 'assessments',
  JOURNAL: 'journal',
  ADVANCED_ANALYTICS: 'advanced_analytics',
  FILE_UPLOADS: 'file_uploads',
} as const;

export type PremiumFeature = (typeof PREMIUM_FEATURES)[keyof typeof PREMIUM_FEATURES];

export const FREE_TIER_LIMITS = {
  maxPosts: 10,
  maxGroups: 0,
  maxUploads: 0,
  canAccessAssessments: false,
  canAccessJournal: false,
} as const;

export const PREMIUM_TIER_LIMITS = {
  maxPosts: Infinity,
  maxGroups: Infinity,
  maxUploads: Infinity,
  canAccessAssessments: true,
  canAccessJournal: true,
} as const;
