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
  AlertIndicator,
  Spinner,
  Separator,
} from '@heroui/react';
import { ArrowRight, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { gatePassApi } from '../../services/api/gatePass.api';
import { useNotification } from '../../providers/NotificationProvider';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { getErrorMessage } from '../../utils/apiError';

const VerifyGatePassPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [denyOpen, setDenyOpen] = React.useState(false);
  const [verifyOpen, setVerifyOpen] = React.useState(false);

  const { data: pass, isLoading, isError } = useQuery({
    queryKey: ['gate-pass', id],
    queryFn: () => gatePassApi.getGatePass(id).then((res) => res.data),
  });

  const verifyMutation = useMutation({
    mutationFn: () => gatePassApi.verifyGatePass(id),
    onSuccess: () => {
      showNotification(`خروج خودرو با پلاک ${pass?.licensePlate} با موفقیت ثبت شد.`, 'success');
      setVerifyOpen(false);
      navigate('/guard/gate-passes');
    },
    onError: (err) => showNotification(getErrorMessage(err, 'ثبت خروج ناموفق بود.'), 'error'),
  });

  const denyMutation = useMutation({
    mutationFn: (/** @type {string} */ reason) => gatePassApi.denyGatePassExit(id, { reason }),
    onSuccess: () => {
      showNotification('گزارش مغایرت ثبت و به مدیر شهرک ارجاع داده شد.', 'success');
      navigate('/guard/gate-passes');
    },
    onError: (err) => showNotification(getErrorMessage(err, 'ثبت گزارش مغایرت ناموفق بود.'), 'error'),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !pass) {
    return (
      <div className="flex flex-col gap-4 max-w-lg mx-auto">
        <Alert status="danger">
          <AlertContent>
            <AlertTitle>خطا</AlertTitle>
            <AlertDescription>برگ خروج مورد نظر یافت نشد.</AlertDescription>
          </AlertContent>
        </Alert>
        <Button variant="secondary" onPress={() => navigate('/guard/gate-passes')} className="rounded-xl font-medium flex items-center gap-2">
          <ArrowRight className="h-4 w-4" />
          بازگشت به لیست
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <div className="flex items-center">
        <Button variant="ghost" onPress={() => navigate('/guard/gate-passes')} className="rounded-xl font-medium flex items-center gap-2">
          <ArrowRight className="h-4 w-4" />
          بازگشت به لیست
        </Button>
      </div>

      <Card className="border border-default-200 shadow-lg rounded-3xl p-2 dark:border-white/10 glass-card">
        <CardContent className="p-6 gap-6">
          <div className="flex items-center gap-3 border-b border-default-100 pb-4 dark:border-white/5">
            <div className="p-2.5 rounded-2xl bg-primary-50 dark:bg-primary-950/40 text-primary">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">بررسی جزئیات و تایید خروج</h1>
              <p className="text-xs text-foreground-500 mt-0.5">استعلام و تطبیق فیزیکی اطلاعات محموله در ورودی/خروجی نگهبانی</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="flex flex-col gap-1 p-3.5 rounded-2xl bg-default-50 dark:bg-default-100/30">
              <span className="text-xs text-foreground-500 font-medium">واحد صنعتی</span>
              <span className="font-bold text-foreground">{pass.factory?.name || '—'}</span>
            </div>

            <div className="flex flex-col gap-1 p-3.5 rounded-2xl bg-default-50 dark:bg-default-100/30">
              <span className="text-xs text-foreground-500 font-medium">تاریخ خروج</span>
              <span className="font-bold text-foreground">{new Date(pass.exitDate).toLocaleDateString('fa-IR')}</span>
            </div>

            <div className="flex flex-col gap-1 p-3.5 rounded-2xl bg-default-50 dark:bg-default-100/30">
              <span className="text-xs text-foreground-500 font-medium">نام راننده</span>
              <span className="font-bold text-foreground">{pass.driverName}</span>
            </div>

            <div className="flex flex-col gap-1 p-3.5 rounded-2xl bg-default-50 dark:bg-default-100/30">
              <span className="text-xs text-foreground-500 font-medium">شماره پلاک</span>
              <span className="font-bold text-foreground">{pass.licensePlate}</span>
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1 p-3.5 rounded-2xl bg-default-50 dark:bg-default-100/30">
              <span className="text-xs text-foreground-500 font-medium">توضیحات بار</span>
              <span className="font-semibold text-foreground leading-relaxed">{pass.cargoDescription || '—'}</span>
            </div>
          </div>

          <Separator />

          <Alert status="accent">
            <AlertIndicator><ShieldCheck className="h-5 w-5" /></AlertIndicator>
            <AlertContent>
              <AlertTitle>راهنمایی بررسی</AlertTitle>
              <AlertDescription>
                لطفاً اطلاعات فوق را دقیقاً با مشخصات راننده، خودرو و بار حاضر در گیت نگهبانی تطبیق دهید.
              </AlertDescription>
            </AlertContent>
          </Alert>

          <div className="flex flex-wrap items-center justify-center gap-4 mt-2">
            <Button
              variant="primary"
              size="lg"
              onPress={() => setVerifyOpen(true)}
              isLoading={verifyMutation.isPending}
              isDisabled={verifyMutation.isPending || pass.status !== 'APPROVED'}
              className="rounded-2xl text-white font-bold px-8 shadow-md shadow-success/20 flex items-center gap-2"
            >
              <CheckCircle2 className="h-5 w-5" />
              ثبت خروج
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onPress={() => setDenyOpen(true)}
              isDisabled={pass.status !== 'APPROVED'}
              className="rounded-2xl font-bold px-8 flex items-center gap-2"
            >
              <AlertTriangle className="h-5 w-5" />
              اعلام مغایرت
            </Button>
          </div>

          {pass.status !== 'APPROVED' && (
            <Alert status="warning" className="mt-2">
              <AlertContent>
                <AlertTitle>هشدار عدم امکان خروج</AlertTitle>
                <AlertDescription>این برگ خروج در وضعیت قابل خروج نیست.</AlertDescription>
              </AlertContent>
            </Alert>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={verifyOpen}
        title="ثبت خروج"
        description={`با تایید این عملیات، خروج خودرو با پلاک «${pass.licensePlate}» ثبت نهایی می‌شود. آیا اطمینان دارید؟`}
        confirmLabel="ثبت خروج"
        confirmColor="primary"
        loading={verifyMutation.isPending}
        onConfirm={() => verifyMutation.mutate()}
        onClose={() => setVerifyOpen(false)}
      />
      <ConfirmDialog
        open={denyOpen}
        title="اعلام مغایرت"
        description="لطفا دلیل مغایرت و عدم اجازه خروج را ذکر کنید."
        requireReason
        reasonLabel="دلیل مغایرت"
        confirmLabel="ثبت مغایرت"
        confirmColor="danger"
        loading={denyMutation.isPending}
        onConfirm={(reason) => denyMutation.mutate(reason)}
        onClose={() => setDenyOpen(false)}
      />
    </div>
  );
};

export default VerifyGatePassPage;
