'use client';

import { useEffect, useRef, useState } from 'react';
import { AxiosError } from 'axios';
import { Course, ChatMessage, ChatSource, Conversation } from '@/types';
import { courseApi, chatApi } from '@/lib/api';
import { CourseSelect } from '@/features/chat/course-select';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Loader2,
  Send,
  BookOpen,
  Bot,
  User as UserIcon,
  MessageSquare,
  Plus,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function StudentChatPage() {
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    loadCourses();
    loadConversationHistory();
  }, []);

  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) {
      return;
    }

    composer.style.height = '0px';
    const nextHeight = Math.min(composer.scrollHeight, 176);
    composer.style.height = `${nextHeight}px`;
    composer.style.overflowY = composer.scrollHeight > 176 ? 'auto' : 'hidden';
  }, [input]);

  useEffect(() => {
    if (!selectedCourseId) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ block: 'end' });
    });

    return () => cancelAnimationFrame(frame);
  }, [messages, isSending, selectedCourseId]);

  const loadCourses = async () => {
    setIsLoadingCourses(true);
    try {
      const response = await courseApi.getAll();
      setCourses(response.data);
      if (response.data.length > 0 && !selectedCourseId) {
        setSelectedCourseId(response.data[0].course_id);
      }
    } catch (error) {
      toast.error('Failed to load courses');
    } finally {
      setIsLoadingCourses(false);
    }
  };

  const loadConversationHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const response = await chatApi.getHistory();
      setConversations(response.data);
    } catch (error) {
      toast.error('Failed to load chat history');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const loadConversation = async (targetConversation: Conversation) => {
    setIsLoadingConversation(true);
    try {
      const response = await chatApi.getConversation(targetConversation.id);
      setConversationId(targetConversation.id);
      setSelectedCourseId(targetConversation.course_id);
      setMessages(response.data.messages);
    } catch (error) {
      toast.error('Failed to load conversation');
    } finally {
      setIsLoadingConversation(false);
    }
  };

  const handleCourseSelect = (courseId: string) => {
    setSelectedCourseId(courseId);
  };

  const handleNewChat = () => {
    setConversationId(null);
    setMessages([]);
    setInput('');
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await chatApi.deleteConversation(id);
      setConversations((prev) => prev.filter((conversation) => conversation.id !== id));

      if (conversationId === id) {
        handleNewChat();
      }
    } catch (error) {
      toast.error('Failed to delete conversation');
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !selectedCourseId || isSending) return;

    const messageToSend = input;

    const userMessage: ChatMessage = {
      role: 'user',
      content: messageToSend,
      timestamp: new Date().toISOString(),
    };

    const assistantPlaceholder: ChatMessage = {
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      sources: [],
    };

    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    setInput('');
    setIsSending(true);

    try {
      const streamResult = await chatApi.streamMessage(
        {
        course_id: selectedCourseId,
        message: messageToSend,
        conversation_id: conversationId || undefined,
        },
        (chunk) => {
          setMessages((prev) => {
            if (prev.length === 0) return prev;

            const next = [...prev];
            const lastIndex = next.length - 1;
            const last = next[lastIndex];

            if (last?.role !== 'assistant') {
              return prev;
            }

            next[lastIndex] = {
              ...last,
              content: `${last.content}${chunk}`,
            };

            return next;
          });
        }
      );

      const resolvedConversationId = conversationId || streamResult.conversation_id;
      setConversationId(resolvedConversationId);

      setMessages((prev) => {
        if (prev.length === 0) return prev;

        const next = [...prev];
        const lastIndex = next.length - 1;
        const last = next[lastIndex];

        if (last?.role !== 'assistant') {
          return prev;
        }

        next[lastIndex] = {
          ...last,
          sources: streamResult.sources,
        };

        return next;
      });

      await loadConversationHistory();
    } catch (error: unknown) {
      const errorDetail = error instanceof Error ? error.message : undefined;

      toast.error(errorDetail || 'Failed to send message');
      // Remove optimistic user + assistant placeholder messages on error.
      setMessages((prev) => prev.slice(0, -2));
    } finally {
      setIsSending(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendMessage();
  };

  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const selectedCourse = courses.find((c) => c.course_id === selectedCourseId);
  const filteredConversations = selectedCourseId
    ? conversations.filter((conversation) => conversation.course_id === selectedCourseId)
    : conversations;

  const getUniqueSources = (sources?: ChatSource[]) => {
    if (!sources || sources.length === 0) {
      return [];
    }

    const seen = new Set<string>();
    const unique: ChatSource[] = [];

    for (const source of sources) {
      const key = `${source.filename}|${source.page_number ?? 'na'}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      unique.push(source);
    }

    return unique;
  };

  const quickPrompts = [
    `Explain the key concept from ${selectedCourse?.name || 'this course'} in simple steps`,
    `Give me 3 practice questions for ${selectedCourse?.name || 'this subject'}`,
  ];

  return (
    <div className="h-full overflow-hidden bg-background">
      <div className="grid h-full w-full lg:grid-cols-[320px_1fr]">
        <Card className="h-full overflow-hidden rounded-none border-y-0 border-l-0 border-r bg-card text-card-foreground">
          <CardContent className="flex h-full flex-col gap-4 p-3 md:p-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <div className="rounded-md bg-foreground p-1.5 text-background">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <p className="text-sm font-semibold">ThinkMate Tutor</p>
              </div>

              <Button
                onClick={handleNewChat}
                className="w-full justify-start gap-2 rounded-xl border border-border bg-card text-foreground shadow-sm hover:bg-muted"
                size="lg"
              >
                <Plus className="h-4 w-4" />
                New Thread
              </Button>

              <div className="rounded-xl border border-border bg-muted/40 p-2">
                <CourseSelect
                  courses={courses}
                  selectedCourseId={selectedCourseId}
                  onSelect={handleCourseSelect}
                />
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
              <span>Conversations</span>
              {(isLoadingCourses || isLoadingHistory) && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            </div>

            <ScrollArea className="flex-1 pr-1">
              <div className="space-y-2">
                {!selectedCourseId ? (
                  <p className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
                    Select a course to view its chats.
                  </p>
                ) : filteredConversations.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
                    No chats yet for this course.
                  </p>
                ) : (
                  filteredConversations.map((conversation) => (
                    <div
                      key={conversation.id}
                      onClick={() => loadConversation(conversation)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          loadConversation(conversation);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      className={cn(
                        'w-full rounded-xl border p-3 text-left transition-colors',
                        conversationId === conversation.id
                          ? 'border-primary/50 bg-primary/10'
                          : 'border-border bg-background hover:bg-muted/60'
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <MessageSquare className="mt-0.5 h-4 w-4 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{conversation.last_message}</p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{conversation.course_name}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteConversation(conversation.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="relative h-full overflow-hidden rounded-none border-0 bg-background text-foreground">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.12),transparent_55%)] dark:bg-[radial-gradient(circle_at_top,rgba(40,50,70,0.25),transparent_55%)]" />
          <CardContent className="relative flex h-full flex-col p-0">
            {!selectedCourseId ? (
              <div className="flex flex-1 items-center justify-center p-8">
                <div className="text-center">
                  <BookOpen className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-3 text-sm text-muted-foreground">Choose a course to start chatting.</p>
                </div>
              </div>
            ) : selectedCourse?.document_count === 0 ? (
              <div className="flex flex-1 items-center justify-center p-8">
                <div className="text-center">
                  <BookOpen className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-3 text-sm text-muted-foreground">This course does not have uploaded materials yet.</p>
                </div>
              </div>
            ) : (
              <>
                <ScrollArea className="flex-1 px-4 py-5 md:px-6">
                  <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 pb-28 md:pb-32">
                    {messages.length === 0 ? (
                      <div className="space-y-5 pt-8 md:pt-16">
                        <div>
                          <h2 className="text-3xl font-semibold tracking-tight">Hello there!</h2>
                          <p className="mt-2 text-xl text-muted-foreground">How can I help you today?</p>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          {quickPrompts.map((prompt) => (
                            <Button
                              key={prompt}
                              type="button"
                              variant="ghost"
                              className="h-auto justify-start rounded-2xl border border-border bg-card px-4 py-3 text-left text-sm hover:bg-muted"
                              onClick={() => setInput(prompt)}
                            >
                              {prompt}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      messages.map((message, index) => (
                        <div
                          key={index}
                          className={cn(
                            'flex w-full items-start gap-3',
                            message.role === 'user' ? 'justify-end' : 'justify-start'
                          )}
                        >
                          {message.role === 'assistant' && (
                            <Avatar className="mt-1 h-8 w-8 border border-border bg-muted">
                              <AvatarFallback className="bg-muted text-foreground">
                                <Bot className="h-4 w-4" />
                              </AvatarFallback>
                            </Avatar>
                          )}

                          <div
                            className={cn(
                              'rounded-2xl px-4 py-3 text-sm shadow-sm',
                              message.role === 'user'
                                ? 'ml-auto max-w-[72%] bg-primary text-primary-foreground'
                                : 'mr-auto max-w-[74%] border border-border bg-card text-card-foreground'
                            )}
                          >
                            <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>

                            {message.role === 'assistant' && getUniqueSources(message.sources).length > 0 && (
                              <div className="mt-3 border-t border-border pt-2">
                                <p className="mb-2 text-xs font-medium text-muted-foreground">Sources</p>
                                <div className="flex flex-wrap gap-2">
                                  {getUniqueSources(message.sources).map((source, sourceIndex) => (
                                    <span
                                      key={`${source.filename}-${source.page_number ?? 'na'}-${sourceIndex}`}
                                      className="rounded-full border border-border bg-muted px-2 py-1 text-xs text-muted-foreground"
                                    >
                                      {source.filename}
                                      {source.page_number ? ` (p. ${source.page_number})` : ''}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {message.role === 'user' && (
                            <Avatar className="mt-1 h-8 w-8 border border-border bg-primary/15">
                              <AvatarFallback className="bg-primary/15 text-primary">
                                <UserIcon className="h-4 w-4" />
                              </AvatarFallback>
                            </Avatar>
                          )}
                        </div>
                      ))
                    )}

                    {isSending && (
                      <div className="flex gap-3">
                        <Avatar className="mt-1 h-8 w-8 border border-border bg-muted">
                          <AvatarFallback className="bg-muted text-foreground">
                            <Bot className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="rounded-2xl border border-border bg-card px-4 py-3">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      </div>
                    )}

                    <div ref={messagesEndRef} className="h-px" />
                  </div>
                </ScrollArea>

                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-3 pb-3 md:px-6 md:pb-5">
                  <div className="pointer-events-none mx-auto h-14 w-full max-w-5xl rounded-full bg-[linear-gradient(to_top,hsl(var(--background))_35%,transparent)]" />
                  <form
                    onSubmit={handleSendMessage}
                    className="pointer-events-auto mx-auto -mt-10 flex w-full max-w-5xl items-end gap-2 rounded-3xl border border-border bg-card/85 p-2 shadow-lg backdrop-blur"
                  >
                    <textarea
                      ref={composerRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleComposerKeyDown}
                      placeholder={selectedCourse ? `Send a message about ${selectedCourse.name}...` : 'Select course first'}
                      disabled={isSending || !selectedCourseId}
                      rows={1}
                      className="max-h-44 min-h-10 flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm leading-6 placeholder:text-muted-foreground focus-visible:outline-none"
                    />
                    <Button
                      type="submit"
                      size="icon"
                      className="h-10 w-10 rounded-full"
                      disabled={isSending || !input.trim() || !selectedCourseId}
                    >
                      {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </form>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
