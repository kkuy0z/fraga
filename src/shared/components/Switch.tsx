/**
 * Switch component reutilizável
 */

import { InputHTMLAttributes, forwardRef } from 'react';
import styles from './Switch.module.css';

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ label, description, size = 'md', className = '', id, ...props }, ref) => {
    const switchId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const descId = description ? `${switchId}-desc` : undefined;

    const classNames = [
      styles.wrapper,
      styles[size],
      className,
    ].filter(Boolean).join(' ');

    return (
      <label className={classNames} htmlFor={switchId}>
        <input
          ref={ref}
          type="checkbox"
          id={switchId}
          className={styles.input}
          aria-describedby={descId}
          {...props}
        />
        <span className={styles.track} aria-hidden="true">
          <span className={styles.thumb} />
        </span>
        {(label || description) && (
          <div className={styles.content}>
            {label && <span className={styles.label}>{label}</span>}
            {description && <span id={descId} className={styles.description}>{description}</span>}
          </div>
        )}
      </label>
    );
  }
);

Switch.displayName = 'Switch';

export default Switch;