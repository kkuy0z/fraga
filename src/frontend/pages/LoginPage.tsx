/**
 * Página de Login
 */

import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Header, ToastContainer, Button, Input, Checkbox } from '@components';
import { useAuth, useToast } from '@hooks';
import styles from './LoginPage.module.css';

type FormData = {
  email: string;
  senha: string;
  lembrar: boolean;
};

const initialFormData: FormData = {
  email: '',
  senha: '',
  lembrar: false,
};

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading } = useAuth();
  const { showToast } = useToast();
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [showPassword, setShowPassword] = useState(false);

  // Redirect após login
  const redirect = (location.state as { redirect?: string })?.redirect || '/';

  const handleChange = (field: keyof FormData, value: string | boolean) => {
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
      await login({
        email: formData.email.trim().toLowerCase(),
        senha: formData.senha,
        lembrar: formData.lembrar,
      });

      showToast('Login realizado com sucesso!', 'success');
      navigate(redirect, { replace: true });
    } catch (error: any) {
      if (error.message?.includes('credenciais') || error.message?.includes('inválidas')) {
        setErrors({ senha: 'E-mail ou senha incorretos' });
      } else {
        showToast(error.message || 'Erro ao fazer login. Tente novamente.', 'error');
      }
    }
  };

  const handleCadastroClick = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate('/cadastro', { state: { redirect } });
  };

  const handleEsqueciSenha = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate('/recuperar-senha', { state: { redirect } });
  };

  return (
    <>
      <Header currentPage="login" />
      <ToastContainer />
      {isLoading && <div className={styles.loadingOverlay}>Entrando...</div>}

      <section className={styles.login} aria-label="Login">
        <div className={styles.container}>
          <header className={styles.header}>
            <h1 className={styles.title}>ENTRAR</h1>
            <p className={styles.subtitle}>Acesse sua conta para fazer pedidos</p>
          </header>

          <form onSubmit={handleSubmit} className={styles.form} noValidate>
            <div className={styles.fieldGroup}>
              <label htmlFor="email" className={styles.label}>
                E-mail <span className={styles.required}>*</span>
              </label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
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

            <div className={styles.options}>
              <Checkbox
                id="lembrar"
                checked={formData.lembrar}
                onChange={(checked) => handleChange('lembrar', checked)}
                label="Lembrar-me"
                className={styles.checkbox}
              />
              <button
                type="button"
                onClick={handleEsqueciSenha}
                className={styles.forgotLink}
              >
                Esqueci a senha
              </button>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={isLoading}
              className={styles.submitBtn}
            >
              {isLoading ? 'Entrando...' : 'ENTRAR'}
            </Button>

            <p className={styles.registerLink}>
              Não tem conta? <button type="button" onClick={handleCadastroClick} className={styles.linkBtn}>Cadastrar</button>
            </p>

            <div className={styles.divider}>
              <span>ou continue com</span>
            </div>

            <Button
              type="button"
              variant="secondary"
              size="md"
              fullWidth
              onClick={() => navigate('/admin/login', { state: { redirect: '/admin' } })}
              className={styles.adminBtn}
            >
              Acessar Painel Admin
            </Button>
          </form>
        </div>
      </section>
    </>
  );
}

export default LoginPage;