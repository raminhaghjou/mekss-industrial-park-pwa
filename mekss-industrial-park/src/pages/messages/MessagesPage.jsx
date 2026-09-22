import { useEffect, useMemo, useState } from 'react';
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
  Chip,
} from '@heroui/react';
import { Bell, CheckCheck, MessageSquare, PenSquare, Reply, Send, Siren, Users } from 'lucide-react';
import { messageApi } from '../../services/api/message.api';
import { filesApi } from '../../services/api/files.api';
import { FileUploader } from '../../components/common/FileUploader';
import { useAuth } from '../../providers/AuthProvider';
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';
import { EmptyState } from '../../components/common/EmptyState';
import { messageStatusLabels } from '../../constants/persianLabels';

const roleRecipientLabels = {
  PARK_MANAGER: 'مدیر شهرک',
  FACTORY_OWNER: 'مدیر واحد',
  EMPLOYEE: 'کارمند',
  SUPER_ADMIN: 'ادمین',
  SECURITY_GUARD: 'نگهبان',
};

const audienceOptionsByRole = {
  SUPER_ADMIN: [
    { value: 'DIRECT', label: 'یک نفر مشخص' },
    { value: 'SYSTEM_ALL', label: 'همه سامانه (مدیران، کارمندان، نگهبانان همه شهرک‌ها)' },
  ],
  PARK_MANAGER: [
    { value: 'DIRECT', label: 'یک نفر مشخص' },
    { value: 'PARK_ALL', label: 'کل شهرک (مدیران واحد + نگهبانی)' },
    { value: 'FACTORY_UNIT', label: 'یک واحد صنعتی (مدیر + کارمندان همان واحد)' },
  ],
  FACTORY_OWNER: [
    { value: 'DIRECT', label: 'یک نفر مشخص' },
    { value: 'FACTORY_EMPLOYEES', label: 'همه کارمندان واحد من' },
  ],
  EMPLOYEE: [
    { value: 'DIRECT', label: 'یک نفر مشخص' },
  ],
};

const audienceHelp = {
  SYSTEM_ALL: 'پیام برای تمام کاربران فعال سامانه در همه شهرک‌ها ارسال می‌شود.',
  PARK_ALL: 'پیام فقط برای مدیران واحدهای صنعتی و نگهبانان همین شهرک ارسال می‌شود.',
  FACTORY_UNIT: 'پیام فقط برای مدیر و کارمندان همان واحد صنعتی انتخاب‌شده ارسال می‌شود.',
  FACTORY_EMPLOYEES: 'پیام برای تمام کارمندان واحد(های) صنعتی شما ارسال می‌شود.',
};

const notificationTypeMeta = {
  EMERGENCY: { label: 'اضطراری', color: 'danger', icon: Siren },
  WARNING: { label: 'هشدار', color: 'warning', icon: Bell },
  SUCCESS: { label: 'موفق', color: 'success', icon: Bell },
  INFO: { label: 'اطلاع', color: 'accent', icon: Bell },
};

