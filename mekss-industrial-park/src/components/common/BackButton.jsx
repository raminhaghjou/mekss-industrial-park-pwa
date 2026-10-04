import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { backTarget } from '../../utils/navigation';

export const BackButton = ({ fallback = '/dashboard', hiddenOn = ['/dashboard'], className = '' }) => {
  const navigate = useNavigate();
  const location = useLocation();

  if (hiddenOn.includes(location.pathname)) return null;

  const handleClick = () => {
    const target = backTarget(window.history.state?.idx, fallback);
    if (target === -1) navigate(-1);
    else navigate(target);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="بازگشت"
      title="بازگشت"
      data-testid="back-button"
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-foreground transition hover:bg-default-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-brand)] ${className}`}
    >
      <ArrowRight className="h-5 w-5" />
    </button>
  );
};

export default BackButton;
