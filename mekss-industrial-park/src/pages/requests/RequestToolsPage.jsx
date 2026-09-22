import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, Button, Input, Label } from '@heroui/react';
import { ArrowRight, Calculator, Download, FileText } from 'lucide-react';

const adminForms = [
  { id: 'settlement', title: 'فرم درخواست تسویه حساب', note: 'نامه تسویه برای مدیر شهرک' },
  { id: 'construction', title: 'فرم کارشناسی مجوز ساخت', note: 'بارگذاری مدارک ساخت' },
  { id: 'final-inspection', title: 'فرم کارشناسی پایان کار', note: 'ارجاع به کارشناس استان' },
  { id: 'appointment', title: 'فرم نوبت کارشناسان صمت', note: 'درخواست وقت ملاقات' },
];

const printFormGuide = (form) => {
  const win = window.open('', '_blank', 'noopener,noreferrer');
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="utf-8"/><title>${form.title}</title>
    <style>body{font-family:Tahoma;padding:24px;line-height:2}h1{font-size:18px}</style></head><body>
    <h1>${form.title}</h1>
    <p>${form.note}</p>
    <p>این نسخه راهنماست. فرم رسمی را از مدیر شهرک دریافت و پس از تکمیل در «ثبت درخواست» بارگذاری کنید.</p>
    <button onclick="window.print()">پرینت</button></body></html>`);
  win.document.close();
};

export const RequestToolsPage = () => {
  const navigate = useNavigate();
  const [area, setArea] = useState('');
  const [chargeRate, setChargeRate] = useState('');
  const [waterRate, setWaterRate] = useState('');
  const [sewageRate, setSewageRate] = useState('');

  const estimate = useMemo(() => {
    const m2 = Number(area) || 0;
    const charge = Number(chargeRate) || 0;
    const water = Number(waterRate) || 0;
    const sewage = Number(sewageRate) || 0;
    const chargeTotal = m2 * charge;
    const utilityTotal = m2 * (water + sewage);
    return {
      chargeTotal,
      utilityTotal,
      grandTotal: chargeTotal + utilityTotal,
    };
  }, [area, chargeRate, waterRate, sewageRate]);

  const formatRial = (v) => `${Number(v || 0).toLocaleString('fa-IR')} ریال`;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" onPress={() => navigate('/requests')} className="gap-2 rounded-xl">
          <ArrowRight className="h-4 w-4" />
          بازگشت
        </Button>
        <h1 className="text-xl font-bold">فرم‌های اداری و محاسبه نرخ</h1>
      </div>

      <Card className="rounded-2xl border border-default-200">
        <CardContent className="gap-4 p-6">
          <div className="flex items-center gap-2 font-bold text-foreground">
            <Download className="h-5 w-5 text-[var(--color-brand)]" />
            دانلود / پرینت فرم‌های اداری
          </div>
          <ul className="divide-y divide-default-100 rounded-xl border border-default-100">
            {adminForms.map((form) => (
              <li key={form.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{form.title}</p>
                  <p className="text-xs text-foreground-500">{form.note}</p>
                </div>
                <Button size="sm" variant="tertiary" className="gap-1 rounded-xl" onPress={() => printFormGuide(form)}>
                  <FileText className="h-4 w-4" />
                  پرینت راهنما
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-default-200">
        <CardContent className="gap-4 p-6">
          <div className="flex items-center gap-2 font-bold text-foreground">
            <Calculator className="h-5 w-5 text-[var(--color-brand)]" />
            ماشین‌حساب ساده نرخ شارژ / آب / فاضلاب
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="مساحت (متر مربع)" value={area} onChange={setArea} />
            <Field label="نرخ شارژ (ریال/م²)" value={chargeRate} onChange={setChargeRate} />
            <Field label="آب (ریال/م²)" value={waterRate} onChange={setWaterRate} />
            <Field label="فاضلاب (ریال/م²)" value={sewageRate} onChange={setSewageRate} />
          </div>
          <div className="rounded-xl bg-default-50 p-4 text-sm">
            <p>شارژ: <strong>{formatRial(estimate.chargeTotal)}</strong></p>
            <p>آب + فاضلاب: <strong>{formatRial(estimate.utilityTotal)}</strong></p>
            <p className="mt-2 text-base font-bold">جمع: {formatRial(estimate.grandTotal)}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const Field = ({ label, value, onChange }) => (
  <div className="flex flex-col gap-1">
    <Label className="text-xs">{label}</Label>
    <Input type="number" dir="ltr" value={value} onChange={(e) => onChange(e.target.value)} className="rounded-xl" />
  </div>
);

export default RequestToolsPage;
