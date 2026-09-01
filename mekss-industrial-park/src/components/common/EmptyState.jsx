import { Inbox } from 'lucide-react';

export const EmptyState = ({ icon, title, description, className = '' }) => {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-8 text-center animate-fade-in ${className}`}>
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-default-100 text-default-400">
        {icon || <Inbox className="h-6 w-6" />}
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="max-w-sm text-sm text-foreground-500">{description}</p>
      )}
    </div>
  );
};

export default EmptyState;
