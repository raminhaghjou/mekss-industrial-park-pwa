import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  Table, TableContent,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Button,
  Input,
  Spinner,
  Alert,
  AlertContent,
  AlertTitle,
  AlertDescription,
  Label,
} from '@heroui/react';
import { Search, ShieldCheck } from 'lucide-react';
import { gatePassApi } from '../../services/api/gatePass.api';
import { getErrorMessage } from '../../utils/apiError';

const GuardGatePassesPage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['gate-passes', 'guard'],
    queryFn: () => gatePassApi.getGatePasses().then((res) => res.data),
  });

  const approvedPasses = (data || []).filter((pass) => pass.status === 'APPROVED').filter((pass) => {
    if (!search.trim()) return true;
    const query = search.trim();
    return pass.licensePlate.includes(query) || pass.id.includes(query);
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">برگ‌های خروج در انتظار تایید نهایی</h1>
        <p className="text-sm text-foreground-500 mt-1">لیست مجوزهای تاییدشده ترافیک خروجی شهرک</p>
      </div>

      <Card className="border border-default-200 shadow-sm rounded-2xl dark:border-white/10">
        <CardContent className="p-4">
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-medium text-foreground-600">جست‌وجوی برگ خروج</Label>
            <div className="relative flex items-center">
              <Search className="absolute right-3 h-4 w-4 text-default-400 pointer-events-none" />
              <Input
                placeholder="بر اساس شماره پلاک یا شناسه برگ خروج..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                variant="primary"
                className="pr-9 rounded-xl"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex min-h-[220px] items-center justify-center">
          <Spinner size="lg" />
        </div>
      )}

      {isError && (
        <Alert status="danger">
          <AlertContent>
            <AlertTitle>خطا</AlertTitle>
            <AlertDescription>{getErrorMessage(error, 'دریافت برگ‌های خروج ناموفق بود.')}</AlertDescription>
          </AlertContent>
        </Alert>
      )}

      {!isLoading && !isError && (
        <Card className="border border-default-200 shadow-sm rounded-2xl dark:border-white/10 overflow-hidden">
          <Table>
              <TableContent aria-label="جدول برگ خروج نگهبانی">
              <TableHeader>
              <TableColumn className="text-right font-bold" isRowHeader>واحد صنعتی</TableColumn>
              <TableColumn className="text-right font-bold">نام راننده</TableColumn>
              <TableColumn className="text-right font-bold">شماره پلاک</TableColumn>
              <TableColumn className="text-center font-bold">عملیات</TableColumn>
            </TableHeader>
            <TableBody>
              {approvedPasses.map((pass) => (
                <TableRow key={pass.id} id={pass.id}>
                  <TableCell className="font-bold text-foreground">{pass.factory?.name || '—'}</TableCell>
                  <TableCell>{pass.driverName}</TableCell>
                  <TableCell className="font-mono text-sm">{pass.licensePlate}</TableCell>
                  <TableCell className="text-center">
                    <Button
                      size="sm"
                      variant="secondary"
                      onPress={() => navigate(`/guard/gate-passes/${pass.id}/verify`)}
                      className="rounded-xl font-bold flex items-center gap-2"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      بررسی و تایید خروج
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
              </TableContent>
            </Table>
        </Card>
      )}
    </div>
  );
};

export default GuardGatePassesPage;
