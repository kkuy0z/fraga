/**
 * Push Notifications utility
 * Handles VAPID key conversion, subscription, and permission management
 */

// Convert VAPID public key from base64 to Uint8Array
export function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// Check if push notifications are supported
export function isPushSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window;
}

// Check current notification permission
export function getNotificationPermission() {
    return Notification.permission;
}

// Request notification permission
export async function requestNotificationPermission() {
    if (!isPushSupported()) {
        return { granted: false, error: 'Push notifications not supported' };
    }

    try {
        const permission = await Notification.requestPermission();
        return { granted: permission === 'granted', permission };
    } catch (error) {
        return { granted: false, error: error.message };
    }
}

// Subscribe to push notifications
export async function subscribeToPush(api) {
    if (!isPushSupported()) {
        return { success: false, error: 'Push notifications not supported' };
    }

    // Check permission
    const permission = Notification.permission;
    if (permission === 'denied') {
        return { success: false, error: 'Notification permission denied' };
    }

    if (permission !== 'granted') {
        const result = await requestNotificationPermission();
        if (!result.granted) {
            return { success: false, error: result.error || 'Permission not granted' };
        }
    }

    try {
        // Get VAPID public key
        const { publicKey } = await api.getVapidPublicKey();
        if (!publicKey) {
            return { success: false, error: 'VAPID key not available' };
        }

        // Get service worker registration
        const registration = await navigator.serviceWorker.ready;

        // Check existing subscription
        let subscription = await registration.pushManager.getSubscription();

        if (subscription) {
            // Update existing subscription on server
            const subData = {
                endpoint: subscription.endpoint,
                keys: {
                    p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')))),
                    auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth'))))
                }
            };

            await api.subscribeToPush(subData);
            return { success: true, subscription: subData, updated: true };
        }

        // Create new subscription
        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey)
        });

        const subData = {
            endpoint: subscription.endpoint,
            keys: {
                p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')))),
                auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth'))))
            }
        };

        await api.subscribeToPush(subData);
        return { success: true, subscription: subData, updated: false };

    } catch (error) {
        console.error('Error subscribing to push:', error);
        return { success: false, error: error.message };
    }
}

// Unsubscribe from push notifications
export async function unsubscribeFromPush(api) {
    if (!isPushSupported()) {
        return { success: false, error: 'Push notifications not supported' };
    }

    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
            await subscription.unsubscribe();
            await api.unsubscribeFromPush(subscription.endpoint);
            return { success: true };
        }

        return { success: true, message: 'No active subscription' };
    } catch (error) {
        console.error('Error unsubscribing from push:', error);
        return { success: false, error: error.message };
    }
}

// Get current subscription status
export async function getPushSubscriptionStatus(api) {
    if (!isPushSupported()) {
        return { supported: false, subscribed: false };
    }

    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            return { supported: true, subscribed: false };
        }

        // Check if subscription is still valid on server
        const { subscriptions } = await api.getPushSubscriptions();
        const isSubscribed = subscriptions.some(s => s.endpoint === subscription.endpoint);

        return {
            supported: true,
            subscribed: isSubscribed,
            endpoint: subscription.endpoint
        };
    } catch (error) {
        console.error('Error checking push subscription:', error);
        return { supported: true, subscribed: false, error: error.message };
    }
}

// Initialize push notifications for a page
export async function initPushNotifications(api, options = {}) {
    const {
        autoSubscribe = false,
        onSubscribed = null,
        onUnsubscribed = null,
        onError = null
    } = options;

    if (!isPushSupported()) {
        console.log('[Push] Not supported in this browser');
        return { supported: false };
    }

    const status = await getPushSubscriptionStatus(api);

    if (autoSubscribe && !status.subscribed && Notification.permission !== 'denied') {
        const result = await subscribeToPush(api);
        if (result.success && onSubscribed) {
            onSubscribed(result);
        } else if (!result.success && onError) {
            onError(result.error);
        }
        return result;
    }

    return status;
}

// Send a test notification (requires admin)
export async function sendTestNotification(api, title = 'Teste', body = 'Esta é uma notificação de teste') {
    try {
        const result = await api.post('/notificacoes/send', { title, body });
        return { success: true, result };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Send order status notification (admin only)
export async function sendOrderStatusNotification(api, pedidoId, status, clienteEmail) {
    try {
        const result = await api.post('/notificacoes/send-order-update', {
            pedidoId,
            status,
            clienteEmail
        });
        return { success: true, result };
    } catch (error) {
        return { success: false, error: error.message };
    }
}