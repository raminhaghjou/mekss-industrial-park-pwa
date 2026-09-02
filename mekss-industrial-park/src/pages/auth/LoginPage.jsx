import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Input, Button, Card, CardContent, CardHeader, Separator, Tabs, TabList, Tab, Label } from '@heroui/react';
import { Eye, EyeOff, Phone, Lock, ArrowLeft, ShieldCheck, Sparkles } from 'lucide-react';
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

  const handlePasswordLogin = async () => {
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loginMethod === 'otp') {
      await handleOtpLogin();
    } else {
      await handlePasswordLogin();
    }
  };

  const inputWrapperClass = 'border-white/15 bg-slate-950/50 backdrop-blur-md rounded-xl text-white';

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 p-4 font-sans text-slate-100 antialiased selection:bg-cyan-500 selection:text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-pulse-slow absolute -top-40 -left-40 h-[550px] w-[550px] rounded-full bg-gradient-to-br from-indigo-600/40 via-purple-600/30 to-cyan-500/20 blur-3xl" />
        <div className="animate-pulse-slow absolute -bottom-40 -right-40 h-[600px] w-[600px] rounded-full bg-gradient-to-tr from-cyan-600/35 via-blue-600/30 to-indigo-600/20 blur-3xl" style={{ animationDelay: '3s' }} />
        <div className="absolute inset-0 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:32px_32px] opacity-15" />
      </div>

      <div className="relative z-10 w-full max-w-md animate-scale-in">
        <Card className="glass-card border border-white/20 bg-slate-900/75 p-2 backdrop-blur-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)]">
          <CardHeader className="flex flex-col items-center gap-3 px-6 pt-8 pb-4 text-center">
            <div className="group relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 p-[2px] shadow-xl transition-all duration-300 hover:scale-105">
              <div className="flex h-full w-full items-center justify-center rounded-[22px] bg-slate-950/80 backdrop-blur-md">
                <span className="bg-gradient-to-r from-cyan-400 to-indigo-300 bg-clip-text text-3xl font-black text-transparent">
                  M
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300 backdrop-blur-md">
                <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                سامانه هوشمند MEKSS
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">ورود به حساب کاربری</h1>
              <p className="text-xs text-slate-400">مدیریت دیجیتال و یکپارچه شهرک صنعتی</p>
            </div>
          </CardHeader>

          <Separator className="my-2 bg-white/10" />

          <CardContent className="px-6 py-4">
            <Tabs
              selectedKey={loginMethod}
              onSelectionChange={(key) => setLoginMethod(String(key))}
              variant="primary"
              className="w-full"
            >
              <TabList className="w-full bg-slate-950/60 p-1 border border-white/10 rounded-2xl">
                <Tab id="password" className="text-xs md:text-sm font-medium rounded-xl">ورود با رمز عبور</Tab>
                <Tab id="otp" className="text-xs md:text-sm font-medium rounded-xl">ورود با رمز یک‌بار مصرف</Tab>
              </TabList>
            </Tabs>

            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <Label className="text-slate-300 text-xs font-medium">شماره تلفن همراه</Label>
                <div className="relative flex items-center">
                  <Phone className="absolute right-3 h-4 w-4 text-cyan-400 pointer-events-none" />
                  <Input
                    type="tel"
                    placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    variant="primary"
                    dir="ltr"
                    isRequired
                    className={`pr-9 ${inputWrapperClass} hover:border-cyan-500/50 focus-within:border-cyan-500 text-left placeholder:text-slate-500`}
                  />
                </div>
              </div>

              {loginMethod === 'password' && (
                <div className="flex flex-col gap-1">
                  <Label className="text-slate-300 text-xs font-medium">رمز عبور</Label>
                  <div className="relative flex items-center">
                    <Lock className="absolute right-3 h-4 w-4 text-indigo-400 pointer-events-none" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="رمز عبور خود را وارد کنید"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      variant="primary"
                      isRequired
                      className={`pr-9 pl-9 ${inputWrapperClass} hover:border-indigo-500/50 focus-within:border-indigo-500 placeholder:text-slate-500`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 text-slate-400 transition-colors hover:text-white"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

              {loginMethod === 'otp' && (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    onPress={handleSendOtp}
                    isLoading={loading && !otpSent}
                    isDisabled={!formData.phoneNumber || otpSent}
                    className="w-full rounded-xl bg-purple-600/20 text-purple-300 border border-purple-500/30 hover:bg-purple-600/30 font-medium"
                  >
                    {otpSent ? 'کد تایید ارسال شد' : 'ارسال کد تایید پیامکی'}
                  </Button>

                  {otpSent && (
                    <div className="flex flex-col gap-1">
                      <Label className="text-purple-300 text-xs font-medium">کد تایید پیامک شده</Label>
                      <Input
                        type="text"
                        placeholder="۶ رقمی"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        maxLength={6}
                        variant="primary"
                        dir="ltr"
                        isRequired
                        className="border-purple-500/40 bg-slate-950/60 backdrop-blur-md focus-within:border-purple-400 rounded-xl text-white font-mono text-center tracking-widest text-lg placeholder:text-slate-600"
                      />
                    </div>
                  )}
                </>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="mt-2 w-full rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-bold shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.01] hover:shadow-indigo-600/50 active:scale-[0.99]"
                isLoading={loading}
                isDisabled={loginMethod === 'otp' && (!otpSent || otpCode.length !== 6)}
              >
                {loginMethod === 'otp' ? 'تایید و ورود به داشبورد' : 'ورود به حساب کاربری'}
              </Button>
            </form>

            <div className="mt-6 flex items-center justify-between text-xs md:text-sm">
              <Link to="/register" className="flex items-center gap-1.5 font-medium text-cyan-400 transition-colors hover:text-cyan-300">
                ثبت‌نام حساب جدید
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <Link to="/forgot-password" className="text-slate-400 transition-colors hover:text-slate-200">
                بازیابی رمز عبور
              </Link>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-slate-400">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span>سامانه مدیریت هوشمند و ایمن شهرک صنعتی MEKSS</span>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
