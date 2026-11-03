/**
 * Página de Login Admin
 */

import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Header, ToastContainer, Button, Input } from '@components';
import { useAuth, useToast } from '@hooks';
import styles from './AdminLoginPage.module.css';

type FormData = {
  email: string;
  senha: string;
};

const initialFormData: FormData = {
  email: '',
  senha: '',
};

export function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginAdmin, isLoading } = useAuth();
  const { showToast } = useToast();
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [showPassword, setShowPassword] = useState(false);

  const redirect = (location.state as { redirect?: string })?.redirect || '/admin';

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<FormData> = {};

    if (!formData.email.trim()) newErrors.email = 'E-mail é obrigatório';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'E-mail inválido';

    if (!formData.senha) newErrors.senha = 'Senha é obrigatória';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      showToast('Por favor, corrija os erros', 'error');
      return;
    }

    try {
      await loginAdmin({
        email: formData.email.trim().toLowerCase(),
        senha: formData.senha,
      });

      showToast('Login admin realizado com sucesso!', 'success');
      navigate(redirect, { replace: true });
    } catch (error: any) {
      if (error.message?.includes('credenciais') || error.message?.includes('inválidas') || error.message?.includes('não autorizado')) {
        setErrors({ senha: 'E-mail ou senha incorretos' });
      } else {
        showToast(error.message || 'Erro ao fazer login. Tente novamente.', 'error');
      }
    }
  };

  const handleVoltar = () => {
    navigate('/');
  };

  return (
    <>
      <Header currentPage="admin-login" />
      <ToastContainer />
      {isLoading && <div className={styles.loadingOverlay}>Entrando...</div>}

      <section className={styles.login} aria-label="Login Admin">
        <div className={styles.container}>
          <header className={styles.header}>
            <Button variant="ghost" size="sm" onClick={handleVoltar} className={styles.backBtn} aria-label="Voltar">
              ← Voltar ao site
            </Button>
            <div className={styles.logo}>
              <span className={styles.logoIcon} aria-hidden="true">⚙️</span>
              <h1 className={styles.title}>PAINEL ADMIN</h1>
            </div>
            <p className={styles.subtitle}>Acesso restrito a administradores</p>
          </header>

          <form onSubmit={handleSubmit} className={styles.form} noValidate>
            <div className={styles.fieldGroup}>
              <label htmlFor="email" className={styles.label}>
                E-mail <span className={styles.required}>*</span>
              </label>
              <Input
                id="email"
                type="email"
                placeholder="admin@fragalanches.com"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                error={errors.email}
                className={styles.input}
                autoComplete="email"
                autoFocus
              />
              {errors.email && <span className={styles.errorMessage}>{errors.email}</span>}
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="senha" className={styles.label}>
                Senha <span className={styles.required}>*</span>
              </label>
              <div className={styles.passwordWrapper}>
                <Input
                  id="senha"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Sua senha"
                  value={formData.senha}
                  onChange={(e) => handleChange('senha', e.target.value)}
                  error={errors.senha}
                  className={styles.input}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className={styles.togglePassword}
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              {errors.senha && <span className={styles.errorMessage}>{errors.senha}</span>}
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={isLoading}
              className={styles.submitBtn}
            >
              {isLoading ? 'Entrando...' : 'ACESSAR PAINEL'}
            </Button>
          </form>

          <div className={styles.footer}>
            <p>Fraga Lanches - Sistema de Gestão</p>
          </div>
        </div>
      </section>
    </>
  );
}

export default AdminLoginPage;