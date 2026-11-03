/**
 * Textarea component reutilizável
 */

import { TextareaHTMLAttributes, forwardRef } from 'react';
import styles from './Textarea.module.css';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
  maxLength?: number;
  showCharCount?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    { label, error, helperText, fullWidth = false, maxLength, showCharCount = false, className = '', id, ...props },
    ref
  ) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const errorId = error ? `${textareaId}-error` : undefined;
    const helperId = helperText ? `${textareaId}-helper` : undefined;
    const countId = showCharCount && maxLength ? `${textareaId}-count` : undefined;

    const classNames = [
      styles.wrapper,
      fullWidth ? styles.fullWidth : '',
      error ? styles.hasError : '',
      className,
    ].filter(Boolean).join(' ');

    const currentLength = props.value?.length || 0;

    return (
      <div className={classNames}>
        {label && (
          <label htmlFor={textareaId} className={styles.label}>
            {label}
            {props.required && <span className={styles.required} aria-hidden="true">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={styles.textarea}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={[errorId, helperId, countId].filter(Boolean).join(' ') || undefined}
          maxLength={maxLength}
          {...props}
        />
        {(error || helperText || (showCharCount && maxLength)) && (
          <div className={styles.footer}>
            {error && (
              <span id={errorId} className={styles.error} role="alert">
                {error}
              </span>
            )}
            {helperText && !error && (
              <span id={helperId} className={styles.helperText}>
                {helperText}
              </span>
            )}
            {showCharCount && maxLength && (
              <span id={countId} className={currentLength > maxLength ? styles.countExceeded : styles.charCount}>
                {currentLength} / {maxLength}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export default Textarea;