import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../providers/AuthProvider';
import { useNotification } from '../../providers/NotificationProvider';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  IconButton,
  InputAdornment,
  CircularProgress,
  Grid,
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Phone as PhoneIcon,
  Lock as LockIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

const LoginContainer = styled(Container)(({ theme }) => ({
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}));

const LoginPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  maxWidth: 400,
  width: '100%',
  textAlign: 'center',
}));

export const LoginPage = () => {
  const navigate = useNavigate();
  const { login, sendOtp, verifyOtp } = useAuth();
  const { showNotification } = useNotification();
  
  const [formData, setFormData] = useState({
    phoneNumber: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSendOtp = async () => {
    if (!formData.phoneNumber) {
      showNotification('لطفاً شماره تلفن را وارد کنید', 'error');
      return;
    }

    setLoading(true);
    const result = await sendOtp(formData.phoneNumber);
    setLoading(false);

    if (result.success) {
      setOtpSent(true);
      showNotification('کد تایید ارسال شد', 'success');
    } else {
      showNotification(result.error || 'ارسال کد تایید ناموفق بود', 'error');
    }
  };

  const handleOtpLogin = async () => {
    if (!otpCode || otpCode.length !== 6) {
      showNotification('لطفاً کد تایید ۶ رقمی را وارد کنید', 'error');
      return;
    }

    setLoading(true);
    const result = await verifyOtp(formData.phoneNumber, otpCode);
    setLoading(false);

    if (result.success) {
      // Handle OTP verification success
      showNotification('ورود با موفقیت انجام شد', 'success');
      navigate('/dashboard');
    } else {
      showNotification(result.error || 'کد تایید اشتباه است', 'error');
    }
  };

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    
    if (!formData.phoneNumber || !formData.password) {
      showNotification('لطفاً تمام فیلدها را پر کنید', 'error');
      return;
    }

    setLoading(true);
    const result = await login(formData);
    setLoading(false);

    if (result.success) {
      showNotification('ورود با موفقیت انجام شد', 'success');
      navigate('/dashboard');
    } else {
      showNotification(result.error || 'ورود ناموفق بود', 'error');
    }
  };

  const handleTogglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <LoginContainer maxWidth="sm">
      <LoginPaper elevation={6}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            ورود به سیستم
          </Typography>
          <Typography variant="body2" color="text.secondary">
            برای دسترسی به سیستم، وارد شوید
          </Typography>
        </Box>

        <Box component="form" onSubmit={handlePasswordLogin} sx={{ mt: 1 }}>
          {!otpSent ? (
            <>
              <TextField
                margin="normal"
                required
                fullWidth
                id="phoneNumber"
                label="شماره تلفن"
                name="phoneNumber"
                autoComplete="tel"
                autoFocus
                value={formData.phoneNumber}
                onChange={handleChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PhoneIcon />
                    </InputAdornment>
                  ),
                }}
              />
              
              <TextField
                margin="normal"
                required
                fullWidth
                name="password"
                label="رمز عبور"
                type={showPassword ? 'text' : 'password'}
                id="password"
                autoComplete="current-password"
                value={formData.password}
                onChange={handleChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={handleTogglePasswordVisibility}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              
              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{ mt: 3, mb: 2 }}
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} /> : 'ورود'}
              </Button>
              
              <Button
                fullWidth
                variant="outlined"
                sx={{ mb: 2 }}
                onClick={handleSendOtp}
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} /> : 'ورود با کد تایید'}
              </Button>
            </>
          ) : (
            <>
              <TextField
                margin="normal"
                required
                fullWidth
                id="otp"
                label="کد تایید"
                name="otp"
                autoFocus
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                inputProps={{ maxLength: 6, pattern: '[0-9]*' }}
              />
              
              <Button
                fullWidth
                variant="contained"
                sx={{ mt: 3, mb: 2 }}
                onClick={handleOtpLogin}
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} /> : 'تایید و ورود'}
              </Button>
              
              <Button
                fullWidth
                variant="text"
                sx={{ mb: 2 }}
                onClick={() => {
                  setOtpSent(false);
                  setOtpCode('');
                }}
              >
                بازگشت
              </Button>
            </>
          )}
          
          <Grid container>
            <Grid item xs>
              <Link to="/forgot-password" style={{ textDecoration: 'none' }}>
                <Typography variant="body2" color="primary">
                  رمز عبور را فراموش کرده‌اید؟
                </Typography>
              </Link>
            </Grid>
            <Grid item>
              <Link to="/register" style={{ textDecoration: 'none' }}>
                <Typography variant="body2" color="primary">
                  ثبت نام
                </Typography>
              </Link>
            </Grid>
          </Grid>
        </Box>
      </LoginPaper>
    </LoginContainer>
  );
};