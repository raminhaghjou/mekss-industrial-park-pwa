import { useEffect, useState } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  Box,
  Skeleton,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { styled } from '@mui/material/styles';
import { analyticsApi } from '../../services/api/analytics.api';

const StyledCard = styled(Card)(({ theme }) => ({
  height: 400,
}));

const ChartContainer = styled(Box)(({ theme }) => ({
  height: 'calc(100% - 60px)',
  width: '100%',
}));

export const ChartContainerComponent = () => {
  const { user } = useAuth();
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState('line');
  const [timeRange, setTimeRange] = useState('week');

  useEffect(() => {
    fetchChartData();
  }, [user, timeRange]);

  const fetchChartData = async () => {
    try {
      setLoading(true);
      const response = await analyticsApi.getDashboardData({
        parkId: user?.parkId,
        factoryId: user?.factoryId,
        timeRange,
      });
      setChartData(response.data.chartData || []);
    } catch (error) {
      console.error('Failed to fetch chart data:', error);
      setChartData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleChartTypeChange = (event, newChartType) => {
    if (newChartType !== null) {
      setChartType(newChartType);
    }
  };

  const handleTimeRangeChange = (event, newTimeRange) => {
    if (newTimeRange !== null) {
      setTimeRange(newTimeRange);
    }
  };

  const renderChart = () => {
    if (chartData.length === 0) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Typography variant="body2" color="text.secondary">
            داده‌ای برای نمایش وجود ندارد
          </Typography>
        </Box>
      );
    }

    if (chartType === 'line') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip 
              formatter={(value) => [value.toLocaleString('fa-IR'), 'مقدار']}
              labelFormatter={(label) => [`تاریخ: ${label}`, '']}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke="#1976d2" 
              strokeWidth={2}
              name="مقدار"
            />
          </LineChart>
        </ResponsiveContainer>
      );
    }

    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip 
            formatter={(value) => [value.toLocaleString('fa-IR'), 'مقدار']}
            labelFormatter={(label) => [`تاریخ: ${label}`, '']}
          />
          <Legend />
          <Bar dataKey="value" fill="#1976d2" name="مقدار" />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  if (loading) {
    return (
      <StyledCard>
        <CardHeader title="نمودار فعالیت" />
        <CardContent>
          <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress />
          </Box>
        </CardContent>
      </StyledCard>
    );
  }

  return (
    <StyledCard>
      <CardHeader
        title="نمودار فعالیت"
        action={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <ToggleButtonGroup
              value={chartType}
              exclusive
              onChange={handleChartTypeChange}
              size="small"
            >
              <ToggleButton value="line">خطی</ToggleButton>
              <ToggleButton value="bar">ستونی</ToggleButton>
            </ToggleButtonGroup>
            <ToggleButtonGroup
              value={timeRange}
              exclusive
              onChange={handleTimeRangeChange}
              size="small"
            >
              <ToggleButton value="week">هفته</ToggleButton>
              <ToggleButton value="month">ماه</ToggleButton>
              <ToggleButton value="year">سال</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        }
      />
      <CardContent>
        <ChartContainer>
          {renderChart()}
        </ChartContainer>
      </CardContent>
    </StyledCard>
  );
};