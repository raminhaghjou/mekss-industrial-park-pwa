import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  Input,
  Button,
  Label,
  Spinner,
} from '@heroui/react';
import { QrCode, ScanLine } from 'lucide-react';
import { gatePassApi } from '../../services/api/gatePass.api';
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';

export const ScanQrPage = () => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [code, setCode] = useState('');

  const lookup = useMutation({
    mutationFn: (qr) => gatePassApi.getByQr(qr.trim()).then((res) => res.data),
    onSuccess: (pass) => {
      showNotification('برگ خروج یافت شد', 'success');
      navigate(`/guard/gate-passes/${pass.id}/verify`);
    },
    onError: (error) => showNotification(getErrorMessage(error, 'کد QR معتبر نیست'), 'error'),
  });

  const submit = (e) => {
    e.preventDefault();
    if (!code.trim()) {
      showNotification('کد QR را وارد کنید', 'error');
      return;
    }
    lookup.mutate(code);
  };

  return (
    <div className="mx-auto max-w-lg animate-fade-in">
      <Card className="rounded-3xl border border-default-200 shadow-sm">
        <CardContent className="gap-6 p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0f4c81]/10 text-[#0f4c81]">
              <ScanLine className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">اسکن کد QR</h1>
              <p className="mt-0.5 text-xs text-foreground-500">کد روی برگ خروج را وارد کنید تا به صفحه تایید بروید.</p>
            </div>
          </div>

          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">کد QR</Label>
              <div className="relative">
                <QrCode className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-400" />
                <Input
                  dir="ltr"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="MEKSS-..."
                  className="rounded-xl pe-10 font-mono"
                  required
                />
              </div>
            </div>
            <Button type="submit" variant="primary" className="h-12 font-bold" isDisabled={lookup.isPending}>
              {lookup.isPending ? <Spinner size="sm" /> : 'جستجو و تایید خروج'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ScanQrPage;