export const MessagesPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();
  const [tab, setTab] = useState('inbox');
  const [selectedId, setSelectedId] = useState(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [compose, setCompose] = useState({
    audience: 'DIRECT',
    receiverId: '',
    factoryId: '',
    subject: '',
    body: '',
    attachmentIds: [],
  });
  const [messageSearch, setMessageSearch] = useState('');
  const [messageFromDate, setMessageFromDate] = useState('');
  const [messageToDate, setMessageToDate] = useState('');

  const messageQueryParams = useMemo(() => ({
    ...(messageSearch.trim() ? { search: messageSearch.trim() } : {}),
    ...(messageFromDate ? { fromDate: messageFromDate } : {}),
    ...(messageToDate ? { toDate: messageToDate } : {}),
  }), [messageSearch, messageFromDate, messageToDate]);

  const audienceOptions = audienceOptionsByRole[user?.role] || audienceOptionsByRole.EMPLOYEE;
  const [tabBootstrapped, setTabBootstrapped] = useState(false);

  const unreadQuery = useQuery({
    queryKey: ['messages', 'unread-count'],
    queryFn: () => messageApi.getUnreadCount().then((res) => res.data),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (tabBootstrapped || unreadQuery.isLoading || !unreadQuery.data) return;
    const messagesCount = Number(unreadQuery.data.messages || 0);
    const notificationsCount = Number(unreadQuery.data.notifications || 0);
    if (messagesCount === 0 && notificationsCount > 0) {
      setTab('notifications');
    }
    setTabBootstrapped(true);
  }, [tabBootstrapped, unreadQuery.data, unreadQuery.isLoading]);

  const inboxQuery = useQuery({
    queryKey: ['messages', 'inbox', messageQueryParams],
    queryFn: () => messageApi.getInbox(messageQueryParams).then((res) => res.data),
  });

  const sentQuery = useQuery({
    queryKey: ['messages', 'sent', messageQueryParams],
    queryFn: () => messageApi.getSent(messageQueryParams).then((res) => res.data),
    enabled: tab === 'sent',
  });

  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: () => messageApi.getNotifications().then((res) => res.data || []),
  });

  const recipientsQuery = useQuery({
    queryKey: ['messages', 'recipients'],
    queryFn: () => messageApi.getRecipients().then((res) => res.data || []),
    enabled: composeOpen,
  });

  const messages = tab === 'inbox' ? (inboxQuery.data || []) : tab === 'sent' ? (sentQuery.data || []) : [];
  const notifications = notificationsQuery.data || [];
  const isLoading = tab === 'inbox'
    ? inboxQuery.isLoading
    : tab === 'sent'
      ? sentQuery.isLoading
      : notificationsQuery.isLoading;
  const isError = tab === 'inbox'
    ? inboxQuery.isError
    : tab === 'sent'
      ? sentQuery.isError
      : notificationsQuery.isError;
  const error = tab === 'inbox'
    ? inboxQuery.error
    : tab === 'sent'
      ? sentQuery.error
      : notificationsQuery.error;
  const recipients = recipientsQuery.data || [];
  const factoryOptions = useMemo(() => {
    const map = new Map();
    for (const person of recipients) {
      if (person.factoryId && person.factoryName) {
        map.set(person.factoryId, person.factoryName);
      }
    }
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'fa'));
  }, [recipients]);

  const unreadMessages = Number(unreadQuery.data?.messages || 0);
  const unreadNotifications = Number(unreadQuery.data?.notifications || 0);

  const selectedMessage = useMemo(
    () => (tab === 'notifications' ? null : messages.find((msg) => msg.id === selectedId) || null),
    [messages, selectedId, tab],
  );
  const selectedNotification = useMemo(
    () => (tab === 'notifications' ? notifications.find((item) => item.id === selectedId) || null : null),
    [notifications, selectedId, tab],
  );

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['messages'] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['messages', 'unread-count'] });
  };

  const markReadMutation = useMutation({
    mutationFn: (id) => messageApi.markRead(id),
    onSuccess: invalidateAll,
  });

  const markNotificationReadMutation = useMutation({
    mutationFn: (id) => messageApi.markNotificationRead(id),
    onSuccess: invalidateAll,
  });

  const markAllNotificationsReadMutation = useMutation({
    mutationFn: () => messageApi.markAllNotificationsRead(),
    onSuccess: () => {
      showNotification('همه اعلان‌ها خوانده شد', 'success');
      invalidateAll();
    },
    onError: (err) => showNotification(getErrorMessage(err, 'خواندن اعلان‌ها ناموفق بود'), 'error'),
  });

  const sendMutation = useMutation({
    mutationFn: (payload) => {
      if (payload.audience === 'DIRECT') {
        return messageApi.sendMessage({
          receiverId: payload.receiverId,
          subject: payload.subject,
          body: payload.body,
          attachments: payload.attachmentIds?.length ? payload.attachmentIds : undefined,
        });
      }
      return messageApi.broadcastMessage({
        subject: payload.subject,
        body: payload.body,
        audience: payload.audience,
        factoryId: payload.factoryId || undefined,
      });
    },
    onSuccess: (res, variables) => {
      if (variables.audience === 'DIRECT') {
        showNotification('پیام ارسال شد', 'success');
      } else {
        const sentCount = res?.data?.sentCount ?? 0;
        showNotification(`پیام برای ${sentCount.toLocaleString('fa-IR')} گیرنده ارسال شد`, 'success');
      }
      setComposeOpen(false);
      setCompose({ audience: 'DIRECT', receiverId: '', factoryId: '', subject: '', body: '', attachmentIds: [] });
      invalidateAll();
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

  const openNotification = (item) => {
    setSelectedId(item.id);
    setComposeOpen(false);
    if (!item.isRead) {
      markNotificationReadMutation.mutate(item.id);
    }
  };

  const startReply = () => {
    if (!selectedMessage) return;
    const receiverId = tab === 'inbox'
      ? selectedMessage.senderId || selectedMessage.sender?.id
      : selectedMessage.receiverId || selectedMessage.receiver?.id;
    setCompose({
      audience: 'DIRECT',
      receiverId: receiverId || '',
      factoryId: '',
      subject: selectedMessage.subject?.startsWith('باز:') ? selectedMessage.subject : `باز: ${selectedMessage.subject || ''}`,
      body: '',
      attachmentIds: [],
    });
    setComposeOpen(true);
  };

  const startCompose = (audience = 'DIRECT') => {
    setSelectedId(null);
    setCompose({ audience, receiverId: '', factoryId: '', subject: '', body: '' });
    setComposeOpen(true);
  };

  const tabs = [
    { id: 'inbox', label: 'پیام‌های دریافتی', badge: unreadMessages },
    { id: 'notifications', label: 'اعلان‌ها', badge: unreadNotifications },
    { id: 'sent', label: 'ارسال‌شده', badge: 0 },
  ];

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="page-toolbar">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">پیام‌ها و اعلان‌ها</h1>
          <p className="mt-1 text-sm text-foreground-500">
            پیام‌های شخصی و اعلان‌های سیستمی (اطلاعیه، اضطراری و ...) در یکجا
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {user?.role === 'SUPER_ADMIN' && (
            <Button variant="secondary" className="gap-2 font-bold" onPress={() => startCompose('SYSTEM_ALL')}>
              <Users className="h-4 w-4" />
              پیام به همه سامانه
            </Button>
          )}
          {user?.role === 'PARK_MANAGER' && (
            <Button variant="secondary" className="gap-2 font-bold" onPress={() => startCompose('PARK_ALL')}>
              <Users className="h-4 w-4" />
              پیام به کل شهرک
            </Button>
          )}
          {user?.role === 'FACTORY_OWNER' && (
            <Button variant="secondary" className="gap-2 font-bold" onPress={() => startCompose('FACTORY_EMPLOYEES')}>
              <Users className="h-4 w-4" />
              پیام به همه کارمندان
            </Button>
          )}
          <Button variant="primary" className="gap-2 font-bold" onPress={() => startCompose('DIRECT')}>
            <PenSquare className="h-4 w-4" />
            پیام جدید
          </Button>
        </div>
      </div>

      {(tab === 'inbox' || tab === 'sent') && (
        <Card className="rounded-2xl border border-default-200">
          <CardContent className="grid gap-3 p-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1 sm:col-span-1">
              <Label className="text-xs">جستجو (موضوع / متن)</Label>
              <Input
                value={messageSearch}
                onChange={(e) => setMessageSearch(e.target.value)}
                placeholder="موضوع یا متن پیام..."
                className="rounded-xl"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">از تاریخ</Label>
              <Input type="date" dir="ltr" value={messageFromDate} onChange={(e) => setMessageFromDate(e.target.value)} className="rounded-xl" />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">تا تاریخ</Label>
              <Input type="date" dir="ltr" value={messageToDate} onChange={(e) => setMessageToDate(e.target.value)} className="rounded-xl" />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="inline-flex flex-wrap rounded-xl bg-default-100 p-1">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => { setTab(item.id); setSelectedId(null); setComposeOpen(false); }}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === item.id ? 'bg-white text-[var(--color-brand)] shadow-sm' : 'text-foreground-600'
            }`}
          >
            <span className="inline-flex items-center gap-2">
              {item.label}
              {item.badge > 0 && (
                <span className="rounded-full bg-[var(--color-brand)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Card className="rounded-2xl border border-default-200">
          <CardContent className="p-0">
            {tab === 'notifications' && unreadNotifications > 0 && (
              <div className="flex justify-end border-b border-default-100 px-3 py-2">
                <Button
                  size="sm"
                  variant="tertiary"
                  className="gap-1.5"
                  onPress={() => markAllNotificationsReadMutation.mutate()}
                  isDisabled={markAllNotificationsReadMutation.isPending}
                >
                  <CheckCheck className="h-4 w-4" />
                  خواندن همه
                </Button>
              </div>
            )}
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
            ) : tab === 'notifications' ? (
              notifications.length === 0 ? (
                <EmptyState
                  icon={<Bell className="h-6 w-6" />}
                  title="اعلانی وجود ندارد"
                  description="اعلان‌های سیستمی مثل هشدار اضطراری و اطلاعیه‌ها اینجا نمایش داده می‌شوند."
                />
              ) : (
                <ul className="divide-y divide-default-100">
                  {notifications.map((item) => {
                    const meta = notificationTypeMeta[item.type] || notificationTypeMeta.INFO;
                    const Icon = meta.icon;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => openNotification(item)}
                          className={`flex w-full items-start gap-3 px-4 py-3.5 text-start transition hover:bg-default-50 ${
                            selectedId === item.id ? 'bg-[var(--color-brand-soft)]' : ''
                          }`}
                        >
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                            item.type === 'EMERGENCY' ? 'bg-danger-100 text-danger-700' : 'bg-[var(--color-brand-soft)] text-[var(--color-brand)]'
                          }`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className={`truncate ${!item.isRead ? 'font-bold text-foreground' : 'font-medium'}`}>
                                {item.title}
                              </span>
                              <span className="shrink-0 text-[11px] text-foreground-500">
                                {new Date(item.createdAt).toLocaleDateString('fa-IR')}
                              </span>
                            </div>
                            <div className="mt-1 flex items-center gap-2">
                              <Chip size="sm" color={meta.color} variant="soft">{meta.label}</Chip>
                              {!item.isRead && <span className="text-[11px] font-medium text-[var(--color-brand)]">خوانده‌نشده</span>}
                            </div>
                            <p className="mt-1 line-clamp-1 text-sm text-foreground-500">{item.body}</p>
                          </div>
                          {!item.isRead && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--color-brand)]" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )
            ) : messages.length === 0 ? (
              <EmptyState
                icon={<MessageSquare className="h-6 w-6" />}
                title="هیچ پیامی وجود ندارد"
                description={tab === 'inbox' ? 'پیام‌های شخصی دریافتی اینجا نمایش داده می‌شوند.' : 'هنوز پیامی ارسال نکرده‌اید.'}
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
                          unread ? 'bg-warning-50/90 border-s-4 border-warning-400' : ''
                        } ${
                          selectedId === msg.id ? 'bg-[var(--color-brand-soft)]' : ''
                        }`}
                      >
                        <Avatar size="sm" className="bg-[var(--color-brand-soft)] text-[var(--color-brand)] shrink-0">
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
                        {unread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-warning-500" />}
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
                  if (!compose.subject.trim() || !compose.body.trim()) {
                    showNotification('موضوع و متن الزامی است', 'error');
                    return;
                  }
                  if (compose.audience === 'DIRECT' && !compose.receiverId) {
                    showNotification('گیرنده را انتخاب کنید', 'error');
                    return;
                  }
                  if (compose.audience === 'FACTORY_UNIT' && !compose.factoryId) {
                    showNotification('واحد صنعتی را انتخاب کنید', 'error');
                    return;
                  }
                  sendMutation.mutate(compose);
                }}
              >
                <h2 className="text-lg font-bold">ارسال پیام</h2>

                <div className="flex flex-col gap-1">
                  <Label className="text-xs">سطح ارسال</Label>
                  <select
                    value={compose.audience}
                    onChange={(e) => setCompose((p) => ({
                      ...p,
                      audience: e.target.value,
                      receiverId: '',
                      factoryId: e.target.value === 'FACTORY_UNIT' ? p.factoryId : '',
                    }))}
                    className="h-11 w-full rounded-xl border border-default-200 bg-default-50 px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
                  >
                    {audienceOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                {compose.audience !== 'DIRECT' && audienceHelp[compose.audience] && (
                  <Alert status="accent">
                    <AlertContent>
                      <AlertTitle>محدوده ارسال</AlertTitle>
                      <AlertDescription>{audienceHelp[compose.audience]}</AlertDescription>
                    </AlertContent>
                  </Alert>
                )}

                {compose.audience === 'DIRECT' && (
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">گیرنده</Label>
                    <select
                      required
                      value={compose.receiverId}
                      onChange={(e) => setCompose((p) => ({ ...p, receiverId: e.target.value }))}
                      className="h-11 w-full rounded-xl border border-default-200 bg-default-50 px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
                    >
                      <option value="">انتخاب از لیست مجاز نقش شما</option>
                      {recipients.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.name}
                          {person.factoryName ? ` · ${person.factoryName}` : ''}
                          {' — '}
                          {roleRecipientLabels[person.role] || person.role}
                          {' ('}
                          {person.phoneNumber}
                          {')'}
                        </option>
                      ))}
                    </select>
                    {recipientsQuery.isLoading && <p className="text-[11px] text-foreground-400">در حال بارگذاری گیرندگان...</p>}
                    {!recipientsQuery.isLoading && recipients.length === 0 && (
                      <p className="text-[11px] text-danger">گیرنده‌ای در حوزه دسترسی شما یافت نشد.</p>
                    )}
                  </div>
                )}

                {compose.audience === 'FACTORY_UNIT' && (
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">واحد صنعتی</Label>
                    <select
                      required
                      value={compose.factoryId}
                      onChange={(e) => setCompose((p) => ({ ...p, factoryId: e.target.value }))}
                      className="h-11 w-full rounded-xl border border-default-200 bg-default-50 px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
                    >
                      <option value="">انتخاب واحد</option>
                      {factoryOptions.map((factory) => (
                        <option key={factory.id} value={factory.id}>{factory.name}</option>
                      ))}
                    </select>
                    {!recipientsQuery.isLoading && factoryOptions.length === 0 && (
                      <p className="text-[11px] text-danger">واحد صنعتی فعالی در شهرک شما یافت نشد.</p>
                    )}
                  </div>
                )}

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
                {compose.audience === 'DIRECT' && (
                  <div className="flex flex-col gap-2">
                    <FileUploader
                      domain="message"
                      label="افزودن پیوست"
                      hint="تصویر یا PDF — حداکثر ۵ فایل"
                      value={null}
                      onUploaded={(file) => setCompose((p) => ({
                        ...p,
                        attachmentIds: [...new Set([...(p.attachmentIds || []), file.id])].slice(0, 5),
                      }))}
                    />
                    {(compose.attachmentIds || []).length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {compose.attachmentIds.map((id) => (
                          <Button
                            key={id}
                            size="sm"
                            variant="tertiary"
                            className="rounded-full"
                            onPress={() => setCompose((p) => ({
                              ...p,
                              attachmentIds: (p.attachmentIds || []).filter((item) => item !== id),
                            }))}
                          >
                            حذف پیوست
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button
                    variant="tertiary"
                    onPress={() => {
                      setComposeOpen(false);
                      setCompose({ audience: 'DIRECT', receiverId: '', factoryId: '', subject: '', body: '', attachmentIds: [] });
                    }}
                  >
                    انصراف
                  </Button>
                  <Button type="submit" variant="primary" className="gap-2 font-bold" isDisabled={sendMutation.isPending}>
                    {sendMutation.isPending ? <Spinner size="sm" /> : <Send className="h-4 w-4" />}
                    {compose.audience === 'DIRECT' ? 'ارسال' : 'ارسال گروهی'}
                  </Button>
                </div>
              </form>
            ) : selectedNotification ? (
              <div className="animate-fade-in">
                <div className="mb-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Chip
                      size="sm"
                      color={(notificationTypeMeta[selectedNotification.type] || notificationTypeMeta.INFO).color}
                      variant="soft"
                    >
                      {(notificationTypeMeta[selectedNotification.type] || notificationTypeMeta.INFO).label}
                    </Chip>
                    {!selectedNotification.isRead && (
                      <Chip size="sm" color="accent" variant="soft">خوانده‌نشده</Chip>
                    )}
                  </div>
                  <h2 className="text-lg font-bold">{selectedNotification.title}</h2>
                  <p className="mt-1 text-xs text-foreground-500">
                    {new Date(selectedNotification.createdAt).toLocaleString('fa-IR')}
                  </p>
                </div>
                <div className="whitespace-pre-wrap rounded-xl bg-default-50 p-4 text-sm leading-7 text-foreground">
                  {selectedNotification.body}
                </div>
              </div>
            ) : selectedMessage ? (
              <div className="animate-fade-in">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold">{selectedMessage.subject}</h2>
                    <p className="mt-1 text-xs text-foreground-500">
                      {(tab === 'inbox' ? selectedMessage.sender?.name : selectedMessage.receiver?.name) || 'کاربر'}
                      {' · '}
                      {new Date(selectedMessage.createdAt).toLocaleString('fa-IR')}
                    </p>
                  </div>
                  <Button size="sm" variant="tertiary" className="gap-1.5" onPress={startReply}>
                    <Reply className="h-4 w-4" />
                    پاسخ
                  </Button>
                </div>
                <div className="whitespace-pre-wrap rounded-xl bg-default-50 p-4 text-sm leading-7 text-foreground">
                  {selectedMessage.body || selectedMessage.content}
                </div>
                {(selectedMessage.attachments || []).length > 0 && (
                  <ul className="mt-4 flex flex-col gap-2">
                    {(selectedMessage.attachments || []).map((fileId) => (
                      <li key={fileId}>
                        <Button
                          size="sm"
                          variant="tertiary"
                          className="rounded-xl"
                          onPress={() => filesApi.download(fileId, `attachment-${fileId}`)}
                        >
                          دانلود پیوست
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <EmptyState
                icon={<MessageSquare className="h-6 w-6" />}
                title="موردی انتخاب نشده"
                description="یک پیام یا اعلان را از فهرست انتخاب کنید، یا پیام جدید بنویسید."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MessagesPage;
