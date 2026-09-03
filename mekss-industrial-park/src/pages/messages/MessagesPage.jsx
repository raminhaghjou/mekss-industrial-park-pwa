import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  Avatar,
  Skeleton,
  Alert,
  AlertContent,
  AlertTitle,
  AlertDescription,
  Button,
  Input,
  TextArea,
  Label,
  Spinner,
} from '@heroui/react';
import { MessageSquare, PenSquare, Reply, Send } from 'lucide-react';
import { messageApi } from '../../services/api/message.api';
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';
import { EmptyState } from '../../components/common/EmptyState';
import { messageStatusLabels } from '../../constants/persianLabels';

export const MessagesPage = () => {
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();
  const [tab, setTab] = useState('inbox');
  const [selectedId, setSelectedId] = useState(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [compose, setCompose] = useState({ receiverId: '', subject: '', body: '' });

  const inboxQuery = useQuery({
    queryKey: ['messages', 'inbox'],
    queryFn: () => messageApi.getInbox().then((res) => res.data),
  });

  const sentQuery = useQuery({
    queryKey: ['messages', 'sent'],
    queryFn: () => messageApi.getSent().then((res) => res.data),
    enabled: tab === 'sent',
  });

  const messages = tab === 'inbox' ? (inboxQuery.data || []) : (sentQuery.data || []);
  const isLoading = tab === 'inbox' ? inboxQuery.isLoading : sentQuery.isLoading;
  const isError = tab === 'inbox' ? inboxQuery.isError : sentQuery.isError;
  const error = tab === 'inbox' ? inboxQuery.error : sentQuery.error;

  const selected = useMemo(
    () => messages.find((msg) => msg.id === selectedId) || null,
    [messages, selectedId],
  );

  const markReadMutation = useMutation({
    mutationFn: (id) => messageApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['messages', 'unread-count'] });
    },
  });

  const sendMutation = useMutation({
    mutationFn: (payload) => messageApi.sendMessage(payload),
    onSuccess: () => {
      showNotification('پیام ارسال شد', 'success');
      setComposeOpen(false);
      setCompose({ receiverId: '', subject: '', body: '' });
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
    onError: (err) => showNotification(getErrorMessage(err, 'ارسال پیام ناموفق بود'), 'error'),
  });

  const openMessage = (msg) => {
    setSelectedId(msg.id);
    setComposeOpen(false);
    if (tab === 'inbox' && msg.status === 'UNREAD') {
      markReadMutation.mutate(msg.id);
    }
  };

  const startReply = () => {
    if (!selected) return;
    const receiverId = tab === 'inbox' ? selected.senderId || selected.sender?.id : selected.receiverId || selected.receiver?.id;
    setCompose({
      receiverId: receiverId || '',
      subject: selected.subject?.startsWith('باز:') ? selected.subject : `باز: ${selected.subject || ''}`,
      body: '',
    });
    setComposeOpen(true);
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="page-toolbar">
        <h1 className="text-xl font-bold sm:text-2xl">پیام‌ها</h1>
        <Button variant="primary" className="gap-2 font-bold" onPress={() => { setComposeOpen(true); setSelectedId(null); }}>
          <PenSquare className="h-4 w-4" />
          پیام جدید
        </Button>
      </div>

      <div className="inline-flex rounded-xl bg-default-100 p-1">
        {[
          { id: 'inbox', label: 'دریافتی' },
          { id: 'sent', label: 'ارسال‌شده' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => { setTab(item.id); setSelectedId(null); setComposeOpen(false); }}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === item.id ? 'bg-white text-[#0f4c81] shadow-sm' : 'text-foreground-600'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Card className="rounded-2xl border border-default-200">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex flex-col gap-2 p-4">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
              </div>
            ) : isError ? (
              <Alert status="danger">
                <AlertContent>
                  <AlertTitle>خطا در دریافت اطلاعات</AlertTitle>
                  <AlertDescription>{getErrorMessage(error, 'دریافت پیام‌ها ناموفق بود.')}</AlertDescription>
                </AlertContent>
              </Alert>
            ) : messages.length === 0 ? (
              <EmptyState
                icon={<MessageSquare className="h-6 w-6" />}
                title="هیچ پیامی وجود ندارد"
                description={tab === 'inbox' ? 'پیام‌های دریافتی اینجا نمایش داده می‌شوند.' : 'هنوز پیامی ارسال نکرده‌اید.'}
              />
            ) : (
              <ul className="divide-y divide-default-100">
                {messages.map((msg) => {
                  const unread = tab === 'inbox' && msg.status === 'UNREAD';
                  const peer = tab === 'inbox' ? msg.sender : msg.receiver;
                  return (
                    <li key={msg.id}>
                      <button
                        type="button"
                        onClick={() => openMessage(msg)}
                        className={`flex w-full items-start gap-3 px-4 py-3.5 text-start transition hover:bg-default-50 ${
                          selectedId === msg.id ? 'bg-[#0f4c81]/5' : ''
                        }`}
                      >
                        <Avatar size="sm" className="bg-[#0f4c81]/10 text-[#0f4c81] shrink-0">
                          <Avatar.Fallback>{peer?.name?.charAt(0) || 'M'}</Avatar.Fallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`truncate ${unread ? 'font-bold text-foreground' : 'font-medium'}`}>
                              {msg.subject}
                            </span>
                            <span className="shrink-0 text-[11px] text-foreground-500">
                              {new Date(msg.createdAt).toLocaleDateString('fa-IR')}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-foreground-500">
                            {peer?.name || 'کاربر'} · {messageStatusLabels[msg.status] || msg.status}
                          </p>
                          <p className="mt-1 line-clamp-1 text-sm text-foreground-500">
                            {(msg.body || msg.content || '').slice(0, 100)}
                          </p>
                        </div>
                        {unread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#0f4c81]" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-default-200">
          <CardContent className="p-5">
            {composeOpen ? (
              <form
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!compose.receiverId || !compose.subject.trim() || !compose.body.trim()) {
                    showNotification('شناسه گیرنده، موضوع و متن الزامی است', 'error');
                    return;
                  }
                  sendMutation.mutate(compose);
                }}
              >
                <h2 className="text-lg font-bold">ارسال پیام</h2>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">شناسه گیرنده</Label>
                  <Input
                    dir="ltr"
                    value={compose.receiverId}
                    onChange={(e) => setCompose((p) => ({ ...p, receiverId: e.target.value }))}
                    className="rounded-xl"
                    placeholder="شناسه کاربر"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">موضوع</Label>
                  <Input
                    value={compose.subject}
                    onChange={(e) => setCompose((p) => ({ ...p, subject: e.target.value }))}
                    className="rounded-xl"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">متن پیام</Label>
                  <TextArea
                    rows={6}
                    value={compose.body}
                    onChange={(e) => setCompose((p) => ({ ...p, body: e.target.value }))}
                    className="rounded-xl"
                    required
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="tertiary" onPress={() => setComposeOpen(false)}>انصراف</Button>
                  <Button type="submit" variant="primary" className="gap-2 font-bold" isDisabled={sendMutation.isPending}>
                    {sendMutation.isPending ? <Spinner size="sm" /> : <Send className="h-4 w-4" />}
                    ارسال
                  </Button>
                </div>
              </form>
            ) : selected ? (
              <div className="animate-fade-in">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold">{selected.subject}</h2>
                    <p className="mt-1 text-xs text-foreground-500">
                      {(tab === 'inbox' ? selected.sender?.name : selected.receiver?.name) || 'کاربر'}
                      {' · '}
                      {new Date(selected.createdAt).toLocaleString('fa-IR')}
                    </p>
                  </div>
                  <Button size="sm" variant="tertiary" className="gap-1.5" onPress={startReply}>
                    <Reply className="h-4 w-4" />
                    پاسخ
                  </Button>
                </div>
                <div className="whitespace-pre-wrap rounded-xl bg-default-50 p-4 text-sm leading-7 text-foreground">
                  {selected.body || selected.content}
                </div>
              </div>
            ) : (
              <EmptyState
                icon={<MessageSquare className="h-6 w-6" />}
                title="پیامی انتخاب نشده"
                description="یک پیام از فهرست انتخاب کنید یا پیام جدید بنویسید."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MessagesPage;
