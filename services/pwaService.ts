
export class PWAService {
  private static deferredPrompt: any = null;

  static init() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      window.dispatchEvent(new CustomEvent('pwa-installable'));
    });
    
    this.registerSW();
  }

  private static async registerSW() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        console.log('Service Worker registrado con éxito:', registration.scope);
        return registration;
      } catch (err) {
        console.error('Fallo al registrar el Service Worker:', err);
      }
    }
  }

  static isStandalone(): boolean {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone ||
      document.referrer.includes('android-app://')
    );
  }

  static isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  }

  static async install() {
    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      this.deferredPrompt = null;
      return outcome === 'accepted';
    }
    return false;
  }

  static async requestNotificationPermission() {
    if (!('Notification' in window)) {
      console.warn("Este navegador no soporta notificaciones.");
      return false;
    }

    try {
      let permission = Notification.permission;
      
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }
      
      if (permission === 'granted') {
        await this.subscribeToPush();
        return true;
      }
      return false;
    } catch (err) {
      console.error("Error solicitando permisos:", err);
      return false;
    }
  }

  // Utility to convert base64 VAPID key to Uint8Array
  private static urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  private static async subscribeToPush() {
    if (!('serviceWorker' in navigator)) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Get the VAPID public key from environment variables
      const publicVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!publicVapidKey) {
        console.warn("VAPID Public Key not found in environment variables.");
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(publicVapidKey)
      });
      
      // Save the subscription to Supabase
      const { supabaseService } = await import('./supabaseService');
      const user = supabaseService.getCurrentUser();
      
      if (user) {
        const subData = JSON.parse(JSON.stringify(subscription));
        
        const { error } = await supabaseService.client
          .from('push_subscriptions')
          .upsert({
            user_id: user.id,
            endpoint: subData.endpoint,
            p256dh: subData.keys.p256dh,
            auth: subData.keys.auth,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id, endpoint' });

        if (error) {
          console.error("Error saving push subscription to Supabase:", error);
        } else {
          console.log("Suscripción Push activa y guardada en Supabase.");
        }
      } else {
        console.warn("User not logged in, cannot save push subscription.");
      }
    } catch (err) {
      console.error("Error al suscribirse a Push:", err);
    }
  }

  static async showLocalNotification(title: string, body: string, serviceId?: string) {
    if (!('serviceWorker' in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      registration.showNotification(title, {
        body,
        icon: 'https://api.dicebear.com/7.x/shapes/svg?seed=tecno&backgroundColor=0d93f2',
        vibrate: [200, 100, 200],
        data: { url: '/', serviceId }
      } as any);
    } catch (err) {
      console.error("No se pudo mostrar la notificación local:", err);
    }
  }
}
