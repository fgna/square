'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMe } from '@/hooks/use-members';
import { useCategories } from '@/hooks/use-categories';
import { useUpdateInterests } from '@/hooks/use-interests';
import apiClient from '@/lib/api-client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { WelcomeVideoPlayer } from './welcome-video';
import { useWelcomeVideo } from '@/hooks/use-welcome-video';

const TOTAL_STEPS = 4;

export function OnboardingWizard() {
  const t = useTranslations('onboarding');
  const { data: profile, isLoading: profileLoading } = useMe();
  const { data: categories } = useCategories();
  const queryClient = useQueryClient();
  const updateInterests = useUpdateInterests();

  const [step, setStep] = useState(1);
  const { data: welcome } = useWelcomeVideo();
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [profileInitialized, setProfileInitialized] = useState(false);

  // Pre-fill profile fields once data loads
  if (profile && !profileInitialized) {
    setName(profile.name || '');
    setBio(profile.bio || '');
    setAvatarUrl(profile.avatarUrl || '');
    setProfileInitialized(true);
  }

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { name?: string; bio?: string; avatarUrl?: string }) => {
      const { data: result } = await apiClient.patch('/users/me', data);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });

  const completeOnboardingMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/users/me/onboarding/complete');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });

  // Don't render until we know onboarding status
  if (profileLoading || !profile) return null;
  if (profile.onboardingCompleted) return null;

  const handleNext = async () => {
    if (step === 2) {
      // Save profile changes
      const updates: Record<string, string> = {};
      if (name && name !== profile.name) updates.name = name;
      if (bio !== (profile.bio || '')) updates.bio = bio;
      if (avatarUrl !== (profile.avatarUrl || '')) updates.avatarUrl = avatarUrl;
      if (Object.keys(updates).length > 0) {
        await updateProfileMutation.mutateAsync(updates);
      }
    }
    // The chosen topics used to be thrown away here; the feed reads them.
    if (step === 3 && selectedInterests.length > 0) {
      await updateInterests.mutateAsync(selectedInterests);
    }
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    }
  };

  const handleComplete = async () => {
    await completeOnboardingMutation.mutateAsync();
  };

  const handleSkip = async () => {
    await completeOnboardingMutation.mutateAsync();
  };

  const toggleInterest = (categoryId: string) => {
    setSelectedInterests((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId],
    );
  };

  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  return (
    <Dialog open onOpenChange={(open) => { if (!open) handleSkip(); }}>
      <DialogContent className="sm:max-w-[500px]" onPointerDownOutside={(e) => e.preventDefault()}>
        {/* Progress indicator */}
        <div className="flex gap-1.5 mb-2">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div
              key={i}
              className="h-1 flex-1 rounded-full transition-colors duration-300"
              style={{
                background:
                  i < step
                    ? 'var(--theme-primary)'
                    : 'rgba(255,255,255,0.1)',
              }}
            />
          ))}
        </div>

        {/* Step 1: Welcome */}
        {step === 1 && (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">{t('welcomeTitle')}</DialogTitle>
              <DialogDescription>
                {t('welcomeText')}
              </DialogDescription>
            </DialogHeader>
            {welcome?.videoEmbedUrl && <WelcomeVideoPlayer embedUrl={welcome.videoEmbedUrl} />}
            <div
              className="rounded-lg p-4 text-sm space-y-2"
              style={{
                background: 'rgba(197,168,128,0.08)',
                border: '1px solid rgba(197,168,128,0.2)',
                color: 'var(--theme-text-muted)',
              }}
            >
              <p>{t('canDo')}</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>{t('canFeed')}</li>
                <li>{t('canCourses')}</li>
                <li>{t('canEvents')}</li>
                <li>{t('canJournal')}</li>
              </ul>
            </div>
            <DialogFooter className="flex-row justify-between sm:justify-between">
              <Button variant="ghost" onClick={handleSkip} disabled={completeOnboardingMutation.isPending}>
                {t('skip')}
              </Button>
              <Button onClick={handleNext}>{t('getStarted')}</Button>
            </DialogFooter>
          </>
        )}

        {/* Step 2: Profile Setup */}
        {step === 2 && (
          <>
            <DialogHeader>
              <DialogTitle>{t('profileTitle')}</DialogTitle>
              <DialogDescription>
                {t('profileText')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  {avatarUrl ? (
                    <AvatarImage src={avatarUrl} alt={name} />
                  ) : null}
                  <AvatarFallback className="text-lg">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="avatarUrl">{t('avatarUrl')}</Label>
                  <Input
                    id="avatarUrl"
                    placeholder="https://example.com/avatar.jpg"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name">{t('name')}</Label>
                <Input
                  id="name"
                  placeholder={t('namePlaceholder')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bio">{t('bio')}</Label>
                <Textarea
                  id="bio"
                  placeholder={t('bioPlaceholder')}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter className="flex-row justify-between sm:justify-between">
              <div className="flex gap-2">
                <Button variant="ghost" onClick={handleSkip} disabled={completeOnboardingMutation.isPending}>
                  {t('skip')}
                </Button>
                <Button variant="outline" onClick={() => setStep(1)}>
                  {t('back')}
                </Button>
              </div>
              <Button onClick={handleNext} disabled={updateProfileMutation.isPending}>
                {updateProfileMutation.isPending ? t('saving') : t('next')}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 3: Interests */}
        {step === 3 && (
          <>
            <DialogHeader>
              <DialogTitle>{t('interestsTitle')}</DialogTitle>
              <DialogDescription>
                {t('interestsText')}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap gap-2">
              {categories && Array.isArray(categories) && categories.length > 0 ? (
                categories.map((cat: { id: string; name: string; slug: string }) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleInterest(cat.id)}
                    className="transition-all duration-200"
                  >
                    <Badge
                      style={
                        selectedInterests.includes(cat.id)
                          ? {
                              background: 'var(--theme-primary)',
                              color: 'var(--theme-background)',
                              borderColor: 'var(--theme-primary)',
                              cursor: 'pointer',
                            }
                          : {
                              background: 'rgba(255,255,255,0.05)',
                              color: 'var(--theme-text-muted)',
                              borderColor: 'var(--theme-border)',
                              cursor: 'pointer',
                            }
                      }
                      className="px-3 py-1.5 text-sm"
                    >
                      {cat.name}
                    </Badge>
                  </button>
                ))
              ) : (
                <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>
                  {t('noCategories')}
                </p>
              )}
            </div>
            <DialogFooter className="flex-row justify-between sm:justify-between">
              <div className="flex gap-2">
                <Button variant="ghost" onClick={handleSkip} disabled={completeOnboardingMutation.isPending}>
                  {t('skip')}
                </Button>
                <Button variant="outline" onClick={() => setStep(2)}>
                  {t('back')}
                </Button>
              </div>
              <Button onClick={handleNext} disabled={updateInterests.isPending}>
                {updateInterests.isPending ? t('saving') : t('next')}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 4: Tour / Overview */}
        {step === 4 && (
          <>
            <DialogHeader>
              <DialogTitle>{t('doneTitle')}</DialogTitle>
              <DialogDescription>
                {t('doneText')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {[
                { icon: '📝', title: t('tourFeed'), desc: t('tourFeedText') },
                { icon: '📚', title: t('tourCourses'), desc: t('tourCoursesText') },
                { icon: '📅', title: t('tourEvents'), desc: t('tourEventsText') },
                { icon: '📓', title: t('tourJournal'), desc: t('tourJournalText') },
                { icon: '👥', title: t('tourMembers'), desc: t('tourMembersText') },
              ].map((item) => (
                <div
                  key={item.title}
                  className="flex items-start gap-3 rounded-lg p-3"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--theme-border)',
                  }}
                >
                  <span className="text-lg mt-0.5" role="img" aria-label={item.title}>
                    {item.icon}
                  </span>
                  <div>
                    <p className="font-medium text-sm" style={{ color: 'var(--theme-text)' }}>
                      {item.title}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter className="flex-row justify-between sm:justify-between">
              <Button variant="outline" onClick={() => setStep(3)}>
                {t('back')}
              </Button>
              <Button onClick={handleComplete} disabled={completeOnboardingMutation.isPending}>
                {completeOnboardingMutation.isPending ? t('finishing') : t('complete')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
