import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardBody,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Button,
  Input,
  Spinner,
  Alert,
} from '@heroui/react';
import { Search, ShieldCheck, ArrowRight } from 'lucide-react';
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
        <CardBody className="p-4">
          <Input
            size="md"
            label="جست‌وجوی برگ خروج"
            placeholder="بر اساس شماره پلاک یا شناسه برگ خروج..."
            value={search}
            onValueChange={setSearch}
            variant="bordered"
            startContent={<Search className="h-4 w-4 text-default-400" />}
            classNames={{ inputWrapper: 'rounded-xl' }}
          />
        </CardBody>
      </Card>

      {isLoading && (
        <div className="flex min-h-[220px] items-center justify-center">
          <Spinner size="lg" label="در حال دریافت لیست برگ‌های خروج..." />
        </div>
      )}

      {isError && (
        <Alert color="danger" title="خطا">
          {getErrorMessage(error, 'دریافت برگ‌های خروج ناموفق بود.')}
        </Alert>
      )}

      {!isLoading && !isError && (
        <Card className="border border-default-200 shadow-sm rounded-2xl dark:border-white/10 overflow-hidden">
          <Table aria-label="جدول برگ خروج نگهبانی" classNames={{ wrapper: 'p-0 shadow-none' }}>
            <TableHeader>
              <TableColumn className="text-right font-bold">واحد صنعتی</TableColumn>
              <TableColumn className="text-right font-bold">نام راننده</TableColumn>
              <TableColumn className="text-right font-bold">شماره پلاک</TableColumn>
              <TableColumn className="text-center font-bold">عملیات</TableColumn>
            </TableHeader>
            <TableBody emptyContent="هیچ برگ خروج تایید‌شده‌ای برای نمایش وجود ندارد.">
              {approvedPasses.map((pass) => (
                <TableRow key={pass.id}>
                  <TableCell className="font-bold text-foreground">{pass.factory?.name || '—'}</TableCell>
                  <TableCell>{pass.driverName}</TableCell>
                  <TableCell className="font-mono text-sm">{pass.licensePlate}</TableCell>
                  <TableCell className="text-center">
                    <Button
                      size="sm"
                      color="primary"
                      variant="flat"
                      startContent={<ShieldCheck className="h-4 w-4" />}
                      onPress={() => navigate(`/guard/gate-passes/${pass.id}/verify`)}
                      className="rounded-xl font-bold"
                    >
                      بررسی و تایید خروج
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
};

export default GuardGatePassesPage;

