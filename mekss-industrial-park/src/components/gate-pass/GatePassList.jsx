import React from 'react';
import {
  Table, TableContent,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Card,
  CardContent,
} from '@heroui/react';

const statusColors = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  COMPLETED: 'accent',
  EXPIRED: 'default',
};

const statusLabels = {
  PENDING: 'در انتظار',
  APPROVED: 'تایید شده',
  REJECTED: 'رد شده',
  COMPLETED: 'تکمیل شده',
  EXPIRED: 'منقضی شده',
};

const GatePassList = ({ passes }) => {
  if (!passes || passes.length === 0) {
    return (
      <Card className="border border-default-200 shadow-sm rounded-2xl p-6 text-center">
        <p className="text-sm text-foreground-500">هیچ برگ خروجی برای نمایش وجود ندارد.</p>
      </Card>
    );
  }

  return (
    <Card className="border border-default-200 shadow-sm rounded-2xl overflow-hidden dark:border-white/10">
      <CardContent className="p-0">
        <Table>
              <TableContent aria-label="جدول برگ خروج" className="min-w-[650px]">
              <TableHeader>
            <TableColumn className="font-bold text-right" isRowHeader>نام راننده</TableColumn>
            <TableColumn className="font-bold text-right">شماره پلاک</TableColumn>
            <TableColumn className="font-bold text-right">نوع بار</TableColumn>
            <TableColumn className="font-bold text-right">تاریخ خروج</TableColumn>
            <TableColumn className="font-bold text-center">وضعیت</TableColumn>
          </TableHeader>
          <TableBody>
            {passes.map((pass) => (
              <TableRow key={pass.id} id={pass.id}>
                <TableCell className="font-medium text-foreground">{pass.driverName}</TableCell>
                <TableCell className="font-mono dir-ltr text-right">{pass.licensePlate}</TableCell>
                <TableCell>{pass.cargoDescription || pass.cargoType}</TableCell>
                <TableCell>{new Date(pass.exitDate).toLocaleDateString('fa-IR')}</TableCell>
                <TableCell className="text-center">
                  <Chip color={statusColors[pass.status] || 'default'} size="sm" variant="soft" className="font-semibold">
                    {statusLabels[pass.status] || pass.status}
                  </Chip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
              </TableContent>
            </Table>
      </CardContent>
    </Card>
  );
};

export default GatePassList;
