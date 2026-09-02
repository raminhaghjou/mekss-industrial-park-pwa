import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, Listbox, ListboxItem, Avatar, Chip, Skeleton, Alert } from '@heroui/react';
import { MessageSquare } from 'lucide-react';
import { messageApi } from '../../services/api/message.api';
import { getErrorMessage } from '../../utils/apiError';
import { EmptyState } from '../../components/common/EmptyState';

export const MessagesPage = () => {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['messages'],
    queryFn: () => messageApi.getMessages().then((res) => res.data),
  });

  const messages = data || [];

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-foreground">پیام‌ها</h1>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : isError ? (
            <Alert color="danger" title="خطا در دریافت اطلاعات">
              {getErrorMessage(error, 'دریافت پیام‌ها ناموفق بود.')}
            </Alert>
          ) : messages.length === 0 ? (
            <EmptyState
              icon={<MessageSquare className="h-6 w-6" />}
              title="هیچ پیامی وجود ندارد"
              description="پیام‌های دریافتی از مدیریت شهرک در اینجا نمایش داده می‌شوند."
            />
          ) : (
            <Listbox aria-label="پیام‌ها">
              {messages.map((msg) => (
                <ListboxItem
                  key={msg.id}
                  startContent={
                    <Avatar
                      name={msg.sender?.name?.charAt(0) || 'M'}
                      className="bg-primary-100 text-primary-700"
                      size="sm"
                    />
                  }
                  description={msg.content?.substring(0, 100) + '...'}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{msg.subject}</span>
                    <span className="text-xs text-foreground-500">
                      {new Date(msg.createdAt).toLocaleDateString('fa-IR')}
                    </span>
                  </div>
                </ListboxItem>
              ))}
            </Listbox>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MessagesPage;
