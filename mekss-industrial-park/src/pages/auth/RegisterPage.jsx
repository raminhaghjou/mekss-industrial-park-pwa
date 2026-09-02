import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Input, Button, Card, CardBody, CardHeader, Divider, Select, SelectItem } from '@heroui/react';
import { Eye, EyeOff, Phone, Lock, User, ArrowLeft, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';
import { useNotification } from '../../providers/NotificationProvider';

export const RegisterPage = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const { showNotification } = useNotification();
  
  const [formData, setFormData] = useState({
    name: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
    role: 'FACTORY_OWNER',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.phoneNumber || !formData.password) {
      showNotification('لطفاً تمام فیلدها را پر کنید', 'error');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      showNotification('رمز عبور و تکرار آن یکسان نیستند', 'error');
      return;
    }

    setLoading(true);
    const result = await register(formData);
    setLoading(false);

    if (result.success) {
      showNotification('ثبت‌نام با موفقیت انجام شد', 'success');
      navigate('/login');
    } else {
      showNotification(result.error || 'ثبت‌نام ناموفق بود', 'error');
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 p-4 font-sans text-slate-100 antialiased selection:bg-cyan-500 selection:text-white">
      {/* Animated Futuristic Ambient Mesh & Particles Background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-pulse-slow absolute -top-40 -right-40 h-[550px] w-[550px] rounded-full bg-gradient-to-bl from-purple-600/40 via-indigo-600/30 to-blue-500/20 blur-3xl" />
        <div className="animate-pulse-slow absolute -bottom-40 -left-40 h-[600px] w-[600px] rounded-full bg-gradient-to-tr from-indigo-600/35 via-cyan-600/30 to-purple-600/20 blur-3xl" style={{ animationDelay: '3s' }} />
        <div className="absolute inset-0 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:32px_32px] opacity-15" />
      </div>

      <div className="relative z-10 w-full max-w-md animate-scale-in">
        <Card className="glass-card border border-white/20 bg-slate-900/75 p-2 backdrop-blur-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)]">
          <CardHeader className="flex flex-col items-center gap-3 px-6 pt-8 pb-4 text-center">
            <div className="group relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-500 p-[2px] shadow-xl transition-all duration-300 hover:scale-105">
              <div className="flex h-full w-full items-center justify-center rounded-[22px] bg-slate-950/80 backdrop-blur-md">
                <span className="bg-gradient-to-r from-purple-400 via-indigo-300 to-cyan-400 bg-clip-text text-3xl font-black text-transparent">
                  M
                </span>
              </div>
            </div>
            
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-300 backdrop-blur-md">
                <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                عضویت در شهرک صنعتی MEKSS
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">ایجاد حساب کاربری جدید</h1>
              <p className="text-xs text-slate-400">اطلاعات کاربری خود را برای ثبت درخواست وارد کنید</p>
            </div>
          </CardHeader>
          
          <Divider className="my-2 bg-white/10" />
          
          <CardBody className="px-6 py-4">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                type="text"
                label="نام و نام خانوادگی"
                placeholder="نام کامل خود را وارد کنید"
                value={formData.name}
                onValueChange={(value) => setFormData({ ...formData, name: value })}
                startContent={<User className="h-4 w-4 text-purple-400" />}
                variant="bordered"
                isRequired
                classNames={{
                  inputWrapper: 'border-white/15 bg-slate-950/50 backdrop-blur-md hover:border-purple-500/50 focus-within:!border-purple-500 rounded-xl text-white',
                  label: 'text-slate-300 text-xs font-medium',
                  input: 'text-white font-medium placeholder:text-slate-500',
                }}
              />

              <Input
                type="tel"
                label="شماره تلفن همراه"
                placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                value={formData.phoneNumber}
                onValueChange={(value) => setFormData({ ...formData, phoneNumber: value })}
                startContent={<Phone className="h-4 w-4 text-cyan-400" />}
                variant="bordered"
                dir="ltr"
                isRequired
                classNames={{
                  inputWrapper: 'border-white/15 bg-slate-950/50 backdrop-blur-md hover:border-cyan-500/50 focus-within:!border-cyan-500 rounded-xl text-white',
                  label: 'text-slate-300 text-xs font-medium',
                  input: 'text-white font-medium text-left placeholder:text-slate-500',
                }}
              />

              <Select
                label="نقش کاربری"
                selectedKeys={[formData.role]}
                onSelectionChange={(keys) => setFormData({ ...formData, role: Array.from(keys)[0] })}
                variant="bordered"
                classNames={{
                  trigger: 'border-white/15 bg-slate-950/50 backdrop-blur-md hover:border-indigo-500/50 rounded-xl text-white',
                  label: 'text-slate-300 text-xs font-medium',
                  value: 'text-white font-medium',
                }}
              >
                <SelectItem key="FACTORY_OWNER">مالک واحد صنعتی / کارخانه</SelectItem>
                <SelectItem key="EMPLOYEE">کارمند / پرسنل واحد</SelectItem>
              </Select>

              <Input
                type={showPassword ? 'text' : 'password'}
                label="رمز عبور"
                placeholder="حداقل ۶ کاراکتر"
                value={formData.password}
                onValueChange={(value) => setFormData({ ...formData, password: value })}
                startContent={<Lock className="h-4 w-4 text-indigo-400" />}
                endContent={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-slate-400 transition-colors hover:text-white"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
                variant="bordered"
                isRequired
                classNames={{
                  inputWrapper: 'border-white/15 bg-slate-950/50 backdrop-blur-md hover:border-indigo-500/50 focus-within:!border-indigo-500 rounded-xl text-white',
                  label: 'text-slate-300 text-xs font-medium',
                  input: 'text-white font-medium placeholder:text-slate-500',
                }}
              />

              <Input
                type={showPassword ? 'text' : 'password'}
                label="تکرار رمز عبور"
                placeholder="رمز عبور را مجدداً وارد کنید"
                value={formData.confirmPassword}
                onValueChange={(value) => setFormData({ ...formData, confirmPassword: value })}
                startContent={<Lock className="h-4 w-4 text-indigo-400" />}
                variant="bordered"
                isRequired
                classNames={{
                  inputWrapper: 'border-white/15 bg-slate-950/50 backdrop-blur-md hover:border-indigo-500/50 focus-within:!border-indigo-500 rounded-xl text-white',
                  label: 'text-slate-300 text-xs font-medium',
                  input: 'text-white font-medium placeholder:text-slate-500',
                }}
              />

              <Button
                type="submit"
                color="primary"
                size="lg"
                className="mt-2 w-full rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 text-white font-bold shadow-lg shadow-purple-600/30 transition-all hover:scale-[1.01] hover:shadow-purple-600/50 active:scale-[0.99]"
                isLoading={loading}
              >
                تکمیل ثبت‌نام و ایجاد حساب
              </Button>
            </form>

            <div className="mt-6 flex items-center justify-center text-xs md:text-sm">
              <Link to="/login" className="flex items-center gap-1.5 font-medium text-cyan-400 transition-colors hover:text-cyan-300">
                <ArrowLeft className="h-4 w-4" />
                قبلاً ثبت‌نام کرده‌اید؟ ورود به حساب
              </Link>
            </div>
          </CardBody>
        </Card>

        <div className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-slate-400">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span>حفاظت از اطلاعات با پروتکل‌های امنیتی MEKSS</span>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;

