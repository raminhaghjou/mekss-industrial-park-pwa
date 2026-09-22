import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, Input, Button, Label, Spinner } from '@heroui/react';
import { Sparkles } from 'lucide-react';
import { advertisementApi } from '../../services/api/advertisement.api';
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';

export const FeaturedAdsSettingCard = () => {
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'advertisement-featured'],
    queryFn: () => advertisementApi.getFeaturedSettings().then((res) => res.data),
  });
  const [cap, setCap] = useState('');

  const saveMutation = useMutation({
    mutationFn: () => advertisementApi.updateFeaturedSettings(Number(cap)),
    onSuccess: () => {
      showNotification('سقف ماهانه آگهی ویژه ذخیره شد', 'success');
      queryClient.invalidateQueries({ queryKey: ['settings', 'advertisement-featured'] });
    },
    onError: (err) => showNotification(getErrorMessage(err, 'ذخیره تنظیمات ناموفق بود'), 'error'),
  });

  const current = data?.monthlyCap ?? 5;
  const displayCap = cap || String(current);

  return (
    <Card className="rounded-2xl border border-default-200">
      <CardContent className="gap-3 p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-warning-600" />
          <h3 className="font-semibold">سقف ماهانه آگهی ویژه</h3>
        </div>
        <p className="text-xs text-foreground-500">حداکثر تعداد آگهی‌های اسلایدر ویژه در هر ماه</p>
        {isLoading ? (
          <Spinner size="sm" />
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs">سقف</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={displayCap}
                onChange={(e) => setCap(e.target.value)}
                className="w-28 rounded-xl"
                dir="ltr"
              />
            </div>
            <Button
              variant="primary"
              size="sm"
              className="font-bold"
              isDisabled={saveMutation.isPending}
              onPress={() => saveMutation.mutate()}
            >
              ذخیره
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FeaturedAdsSettingCard;
