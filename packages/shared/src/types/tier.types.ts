export enum MembershipTier {
  FREE = 'FREE',
  PREMIUM = 'PREMIUM',
}

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

export type TierLimits = typeof FREE_TIER_LIMITS | typeof PREMIUM_TIER_LIMITS;

export interface TierStatus {
  tier: MembershipTier;
  isPremium: boolean;
  limits: TierLimits;
}

/** Feature metadata for UI display of upgrade prompts */
export const PREMIUM_FEATURE_INFO: Record<
  keyof typeof PREMIUM_FEATURES,
  { label: string; description: string }
> = {
  LEARNING_GROUPS: { label: 'Learning Groups', description: 'Join peer learning groups' },
  ASSESSMENTS: { label: 'Self-Assessment', description: 'Complete the self-assessment' },
  JOURNAL: { label: 'Journal', description: 'Keep a private development journal' },
  ADVANCED_ANALYTICS: { label: 'Advanced Analytics', description: 'Access detailed analytics and reports' },
  FILE_UPLOADS: { label: 'File Uploads', description: 'Upload and share files with the community' },
};

export type PremiumFeatureKey = keyof typeof PREMIUM_FEATURES;
