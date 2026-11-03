/**
 * Checkbox component reutilizável
 */

import { InputHTMLAttributes, forwardRef } from 'react';
import styles from './Checkbox.module.css';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  description?: string;
  fullWidth?: boolean;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, fullWidth = false, className = '', id, ...props }, ref) => {
    const checkboxId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const descId = description ? `${checkboxId}-desc` : undefined;

    const classNames = [
      styles.wrapper,
      fullWidth ? styles.fullWidth : '',
      className,
    ].filter(Boolean).join(' ');

    return (
      <div className={classNames}>
        <label htmlFor={checkboxId} className={styles.label}>
          <input
            ref={ref}
            type="checkbox"
            id={checkboxId}
            className={styles.input}
            aria-describedby={descId}
            {...props}
          />
          <span className={styles.box} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          {label && <span className={styles.labelText}>{label}</span>}
        </label>
        {description && (
          <span id={descId} className={styles.description}>
            {description}
          </span>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';

export default Checkbox;