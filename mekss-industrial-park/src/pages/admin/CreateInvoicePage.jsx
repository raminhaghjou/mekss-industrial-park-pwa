import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardBody,
  Input,
  Select,
  SelectItem,
  Textarea,
  Button,
  Alert,
} from '@heroui/react';
import { ArrowRight, ReceiptPlus } from 'lucide-react';
import { factoryApi } from '../../services/api/factory.api';
import { invoiceApi } from '../../services/api/invoice.api';
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';

const CreateInvoicePage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();

  const [factoryId, setFactoryId] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [taxAmount, setTaxAmount] = React.useState('');
  const [dueDate, setDueDate] = React.useState('');

  const { data: factories, isLoading: loadingFactories, isError: factoriesError } = useQuery({
    queryKey: ['factories', 'managed'],
    queryFn: () => factoryApi.getFactories().then((res) => res.data),
  });

  const createMutation = useMutation({
    mutationFn: (/** @type {{factoryId: string, description: string, amount: number, taxAmount: number, dueDate: string}} */ payload) => invoiceApi.createInvoice(payload),
    onSuccess: () => {
      showNotification('قبض با موفقیت صادر شد.', 'success');
      queryClient.invalidateQueries({ queryKey: ['invoices', 'managed'] });
      navigate('/admin/invoices');
    },
    onError: (err) => showNotification(getErrorMessage(err, 'صدور قبض ناموفق بود.'), 'error'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!factoryId || !description.trim() || !amount || !dueDate) {
      showNotification('لطفا تمام فیلدهای الزامی را پر کنید.', 'error');
      return;
    }
    createMutation.mutate({
      factoryId,
      description,
      amount: Number(amount),
      taxAmount: taxAmount ? Number(taxAmount) : 0,
      dueDate,
    });
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <div className="flex items-center">
        <Button startContent={<ArrowRight className="h-4 w-4" />} onPress={() => navigate('/admin/invoices')} variant="light" className="rounded-xl font-medium">
          بازگشت
        </Button>
      </div>

      <Card className="border border-default-200 shadow-sm rounded-3xl p-2 dark:border-white/10 glass-card">
        <CardBody className="p-6 gap-6">
          <div className="flex items-center gap-3 border-b border-default-100 pb-4 dark:border-white/5">
            <div className="p-2.5 rounded-2xl bg-primary-50 dark:bg-primary-950/40 text-primary">
              <ReceiptPlus className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">فرم صدور قبض جدید</h1>
              <p className="text-xs text-foreground-500 mt-0.5">صدور و ارسال مستقیم قبض مالی برای واحد صنعتی</p>
            </div>
          </div>

          {factoriesError && (
            <Alert color="danger" title="خطا">
              دریافت لیست واحدهای صنعتی ناموفق بود.
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Select
              label="انتخاب واحد صنعتی"
              placeholder="واحد صنعتی مورد نظر را انتخاب کنید"
              selectedKeys={factoryId ? [factoryId] : []}
              onSelectionChange={(keys) => setFactoryId(Array.from(keys)[0] || '')}
              variant="bordered"
              isDisabled={loadingFactories}
              isRequired
              classNames={{ trigger: 'rounded-xl' }}
            >
              {(factories || []).map((factory) => (
                <SelectItem key={factory.id}>{factory.name}</SelectItem>
              ))}
            </Select>

            <Textarea
              label="شرح قبض"
              placeholder="توضیحات و بابت پرداختی..."
              value={description}
              onValueChange={setDescription}
              variant="bordered"
              minRows={2}
              isRequired
              classNames={{ inputWrapper: 'rounded-xl' }}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                type="number"
                label="مبلغ (ریال)"
                placeholder="مثلا: ۱۰۰۰۰۰۰"
                value={amount}
                onValueChange={setAmount}
                variant="bordered"
                dir="ltr"
                isRequired
                classNames={{ inputWrapper: 'rounded-xl' }}
              />

              <Input
                type="number"
                label="مبلغ مالیات (ریال)"
                placeholder="اختیاری"
                value={taxAmount}
                onValueChange={setTaxAmount}
                variant="bordered"
                dir="ltr"
                classNames={{ inputWrapper: 'rounded-xl' }}
              />
            </div>

            <Input
              type="date"
              label="مهلت پرداخت"
              value={dueDate}
              onValueChange={setDueDate}
              variant="bordered"
              isRequired
              classNames={{ inputWrapper: 'rounded-xl' }}
            />

            <div className="flex items-center justify-end gap-3 mt-2">
              <Button variant="flat" color="default" onPress={() => navigate('/admin/invoices')} isDisabled={createMutation.isPending} className="rounded-xl font-medium">
                انصراف
              </Button>
              <Button type="submit" color="primary" isLoading={createMutation.isPending} className="rounded-xl font-bold px-6 shadow-md shadow-primary/20">
                صدور قبض
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
};

export default CreateInvoicePage;

