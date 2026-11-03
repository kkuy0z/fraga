/**
 * Página de Cadastro
 */

import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Header, ToastContainer, Button, Input, Checkbox } from '@components';
import { useAuth, useToast } from '@hooks';
import { api } from '@api/client';
import { validarCPF } from '@shared/utils';
import styles from './CadastroPage.module.css';

type FormData = {
  nome: string;
  email: string;
  telefone: string;
  cpf: string;
  senha: string;
  confirmarSenha: string;
  termos: boolean;
};

const initialFormData: FormData = {
  nome: '',
  email: '',
  telefone: '',
  cpf: '',
  senha: '',
  confirmarSenha: '',
  termos: false,
};

export function CadastroPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { register, isLoading } = useAuth();
  const { showToast } = useToast();
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Redirect após cadastro
  const redirect = (location.state as { redirect?: string })?.redirect || '/';

  const handleChange = (field: keyof FormData, value: string | boolean) => {
    let formattedValue = value;

    if (field === 'telefone' && typeof value === 'string') {
      formattedValue = value
        .replace(/\D/g, '')
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2');
    } else if (field === 'cpf' && typeof value === 'string') {
      formattedValue = value
        .replace(/\D/g, '')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})/, '$1-$2');
    }

    setFormData(prev => ({ ...prev, [field]: formattedValue }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<FormData> = {};

    if (!formData.nome.trim()) newErrors.nome = 'Nome é obrigatório';
    else if (formData.nome.trim().length < 3) newErrors.nome = 'Nome deve ter pelo menos 3 caracteres';

    if (!formData.email.trim()) newErrors.email = 'E-mail é obrigatório';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'E-mail inválido';

    if (!formData.telefone.trim()) newErrors.telefone = 'Telefone é obrigatório';
    else if (formData.telefone.replace(/\D/g, '').length < 10) newErrors.telefone = 'Telefone inválido';

    if (!formData.cpf.trim()) newErrors.cpf = 'CPF é obrigatório';
    else if (!validarCPF(formData.cpf)) newErrors.cpf = 'CPF inválido';

    if (!formData.senha) newErrors.senha = 'Senha é obrigatória';
    else if (formData.senha.length < 6) newErrors.senha = 'Senha deve ter pelo menos 6 caracteres';

    if (!formData.confirmarSenha) newErrors.confirmarSenha = 'Confirme sua senha';
    else if (formData.senha !== formData.confirmarSenha) newErrors.confirmarSenha = 'Senhas não conferem';

    if (!formData.termos) newErrors.termos = 'Você deve aceitar os termos de uso';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      showToast('Por favor, corrija os erros no formulário', 'error');
      return;
    }

    try {
      await register({
        nome: formData.nome.trim(),
        email: formData.email.trim().toLowerCase(),
        telefone: formData.telefone.replace(/\D/g, ''),
        cpf: formData.cpf.replace(/\D/g, ''),
        senha: formData.senha,
      });

      showToast('Cadastro realizado com sucesso! Bem-vindo!', 'success');
      navigate(redirect, { replace: true });
    } catch (error: any) {
      if (error.message?.includes('email')) {
        setErrors({ email: 'Este e-mail já está cadastrado' });
      } else if (error.message?.includes('cpf')) {
        setErrors({ cpf: 'Este CPF já está cadastrado' });
      } else {
        showToast(error.message || 'Erro ao cadastrar. Tente novamente.', 'error');
      }
    }
  };

  const handleLoginClick = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate('/login', { state: { redirect } });
  };

  return (
    <>
      <Header currentPage="cadastro" />
      <ToastContainer />
      {isLoading && <div className={styles.loadingOverlay}>Processando...</div>}

      <section className={styles.cadastro} aria-label="Cadastro">
        <div className={styles.container}>
          <header className={styles.header}>
            <h1 className={styles.title}>CRIAR CONTA</h1>
            <p className={styles.subtitle}>Cadastre-se e faça seus pedidos com facilidade</p>
          </header>

          <form onSubmit={handleSubmit} className={styles.form} noValidate>
            <div className={styles.fieldGroup}>
              <label htmlFor="nome" className={styles.label}>
                Nome Completo <span className={styles.required}>*</span>
              </label>
              <Input
                id="nome"
                type="text"
                placeholder="Seu nome completo"
                value={formData.nome}
                onChange={(e) => handleChange('nome', e.target.value)}
                error={errors.nome}
                className={styles.input}
                autoComplete="name"
                autoFocus
              />
              {errors.nome && <span className={styles.errorMessage}>{errors.nome}</span>}
            </div>

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
              />
              {errors.email && <span className={styles.errorMessage}>{errors.email}</span>}
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="telefone" className={styles.label}>
                Telefone <span className={styles.required}>*</span>
              </label>
              <Input
                id="telefone"
                type="tel"
                placeholder="(11) 99999-9999"
                value={formData.telefone}
                onChange={(e) => handleChange('telefone', e.target.value)}
                error={errors.telefone}
                className={styles.input}
                autoComplete="tel"
              />
              {errors.telefone && <span className={styles.errorMessage}>{errors.telefone}</span>}
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="cpf" className={styles.label}>
                CPF <span className={styles.required}>*</span>
              </label>
              <Input
                id="cpf"
                type="text"
                placeholder="000.000.000-00"
                value={formData.cpf}
                onChange={(e) => handleChange('cpf', e.target.value)}
                error={errors.cpf}
                className={styles.input}
              />
              {errors.cpf && <span className={styles.errorMessage}>{errors.cpf}</span>}
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="senha" className={styles.label}>
                Senha <span className={styles.required}>*</span>
              </label>
              <div className={styles.passwordWrapper}>
                <Input
                  id="senha"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={formData.senha}
                  onChange={(e) => handleChange('senha', e.target.value)}
                  error={errors.senha}
                  className={styles.input}
                  autoComplete="new-password"
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

            <div className={styles.fieldGroup}>
              <label htmlFor="confirmarSenha" className={styles.label}>
                Confirmar Senha <span className={styles.required}>*</span>
              </label>
              <div className={styles.passwordWrapper}>
                <Input
                  id="confirmarSenha"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirme sua senha"
                  value={formData.confirmarSenha}
                  onChange={(e) => handleChange('confirmarSenha', e.target.value)}
                  error={errors.confirmarSenha}
                  className={styles.input}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className={styles.togglePassword}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-pressed={showConfirmPassword}
                >
                  {showConfirmPassword ? '🙈' : '👁️'}
                </button>
              </div>
              {errors.confirmarSenha && <span className={styles.errorMessage}>{errors.confirmarSenha}</span>}
            </div>

            <div className={styles.fieldGroup}>
              <Checkbox
                id="termos"
                checked={formData.termos}
                onChange={(checked) => handleChange('termos', checked)}
                label={
                  <>
                    Li e concordo com os
                    <Link to="/termos" target="_blank" rel="noopener noreferrer" className={styles.link}>
                      Termos de Uso
                    </Link>
                    e
                    <Link to="/privacidade" target="_blank" rel="noopener noreferrer" className={styles.link}>
                      Política de Privacidade
                    </Link>
                    <span className={styles.required}>*</span>
                  </>
                }
                error={errors.termos}
                className={styles.checkbox}
              />
              {errors.termos && <span className={styles.errorMessage}>{errors.termos}</span>}
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={isLoading}
              className={styles.submitBtn}
            >
              {isLoading ? 'Cadastrando...' : 'CRIAR CONTA'}
            </Button>

            <p className={styles.loginLink}>
              Já tem conta? <button type="button" onClick={handleLoginClick} className={styles.linkBtn}>Entrar</button>
            </p>
          </form>
        </div>
      </section>
    </>
  );
}

export default CadastroPage;