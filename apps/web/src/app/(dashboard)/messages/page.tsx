'use client';

import { useTranslations } from 'next-intl';
import { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useConversations, useMessages, useSendMessage, useGetOrCreateConversation } from '@/hooks/use-messages';
import { useMembers } from '@/hooks/use-members';
import { useAuth } from '@/hooks/use-auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getInitials, formatDate } from '@community/shared';
import type { Conversation } from '@community/shared';
import { Send, MessageSquare, ArrowLeft, PenSquare, Search, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

function getOtherParticipant(conv: Conversation, myId: string) {
  return conv.participants.find(p => p.userId !== myId)?.user;
}

function NewMessageModal({
  myId,
  onConversationCreated,
  onClose,
}: {
  myId: string;
  onConversationCreated: (convId: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations('messages');
  const [search, setSearch] = useState('');
  const { data: membersData, isLoading } = useMembers(1, 50);
  const startConversation = useGetOrCreateConversation();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const members = (membersData?.data ?? membersData?.users ?? []).filter(
    (m: any) => m.id !== myId && m.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSelect = (userId: string) => {
    startConversation.mutate(userId, {
      onSuccess: (data: any) => {
        onConversationCreated(data.id);
      },
    });
  };

  return (
    <div className="absolute inset-0 z-10 flex flex-col" style={{ background: 'var(--theme-surface)' }}>
      <div
        className="flex items-center gap-2 p-3"
        style={{ borderBottom: '1px solid var(--theme-border)' }}
      >
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-white/5 flex-shrink-0"
          aria-label={t('cancel')}
        >
          <X size={18} style={{ color: 'var(--theme-text-muted)' }} />
        </button>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--theme-text)' }}>
          {t('new')}
        </h3>
      </div>

      <div className="p-3" style={{ borderBottom: '1px solid var(--theme-border)' }}>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--theme-text-muted)' }} />
          <Input
            ref={inputRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('searchMembers')}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--theme-text-muted)' }} />
          </div>
        ) : members.length === 0 ? (
          <p className="p-4 text-xs text-center" style={{ color: 'var(--theme-text-muted)' }}>
            {search ? t('noMembersFound') : t('noOtherMembers')}
          </p>
        ) : (
          members.map((member: any) => (
            <button
              key={member.id}
              onClick={() => handleSelect(member.id)}
              disabled={startConversation.isPending}
              className="flex items-center gap-3 p-3 w-full text-left transition-colors hover:bg-white/5 disabled:opacity-50"
              style={{ borderBottom: '1px solid var(--theme-border)' }}
            >
              <Avatar className="h-9 w-9 flex-shrink-0">
                <AvatarImage src={member.avatarUrl ?? undefined} />
                <AvatarFallback className="text-xs">{getInitials(member.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--theme-text)' }}>
                  {member.name}
                </p>
                {member.bio && (
                  <p className="text-xs truncate" style={{ color: 'var(--theme-text-muted)' }}>
                    {member.bio}
                  </p>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function ConversationList({
  conversations,
  selectedId,
  myId,
  onSelect,
  onNewMessage,
}: {
  conversations: Conversation[];
  selectedId: string | null;
  myId: string;
  onSelect: (id: string) => void;
  onNewMessage: () => void;
}) {
  const t = useTranslations('messages');
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--theme-border)' }}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--theme-text)' }}>
          {t('title')}
        </h2>
        <button
          onClick={onNewMessage}
          className="p-1.5 rounded-md hover:bg-white/5 transition-colors"
          aria-label={t('newShort')}
          title={t('newShort')}
        >
          <PenSquare size={16} style={{ color: 'var(--theme-primary)' }} />
        </button>
      </div>
      {conversations.length === 0 && (
        <div className="flex flex-col items-center gap-3 p-6 text-center">
          <MessageSquare size={32} style={{ color: 'var(--theme-text-muted)', opacity: 0.4 }} />
          <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
            {t('noConversations')}
          </p>
          <Button size="sm" variant="outline" onClick={onNewMessage} className="gap-1.5">
            <PenSquare size={13} />
            {t('start')}
          </Button>
        </div>
      )}
      {conversations.map(conv => {
        const other = getOtherParticipant(conv, myId);
        const lastMsg = conv.messages[0];
        const isSelected = conv.id === selectedId;
        return (
          <button
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={cn(
              'flex items-center gap-3 p-4 w-full text-left transition-colors hover:bg-white/5',
              isSelected && 'bg-white/5',
            )}
            style={{ borderBottom: '1px solid var(--theme-border)' }}
          >
            <Avatar className="h-9 w-9 flex-shrink-0">
              <AvatarImage src={other?.avatarUrl ?? undefined} />
              <AvatarFallback className="text-xs">{getInitials(other?.name ?? '?')}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--theme-text)' }}>
                {other?.name ?? t('unknown')}
              </p>
              {lastMsg && (
                <p className="text-xs truncate" style={{ color: 'var(--theme-text-muted)' }}>
                  {lastMsg.content}
                </p>
              )}
            </div>
            {lastMsg && (
              <span className="text-xs flex-shrink-0" style={{ color: 'var(--theme-text-muted)' }}>
                {formatDate(lastMsg.createdAt, { month: 'short', day: 'numeric', year: undefined })}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function MessageThread({
  conversationId,
  myId,
  otherName,
  onBack,
}: {
  conversationId: string;
  myId: string;
  otherName?: string;
  onBack: () => void;
}) {
  const t = useTranslations('messages');
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const { data, isLoading } = useMessages(conversationId);
  const send = useSendMessage(conversationId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [data]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText('');
    send.mutate(trimmed);
  };

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center gap-3 px-4 h-14 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--theme-border)' }}
      >
        <button
          className="md:hidden p-1.5 rounded-md hover:bg-white/5 flex-shrink-0"
          onClick={onBack}
          aria-label={t('back')}
        >
          <ArrowLeft size={18} style={{ color: 'var(--theme-text-muted)' }} />
        </button>
        {otherName && (
          <span className="text-sm font-semibold" style={{ color: 'var(--theme-text)' }}>
            {otherName}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>Loading…</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          {/* Pushed to the bottom, so a short conversation sits right above
              the input line instead of at the top of an empty panel. */}
          <div className="min-h-full flex flex-col justify-end space-y-3">
          {(data?.data ?? []).map(msg => {
            const isMine = msg.senderId === myId;
            return (
              <div key={msg.id} className={cn('flex gap-2 items-end', isMine && 'flex-row-reverse')}>
                {!isMine && (
                  <Avatar className="h-7 w-7 flex-shrink-0">
                    <AvatarImage src={msg.sender.avatarUrl ?? undefined} />
                    <AvatarFallback className="text-xs">{getInitials(msg.sender.name)}</AvatarFallback>
                  </Avatar>
                )}
                <div
                  className="max-w-[75%] px-3 py-2 rounded-2xl text-sm"
                  style={{
                    background: isMine ? 'var(--theme-primary)' : 'var(--theme-card)',
                    color: isMine ? 'var(--theme-background)' : 'var(--theme-text)',
                    borderBottomRightRadius: isMine ? 4 : undefined,
                    borderBottomLeftRadius: !isMine ? 4 : undefined,
                  }}
                >
                  {msg.content}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
          </div>
        </div>
      )}

      <div
        className="p-3 flex items-center gap-2"
        style={{ borderTop: '1px solid var(--theme-border)' }}
      >
        <Input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={t('placeholder')}
          className="flex-1"
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!text.trim() || send.isPending}
        >
          <Send size={16} />
        </Button>
      </div>
    </div>
  );
}

function MessagesPageInner() {
  const t = useTranslations('messages');
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('conv'));
  const [showNewMessage, setShowNewMessage] = useState(false);
  const { data: conversations = [] } = useConversations();

  if (!user) return null;

  const selectedConv = conversations.find(c => c.id === selectedId);
  const otherName = selectedConv ? getOtherParticipant(selectedConv, user.id)?.name : undefined;

  const handleConversationCreated = (convId: string) => {
    setShowNewMessage(false);
    setSelectedId(convId);
  };

  return (
    <div className="max-w-5xl mx-auto animate-fade-in" style={{ height: 'calc(100vh - 9rem)' }}>
      <div
        className="rounded-2xl overflow-hidden flex h-full relative"
        style={{
          border: '1px solid var(--theme-border)',
          background: 'var(--theme-surface)',
        }}
      >
        {/* Conversation list */}
        <div
          className={cn(
            'flex-shrink-0 md:w-72 relative',
            selectedId ? 'hidden md:block' : 'w-full',
          )}
          style={{ borderRight: '1px solid var(--theme-border)' }}
        >
          <ConversationList
            conversations={conversations}
            selectedId={selectedId}
            myId={user.id}
            onSelect={setSelectedId}
            onNewMessage={() => setShowNewMessage(true)}
          />
          {showNewMessage && (
            <NewMessageModal
              myId={user.id}
              onConversationCreated={handleConversationCreated}
              onClose={() => setShowNewMessage(false)}
            />
          )}
        </div>

        {/* Thread */}
        <div className={cn('flex-1 flex flex-col', !selectedId && 'hidden md:flex')}>
          {selectedId ? (
            <MessageThread
              conversationId={selectedId}
              myId={user.id}
              otherName={otherName}
              onBack={() => setSelectedId(null)}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <MessageSquare size={40} style={{ color: 'var(--theme-text-muted)', opacity: 0.4 }} />
              <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>
                {t('select')}
              </p>
              <Button size="sm" variant="outline" onClick={() => setShowNewMessage(true)} className="gap-1.5">
                <PenSquare size={13} />
                {t('newShort')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense>
      <MessagesPageInner />
    </Suspense>
  );
}
