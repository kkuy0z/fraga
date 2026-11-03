/**
 * Card component reutilizável
 */

import { HTMLAttributes, forwardRef, ReactNode } from 'react';
import styles from './Card.module.css';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'outlined' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  children: ReactNode;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', padding = 'md', hover = false, className = '', children, ...props }, ref) => {
    const classNames = [
      styles.card,
      styles[variant],
      styles[`padding${padding.charAt(0).toUpperCase() + padding.slice(1)}`],
      hover ? styles.hover : '',
      className,
    ].filter(Boolean).join(' ');

    return (
      <div ref={ref} className={classNames} {...props}>
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ title, subtitle, action, className = '', children, ...props }, ref) => {
    return (
      <div ref={ref} className={`${styles.header} ${className}`} {...props}>
        <div className={styles.headerContent}>
          <h3 className={styles.title}>{title}</h3>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        {action && <div className={styles.headerAction}>{action}</div>}
        {children}
      </div>
    );
  }
);

CardHeader.displayName = 'CardHeader';

export interface CardBodyProps extends HTMLAttributes<HTMLDivElement> {}

export const CardBody = forwardRef<HTMLDivElement, CardBodyProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div ref={ref} className={`${styles.body} ${className}`} {...props}>
        {children}
      </div>
    );
  }
);

CardBody.displayName = 'CardBody';

export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {}

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div ref={ref} className={`${styles.footer} ${className}`} {...props}>
        {children}
      </div>
    );
  }
);

CardFooter.displayName = 'CardFooter';

/**
 * StatCard - Cartão para exibir estatísticas
 */
export interface StatCardProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  icon?: ReactNode;
  trend?: {
    value: string;
    type: 'up' | 'down' | 'neutral';
  };
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
}

export function StatCard({ title, value, icon, trend, variant = 'default', className = '', children, ...props }: StatCardProps) {
  return (
    <Card variant="default" padding="lg" hover className={`${styles.statCard} ${styles[variant]} ${className}`} {...props}>
      <div className={styles.statHeader}>
        <span className={styles.statTitle}>{title}</span>
        {icon && <span className={styles.statIcon}>{icon}</span>}
      </div>
      <div className={styles.statValue}>{value}</div>
      {trend && (
        <div className={`${styles.statTrend} ${styles[`trend${trend.type.charAt(0).toUpperCase() + trend.type.slice(1)}`]}`}>
          <span aria-hidden="true">{trend.type === 'up' ? '↑' : trend.type === 'down' ? '↓' : '→'}</span>
          <span>{trend.value}</span>
        </div>
      )}
      {children}
    </Card>
  );
}

export default Card;