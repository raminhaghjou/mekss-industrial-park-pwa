import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  Input,
  TextArea,
  Button,
  Label,
  Spinner,
} from '@heroui/react';
import { MessageSquareHeart } from 'lucide-react';
import { feedbackApi } from '../../services/api/feedback.api';
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';

export const FeedbackPage = () => {
  const { showNotification } = useNotification();
  const [form, setForm] = useState({ subject: '', body: '' });

  const mutation = useMutation({
    mutationFn: () => feedbackApi.submit({
      subject: form.subject.trim(),
      body: form.body.trim(),
    }),
    onSuccess: () => {
      showNotification('پیام شما ثبت شد. از همکاری شما سپاسگزاریم.', 'success');
      setForm({ subject: '', body: '' });
    },
    onError: (err) => showNotification(getErrorMessage(err, 'ثبت پیام ناموفق بود'), 'error'),
  });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
          <MessageSquareHeart className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">انتقادات و پیشنهادات</h1>
          <p className="text-sm text-foreground-500">نظر شما برای بهبود سامانه مکص ثبت می‌شود.</p>
        </div>
      </div>

      <Card className="rounded-2xl border border-default-200">
        <CardContent className="gap-4 p-5">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">موضوع</Label>
            <Input
              value={form.subject}
              onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
              className="rounded-xl"
              maxLength={200}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">متن پیام</Label>
            <TextArea
              value={form.body}
              onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
              rows={6}
              className="rounded-xl"
              maxLength={8000}
            />
          </div>
          <Button
            variant="primary"
            className="self-end font-bold"
            isDisabled={!form.subject.trim() || !form.body.trim() || mutation.isPending}
            onPress={() => mutation.mutate()}
          >
            {mutation.isPending ? <Spinner size="sm" /> : 'ارسال'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default FeedbackPage;
