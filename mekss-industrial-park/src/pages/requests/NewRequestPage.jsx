import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectIndicator,
  SelectPopover,
  ListBox,
  ListBoxItem,
  TextArea,
  Button,
  Alert,
  AlertContent,
  AlertTitle,
  AlertDescription,
  Label,
  Spinner,
  Switch,
} from '@heroui/react';
import { ArrowRight, FilePlus } from 'lucide-react';
import { requestApi } from '../../services/api/request.api';
import { factoryApi } from '../../services/api/factory.api';
import { useActiveFactory } from '../../providers/ActiveFactoryProvider';
import { useAuth } from '../../providers/AuthProvider';
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';
import { requestTypeLabels } from '../../constants/persianLabels';

const requestTypeMap = {
  repair: 'OTHER',
  services: 'SERVICE_ORDER',
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
  SERVICE_ORDER: 'SERVICE_ORDER',
  OTHER: 'OTHER',
};

const requestTypes = Object.entries(requestTypeLabels).map(([value, label]) => ({ value, label }));

const serviceKinds = [
  { value: 'FOOD', label: 'غذا' },
  { value: 'CLEANING', label: 'نظافت' },
  { value: 'FREIGHT', label: 'باربری' },
  { value: 'OTHER', label: 'سایر' },
];

