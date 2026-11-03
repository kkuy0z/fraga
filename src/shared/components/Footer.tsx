/**
 * Componente Footer compartilhado
 */

import styles from './Footer.module.css';

interface FooterProps {
  className?: string;
}

export function Footer({ className = '' }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={`${styles.footer} ${className}`} role="contentinfo">
      <div className={styles.footerContainer}>
        <p className={styles.footerText}>
          © {currentYear} Fraga Lanches - Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}

export default Footer;