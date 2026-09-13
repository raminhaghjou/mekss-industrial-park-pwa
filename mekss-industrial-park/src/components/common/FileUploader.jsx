import { useRef, useState } from 'react';
import { Button, Spinner } from '@heroui/react';
import { Upload, X } from 'lucide-react';
import { filesApi } from '../../services/api/files.api';
import { getErrorMessage } from '../../utils/apiError';
import { AuthenticatedImage } from './AuthenticatedImage';

const DEFAULT_ACCEPT = {
  avatar: 'image/jpeg,image/png,image/webp,image/gif',
  logo: 'image/jpeg,image/png,image/webp,image/gif',
  document: 'image/*,application/pdf,.doc,.docx,.xls,.xlsx',
  invoice: 'application/pdf,image/*',
  'gate-pass': 'image/jpeg,image/png,image/webp',
  advertisement: 'image/jpeg,image/png,image/webp,image/gif',
  request: 'image/*,application/pdf',
  message: 'image/*,application/pdf',
  announcement: 'image/*,application/pdf',
};

/**
 * Reusable upload control for MinIO-backed media.
 * onUploaded(fileDto) receives { id, url, originalName, contentType, ... }
 */
export const FileUploader = ({
  domain = 'document',
  parkId,
  factoryId,
  value,
  onUploaded,
  onCleared,
  label = 'آپلود فایل',
  hint,
  accept,
  disabled = false,
  preview = true,
  className = '',
}) => {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [localPreview, setLocalPreview] = useState(null);

  const openPicker = () => {
    if (disabled || uploading) return;
    inputRef.current?.click();
  };

  const handleSelect = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setError('');
    setUploading(true);
    if (file.type.startsWith('image/')) {
      setLocalPreview(URL.createObjectURL(file));
    } else {
      setLocalPreview(null);
    }

    try {
      const { data } = await filesApi.upload(file, { domain, parkId, factoryId });
      onUploaded?.(data);
    } catch (err) {
      setLocalPreview(null);
      setError(getErrorMessage(err, 'آپلود فایل ناموفق بود'));
    } finally {
      setUploading(false);
    }
  };

  const clear = () => {
    setLocalPreview(null);
    setError('');
    onCleared?.();
  };

  const showImage = preview && (localPreview || value);

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept || DEFAULT_ACCEPT[domain] || '*/*'}
        onChange={handleSelect}
      />

      <div className="flex flex-wrap items-center gap-3">
        {showImage ? (
          <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-default-200 bg-default-100 dark:border-white/10">
            {localPreview ? (
              <img src={localPreview} alt="" className="h-full w-full object-cover" />
            ) : (
              <AuthenticatedImage
                fileId={typeof value === 'object' ? value?.id : value}
                className="h-full w-full object-cover"
                fallback={<div className="flex h-full w-full items-center justify-center text-xs text-foreground-500">پیش‌نمایش</div>}
              />
            )}
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              className="gap-2"
              isDisabled={disabled || uploading}
              onPress={openPicker}
            >
              {uploading ? <Spinner size="sm" /> : <Upload className="h-4 w-4" />}
              {uploading ? 'در حال آپلود...' : label}
            </Button>
            {(value || localPreview) && (
              <Button type="button" variant="ghost" className="gap-1 text-danger" isDisabled={uploading} onPress={clear}>
                <X className="h-4 w-4" />
                حذف
              </Button>
            )}
          </div>
          {hint ? <p className="text-xs text-foreground-500">{hint}</p> : null}
          {error ? <p className="text-xs text-danger">{error}</p> : null}
          {value?.originalName ? (
            <p className="text-xs text-foreground-500">{value.originalName}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default FileUploader;
