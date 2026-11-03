/**
 * ImageUpload component reutilizável
 */

import { useState, useRef, ChangeEvent, DragEvent, ReactNode } from 'react';
import { Button } from './Button';
import styles from './ImageUpload.module.css';

export interface ImageUploadProps {
  value?: string | null;
  onChange: (file: File | null, preview: string | null) => void;
  onRemove?: () => void;
  label?: string;
  accept?: string;
  maxSize?: number; // em MB
  multiple?: false;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  children?: ReactNode;
}

export function ImageUpload({
  value,
  onChange,
  onRemove,
  label = 'Imagem',
  accept = 'image/*',
  maxSize = 5,
  disabled = false,
  required = false,
  className = '',
  children,
}: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(value || null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value) {
      setPreview(value);
    }
  }, [value]);

  const validateFile = (file: File): boolean => {
    if (!accept.split(',').some((type) => file.type.match(type.replace('*', '.*')))) {
      setError(`Tipo de arquivo não suportado. Use: ${accept}`);
      return false;
    }
    if (file.size > maxSize * 1024 * 1024) {
      setError(`Arquivo muito grande. Máximo: ${maxSize}MB`);
      return false;
    }
    setError(null);
    return true;
  };

  const handleFileSelect = (file: File | null) => {
    if (!file) {
      setPreview(null);
      onChange(null, null);
      onRemove?.();
      return;
    }

    if (!validateFile(file)) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const previewUrl = e.target?.result as string;
      setPreview(previewUrl);
      onChange(file, previewUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    handleFileSelect(file);
    if (e.target) e.target.value = '';
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setDragActive(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (disabled) return;

    const file = e.dataTransfer.files[0] || null;
    handleFileSelect(file);
  };

  const handleRemove = () => {
    setPreview(null);
    onChange(null, null);
    onRemove?.();
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const classNames = [
    styles.wrapper,
    dragActive ? styles.dragActive : '',
    disabled ? styles.disabled : '',
    preview ? styles.hasPreview : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classNames}>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        disabled={disabled}
        required={required}
        className={styles.input}
        aria-label={label}
      />

      <div
        className={styles.dropZone}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={triggerFileInput}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
            e.preventDefault();
            triggerFileInput();
          }
        }}
        aria-label={`Área de upload de ${label}`}
      >
        {preview ? (
          <div className={styles.preview}>
            <img src={preview} alt={`Preview de ${label}`} className={styles.previewImage} />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={styles.removeBtn}
              onClick={(e) => {
                e.stopPropagation();
                handleRemove();
              }}
              disabled={disabled}
              aria-label={`Remover ${label}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </Button>
          </div>
        ) : (
          <div className={styles.placeholder}>
            {children || (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className={styles.icon}>
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <p className={styles.placeholderText}>
                  <strong>Clique ou arraste</strong> para fazer upload
                </p>
                <p className={styles.placeholderHint}>
                  {accept.split(',').map((t) => t.trim()).join(', ')} · Máx. {maxSize}MB
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}
    </div>
  );
}

export default ImageUpload;