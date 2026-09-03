import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  Input,
  TextArea,
  Button,
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectIndicator,
  SelectPopover,
  ListBox,
  ListBoxItem,
  Spinner,
} from '@heroui/react';
import { Building2, ArrowRight } from 'lucide-react';
import { factoryApi } from '../../services/api/factory.api';
import { publicApi } from '../../services/api/public.api';
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';

const emptyForm = {
  name: '',
  licenseNumber: '',
  nationalId: '',
  activityType: '',
  address: '',
  phoneNumber: '',
  phoneNumber2: '',
  landline: '',
  fax: '',
  email: '',
  website: '',
  description: '',
  ceoName: '',
  shopUrl: '',
  employees: '',
  parkId: '',
};

export const RegisterFactoryPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();
  const [form, setForm] = useState(emptyForm);

  const { data: parks = [], isLoading: loadingParks } = useQuery({
    queryKey: ['public', 'parks'],
    queryFn: () => publicApi.getParks().then((res) => res.data),
  });

  const mutation = useMutation({
    mutationFn: (payload) => factoryApi.registerFactory(payload),
    onSuccess: () => {
      showNotification('درخواست ثبت واحد صنعتی ارسال شد', 'success');
      queryClient.invalidateQueries({ queryKey: ['factories'] });
      navigate('/dashboard');
    },
    onError: (error) => showNotification(getErrorMessage(error, 'ثبت واحد صنعتی ناموفق بود'), 'error'),
  });

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = (e) => {
    e.preventDefault();
    const required = ['name', 'licenseNumber', 'nationalId', 'activityType', 'address', 'phoneNumber', 'parkId'];
    if (required.some((key) => !String(form[key] || '').trim())) {
      showNotification('لطفاً فیلدهای الزامی را تکمیل کنید', 'error');
      return;
    }
    const payload = {
      name: form.name.trim(),
      licenseNumber: form.licenseNumber.trim(),
      nationalId: form.nationalId.trim(),
      activityType: form.activityType.trim(),
      address: form.address.trim(),
      phoneNumber: form.phoneNumber.trim(),
      parkId: form.parkId,
    };
    ['phoneNumber2', 'landline', 'fax', 'email', 'website', 'description', 'ceoName', 'shopUrl'].forEach((key) => {
      const value = form[key]?.trim();
      if (value) payload[key] = value;
    });
    if (form.employees !== '') payload.employees = Number(form.employees);
    mutation.mutate(payload);
  };

  return (
    <div className="mx-auto max-w-3xl animate-fade-in">
      <Button variant="ghost" className="mb-4 gap-2" onPress={() => navigate('/dashboard')}>
        <ArrowRight className="h-4 w-4" />
        بازگشت
      </Button>

      <Card className="rounded-3xl border border-default-200 shadow-sm">
        <CardContent className="gap-6 p-5 sm:p-7">
          <div className="flex items-center gap-3 border-b border-default-100 pb-4">
            <div className="rounded-2xl bg-[#0f4c81]/10 p-2.5 text-[#0f4c81]">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">ثبت واحد صنعتی جدید</h1>
              <p className="mt-0.5 text-xs text-foreground-500">پس از ارسال، درخواست شما توسط مدیریت شهرک بررسی می‌شود.</p>
            </div>
          </div>

          <form onSubmit={submit} className="flex flex-col gap-6">
            <section className="grid gap-4 sm:grid-cols-2">
              <h2 className="sm:col-span-2 text-sm font-semibold text-[#0f4c81]">اطلاعات اصلی</h2>
              <Field label="نام واحد" required>
                <Input value={form.name} onChange={(e) => update('name', e.target.value)} required className="rounded-xl" />
              </Field>
              <Field label="شهرک صنعتی" required>
                <Select
                  value={form.parkId}
                  onChange={(val) => update('parkId', String(val || ''))}
                  isDisabled={loadingParks}
                  isRequired
                  className="rounded-xl"
                  placeholder="انتخاب شهرک"
                >
                  <SelectTrigger><SelectValue /><SelectIndicator /></SelectTrigger>
                  <SelectPopover>
                    <ListBox>
                      {parks.map((park) => (
                        <ListBoxItem key={park.id} id={park.id}>
                          {park.name} — {park.city}
                        </ListBoxItem>
                      ))}
                    </ListBox>
                  </SelectPopover>
                </Select>
              </Field>
              <Field label="شماره پروانه" required>
                <Input value={form.licenseNumber} onChange={(e) => update('licenseNumber', e.target.value)} required className="rounded-xl" />
              </Field>
              <Field label="شناسه ملی" required>
                <Input dir="ltr" value={form.nationalId} onChange={(e) => update('nationalId', e.target.value.replace(/\D/g, '').slice(0, 11))} required className="rounded-xl" />
              </Field>
              <Field label="نوع فعالیت" required>
                <Input value={form.activityType} onChange={(e) => update('activityType', e.target.value)} required className="rounded-xl" />
              </Field>
              <Field label="نام مدیرعامل">
                <Input value={form.ceoName} onChange={(e) => update('ceoName', e.target.value)} className="rounded-xl" />
              </Field>
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
              <h2 className="sm:col-span-2 text-sm font-semibold text-[#0f4c81]">تماس و آدرس</h2>
              <Field label="آدرس" required className="sm:col-span-2">
                <TextArea value={form.address} onChange={(e) => update('address', e.target.value)} required rows={2} className="rounded-xl" />
              </Field>
              <Field label="تلفن همراه" required>
                <Input dir="ltr" value={form.phoneNumber} onChange={(e) => update('phoneNumber', e.target.value)} required className="rounded-xl" />
              </Field>
              <Field label="تلفن دوم">
                <Input dir="ltr" value={form.phoneNumber2} onChange={(e) => update('phoneNumber2', e.target.value)} className="rounded-xl" />
              </Field>
              <Field label="تلفن ثابت">
                <Input dir="ltr" value={form.landline} onChange={(e) => update('landline', e.target.value)} className="rounded-xl" />
              </Field>
              <Field label="فکس">
                <Input dir="ltr" value={form.fax} onChange={(e) => update('fax', e.target.value)} className="rounded-xl" />
              </Field>
              <Field label="ایمیل">
                <Input dir="ltr" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} className="rounded-xl" />
              </Field>
              <Field label="تعداد پرسنل">
                <Input type="number" min="0" value={form.employees} onChange={(e) => update('employees', e.target.value)} className="rounded-xl" />
              </Field>
            </section>

            <section className="grid gap-4">
              <h2 className="text-sm font-semibold text-[#0f4c81]">اطلاعات تکمیلی</h2>
              <Field label="وب‌سایت">
                <Input dir="ltr" value={form.website} onChange={(e) => update('website', e.target.value)} placeholder="https://" className="rounded-xl" />
              </Field>
              <Field label="آدرس فروشگاه آنلاین">
                <Input dir="ltr" value={form.shopUrl} onChange={(e) => update('shopUrl', e.target.value)} placeholder="https://" className="rounded-xl" />
              </Field>
              <Field label="توضیحات">
                <TextArea value={form.description} onChange={(e) => update('description', e.target.value)} rows={3} className="rounded-xl" />
              </Field>
            </section>

            <div className="flex justify-end gap-3">
              <Button variant="tertiary" onPress={() => navigate('/dashboard')} isDisabled={mutation.isPending}>انصراف</Button>
              <Button type="submit" variant="primary" className="min-w-32 font-bold" isDisabled={mutation.isPending}>
                {mutation.isPending ? <Spinner size="sm" /> : 'ثبت درخواست'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

const Field = ({ label, required, children, className = '' }) => (
  <div className={`flex flex-col gap-1 ${className}`}>
    <Label className="text-xs font-medium text-foreground-600">
      {label}{required ? ' *' : ''}
    </Label>
    {children}
  </div>
);

export default RegisterFactoryPage;
