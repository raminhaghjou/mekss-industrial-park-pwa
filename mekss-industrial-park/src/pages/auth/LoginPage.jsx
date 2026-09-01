import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Input, Button, Card, CardBody, CardHeader, Divider, Tabs, Tab } from '@heroui/react';
import { Eye, EyeOff, Phone, Lock, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';
import { useNotification } from '../../providers/NotificationProvider';

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
  const [loginMethod, setLoginMethod] = useState('password');

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 p-4">
      <div className="w-full max-w-md animate-scale-in">
        <Card className="border border-white/20 bg-white/95 backdrop-blur-xl shadow-2xl dark:bg-default-100/95">
          <CardHeader className="flex flex-col gap-2 px-6 pt-8 pb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-2xl font-bold text-white shadow-lg">
              M
            </div>
            <h1 className="text-2xl font-bold text-foreground">ورود به سامانه</h1>
            <p className="text-sm text-foreground-500">مدیریت یکپارچه شهرک صنعتی</p>
          </CardHeader>
          
          <Divider />
          
          <CardBody className="p-6">
            <Tabs
              selectedKey={loginMethod}
              onSelectionChange={setLoginMethod}
              variant="underlined"
              classNames={{
                tabList: 'w-full',
                tab: 'text-sm',
              }}
            >
              <Tab key="password" title="ورود با رمز عبور" />
              <Tab key="otp" title="ورود با کد یکبار" />
            </Tabs>

            <form onSubmit={handlePasswordLogin} className="mt-6 flex flex-col gap-4">
              <Input
                type="tel"
                label="شماره تلفن"
                placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                value={formData.phoneNumber}
                onValueChange={(value) => setFormData({ ...formData, phoneNumber: value })}
                startContent={<Phone className="h-4 w-4 text-default-400" />}
                variant="bordered"
                dir="ltr"
                isRequired
              />

              {loginMethod === 'password' && (
                <Input
                  type={showPassword ? 'text' : 'password'}
                  label="رمز عبور"
                  placeholder="رمز عبور خود را وارد کنید"
                  value={formData.password}
                  onValueChange={(value) => setFormData({ ...formData, password: value })}
                  startContent={<Lock className="h-4 w-4 text-default-400" />}
                  endContent={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-default-400 hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                  variant="bordered"
                  isRequired
                />
              )}

              {loginMethod === 'otp' && (
                <>
                  <Button
                    type="button"
                    color="secondary"
                    variant="flat"
                    onPress={handleSendOtp}
                    isLoading={loading && !otpSent}
                    isDisabled={!formData.phoneNumber || otpSent}
                  >
                    {otpSent ? 'کد ارسال شد' : 'ارسال کد تایید'}
                  </Button>

                  {otpSent && (
                    <Input
                      type="text"
                      label="کد تایید"
                      placeholder="۶ رقمی"
                      value={otpCode}
                      onValueChange={setOtpCode}
                      maxLength={6}
                      variant="bordered"
                      dir="ltr"
                      isRequired
                    />
                  )}
                </>
              )}

              <Button
                type="submit"
                color="primary"
                size="lg"
                className="mt-2 font-semibold"
                isLoading={loading}
                isDisabled={loginMethod === 'otp' && (!otpSent || otpCode.length !== 6)}
              >
                {loginMethod === 'otp' ? 'تایید و ورود' : 'ورود'}
              </Button>
            </form>

            <div className="mt-6 flex items-center justify-between text-sm">
              <Link to="/register" className="text-primary-500 hover:text-primary-600 flex items-center gap-1">
                ثبت‌نام
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <Link to="/forgot-password" className="text-foreground-500 hover:text-foreground-600">
                فراموشی رمز عبور
              </Link>
            </div>
          </CardBody>
        </Card>

        <p className="mt-6 text-center text-sm text-white/70">
          مدیریت یکپارچه، برای شهری که همیشه در حرکت است.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
