import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Input, Button, Card, CardBody, CardHeader, Divider, Select, SelectItem } from '@heroui/react';
import { Eye, EyeOff, Phone, Lock, User, Building2, ArrowLeft } from 'lucide-react';
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 p-4">
      <div className="w-full max-w-md animate-scale-in">
        <Card className="border border-white/20 bg-white/95 backdrop-blur-xl shadow-2xl dark:bg-default-100/95">
          <CardHeader className="flex flex-col gap-2 px-6 pt-8 pb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-2xl font-bold text-white shadow-lg">
              M
            </div>
            <h1 className="text-2xl font-bold text-foreground">ثبت‌نام در سامانه</h1>
            <p className="text-sm text-foreground-500">مدیریت یکپارچه شهرک صنعتی</p>
          </CardHeader>
          
          <Divider />
          
          <CardBody className="p-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                type="text"
                label="نام و نام خانوادگی"
                placeholder="نام خود را وارد کنید"
                value={formData.name}
                onValueChange={(value) => setFormData({ ...formData, name: value })}
                startContent={<User className="h-4 w-4 text-default-400" />}
                variant="bordered"
                isRequired
              />

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

              <Select
                label="نوع کاربر"
                selectedKeys={[formData.role]}
                onSelectionChange={(keys) => setFormData({ ...formData, role: Array.from(keys)[0] })}
                variant="bordered"
              >
                <SelectItem key="FACTORY_OWNER">مالک واحد صنعتی</SelectItem>
                <SelectItem key="EMPLOYEE">کارمند</SelectItem>
              </Select>

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

              <Input
                type={showPassword ? 'text' : 'password'}
                label="تکرار رمز عبور"
                placeholder="رمز عبور را تکرار کنید"
                value={formData.confirmPassword}
                onValueChange={(value) => setFormData({ ...formData, confirmPassword: value })}
                startContent={<Lock className="h-4 w-4 text-default-400" />}
                variant="bordered"
                isRequired
              />

              <Button
                type="submit"
                color="primary"
                size="lg"
                className="mt-2 font-semibold"
                isLoading={loading}
              >
                ثبت‌نام
              </Button>
            </form>

            <div className="mt-6 flex items-center justify-center text-sm">
              <Link to="/login" className="text-primary-500 hover:text-primary-600 flex items-center gap-1">
                <ArrowLeft className="h-4 w-4" />
                بازگشت به صفحه ورود
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
};

export default RegisterPage;