const NewRequestPage = () => {
  const { type } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();
  const { user } = useAuth();
  const { activeFactoryId, factories: ownerFactories } = useActiveFactory();

  const [requestType, setRequestType] = React.useState(requestTypeMap[type] || 'OTHER');
  const [factoryId, setFactoryId] = React.useState('');
  const [subject, setSubject] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [isToParkManager, setIsToParkManager] = React.useState(false);
  const [dataFields, setDataFields] = React.useState({});

  const { data: factories, isLoading: loadingFactories, isError: factoriesError } = useQuery({
    queryKey: ['factories', 'for-request'],
    queryFn: () => factoryApi.getFactories().then((res) => (Array.isArray(res.data) ? res.data : res.data?.items || [])),
  });

  React.useEffect(() => {
    if (factoryId) return;
    if (activeFactoryId) setFactoryId(activeFactoryId);
    else if (factories?.length === 1) setFactoryId(factories[0].id);
  }, [activeFactoryId, factories, factoryId]);

  const createMutation = useMutation({
    mutationFn: (payload) => requestApi.createRequest(payload),
    onSuccess: () => {
      showNotification('درخواست شما با موفقیت ثبت شد.', 'success');
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      navigate('/requests');
    },
    onError: (err) => showNotification(getErrorMessage(err, 'ثبت درخواست ناموفق بود.'), 'error'),
  });

  const setData = (key, value) => setDataFields((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!factoryId || !subject.trim() || !description.trim()) {
      showNotification('لطفا تمام فیلدهای الزامی را پر کنید.', 'error');
      return;
    }
    const data = Object.fromEntries(
      Object.entries(dataFields).filter(([, value]) => value !== '' && value != null),
    );
    createMutation.mutate({
      factoryId,
      type: requestType,
      title: subject,
      description,
      isToParkManager,
      data,
    });
  };

  const factoryOptions = factories || ownerFactories || [];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex items-center">
        <Button variant="ghost" onPress={() => navigate('/requests')} className="flex items-center gap-2 rounded-xl font-medium">
          <ArrowRight className="h-4 w-4" />
          بازگشت به لیست
        </Button>
      </div>

      <Card className="rounded-3xl border border-default-200 p-2 shadow-sm">
        <CardContent className="gap-6 p-6">
          <div className="flex items-center gap-3 border-b border-default-100 pb-4">
            <div className="rounded-2xl bg-[#0f4c81]/10 p-2.5 text-[#0f4c81]">
              <FilePlus className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">فرم ثبت درخواست جدید</h1>
              <p className="mt-0.5 text-xs text-foreground-500">ثبت و پیگیری درخواست‌های اداری، خدمات و مجوزها</p>
            </div>
          </div>

          {factoriesError && (
            <Alert status="danger">
              <AlertContent>
                <AlertTitle>خطا</AlertTitle>
                <AlertDescription>دریافت لیست واحدهای صنعتی ناموفق بود.</AlertDescription>
              </AlertContent>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-foreground-600">واحد صنعتی</Label>
              <Select
                value={factoryId}
                onChange={(val) => setFactoryId(String(val || ''))}
                variant="primary"
                isDisabled={loadingFactories}
                isRequired
                className="rounded-xl"
                placeholder="واحد صنعتی مربوطه را انتخاب کنید"
              >
                <SelectTrigger>
                  <SelectValue />
                  <SelectIndicator />
                </SelectTrigger>
                <SelectPopover>
                  <ListBox>
                    {factoryOptions.map((factory) => (
                      <ListBoxItem key={factory.id} id={factory.id}>{factory.name}</ListBoxItem>
                    ))}
                  </ListBox>
                </SelectPopover>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-foreground-600">نوع درخواست</Label>
              <Select
                value={requestType}
                onChange={(val) => {
                  setRequestType(String(val || 'OTHER'));
                  setDataFields({});
                }}
                variant="primary"
                isRequired
                className="rounded-xl"
              >
                <SelectTrigger>
                  <SelectValue />
                  <SelectIndicator />
                </SelectTrigger>
                <SelectPopover>
                  <ListBox>
                    {requestTypes.map((option) => (
                      <ListBoxItem key={option.value} id={option.value}>{option.label}</ListBoxItem>
                    ))}
                  </ListBox>
                </SelectPopover>
              </Select>
            </div>

            <TypeSpecificFields type={requestType} dataFields={dataFields} setData={setData} />

            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-foreground-600">موضوع درخواست</Label>
              <Input
                placeholder="عنوان کوتاه درخواست..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                variant="primary"
                required
                className="rounded-xl"
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-foreground-600">شرح درخواست</Label>
              <TextArea
                placeholder="جزئیات کامل درخواست خود را وارد نمایید..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                variant="primary"
                rows={4}
                required
                className="rounded-xl"
              />
            </div>

            {['FACTORY_OWNER', 'EMPLOYEE'].includes(user?.role) && (
              <div className="flex items-center justify-between rounded-xl bg-default-50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">ارجاع به مدیر شهرک</p>
                  <p className="text-xs text-foreground-500">در صورت نیاز مستقیم برای مدیریت شهرک ارسال شود</p>
                </div>
                <Switch isSelected={isToParkManager} onChange={setIsToParkManager} />
              </div>
            )}

            <div className="mt-2 flex items-center justify-end gap-3">
              <Button variant="tertiary" onPress={() => navigate('/requests')} isDisabled={createMutation.isPending} className="rounded-xl font-medium">
                انصراف
              </Button>
              <Button
                type="submit"
                className="rounded-xl px-6 font-bold shadow-md shadow-primary/20"
                variant="primary"
                isDisabled={createMutation.isPending}
              >
                {createMutation.isPending ? <Spinner size="sm" /> : 'ثبت درخواست'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

const Field = ({ label, children }) => (
  <div className="flex flex-col gap-1">
    <Label className="text-xs font-medium text-foreground-600">{label}</Label>
    {children}
  </div>
);

const TypeSpecificFields = ({ type, dataFields, setData }) => {
  switch (type) {
    case 'MISSION':
      return (
        <div className="grid gap-3 rounded-2xl bg-default-50 p-4 sm:grid-cols-3">
          <Field label="مقصد">
            <Input value={dataFields.destination || ''} onChange={(e) => setData('destination', e.target.value)} className="rounded-xl" />
          </Field>
          <Field label="از تاریخ">
            <Input type="date" dir="ltr" value={dataFields.startDate || ''} onChange={(e) => setData('startDate', e.target.value)} className="rounded-xl" />
          </Field>
          <Field label="تا تاریخ">
            <Input type="date" dir="ltr" value={dataFields.endDate || ''} onChange={(e) => setData('endDate', e.target.value)} className="rounded-xl" />
          </Field>
        </div>
      );
    case 'TRANSFER':
      return (
        <div className="grid gap-3 rounded-2xl bg-default-50 p-4 sm:grid-cols-3">
          <Field label="مبدا">
            <Input value={dataFields.fromLocation || ''} onChange={(e) => setData('fromLocation', e.target.value)} className="rounded-xl" />
          </Field>
          <Field label="مقصد">
            <Input value={dataFields.toLocation || ''} onChange={(e) => setData('toLocation', e.target.value)} className="rounded-xl" />
          </Field>
          <Field label="تاریخ انتقال">
            <Input type="date" dir="ltr" value={dataFields.transferDate || ''} onChange={(e) => setData('transferDate', e.target.value)} className="rounded-xl" />
          </Field>
        </div>
      );
    case 'DAILY_LEAVE':
      return (
        <div className="grid gap-3 rounded-2xl bg-default-50 p-4 sm:grid-cols-2">
          <Field label="از تاریخ">
            <Input type="date" dir="ltr" value={dataFields.startDate || ''} onChange={(e) => setData('startDate', e.target.value)} className="rounded-xl" />
          </Field>
          <Field label="تا تاریخ">
            <Input type="date" dir="ltr" value={dataFields.endDate || ''} onChange={(e) => setData('endDate', e.target.value)} className="rounded-xl" />
          </Field>
        </div>
      );
    case 'HOURLY_LEAVE':
      return (
        <div className="grid gap-3 rounded-2xl bg-default-50 p-4 sm:grid-cols-3">
          <Field label="تاریخ">
            <Input type="date" dir="ltr" value={dataFields.date || ''} onChange={(e) => setData('date', e.target.value)} className="rounded-xl" />
          </Field>
          <Field label="از ساعت">
            <Input type="time" dir="ltr" value={dataFields.fromTime || ''} onChange={(e) => setData('fromTime', e.target.value)} className="rounded-xl" />
          </Field>
          <Field label="تا ساعت">
            <Input type="time" dir="ltr" value={dataFields.toTime || ''} onChange={(e) => setData('toTime', e.target.value)} className="rounded-xl" />
          </Field>
        </div>
      );
    case 'LOAN':
      return (
        <div className="rounded-2xl bg-default-50 p-4">
          <Field label="مبلغ درخواستی (ریال)">
            <Input type="number" dir="ltr" value={dataFields.amount || ''} onChange={(e) => setData('amount', e.target.value)} className="rounded-xl" />
          </Field>
        </div>
      );
    case 'SETTLEMENT':
      return (
        <div className="rounded-2xl bg-default-50 p-4">
          <Field label="تاریخ تسویه">
            <Input type="date" dir="ltr" value={dataFields.settlementDate || ''} onChange={(e) => setData('settlementDate', e.target.value)} className="rounded-xl" />
          </Field>
        </div>
      );
    case 'CONSTRUCTION_PERMIT':
      return (
        <div className="grid gap-3 rounded-2xl bg-default-50 p-4 sm:grid-cols-2">
          <Field label="مساحت / محدوده">
            <Input value={dataFields.permitArea || ''} onChange={(e) => setData('permitArea', e.target.value)} className="rounded-xl" />
          </Field>
          <Field label="تاریخ شروع">
            <Input type="date" dir="ltr" value={dataFields.startDate || ''} onChange={(e) => setData('startDate', e.target.value)} className="rounded-xl" />
          </Field>
        </div>
      );
    case 'FINAL_INSPECTION':
      return (
        <div className="rounded-2xl bg-default-50 p-4">
          <Field label="تاریخ بازرسی پیشنهادی">
            <Input type="date" dir="ltr" value={dataFields.inspectionDate || ''} onChange={(e) => setData('inspectionDate', e.target.value)} className="rounded-xl" />
          </Field>
        </div>
      );
    case 'APPOINTMENT':
      return (
        <div className="grid gap-3 rounded-2xl bg-default-50 p-4 sm:grid-cols-2">
          <Field label="تاریخ ملاقات">
            <Input type="date" dir="ltr" value={dataFields.appointmentDate || ''} onChange={(e) => setData('appointmentDate', e.target.value)} className="rounded-xl" />
          </Field>
          <Field label="ساعت">
            <Input type="time" dir="ltr" value={dataFields.appointmentTime || ''} onChange={(e) => setData('appointmentTime', e.target.value)} className="rounded-xl" />
          </Field>
        </div>
      );
    case 'SERVICE_ORDER':
      return (
        <div className="rounded-2xl bg-default-50 p-4">
          <Field label="نوع خدمت">
            <Select
              value={dataFields.serviceKind || 'OTHER'}
              onChange={(val) => setData('serviceKind', String(val || 'OTHER'))}
              className="rounded-xl"
            >
              <SelectTrigger><SelectValue /><SelectIndicator /></SelectTrigger>
              <SelectPopover>
                <ListBox>
                  {serviceKinds.map((option) => (
                    <ListBoxItem key={option.value} id={option.value}>{option.label}</ListBoxItem>
                  ))}
                </ListBox>
              </SelectPopover>
            </Select>
          </Field>
        </div>
      );
    default:
      return null;
  }
};

export default NewRequestPage;
