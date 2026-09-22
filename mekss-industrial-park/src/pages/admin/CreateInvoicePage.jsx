import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  Input,
  TextArea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectIndicator,
  SelectPopover,
  ListBox,
  ListBoxItem,
  Label,
  Button,
  Alert,
  AlertContent,
  AlertTitle,
  AlertDescription,
  Spinner,
} from '@heroui/react';
import { ArrowRight, Receipt } from 'lucide-react';
import { factoryApi } from '../../services/api/factory.api';
import { parkApi } from '../../services/api/park.api';
import { invoiceApi } from '../../services/api/invoice.api';
import { useAuth } from '../../providers/AuthProvider';
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';
import JalaliDatePicker from '../../components/common/JalaliDatePicker';

const CreateInvoicePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [targetType, setTargetType] = React.useState('FACTORY');
  const [factoryId, setFactoryId] = React.useState(searchParams.get('factoryId') || '');
  const [parkId, setParkId] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [taxAmount, setTaxAmount] = React.useState('');
  const [latePenaltyPerDay, setLatePenaltyPerDay] = React.useState('');
  const [dueDate, setDueDate] = React.useState('');

  const { data: factories, isLoading: loadingFactories, isError: factoriesError } = useQuery({
    queryKey: ['factories', 'managed'],
    queryFn: () => factoryApi.getFactories().then((res) => res.data),
    enabled: targetType === 'FACTORY',
  });

  const { data: parks, isLoading: loadingParks, isError: parksError } = useQuery({
    queryKey: ['parks', 'all'],
    queryFn: () => parkApi.getParks().then((res) => res.data),
    enabled: isSuperAdmin && targetType === 'PARK',
  });
  const parkList = Array.isArray(parks) ? parks : parks?.items || [];

  const createMutation = useMutation({
    mutationFn: (payload) => invoiceApi.createInvoice(payload),
    onSuccess: () => {
      showNotification('قبض با موفقیت صادر شد.', 'success');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      navigate(targetType === 'PARK' ? '/admin/finance' : '/admin/finance');
    },
    onError: (err) => showNotification(getErrorMessage(err, 'صدور قبض ناموفق بود.'), 'error'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!description.trim() || !amount || !dueDate) {
      showNotification('لطفا تمام فیلدهای الزامی را پر کنید.', 'error');
      return;
    }
    if (targetType === 'FACTORY' && !factoryId) {
      showNotification('انتخاب واحد صنعتی الزامی است.', 'error');
      return;
    }
    if (targetType === 'PARK' && !parkId) {
      showNotification('انتخاب شهرک صنعتی الزامی است.', 'error');
      return;
    }
    createMutation.mutate({
      targetType,
      ...(targetType === 'FACTORY' ? { factoryId } : { parkId }),
      description: description.trim(),
      amount: Number(amount),
      taxAmount: taxAmount ? Number(taxAmount) : 0,
      latePenaltyPerDay: latePenaltyPerDay ? Number(latePenaltyPerDay) : 0,
      dueDate,
    });
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <div className="flex items-center">
        <Button variant="ghost" onPress={() => navigate('/admin/finance')} className="rounded-xl font-medium flex items-center gap-2">
          <ArrowRight className="h-4 w-4" />
          بازگشت به حسابداری
        </Button>
      </div>

      <Card className="border border-default-200 shadow-sm rounded-3xl p-2 dark:border-white/10 glass-card">
        <CardContent className="p-6 gap-6">
          <div className="flex items-center gap-3 border-b border-default-100 pb-4 dark:border-white/5">
            <div className="p-2.5 rounded-2xl bg-primary-50 dark:bg-primary-950/40 text-primary">
              <Receipt className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">فرم صدور قبض جدید</h1>
              <p className="text-xs text-foreground-500 mt-0.5">
                {isSuperAdmin
                  ? 'صدور قبض برای واحد صنعتی یا صورتحساب بدهی شهرک'
                  : 'صدور و ارسال مستقیم قبض مالی برای واحد صنعتی'}
              </p>
            </div>
          </div>

          {(factoriesError || parksError) && (
            <Alert status="danger">
              <AlertContent>
                <AlertTitle>خطا</AlertTitle>
                <AlertDescription>دریافت فهرست گیرندگان ناموفق بود.</AlertDescription>
              </AlertContent>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {isSuperAdmin && (
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-medium text-foreground-600">نوع صورتحساب</Label>
                <select
                  value={targetType}
                  onChange={(e) => {
                    setTargetType(e.target.value);
                    setFactoryId('');
                    setParkId('');
                  }}
                  className="h-11 w-full rounded-xl border border-default-200 bg-default-50 px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="FACTORY">قبض واحد صنعتی</option>
                  <option value="PARK">بدهی شهرک (برای مدیر شهرک)</option>
                </select>
                <p className="text-[11px] text-foreground-500 mt-1">
                  {targetType === 'PARK'
                    ? 'این قبض فقط برای مدیر همان شهرک نمایش داده می‌شود و در داشبورد مدیر شهرک به‌عنوان بدهی معوق شهرک ظاهر می‌گردد.'
                    : 'این قبض برای مدیر واحد صنعتی صادر می‌شود و در مطالبات حسابداری شهرک ثبت می‌گردد.'}
                </p>
              </div>
            )}

            {targetType === 'FACTORY' ? (
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-medium text-foreground-600">انتخاب واحد صنعتی</Label>
                <Select
                  value={factoryId}
                  onChange={(value) => setFactoryId(String(value || ''))}
                  placeholder="واحد صنعتی مورد نظر را انتخاب کنید..."
                  variant="primary"
                  isDisabled={loadingFactories}
                  className="rounded-xl"
                >
                  <SelectTrigger>
                    <SelectValue />
                    <SelectIndicator />
                  </SelectTrigger>
                  <SelectPopover>
                    <ListBox>
                      {(factories || []).map((factory) => (
                        <ListBoxItem key={factory.id} id={factory.id}>{factory.name}</ListBoxItem>
                      ))}
                    </ListBox>
                  </SelectPopover>
                </Select>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-medium text-foreground-600">انتخاب شهرک صنعتی</Label>
                <Select
                  value={parkId}
                  onChange={(value) => setParkId(String(value || ''))}
                  placeholder="شهرک مورد نظر را انتخاب کنید..."
                  variant="primary"
                  isDisabled={loadingParks}
                  className="rounded-xl"
                >
                  <SelectTrigger>
                    <SelectValue />
                    <SelectIndicator />
                  </SelectTrigger>
                  <SelectPopover>
                    <ListBox>
                      {parkList.map((park) => (
                        <ListBoxItem key={park.id} id={park.id}>{park.name}</ListBoxItem>
                      ))}
                    </ListBox>
                  </SelectPopover>
                </Select>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-foreground-600">شرح قبض</Label>
              <TextArea
                placeholder="توضیحات و بابت پرداختی..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                variant="primary"
                rows={2}
                className="rounded-xl"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-medium text-foreground-600">مبلغ (ریال)</Label>
                <Input
                  type="number"
                  placeholder="مثلا: ۱۰۰۰۰۰۰"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  variant="primary"
                  dir="ltr"
                  className="rounded-xl"
                />
              </div>

              <div className="flex flex-col gap-1">
                <Label className="text-xs font-medium text-foreground-600">مبلغ مالیات (ریال)</Label>
                <Input
                  type="number"
                  placeholder="اختیاری"
                  value={taxAmount}
                  onChange={(e) => setTaxAmount(e.target.value)}
                  variant="primary"
                  dir="ltr"
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-foreground-600">جریمه تأخیر روزانه (ریال)</Label>
              <Input
                type="number"
                placeholder="مثلاً ۵۰۰۰۰ — پس از سررسید به ازای هر روز محاسبه می‌شود"
                value={latePenaltyPerDay}
                onChange={(e) => setLatePenaltyPerDay(e.target.value)}
                variant="primary"
                dir="ltr"
                className="rounded-xl"
              />
            </div>

            <JalaliDatePicker
              label="مهلت پرداخت"
              value={dueDate}
              onChange={setDueDate}
              required
            />

            <div className="flex items-center justify-end gap-3 mt-2">
              <Button variant="tertiary" onPress={() => navigate('/admin/finance')} isDisabled={createMutation.isPending} className="rounded-xl font-medium">
                انصراف
              </Button>
              <Button type="submit" variant="primary" isDisabled={createMutation.isPending} className="rounded-xl font-bold px-6 shadow-md shadow-primary/20">
                {createMutation.isPending ? <Spinner size="sm" /> : 'صدور قبض'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateInvoicePage;
