import { useEffect, useState } from 'react';
import { filesApi } from '../../services/api/files.api';

/**
 * Loads a private MinIO-backed file through the authenticated API and renders it.
 * Accepts either a media asset id or a path like `/api/v1/files/:id/content`.
 */
export const AuthenticatedImage = ({
  fileId,
  alt = '',
  className = '',
  fallback = null,
}) => {
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);

  const resolvedId = (() => {
    if (!fileId) return null;
    const value = String(fileId);
    const match = value.match(/\/files\/([^/]+)\/content/);
    if (match) return match[1];
    if (value.startsWith('http') || value.startsWith('blob:') || value.startsWith('data:')) return null;
    return value;
  })();

  useEffect(() => {
    let active = true;
    let objectUrl;

    if (!fileId) {
      setSrc(null);
      setFailed(false);
      return undefined;
    }

    // Direct public/local URLs
    if (!resolvedId && (String(fileId).startsWith('http') || String(fileId).startsWith('blob:') || String(fileId).startsWith('data:'))) {
      setSrc(String(fileId));
      setFailed(false);
      return undefined;
    }

    if (!resolvedId) {
      setSrc(null);
      setFailed(true);
      return undefined;
    }

    setFailed(false);
    filesApi
      .getContentBlob(resolvedId)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (!active) return;
        setFailed(true);
        setSrc(null);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId, resolvedId]);

  if (failed || !src) return fallback;
  return <img src={src} alt={alt} className={className} />;
};

export default AuthenticatedImage;
