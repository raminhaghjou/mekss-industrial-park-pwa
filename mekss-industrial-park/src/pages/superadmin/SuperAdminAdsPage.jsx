import React from 'react';
import { Link } from 'react-router-dom';
import { AdvertisementModerationBoard } from '../../components/advertisements/AdvertisementModerationBoard';
import { FeaturedAdsSettingCard } from '../../components/settings/FeaturedAdsSettingCard';

const SuperAdminAdsPage = () => (
  <div className="flex flex-col gap-6">
    <div>
      <h1 className="text-2xl font-bold text-foreground">تایید آگهی‌ها (ادمین کل)</h1>
      <p className="text-sm text-foreground-500 mt-1">مدیریت، بررسی و تایید آگهی‌های ثبت شده در تمامی شهرک‌های صنعتی</p>
      <Link to="/superadmin/ad-categories" className="mt-2 inline-block text-sm font-semibold text-primary">
        مدیریت دسته‌بندی آگهی‌ها
      </Link>
    </div>
    <FeaturedAdsSettingCard />
    <AdvertisementModerationBoard showParkFilter />
  </div>
);

export default SuperAdminAdsPage;

