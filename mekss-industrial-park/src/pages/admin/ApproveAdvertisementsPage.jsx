import React from 'react';
import { Megaphone } from 'lucide-react';
import { AdvertisementModerationBoard } from '../../components/advertisements/AdvertisementModerationBoard';

const ApproveAdvertisementsPage = () => (
  <div className="flex flex-col gap-6">
    <div className="flex items-center gap-3">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-100 dark:bg-primary-900/40 text-primary-600">
        <Megaphone className="h-6 w-6" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-foreground">تایید آگهی‌ها</h1>
        <p className="text-sm text-foreground-500">بررسی، تایید و انتشار آگهی‌های ثبت شده در شهرک صنعتی</p>
      </div>
    </div>
    <AdvertisementModerationBoard />
  </div>
);

export default ApproveAdvertisementsPage;

