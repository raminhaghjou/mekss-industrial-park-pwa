import React from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  Input,
  Select,
  ListBoxItem,
  TextArea,
  Button,
  Alert,
} from '@heroui/react';
import { Send, MessageSquare } from 'lucide-react';
import { factoryApi } from '../../services/api/factory.api';
import { messageApi } from '../../services/api/message.api';
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';

const SendMessagePage = () => {
  const { showNotification } = useNotification();
  const [selectedManagerIds, setSelectedManagerIds] = React.useState([]);
  const [subject, setSubject] = React.useState('');
  const [body, setBody] = React.useState('');

  const { data: factories, isLoading, isError } = useQuery({
    queryKey: ['factories', 'managed'],
    queryFn: () => factoryApi.getFactories().then((res) => res.data),
  });

  const recipients = React.useMemo(() => {
    const seen = new Map();
    (factories || []).forEach((factory) => {
      if (factory.manager?.id && !seen.has(factory.manager.id)) {
        seen.set(factory.manager.id, { id: factory.manager.id, label: `${factory.manager.name} (${factory.name})` });
      }
    });
    return Array.from(seen.values());
  }, [factories]);

  const sendMutation = useMutation({
    mutationFn: () => messageApi.sendBatchMessage(selectedManagerIds, subject, body),
    onSuccess: (res) => {
      const { sentCount, excludedCount } = res.data;
      showNotification(
        excludedCount > 0
          ? `پیام برای ${sentCount} گیرنده ارسال شد. ${excludedCount} گیرنده نامعتبر نادیده گرفته شد.`
          : `پیام با موفقیت برای ${sentCount} گیرنده ارسال شد.`,
        'success',
      );
      setSelectedManagerIds([]);
      setSubject('');
      setBody('');
    },
    onError: (err) => showNotification(getErrorMessage(err, 'ارسال پیام ناموفق بود.'), 'error'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedManagerIds.length || !subject.trim() || !body.trim()) {
      showNotification('لطفا گیرندگان، موضوع و متن پیام را مشخص کنید.', 'error');
      return;
    }
    sendMutation.mutate();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-100 dark:bg-primary-900/40 text-primary-600">
          <MessageSquare className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">ارسال پیام گروهی</h1>
          <p className="text-sm text-foreground-500">ارسال اعلان و اطلاع‌رسانی مستقیم به مدیران واحدهای صنعتی</p>
        </div>
      </div>

      <Card className="border border-default-200 shadow-sm rounded-2xl p-2 dark:border-white/10">
        <CardContent className="p-6">
          {isError && (
            <Alert color="danger" title="خطا" className="mb-4">
              دریافت لیست گیرندگان ناموفق بود.
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Select
              label="انتخاب گیرندگان"
              placeholder="مدیران مورد نظر را انتخاب کنید..."
              selectionMode="multiple"
              selectedKeys={new Set(selectedManagerIds)}
              onSelectionChange={(keys) => setSelectedManagerIds(Array.from(keys))}
              variant="primary"
              disabled={isLoading}
              isRequired
              classNames={{ trigger: 'rounded-xl' }}
            >
              {recipients.map((recipient) => (
                <ListBoxItem key={recipient.id}>{recipient.label}</ListBoxItem>
              ))}
            </Select>

            <Input
              label="موضوع پیام"
              placeholder="عنوان پیام اطلاع‌رسانی..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              variant="primary"
              isRequired
              classNames={{ inputWrapper: 'rounded-xl' }}
            />

            <TextArea
              label="متن پیام"
              placeholder="متن کامل پیام را وارد کنید..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              variant="primary"
              minRows={6}
              isRequired
              classNames={{ inputWrapper: 'rounded-xl' }}
            />

            <div className="flex items-center justify-end mt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                startContent={sendMutation.isPending ? <Spinner size="sm" /> : <Send className="h-4 w-4" />}
                isDisabled={sendMutation.isPending}
                className="rounded-xl font-bold px-8 shadow-md"
              >
                ارسال پیام
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SendMessagePage;

