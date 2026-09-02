import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { ArrowRight, FilePlus } from 'lucide-react';
import { requestApi } from '../../services/api/request.api';
import { factoryApi } from '../../services/api/factory.api';
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';

const requestTypeMap = {
  repair: 'OTHER',
  services: 'OTHER',
  permit: 'CONSTRUCTION_PERMIT',
  general: 'OTHER',
  MISSION: 'MISSION',
  TRANSFER: 'TRANSFER',
  DAILY_LEAVE: 'DAILY_LEAVE',
  HOURLY_LEAVE: 'HOURLY_LEAVE',
  LOAN: 'LOAN',
  SETTLEMENT: 'SETTLEMENT',
  CONSTRUCTION_PERMIT: 'CONSTRUCTION_PERMIT',
  FINAL_INSPECTION: 'FINAL_INSPECTION',
  APPOINTMENT: 'APPOINTMENT',
  OTHER: 'OTHER',
};

const requestTypes = [
  { value: 'MISSION', label: 'ماموریت' },
  { value: 'TRANSFER', label: 'انتقال' },
  { value: 'DAILY_LEAVE', label: 'مرخصی روزانه' },
  { value: 'HOURLY_LEAVE', label: 'مرخصی ساعتی' },
  { value: 'LOAN', label: 'وام' },
  { value: 'SETTLEMENT', label: 'تسویه حساب' },
  { value: 'CONSTRUCTION_PERMIT', label: 'مجوز ساخت' },
  { value: 'FINAL_INSPECTION', label: 'بازرسی نهایی' },
  { value: 'APPOINTMENT', label: 'وقت ملاقات' },
  { value: 'OTHER', label: 'سایر' },
];

const NewRequestPage = () => {
  const { type } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();

  const [requestType, setRequestType] = React.useState(requestTypeMap[type] || 'OTHER');
  const [factoryId, setFactoryId] = React.useState('');
  const [subject, setSubject] = React.useState('');
  const [description, setDescription] = React.useState('');

  const { data: factories, isLoading: loadingFactories, isError: factoriesError } = useQuery({
    queryKey: ['factories', 'managed'],
    queryFn: () => factoryApi.getFactories().then((res) => res.data),
  });

  const createMutation = useMutation({
    mutationFn: (/** @type {{factoryId: string, type: string, title: string, description: string}} */ payload) => requestApi.createRequest(payload),
    onSuccess: () => {
      showNotification('درخواست شما با موفقیت ثبت شد.', 'success');
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      navigate('/requests');
    },
    onError: (err) => showNotification(getErrorMessage(err, 'ثبت درخواست ناموفق بود.'), 'error'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!factoryId || !subject.trim() || !description.trim()) {
      showNotification('لطفا تمام فیلدهای الزامی را پر کنید.', 'error');
      return;
    }
    createMutation.mutate({ factoryId, type: requestType, title: subject, description });
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <div className="flex items-center">
        <Button startContent={<ArrowRight className="h-4 w-4" />} onPress={() => navigate('/requests')} variant="ghost" className="rounded-xl font-medium">
          بازگشت به لیست
        </Button>
      </div>

      <Card className="border border-default-200 shadow-sm rounded-3xl p-2 dark:border-white/10 glass-card">
        <CardContent className="p-6 gap-6">
          <div className="flex items-center gap-3 border-b border-default-100 pb-4 dark:border-white/5">
            <div className="p-2.5 rounded-2xl bg-primary-50 dark:bg-primary-950/40 text-primary">
              <FilePlus className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">فرم ثبت درخواست جدید</h1>
              <p className="text-xs text-foreground-500 mt-0.5">ثبت و پیگیری درخواست‌های اداری، خدمات و مجوزها</p>
            </div>
          </div>

          {factoriesError && (
            <Alert color="danger" title="خطا">
              دریافت لیست واحدهای صنعتی ناموفق بود.
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Select
              label="واحد صنعتی"
              placeholder="واحد صنعتی مربوطه را انتخاب کنید"
              selectedKeys={factoryId ? [factoryId] : []}
              onSelectionChange={(keys) => setFactoryId(Array.from(keys)[0] || '')}
              variant="primary"
              disabled={loadingFactories}
              isRequired
              classNames={{ trigger: 'rounded-xl' }}
            >
              {(factories || []).map((factory) => (
                <ListBoxItem key={factory.id}>{factory.name}</ListBoxItem>
              ))}
            </Select>

            <Select
              label="نوع درخواست"
              selectedKeys={[requestType]}
              onSelectionChange={(keys) => setRequestType(Array.from(keys)[0] || '')}
              variant="primary"
              isRequired
              classNames={{ trigger: 'rounded-xl' }}
            >
              {requestTypes.map((option) => (
                <ListBoxItem key={option.value}>{option.label}</ListBoxItem>
              ))}
            </Select>

            <Input
              label="موضوع درخواست"
              placeholder="عنوان کوتاه درخواست..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              variant="primary"
              isRequired
              classNames={{ inputWrapper: 'rounded-xl' }}
            />

            <TextArea
              label="شرح درخواست"
              placeholder="جزئیات کامل درخواست خود را وارد نمایید..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              variant="primary"
              minRows={4}
              isRequired
              classNames={{ inputWrapper: 'rounded-xl' }}
            />

            <div className="flex items-center justify-end gap-3 mt-2">
              <Button variant="tertiary" onPress={() => navigate('/requests')} disabled={createMutation.isPending} className="rounded-xl font-medium">
                انصراف
              </Button>
              <Button type="submit"  className="rounded-xl font-bold px-6 shadow-md shadow-primary/20" variant="primary" isDisabled={createMutation.isPending}>{createMutation.isPending ? <Spinner size="sm" /> : 'ثبت درخواست'}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default NewRequestPage;

