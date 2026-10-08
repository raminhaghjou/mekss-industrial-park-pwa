import { useState } from 'react';
import { Input } from '@heroui/react';
import { Eye, EyeOff } from 'lucide-react';

/** HeroUI Input with a show/hide toggle so users can check what they typed. */
export const PasswordInput = ({ className = '', ...props }) => {
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative block w-full">
      <Input
        {...props}
        type={visible ? 'text' : 'password'}
        dir={props.dir ?? 'ltr'}
        className={`w-full pl-10 ${className}`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 hover:text-foreground-700"
        aria-label={visible ? 'پنهان کردن رمز' : 'نمایش رمز'}
        title={visible ? 'پنهان کردن رمز' : 'نمایش رمز'}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </span>
  );
};

export default PasswordInput;
