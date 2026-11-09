/**
 * Componente de Notificações Push - RF-21
 * Gerencia permissão, inscrição e preferências de notificações push
 */

import { useEffect, useState, useCallback } from 'react';
import { Header, ToastContainer, LoadingOverlay, Button, Switch, Card } from '@components';
import { useToast } from '@hooks';
import { useAuth } from '@hooks';
import { api } from '@api/client';
import styles from './NotificacoesPage.module.css';

type PushSubscriptionData = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  user_agent: string;
  created_at: string;
};

type NotificacaoPreferencias = {
  pedidos: boolean;
  promocao: boolean;
  entrega: boolean;
  avaliacao: boolean;
};

const initialPreferencias: NotificacaoPreferencias = {
  pedidos: true,
  promocao: false,
  entrega: true,
  avaliacao: true,
};

export function NotificacoesPage() {
  const { isClienteAuthenticated, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();
  const [subscription, setSubscription] = useState<PushSubscriptionData | null>(null);
  const [preferencias, setPreferencias] = useState<NotificacaoPreferencias>(initialPreferencias);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [support, setSupport] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Verificar suporte
      const supported = 'serviceWorker' in navigator && 'PushManager' in window;
      setSupport(supported);

      if (!supported) {
        setPermission('denied');
        return;
      }

      // Verificar permissão atual
      setPermission(Notification.permission);

      // Verificar inscrição existente
      const registration = await navigator.serviceWorker.ready;
      const existingSubscription = await registration.pushManager.getSubscription();

      if (existingSubscription) {
        setSubscription({
          endpoint: existingSubscription.endpoint,
          keys: {
            p256dh: arrayBufferToBase64(existingSubscription.getKey('p256dh')),
            auth: arrayBufferToBase64(existingSubscription.getKey('auth')),
          },
          user_agent: navigator.userAgent,
          created_at: new Date().toISOString(),
        });
      }

      // Carregar preferências do servidor (salvas localmente por enquanto)
      try {
        const savedPrefs = localStorage.getItem('notificacoes_preferencias');
        if (savedPrefs) {
          setPreferencias(JSON.parse(savedPrefs));
        }
      } catch {
        // Usar padrão se falhar
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Atualizar preferência local
  const handlePrefChange = (key: keyof NotificacaoPreferencias, value: boolean) => {
    setPreferencias(prev => ({ ...prev, [key]: value }));
  };

  // Salvar preferências localmente
  const handleSavePrefs = async () => {
    setIsSavingPrefs(true);
    try {
      localStorage.setItem('notificacoes_preferencias', JSON.stringify(preferencias));
      showToast('Preferências salvas', 'success');
    } catch (err: any) {
      showToast(err.message || 'Erro ao salvar preferências', 'error');
    } finally {
      setIsSavingPrefs(false);
    }
  };

  // Solicitar permissão e inscrever
  const handleSubscribe = async () => {
    if (!support) {
      showToast('Seu navegador não suporta notificações push', 'error');
      return;
    }

    setIsSubscribing(true);
    try {
      // Solicitar permissão
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') {
        showToast('Permissão negada para notificações', 'warning');
        return;
      }

      // Obter chave VAPID do servidor
      const { publicKey: vapidPublicKey } = await api.getVapidPublicKey();

      // Inscrever
      const registration = await navigator.serviceWorker.ready;
      const newSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      // Enviar para servidor
      await api.subscribeToPush(newSubscription);

      setSubscription({
        endpoint: newSubscription.endpoint,
        keys: {
          p256dh: arrayBufferToBase64(newSubscription.getKey('p256dh')),
          auth: arrayBufferToBase64(newSubscription.getKey('auth')),
        },
        user_agent: navigator.userAgent,
        created_at: new Date().toISOString(),
      });

      showToast('Notificações ativadas com sucesso!', 'success');
    } catch (err: any) {
      console.error('Erro ao inscrever:', err);
      showToast(err.message || 'Erro ao ativar notificações', 'error');
    } finally {
      setIsSubscribing(false);
    }
  };

  // Cancelar inscrição
  const handleUnsubscribe = async () => {
    if (!subscription) return;

    setIsSubscribing(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const existingSubscription = await registration.pushManager.getSubscription();

      if (existingSubscription) {
        await existingSubscription.unsubscribe();
      }

      await api.unsubscribeFromPush(subscription.endpoint);
      setSubscription(null);
      showToast('Notificações desativadas', 'success');
    } catch (err: any) {
      showToast(err.message || 'Erro ao desativar notificações', 'error');
    } finally {
      setIsSubscribing(false);
    }
  };

  if (authLoading) {
    return (
      <>
        <Header currentPage="notificacoes" />
        <ToastContainer />
        <LoadingOverlay message="Carregando..." />
      </>
    );
  }

  if (!isClienteAuthenticated) {
    return (
      <>
        <Header currentPage="notificacoes" />
        <ToastContainer />
        <div className={styles.errorContainer}>
          <div className={styles.errorCard}>
            <h1>🔒</h1>
            <h2>Área Restrita</h2>
            <p>Faça login para gerenciar suas notificações.</p>
            <Button variant="primary" onClick={() => window.location.href = '/cadastro'}>
              Entrar / Cadastrar
            </Button>
          </div>
        </div>
      </>
    );
  }

  if (isLoading) {
    return (
      <>
        <Header currentPage="notificacoes" />
        <ToastContainer />
        <LoadingOverlay message="Carregando notificações..." />
      </>
    );
  }

  return (
    <>
      <Header currentPage="notificacoes" />
      <ToastContainer />

      <div className={styles.page}>
        {/* Status de Suporte */}
        <section className={styles.statusSection} aria-labelledby="status-title">
          <h2 id="status-title" className={styles.sectionTitle}>STATUS DO DISPOSITIVO</h2>

          <div className={styles.statusGrid}>
            <div className={styles.statusCard}>
              <div className={styles.statusIcon}>
                {support ? '✅' : '❌'}
              </div>
              <div className={styles.statusInfo}>
                <span className={styles.statusLabel}>Suporte a Push</span>
                <span className={styles.statusValue}>
                  {support ? 'Disponível' : 'Não suportado'}
                </span>
              </div>
            </div>

            <div className={styles.statusCard}>
              <div className={styles.statusIcon}>
                {permission === 'granted' ? '✅' : permission === 'denied' ? '❌' : '❓'}
              </div>
              <div className={styles.statusInfo}>
                <span className={styles.statusLabel}>Permissão</span>
                <span className={styles.statusValue}>
                  {permission === 'granted' ? 'Concedida' : permission === 'denied' ? 'Negada' : 'Pendente'}
                </span>
              </div>
            </div>

            <div className={styles.statusCard}>
              <div className={styles.statusIcon}>
                {subscription ? '✅' : '⭕'}
              </div>
              <div className={styles.statusInfo}>
                <span className={styles.statusLabel}>Inscrição</span>
                <span className={styles.statusValue}>
                  {subscription ? 'Ativa' : 'Inativa'}
                </span>
              </div>
            </div>
          </div>

          {!support && (
            <div className={styles.notSupported}>
              <p>Seu navegador não suporta notificações push.</p>
              <p>Tente usar Chrome, Firefox, Edge ou Safari atualizados.</p>
            </div>
          )}

          {permission === 'denied' && support && (
            <div className={styles.permissionDenied}>
              <p>As notificações foram bloqueadas nas configurações do navegador.</p>
              <p>Para habilitar, clique no ícone de cadeado/alerta na barra de endereço e permita notificações.</p>
            </div>
          )}
        </section>

        {/* Ações de Inscrição */}
        {support && (
          <section className={styles.actionsSection} aria-labelledby="actions-title">
            <h2 id="actions-title" className={styles.sectionTitle}>NOTIFICAÇÕES PUSH</h2>

            {subscription ? (
              <Card className={styles.subscriptionCard}>
                <div className={styles.subscriptionInfo}>
                  <div className={`${styles.subscriptionBadge} ativa`}>ATIVA</div>
                  <div>
                    <p className={styles.subscriptionText}>
                      Você receberá notificações sobre seus pedidos, entregas e promoções.
                    </p>
                    <p className={styles.subscriptionDetails}>
                      Endpoint: {subscription.endpoint.substring(0, 50)}...
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  className={styles.unsubscribeBtn}
                  onClick={handleUnsubscribe}
                  disabled={isSubscribing}
                >
                  {isSubscribing ? 'Desativando...' : 'Desativar Notificações'}
                </Button>
              </Card>
            ) : (
              <Card className={styles.subscribeCard}>
                <div className={styles.subscribeInfo}>
                  <div className={styles.subscribeIcon}>🔔</div>
                  <div>
                    <h3 className={styles.subscribeTitle}>Ativar Notificações</h3>
                    <p className={styles.subscribeText}>
                      Receba atualizações em tempo real sobre seus pedidos, status de entrega e ofertas especiais.
                    </p>
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="lg"
                  className={styles.subscribeBtn}
                  onClick={handleSubscribe}
                  disabled={isSubscribing || permission === 'denied'}
                >
                  {isSubscribing ? 'Ativando...' : 'Ativar Notificações'}
                </Button>
              </Card>
            )}
          </section>
        )}

        {/* Preferências de Notificação */}
        <section className={styles.prefsSection} aria-labelledby="prefs-title">
          <h2 id="prefs-title" className={styles.sectionTitle}>PREFERÊNCIAS DE NOTIFICAÇÃO</h2>

          <p className={styles.prefsDesc}>
            Escolha quais tipos de notificação você deseja receber:
          </p>

          <div className={styles.prefsList}>
            <div className={styles.prefItem}>
              <div className={styles.prefInfo}>
                <span className={styles.prefIcon}>📦</span>
                <div>
                  <span className={styles.prefLabel}>Pedidos</span>
                  <span className={styles.prefDesc}>Confirmação, preparo, saída para entrega</span>
                </div>
              </div>
              <Switch
                checked={preferencias.pedidos}
                onChange={(checked) => handlePrefChange('pedidos', checked)}
                disabled={isSavingPrefs}
              />
            </div>

            <div className={styles.prefItem}>
              <div className={styles.prefInfo}>
                <span className={styles.prefIcon}>🚚</span>
                <div>
                  <span className={styles.prefLabel}>Entrega</span>
                  <span className={styles.prefDesc}>Rastreamento em tempo real, chegada do entregador</span>
                </div>
              </div>
              <Switch
                checked={preferencias.entrega}
                onChange={(checked) => handlePrefChange('entrega', checked)}
                disabled={isSavingPrefs}
              />
            </div>

            <div className={styles.prefItem}>
              <div className={styles.prefInfo}>
                <span className={styles.prefIcon}>⭐</span>
                <div>
                  <span className={styles.prefLabel}>Avaliações</span>
                  <span className={styles.prefDesc}>Lembrete para avaliar após entrega</span>
                </div>
              </div>
              <Switch
                checked={preferencias.avaliacao}
                onChange={(checked) => handlePrefChange('avaliacao', checked)}
                disabled={isSavingPrefs}
              />
            </div>

            <div className={styles.prefItem}>
              <div className={styles.prefInfo}>
                <span className={styles.prefIcon}>🎁</span>
                <div>
                  <span className={styles.prefLabel}>Promoções</span>
                  <span className={styles.prefDesc}>Ofertas especiais, cupons, novidades</span>
                </div>
              </div>
              <Switch
                checked={preferencias.promocao}
                onChange={(checked) => handlePrefChange('promocao', checked)}
                disabled={isSavingPrefs}
              />
            </div>
          </div>

          <Button
            variant="primary"
            className={styles.savePrefsBtn}
            onClick={handleSavePrefs}
            disabled={isSavingPrefs}
          >
            {isSavingPrefs ? 'Salvando...' : 'Salvar Preferências'}
          </Button>
        </section>

        {/* Informações */}
        <section className={styles.infoSection} aria-labelledby="info-title">
          <h2 id="info-title" className={styles.sectionTitle}>SOBRE NOTIFICAÇÕES</h2>

          <div className={styles.infoGrid}>
            <div className={styles.infoCard}>
              <div className={styles.infoIcon}>🔒</div>
              <h3>Privacidade</h3>
              <p>Seus dados de inscrição são criptografados e usados apenas para enviar notificações. Não compartilhamos com terceiros.</p>
            </div>

            <div className={styles.infoCard}>
              <div className={styles.infoIcon}>⚡</div>
              <h3>Tempo Real</h3>
              <p>Notificações são entregues instantaneamente via Service Worker, mesmo com o app fechado.</p>
            </div>

            <div className={styles.infoCard}>
              <div className={styles.infoIcon}>🎛️</div>
              <h3>Controle Total</h3>
              <p>Você pode desativar notificações a qualquer momento nas configurações do navegador ou aqui.</p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

// Utilitários
function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default NotificacoesPage;