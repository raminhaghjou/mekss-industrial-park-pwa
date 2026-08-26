import React from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  Box,
  Paper,
  Tabs,
  Tab,
  Card,
  CardContent,
  CardActions,
  Button,
  Grid,
  Typography,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import { advertisementApi } from '../../services/api/advertisement.api';
import { useNotification } from '../../providers/NotificationProvider';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { getErrorMessage } from '../../utils/apiError';

const categoryLabels = {
  EQUIPMENT: 'تجهیزات', SERVICES: 'خدمات', RAW_MATERIALS: 'مواد اولیه', JOB_LISTINGS: 'فرصت شغلی', REAL_ESTATE: 'املاک', OTHER: 'سایر',
};

/**
 * Shared moderation board reused by both PARK_MANAGER and SUPER_ADMIN advertisement
 * moderation pages. Scope is enforced server-side; this component only renders
 * whatever the authorized backend contract returns.
 */
export const AdvertisementModerationBoard = () => {
  const [tab, setTab] = React.useState(0);
  const [rejectTarget, setRejectTarget] = React.useState(null);
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();

  const pendingQuery = useQuery({
    queryKey: ['advertisements', 'managed', 'pending'],
    queryFn: () => advertisementApi.getManagedPending().then((res) => res.data),
    enabled: tab === 0,
  });

  const historyQuery = useQuery({
    queryKey: ['advertisements', 'managed', 'history'],
    queryFn: () => advertisementApi.getManagedHistory().then((res) => res.data),
    enabled: tab === 1,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['advertisements', 'managed', 'pending'] });
    queryClient.invalidateQueries({ queryKey: ['advertisements', 'managed', 'history'] });
  };

  const approveMutation = useMutation({
    mutationFn: (/** @type {string} */ id) => advertisementApi.approveAdvertisement(id),
    onSuccess: () => { showNotification('آگهی با موفقیت تایید شد.', 'success'); invalidate(); },
    onError: (err) => showNotification(getErrorMessage(err, 'تایید آگهی ناموفق بود.'), 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: (/** @type {{id: string, reason: string}} */ { id, reason }) => advertisementApi.rejectAdvertisement(id, reason),
    onSuccess: () => { showNotification('آگهی رد شد.', 'success'); setRejectTarget(null); invalidate(); },
    onError: (err) => showNotification(getErrorMessage(err, 'رد آگهی ناموفق بود.'), 'error'),
  });

  const activeQuery = tab === 0 ? pendingQuery : historyQuery;
  const ads = activeQuery.data || [];

  return (
    <Box>
      <Paper>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tab} onChange={(_, value) => setTab(value)}>
            <Tab label="در انتظار تایید" />
            <Tab label="تاریخچه" />
          </Tabs>
        </Box>
        <Box sx={{ p: 2 }}>
          {activeQuery.isLoading && <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>}
          {activeQuery.isError && <Alert severity="error">{getErrorMessage(activeQuery.error, 'دریافت آگهی‌ها ناموفق بود.')}</Alert>}
          {!activeQuery.isLoading && !activeQuery.isError && ads.length === 0 && (
            <Typography color="text.secondary" sx={{ p: 2 }}>موردی برای نمایش وجود ندارد.</Typography>
          )}
          {!activeQuery.isLoading && !activeQuery.isError && ads.length > 0 && (
            <Grid container spacing={3}>
              {ads.map((ad) => (
                <Grid item xs={12} sm={6} md={4} key={ad.id}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6">{ad.title}</Typography>
                      <Typography color="text.secondary" gutterBottom>{ad.createdBy?.name} — {ad.park?.name || 'بدون شهرک مشخص'}</Typography>
                      <Chip size="small" label={categoryLabels[ad.category] || ad.category} sx={{ mb: 1 }} />
                      <Typography variant="body2" sx={{ mb: 1 }}>{ad.content}</Typography>
                      {ad.status !== 'PENDING' && (
                        <Chip
                          size="small"
                          label={ad.status === 'APPROVED' ? 'تایید شده' : 'رد شده'}
                          color={ad.status === 'APPROVED' ? 'success' : 'error'}
                        />
                      )}
                      {ad.status === 'REJECTED' && ad.rejectionReason && (
                        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>دلیل رد: {ad.rejectionReason}</Typography>
                      )}
                    </CardContent>
                    {ad.status === 'PENDING' && (
                      <CardActions>
                        <Button size="small" color="success" onClick={() => approveMutation.mutate(ad.id)} disabled={approveMutation.isPending}>تایید</Button>
                        <Button size="small" color="error" onClick={() => setRejectTarget(ad.id)}>رد</Button>
                      </CardActions>
                    )}
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      </Paper>
      <ConfirmDialog
        open={Boolean(rejectTarget)}
        title="رد آگهی"
        description="لطفا دلیل رد این آگهی را وارد کنید."
        requireReason
        reasonLabel="دلیل رد"
        confirmLabel="رد کردن"
        confirmColor="error"
        loading={rejectMutation.isPending}
        onConfirm={(reason) => rejectMutation.mutate({ id: rejectTarget, reason })}
        onClose={() => setRejectTarget(null)}
      />
    </Box>
  );
};

export default AdvertisementModerationBoard;
