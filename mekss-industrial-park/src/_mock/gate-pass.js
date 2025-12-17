export const mockGatePasses = [
  {
    id: 'GP-001',
    driverName: 'علی رضایی',
    plateNumber: '۱۲ع۳۴۵ ایران ۶۷',
    description: 'خروج ضایعات آهن',
    items: [{ name: 'ضایعات آهن', quantity: '۲ تن' }],
    createdAt: '۱۴۰۲/۰۳/۱۲',
    status: 'PENDING', // PENDING, APPROVED, REJECTED
  },
  {
    id: 'GP-002',
    driverName: 'مریم حسینی',
    plateNumber: '۸۸د۴۴۴ ایران ۱۱',
    description: 'حمل محصول نهایی',
    items: [{ name: 'محصول الف', quantity: '۵۰۰ عدد' }],
    createdAt: '۱۴۰۲/۰۳/۱۱',
    status: 'APPROVED',
  },
  {
    id: 'GP-003',
    driverName: 'رضا محمدی',
    plateNumber: '۵۵ب۶۶۶ ایران ۲۲',
    description: 'ورود مواد اولیه',
    items: [{ name: 'ماده اولیه ب', quantity: '۱۰۰۰ کیلوگرم' }],
    createdAt: '۱۴۰۲/۰۳/۱۰',
    status: 'REJECTED',
    rejectionReason: 'عدم تطابق مشخصات',
  },
    {
    id: 'GP-004',
    driverName: 'زهرا احمدی',
    plateNumber: '۳۳ج۷۷۷ ایران ۳۳',
    description: 'خروج تجهیزات برای تعمیر',
    items: [{ name: 'دستگاه پرس', quantity: '۱ عدد' }],
    createdAt: '۱۴۰۲/۰۳/۰۹',
    status: 'APPROVED',
  },
];
