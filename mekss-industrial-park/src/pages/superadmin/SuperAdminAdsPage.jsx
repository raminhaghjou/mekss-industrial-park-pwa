import React from 'react';
import { AdvertisementModerationBoard } from '../../components/advertisements/AdvertisementModerationBoard';

const SuperAdminAdsPage = () => (
  <div className="flex flex-col gap-6">
    <div>
      <h1 className="text-2xl font-bold text-foreground">تایید آگهی‌ها (ادمین کل)</h1>
      <p className="text-sm text-foreground-500 mt-1">مدیریت، بررسی و تایید آگهی‌های ثبت شده در تمامی شهرک‌های صنعتی</p>
    </div>
    <AdvertisementModerationBoard showParkFilter />
  </div>
);

export default SuperAdminAdsPage;

