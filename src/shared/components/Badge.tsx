/**
 * Badge component reutilizável
 */

import { HTMLAttributes, forwardRef } from 'react';
import styles from './Badge.module.css';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
  outline?: boolean;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = 'default', size = 'md', dot = false, outline = false, className = '', children, ...props }, ref) => {
    const classNames = [
      styles.badge,
      styles[variant],
      styles[size],
      outline ? styles.outline : '',
      dot ? styles.dot : '',
      className,
    ].filter(Boolean).join(' ');

    return (
      <span ref={ref} className={classNames} {...props}>
        {dot && <span className={styles.dotIndicator} aria-hidden="true" />}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export default Badge;