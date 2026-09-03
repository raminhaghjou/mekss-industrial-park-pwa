import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  Button,
  Alert,
  AlertContent,
  AlertTitle,
  AlertDescription,
  Spinner,
  Separator,
} from '@heroui/react';
import { ArrowRight, CreditCard } from 'lucide-react';
import { invoiceApi } from '../../services/api/invoice.api';
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';

const InvoicePaymentPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const { data: invoices, isLoading, isError } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoiceApi.getInvoices().then((res) => res.data),
  });

  const invoice = (invoices || []).find((inv) => inv.id === id);

  const payMutation = useMutation({
    mutationFn: () => invoiceApi.startPayment(id, `${id}-${Date.now()}`),
    onSuccess: (res) => {
      const { paymentUrl } = res.data;
      if (paymentUrl) {
        window.location.href = paymentUrl;
      } else {
        showNotification('پرداخت با موفقیت شروع شد.', 'success');
        navigate('/invoices');
      }
    },
    onError: (err) => showNotification(getErrorMessage(err, 'شروع پرداخت ناموفق بود.'), 'error'),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !invoice) {
    return (
      <div className="flex flex-col gap-4 max-w-lg mx-auto">
        <Alert status="danger">
          <AlertContent>
            <AlertTitle>خطا</AlertTitle>
            <AlertDescription>قبض مورد نظر یافت نشد.</AlertDescription>
          </AlertContent>
        </Alert>
        <Button variant="secondary" onPress={() => navigate('/invoices')} className="rounded-xl font-medium flex items-center gap-2">
          <ArrowRight className="h-4 w-4" />
          بازگشت به لیست قبض‌ها
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <div className="flex items-center">
        <Button variant="ghost" onPress={() => navigate('/invoices')} className="rounded-xl font-medium flex items-center gap-2">
          <ArrowRight className="h-4 w-4" />
          بازگشت
        </Button>
      </div>
      <Card className="border border-default-200 shadow-lg rounded-3xl p-4 dark:border-white/10 glass-card">
        <CardContent className="gap-6 p-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">پرداخت قبض</h1>
            <p className="text-sm text-foreground-500 mt-1">مشخصات و جزئیات صورت‌حساب جهت پرداخت آنلاین</p>
          </div>

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="flex flex-col gap-1 p-3 rounded-2xl bg-default-50 dark:bg-default-100/30">
              <span className="text-xs text-foreground-500 font-medium">شماره قبض</span>
              <span className="font-semibold text-foreground">{invoice.invoiceNumber}</span>
            </div>

            <div className="flex flex-col gap-1 p-3 rounded-2xl bg-default-50 dark:bg-default-100/30">
              <span className="text-xs text-foreground-500 font-medium">مهلت پرداخت</span>
              <span className="font-semibold text-foreground">{new Date(invoice.dueDate).toLocaleDateString('fa-IR')}</span>
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1 p-3 rounded-2xl bg-default-50 dark:bg-default-100/30">
              <span className="text-xs text-foreground-500 font-medium">شرح قبض</span>
              <span className="font-semibold text-foreground">{invoice.description}</span>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between p-4 rounded-2xl bg-primary-50 dark:bg-primary-950/40 border border-primary-200 dark:border-primary-800/40">
            <span className="text-base font-bold text-foreground">مبلغ قابل پرداخت:</span>
            <span className="text-xl font-extrabold text-primary">
              {Number(invoice.totalAmount).toLocaleString('fa-IR')} ریال
            </span>
          </div>

          {invoice.status === 'PAID' ? (
            <Alert status="success">
              <AlertContent>
                <AlertTitle>پرداخت شده</AlertTitle>
                <AlertDescription>این قبض قبلاً پرداخت شده است.</AlertDescription>
              </AlertContent>
            </Alert>
          ) : (
            <div className="flex justify-center mt-2">
              <Button
                variant="primary"
                size="lg"
                onPress={() => payMutation.mutate()}
                isDisabled={payMutation.isPending}
                className="w-full sm:w-auto px-8 rounded-2xl font-bold text-base shadow-md shadow-primary/20 flex items-center gap-2"
              >
                {payMutation.isPending ? <Spinner size="sm" /> : <CreditCard className="h-5 w-5" />}
                پرداخت آنلاین
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InvoicePaymentPage;
