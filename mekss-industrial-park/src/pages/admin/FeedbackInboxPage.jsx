import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  Input,
  Button,
  Chip,
  Spinner,
  Alert,
  AlertContent,
  AlertTitle,
  AlertDescription,
} from '@heroui/react';
import { Search, Phone, Building2, Globe, ChevronRight, ChevronLeft, RotateCw } from 'lucide-react';
import { feedbackApi } from '../../services/api/feedback.api';
import { useAuth } from '../../providers/AuthProvider';
import { EmptyState } from '../../components/common/EmptyState';
import { getErrorMessage } from '../../utils/apiError';
import { roleLabels, labelFor } from '../../constants/persianLabels';
const PAGE_SIZE = 20;
const faNumber = new Intl.NumberFormat('fa-IR');

const TARGET_FILTERS = [
  { id: '', label: 'همه' },
  { id: 'PLATFORM', label: 'مدیریت سامانه' },
  { id: 'PARK', label: 'شهرک‌ها' },
];

const formatDate = (value) => (value
  ? new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '—');

const senderUnits = (sender) => {
  const units = [
    ...(sender?.managedFactories || []),
    ...(sender?.employeeOfFactory ? [sender.employeeOfFactory] : []),
  ];
  return [...new Map(units.map((unit) => [unit.id, unit.name])).values()].join('، ');
};

const FeedbackCard = ({ item }) => {
  const units = senderUnits(item.sender);
  return (
    <Card className="rounded-2xl border border-default-200 dark:border-white/10">
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-base font-bold text-foreground break-words">{item.subject}</h2>
          {item.recipientPark ? (
            <Chip size="sm" variant="soft" color="accent" className="font-medium">
              <Building2 className="me-1 inline h-3.5 w-3.5" />
              {item.recipientPark.name}
            </Chip>
          ) : (
            <Chip size="sm" variant="soft" className="font-medium">
              <Globe className="me-1 inline h-3.5 w-3.5" />
              مدیریت سامانه
            </Chip>
          )}
        </div>
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground-700">{item.body}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-default-100 pt-3 text-xs text-foreground-500 dark:border-white/10">
          <span className="font-semibold text-foreground-700">{item.sender?.name || 'کاربر سامانه'}</span>
          {item.sender?.role && <span>{labelFor(roleLabels, item.sender.role)}</span>}
          {units && <span>واحد: {units}</span>}
          {item.sender?.phoneNumber && (
            <a href={`tel:${item.sender.phoneNumber}`} className="inline-flex items-center gap-1 text-accent" dir="ltr">
              <Phone className="h-3.5 w-3.5" />
              {item.sender.phoneNumber}
            </a>
          )}
          <span className="ms-auto">{formatDate(item.createdAt)}</span>
        </div>
      </CardContent>
    </Card>
  );
};

const FeedbackInboxPage = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [page, setPage] = React.useState(1);
  const [draftSearch, setDraftSearch] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [target, setTarget] = React.useState('');

  const params = React.useMemo(() => ({
    page,
    pageSize: PAGE_SIZE,
    ...(search ? { search } : {}),
    ...(isSuperAdmin && target ? { target } : {}),
  }), [isSuperAdmin, page, search, target]);

  const inboxQuery = useQuery({
    queryKey: ['feedback', 'inbox', params],
    queryFn: () => feedbackApi.getInbox(params).then((response) => response.data),
    placeholderData: (previous) => previous,
  });

  const data = inboxQuery.data || { items: [], total: 0, page: 1, pageSize: PAGE_SIZE };
  const items = data.items || [];
  const total = data.total || 0;
  const pageCount = Math.max(1, Math.ceil(total / (data.pageSize || PAGE_SIZE)));

  const submitSearch = (event) => {
    event.preventDefault();
    setPage(1);
    setSearch(draftSearch.trim());
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">صندوق انتقادات و پیشنهادات</h1>
          <p className="text-sm text-foreground-500">
            {isSuperAdmin ? 'نظرات ارسال‌شده برای مدیریت سامانه و همه شهرک‌ها' : 'نظرات ارسال‌شده برای شهرک‌های تحت مدیریت شما'}
          </p>
        </div>
        <Button
          variant="tertiary"
          onPress={() => inboxQuery.refetch()}
          isDisabled={inboxQuery.isFetching}
          className="rounded-xl font-medium flex items-center gap-1"
        >
          {inboxQuery.isFetching ? <Spinner size="sm" /> : <RotateCw className="h-4 w-4" />}
          به‌روزرسانی
        </Button>
      </div>

      <form onSubmit={submitSearch} className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="جستجو در نظرات"
          placeholder="جستجو در موضوع، متن، نام یا شماره فرستنده..."
          value={draftSearch}
          onChange={(event) => setDraftSearch(event.target.value)}
          maxLength={120}
          variant="primary"
          className="min-w-[16rem] flex-1 rounded-xl"
        />
        <Button type="submit" variant="primary" className="rounded-xl font-medium flex items-center gap-1">
          <Search className="h-4 w-4" />
          جستجو
        </Button>
      </form>

      {isSuperAdmin && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="مقصد نظر">
          {TARGET_FILTERS.map((filter) => (
            <Button
              key={filter.id || 'all'}
              size="sm"
              variant={target === filter.id ? 'primary' : 'tertiary'}
              aria-pressed={target === filter.id}
              onPress={() => { setTarget(filter.id); setPage(1); }}
              className="rounded-xl font-medium"
            >
              {filter.label}
            </Button>
          ))}
        </div>
      )}

      {inboxQuery.isLoading && (
        <div className="flex min-h-[200px] items-center justify-center">
          <Spinner size="lg" />
        </div>
      )}

      {inboxQuery.isError && (
        <Alert status="danger">
          <AlertContent>
            <AlertTitle>خطا</AlertTitle>
            <AlertDescription>{getErrorMessage(inboxQuery.error, 'دریافت انتقادات و پیشنهادات ناموفق بود.')}</AlertDescription>
          </AlertContent>
        </Alert>
      )}

      {!inboxQuery.isLoading && !inboxQuery.isError && items.length === 0 && (
        <EmptyState
          title={search ? 'نتیجه‌ای یافت نشد' : 'هنوز نظری ثبت نشده است'}
          description={search ? 'عبارت دیگری را جستجو کنید.' : 'نظرات کاربران پس از ثبت در اینجا نمایش داده می‌شود.'}
        />
      )}

      {items.length > 0 && (
        <>
          <p className="text-xs text-foreground-500">{faNumber.format(total)} نظر</p>
          <div className="flex flex-col gap-3">
            {items.map((item) => <FeedbackCard key={item.id} item={item} />)}
          </div>
        </>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            size="sm"
            variant="tertiary"
            aria-label="صفحه قبل"
            isIconOnly
            isDisabled={page <= 1 || inboxQuery.isFetching}
            onPress={() => setPage((current) => Math.max(1, current - 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm text-foreground-600">
            صفحه {faNumber.format(page)} از {faNumber.format(pageCount)}
          </span>
          <Button
            size="sm"
            variant="tertiary"
            aria-label="صفحه بعد"
            isIconOnly
            isDisabled={page >= pageCount || inboxQuery.isFetching}
            onPress={() => setPage((current) => Math.min(pageCount, current + 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default FeedbackInboxPage;
