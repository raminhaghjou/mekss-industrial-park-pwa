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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  Lock as LockIcon,
  Business as BusinessIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

const RegisterContainer = styled(Container)(({ theme }) => ({
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}));

const RegisterPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  maxWidth: 450,
  width: '100%',
  textAlign: 'center',
}));

export const RegisterPage = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const { showNotification } = useNotification();
  
  const [formData, setFormData] = useState({
    name: '',
    phoneNumber: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'FACTORY_OWNER',
    factoryName: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.name || !formData.phoneNumber || !formData.password) {
      showNotification('لطفاً تمام فیلدهای الزامی را پر کنید', 'error');
      return;
    }
    
    if (formData.password !== formData.confirmPassword) {
      showNotification('رمز عبور و تکرار آن مطابقت ندارند', 'error');
      return;
    }
    
    if (formData.password.length < 8) {
      showNotification('رمز عبور باید حداقل ۸ کاراکتر باشد', 'error');
      return;
    }

    setLoading(true);
    const result = await register(formData);
    setLoading(false);

    if (result.success) {
      showNotification('ثبت نام با موفقیت انجام شد', 'success');
      navigate('/dashboard');
    } else {
      showNotification(result.error || 'ثبت نام ناموفق بود', 'error');
    }
  };

  const handleTogglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleToggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  return (
    <RegisterContainer maxWidth="sm">
      <RegisterPaper elevation={6}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            ثبت نام
          </Typography>
          <Typography variant="body2" color="text.secondary">
            برای استفاده از سیستم، ثبت نام کنید
          </Typography>
        </Box>

        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
          <TextField
            margin="normal"
            required
            fullWidth
            id="name"
            label="نام و نام خانوادگی"
            name="name"
            autoComplete="name"
            autoFocus
            value={formData.name}
            onChange={handleChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PersonIcon />
                </InputAdornment>
              ),
            }}
          />
          
          <TextField
            margin="normal"
            required
            fullWidth
            id="phoneNumber"
            label="شماره تلفن"
            name="phoneNumber"
            autoComplete="tel"
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
            fullWidth
            id="email"
            label="ایمیل (اختیاری)"
            name="email"
            autoComplete="email"
            value={formData.email}
            onChange={handleChange}
          />
          
          <FormControl fullWidth margin="normal">
            <InputLabel id="role-label">نقش</InputLabel>
            <Select
              labelId="role-label"
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
              label="نقش"
            >
              <MenuItem value="FACTORY_OWNER">مالک کارخانه</MenuItem>
              <MenuItem value="PARK_MANAGER">مدیر پارک</MenuItem>
              <MenuItem value="SECURITY_GUARD">نگهبان</MenuItem>
              <MenuItem value="GOVERNMENT_OFFICIAL">نماینده دولت</MenuItem>
            </Select>
          </FormControl>
          
          {formData.role === 'FACTORY_OWNER' && (
            <TextField
              margin="normal"
              fullWidth
              id="factoryName"
              label="نام کارخانه"
              name="factoryName"
              value={formData.factoryName}
              onChange={handleChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <BusinessIcon />
                  </InputAdornment>
                ),
              }}
            />
          )}
          
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="رمز عبور"
            type={showPassword ? 'text' : 'password'}
            id="password"
            autoComplete="new-password"
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
          
          <TextField
            margin="normal"
            required
            fullWidth
            name="confirmPassword"
            label="تکرار رمز عبور"
            type={showConfirmPassword ? 'text' : 'password'}
            id="confirmPassword"
            autoComplete="new-password"
            value={formData.confirmPassword}
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
                    aria-label="toggle confirm password visibility"
                    onClick={handleToggleConfirmPasswordVisibility}
                    edge="end"
                  >
                    {showConfirmPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
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
            {loading ? <CircularProgress size={24} /> : 'ثبت نام'}
          </Button>
          
          <Grid container justifyContent="flex-end">
            <Grid item>
              <Link to="/login" style={{ textDecoration: 'none' }}>
                <Typography variant="body2" color="primary">
                  حساب کاربری دارید؟ وارد شوید
                </Typography>
              </Link>
            </Grid>
          </Grid>
        </Box>
      </RegisterPaper>
    </RegisterContainer>
  );
};