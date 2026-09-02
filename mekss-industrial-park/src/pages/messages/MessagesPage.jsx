import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, Listbox, ListboxItem, Avatar, Skeleton, Alert, AlertContent, AlertTitle, AlertDescription } from '@heroui/react';
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
              description="پیام‌های دریافتی از مدیریت شهرک در اینجا نمایش داده می‌شوند."
            />
          ) : (
            <Listbox aria-label="پیام‌ها">
              {messages.map((msg) => (
                <ListboxItem
                  key={msg.id}
                  textValue={msg.subject}
                >
                  <div className="flex items-start gap-3 w-full">
                    <Avatar
                      name={msg.sender?.name?.charAt(0) || 'M'}
                      className="bg-primary-100 text-primary-700 shrink-0"
                      size="sm"
                    />
                    <div className="flex flex-1 flex-col min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">{msg.subject}</span>
                        <span className="text-xs text-foreground-500 shrink-0">
                          {new Date(msg.createdAt).toLocaleDateString('fa-IR')}
                        </span>
                      </div>
                      <span className="text-sm text-foreground-500 truncate">
                        {msg.content?.substring(0, 100)}...
                      </span>
                    </div>
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
