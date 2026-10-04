import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Card, CardContent, Chip, Spinner } from '@heroui/react';
import { Building2, CheckCircle2, LogOut, MapPin, Plus } from 'lucide-react';
import { useActiveFactory } from '../../providers/ActiveFactoryProvider';
import { useAuth } from '../../providers/AuthProvider';
import { safeInternalPath } from '../../utils/navigation';

const statusMeta = {
  ACTIVE: { label: 'فعال', color: 'success' },
  PENDING: { label: 'در انتظار تأیید', color: 'warning' },
  SUSPENDED: { label: 'مسدود', color: 'danger' },
  INACTIVE: { label: 'غیرفعال', color: 'default' },
};

const SelectFactoryPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { factories, activeFactoryId, setActiveFactoryId, isLoading } = useActiveFactory();
  const from = /** @type {any} */ (location.state)?.from;

  const choose = (factoryId) => {
    setActiveFactoryId(factoryId);
    navigate(safeInternalPath(from, '/dashboard', ['/select-factory']), { replace: true });
  };

  return (
    <div className="min-h-dvh bg-background px-4 py-8 sm:py-12">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">انتخاب واحد صنعتی</h1>
            <p className="mt-1 text-sm text-foreground-500">
              {user?.name ? `${user.name} عزیز، ` : ''}
              حساب شما به چند واحد صنعتی دسترسی دارد. واحدی را که می‌خواهید با آن کار کنید انتخاب کنید؛ بعداً از بالای صفحه هم می‌توانید واحد را عوض کنید.
            </p>
          </div>
          <Button variant="ghost" size="sm" className="shrink-0 gap-1 text-danger" onPress={() => logout()}>
            <LogOut className="h-4 w-4" />
            خروج
          </Button>
        </div>

        {isLoading && (
          <div className="flex min-h-[200px] items-center justify-center"><Spinner size="lg" /></div>
        )}

        {!isLoading && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="select-factory-list">
            {factories.map((factory) => {
              const meta = statusMeta[factory.status] || { label: factory.status || '—', color: 'default' };
              const selected = factory.id === activeFactoryId;
              return (
                <Card
                  key={factory.id}
                  className={`rounded-2xl border shadow-sm transition ${selected ? 'border-[var(--color-brand)] ring-2 ring-[var(--color-brand)]/30' : 'border-default-200 dark:border-white/10'}`}
                >
                  <CardContent className="flex flex-col gap-3 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-foreground">{factory.name}</p>
                        {factory.park?.name && (
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-foreground-500">
                            <MapPin className="h-3.5 w-3.5" />
                            {factory.park.name}
                          </p>
                        )}
                      </div>
                      <Chip size="sm" variant="soft" color={/** @type {any} */ (meta.color)}>{meta.label}</Chip>
                    </div>
                    {factory.status === 'SUSPENDED' && factory.suspendedReason && (
                      <p className="text-xs text-danger">دلیل مسدودی: {factory.suspendedReason}</p>
                    )}
                    <Button
                      variant={selected ? 'secondary' : 'primary'}
                      className="rounded-xl font-bold"
                      onPress={() => choose(factory.id)}
                    >
                      {selected && <CheckCircle2 className="h-4 w-4" />}
                      {selected ? 'ادامه با همین واحد' : 'ورود با این واحد'}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Button variant="tertiary" className="self-start rounded-xl gap-1" onPress={() => navigate('/factory/register')}>
          <Plus className="h-4 w-4" />
          افزودن واحد جدید
        </Button>
      </div>
    </div>
  );
};

export default SelectFactoryPage;
