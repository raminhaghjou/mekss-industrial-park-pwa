import { Spinner } from '@heroui/react';

export const LoadingScreen = ({ message = 'در حال بارگذاری...' }) => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-xl font-bold text-white shadow-lg">
        M
      </div>
      <Spinner size="lg" color="success" />
      <p className="text-sm text-foreground-500">{message}</p>
    </div>
  );
};

export default LoadingScreen;
