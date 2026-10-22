'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState, useRef, useEffect } from 'react';
import {
  useLearningGroups,
  useLearningGroup,
  useCreateGroup,
  useAddGroupMember,
  useRemoveGroupMember,
  useSendGroupMessage,
  useDeleteGroup,
  useGroupInvites,
  useAcceptGroupInvite,
  useRemoveGroupInvite,
} from '@/hooks/use-learning-groups';
import { toast } from '@/store/toast.store';
import type {
  LearningGroup,
  LearningGroupDetail,
  LearningGroupMessage,
} from '@/hooks/use-learning-groups';
import { useAuth } from '@/hooks/use-auth';
import { useMembers } from '@/hooks/use-members';
import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  Plus,
  MessageCircle,
  Send,
  Trash2,
  LogOut,
  UserPlus,
  ArrowLeft,
  Loader2,
  X,
} from 'lucide-react';
import { getInitials } from '@community/shared';

function CreateGroupForm({ onClose }: { onClose: () => void }) {
  const t = useTranslations('groups');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const createGroup = useCreateGroup();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await createGroup.mutateAsync({
      name: name.trim(),
      description: description.trim() || undefined,
    });
    setName('');
    setDescription('');
    onClose();
  };

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--theme-text)' }}>
            {t('create')}
          </h3>
          <button onClick={onClose}>
            <X size={16} style={{ color: 'var(--theme-text-muted)' }} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input placeholder={t('name')} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
          <Textarea placeholder={t('descriptionField')} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={2} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>{t('cancel')}</Button>
            <Button type="submit" size="sm" disabled={createGroup.isPending || !name.trim()}>
              {createGroup.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : <Plus size={14} className="mr-1" />}
              {t('createButton')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function AddMemberPanel({ groupId, existingMemberIds, onClose }: { groupId: string; existingMemberIds: string[]; onClose: () => void }) {
  const t = useTranslations('groups');
  const [search, setSearch] = useState('');
  const { data: membersData } = useMembers(1, 50);
  const addMember = useAddGroupMember(groupId);
  const allMembers: any[] = (membersData as any)?.data ?? (membersData as any)?.users ?? [];
  const available = allMembers.filter((m) => !existingMemberIds.includes(m.id) && m.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="rounded-xl p-4 space-y-3 mb-2" style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold" style={{ color: 'var(--theme-text)' }}>{t('addMember')}</h4>
        <button onClick={onClose}><X size={14} style={{ color: 'var(--theme-text-muted)' }} /></button>
      </div>
      <Input placeholder={t('searchMembers')} value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 text-sm" />
      <div className="max-h-48 overflow-y-auto space-y-1">
        {available.length === 0 ? (
          <p className="text-xs text-center py-3" style={{ color: 'var(--theme-text-muted)' }}>{t('noMembers')}</p>
        ) : available.map((m) => (
          <div key={m.id} className="flex items-center gap-2 p-2 rounded-lg hover:opacity-80 cursor-pointer" style={{ background: 'rgba(197,168,128,0.05)' }} onClick={() =>
            addMember.mutate(m.id, {
              onSuccess: () => {
                toast.success(t('inviteSent'), t('inviteSentText', { name: m.name }));
                onClose();
              },
            })
          }>
            <Avatar className="h-7 w-7"><AvatarFallback className="text-xs">{getInitials(m.name)}</AvatarFallback></Avatar>
            <span className="text-sm flex-1 truncate" style={{ color: 'var(--theme-text)' }}>{m.name}</span>
            {addMember.isPending ? <Loader2 size={14} className="animate-spin" style={{ color: 'var(--theme-primary)' }} /> : <UserPlus size={14} style={{ color: 'var(--theme-primary)' }} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function ChatPanel({ messages, groupId, currentUserId }: { messages: LearningGroupMessage[]; groupId: string; currentUserId: string }) {
  const t = useTranslations('groups');
  const locale = useLocale();
  const [content, setContent] = useState('');
  const sendMessage = useSendGroupMessage(groupId);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    await sendMessage.mutateAsync(content.trim());
    setContent('');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0" style={{ maxHeight: '400px' }}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8">
            <MessageCircle size={32} style={{ color: 'var(--theme-text-muted)' }} />
            <p className="text-sm mt-2" style={{ color: 'var(--theme-text-muted)' }}>{t('noMessages')}</p>
          </div>
        ) : messages.map((msg) => {
          const isOwn = msg.senderId === currentUserId;
          return (
            <div key={msg.id} className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
              <Avatar className="h-7 w-7 flex-shrink-0"><AvatarFallback className="text-[10px]">{getInitials(msg.sender.name)}</AvatarFallback></Avatar>
              <div className={`max-w-[75%] ${isOwn ? 'text-right' : ''}`}>
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="text-xs font-medium" style={{ color: 'var(--theme-primary)' }}>{msg.sender.name}</span>
                  <span className="text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>{new Date(msg.createdAt).toLocaleTimeString(locale === 'de' ? 'de-DE' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="inline-block rounded-xl px-3 py-2 text-sm" style={{ background: isOwn ? 'rgba(197,168,128,0.15)' : 'rgba(255,255,255,0.05)', color: 'var(--theme-text)', border: `1px solid ${isOwn ? 'rgba(197,168,128,0.25)' : 'var(--theme-border)'}` }}>
                  {msg.content}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>
      <form onSubmit={handleSend} className="flex gap-2 p-3" style={{ borderTop: '1px solid var(--theme-border)' }}>
        <Input placeholder={t('messagePlaceholder')} value={content} onChange={(e) => setContent(e.target.value)} className="flex-1 h-9 text-sm" maxLength={2000} />
        <Button type="submit" size="sm" disabled={sendMessage.isPending || !content.trim()} className="h-9 px-3">
          {sendMessage.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </Button>
      </form>
    </div>
  );
}

function GroupDetailView({ groupId, onBack }: { groupId: string; onBack: () => void }) {
  const t = useTranslations('groups');
  const { user } = useAuth();
  const { data: group, isLoading, error } = useLearningGroup(groupId);
  const removeMember = useRemoveGroupMember(groupId);
  const deleteGroup = useDeleteGroup();
  const [showAddMember, setShowAddMember] = useState(false);
  const withdrawInvite = useRemoveGroupInvite();

  if (isLoading) {
    return (<div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>);
  }

  if (error || !group) {
    return (<Card><CardContent className="p-8 text-center space-y-3"><p style={{ color: 'var(--theme-danger)' }}>{t('failedGroup')}</p><Button variant="outline" size="sm" onClick={onBack}>{t('goBack')}</Button></CardContent></Card>);
  }

  const isCreator = group.createdById === user?.id;
  // Invited people are not offered again.
  const existingMemberIds = [...group.members.map((m) => m.userId), ...(group.invites ?? []).map((i) => i.userId)];

  const handleLeave = async () => { if (!user?.id) return; await removeMember.mutateAsync(user.id); onBack(); };
  const handleDelete = async () => { await deleteGroup.mutateAsync(groupId); onBack(); };
  const handleRemoveMember = async (userId: string) => { await removeMember.mutateAsync(userId); };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:opacity-80" style={{ background: 'rgba(197,168,128,0.1)' }}>
          <ArrowLeft size={16} style={{ color: 'var(--theme-primary)' }} />
        </button>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold truncate" style={{ color: 'var(--theme-text)' }}>{group.name}</h3>
          {group.description && <p className="text-sm truncate" style={{ color: 'var(--theme-text-muted)' }}>{group.description}</p>}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {!isCreator && (
            <Button variant="outline" size="sm" onClick={handleLeave} disabled={removeMember.isPending} style={{ borderColor: 'var(--theme-danger)', color: 'var(--theme-danger)' }}>
              {removeMember.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : <LogOut size={14} className="mr-1" />}{t('leave')}
            </Button>
          )}
          {isCreator && (
            <Button variant="outline" size="sm" onClick={handleDelete} disabled={deleteGroup.isPending} style={{ borderColor: 'var(--theme-danger)', color: 'var(--theme-danger)' }}>
              {deleteGroup.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : <Trash2 size={14} className="mr-1" />}{t('deleteGroup')}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--theme-border)' }}>
              <MessageCircle size={16} style={{ color: 'var(--theme-primary)' }} />
              <h4 className="text-sm font-semibold" style={{ color: 'var(--theme-text)' }}>{t('chat')}</h4>
              <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>{t('messagesCount', { count: group._count.messages })}</span>
            </div>
            <ChatPanel messages={group.messages} groupId={groupId} currentUserId={user?.id ?? ''} />
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--theme-border)' }}>
              <div className="flex items-center gap-2">
                <Users size={16} style={{ color: 'var(--theme-primary)' }} />
                <h4 className="text-sm font-semibold" style={{ color: 'var(--theme-text)' }}>{t('membersOf', { count: group._count.members })}</h4>
              </div>
              {isCreator && group._count.members < 8 && (
                <button onClick={() => setShowAddMember(!showAddMember)} className="p-1 rounded hover:opacity-80" style={{ color: 'var(--theme-primary)' }}>
                  <UserPlus size={14} />
                </button>
              )}
            </div>
            <CardContent className="p-3 space-y-1">
              {showAddMember && <AddMemberPanel groupId={groupId} existingMemberIds={existingMemberIds} onClose={() => setShowAddMember(false)} />}
              {group.members.map((member) => (
                <div key={member.id} className="flex items-center gap-2 p-2 rounded-lg">
                  <Avatar className="h-7 w-7 flex-shrink-0"><AvatarFallback className="text-[10px]">{getInitials(member.user.name)}</AvatarFallback></Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ color: 'var(--theme-text)' }}>{member.user.name}</p>
                    {member.userId === group.createdById && <span className="text-[10px]" style={{ color: 'var(--theme-primary)' }}>{t('creator')}</span>}
                  </div>
                  {isCreator && member.userId !== user?.id && (
                    <button onClick={() => handleRemoveMember(member.userId)} className="p-1 rounded hover:opacity-80 flex-shrink-0" style={{ color: 'var(--theme-text-muted)' }} title={t('removeMember')}>
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
              {(group.invites ?? []).map((invite) => (
                <div key={invite.id} className="flex items-center gap-2 p-2 rounded-lg opacity-70">
                  <Avatar className="h-7 w-7 flex-shrink-0"><AvatarFallback className="text-[10px]">{getInitials(invite.user.name)}</AvatarFallback></Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ color: 'var(--theme-text)' }}>{invite.user.name}</p>
                    <span className="text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>{t('invitedWaiting')}</span>
                  </div>
                  <button onClick={() => withdrawInvite.mutate(invite.id)} className="p-1 rounded hover:opacity-80 flex-shrink-0" style={{ color: 'var(--theme-text-muted)' }} title={t('withdraw')}>
                    <X size={12} />
                  </button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function GroupCard({ group, onClick }: { group: LearningGroup; onClick: () => void }) {
  const t = useTranslations('groups');
  return (
    <Card className="cursor-pointer hover:opacity-90 transition-opacity" onClick={onClick}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--theme-text)' }}>{group.name}</h3>
            {group.description && <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--theme-text-muted)' }}>{group.description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--theme-text-muted)' }}>
          <span className="flex items-center gap-1"><Users size={12} />{group._count.members === 1 ? t('memberOne') : t('memberCount', { count: group._count.members })}</span>
          <span className="flex items-center gap-1"><MessageCircle size={12} />{group._count.messages === 1 ? t('messageOne') : t('messageCount', { count: group._count.messages })}</span>
        </div>
        {group.members && group.members.length > 0 && (
          <div className="flex -space-x-2 mt-3">
            {group.members.slice(0, 5).map((m) => (
              <div key={m.id} className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2" style={{ background: 'var(--theme-primary)', color: 'var(--theme-background)', borderColor: 'var(--theme-card)' }} title={m.user.name}>
                {m.user.name?.[0] ?? '?'}
              </div>
            ))}
            {group.members.length > 5 && (
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2" style={{ background: 'rgba(197,168,128,0.2)', color: 'var(--theme-primary)', borderColor: 'var(--theme-card)' }}>
                +{group.members.length - 5}
              </div>
            )}
          </div>
        )}
        <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid var(--theme-border)' }}>
          <span className="text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>{t('createdBy', { name: group.createdBy.name })}</span>
          <span className="text-[10px] font-medium" style={{ color: 'var(--theme-primary)' }}>{t('viewDetails')}</span>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Invitations waiting for an answer. Being added to a group used to make
 * someone a member without asking; now they decide here.
 */
function GroupInvitations() {
  const t = useTranslations('groups');
  const { data: invites = [] } = useGroupInvites();
  const accept = useAcceptGroupInvite();
  const decline = useRemoveGroupInvite();
  if (invites.length === 0) return null;

  return (
    <section aria-label={t('invitations')} className="space-y-2">
      <h3 className="text-sm font-semibold" style={{ color: 'var(--theme-text)' }}>{t('invitations')}</h3>
      {invites.map((invite) => (
        <Card key={invite.id}>
          <CardContent className="p-4 flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium" style={{ color: 'var(--theme-text)' }}>{invite.group.name}</p>
              <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                {t('invitedYou', { name: invite.invitedBy.name, count: invite.group._count.members })}
              </p>
            </div>
            <Button
              size="sm"
              disabled={accept.isPending}
              onClick={() => accept.mutate(invite.id, { onSuccess: () => toast.success(t('welcome'), t('joined', { name: invite.group.name })) })}
            >
              {t('accept')}
            </Button>
            <Button size="sm" variant="outline" disabled={decline.isPending} onClick={() => decline.mutate(invite.id)}>
              {t('decline')}
            </Button>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

export function LearningGroupsPage() {
  const t = useTranslations('groups');
  const { data: groups, isLoading, error, refetch } = useLearningGroups();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  if (selectedGroupId) {
    return (<div className="animate-fade-in"><GroupDetailView groupId={selectedGroupId} onBack={() => setSelectedGroupId(null)} /></div>);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title={t('title')} description={t('description')} icon={Users} action={<Button size="sm" onClick={() => setShowCreate(!showCreate)}><Plus size={14} className="mr-1" />{t('new')}</Button>} />

      {showCreate && <CreateGroupForm onClose={() => setShowCreate(false)} />}

      <GroupInvitations />

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5 space-y-3"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-3 w-full" /><div className="flex gap-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-20" /></div><div className="flex -space-x-2">{Array.from({ length: 3 }).map((_, j) => (<Skeleton key={j} className="h-7 w-7 rounded-full" />))}</div></CardContent></Card>
          ))}
        </div>
      ) : error ? (
        <Card><CardContent className="p-8 text-center space-y-3"><p style={{ color: 'var(--theme-danger)' }}>{t('failedGroups')}</p><p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>{(error as { message?: string })?.message || t('unknownError')}</p><Button variant="outline" size="sm" onClick={() => refetch()}>{t('retry')}</Button></CardContent></Card>
      ) : !groups || groups.length === 0 ? (
        <Card><CardContent className="p-12 text-center"><Users size={40} className="mx-auto mb-3" style={{ color: 'var(--theme-text-muted)' }} /><p className="font-medium" style={{ color: 'var(--theme-text)' }}>{t('emptyTitle')}</p><p className="text-sm mt-1 mb-4" style={{ color: 'var(--theme-text-muted)' }}>{t('emptyText')}</p><Button size="sm" onClick={() => setShowCreate(true)}><Plus size={14} className="mr-1" />{t('first')}</Button></CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (<GroupCard key={group.id} group={group} onClick={() => setSelectedGroupId(group.id)} />))}
        </div>
      )}
    </div>
  );
}
