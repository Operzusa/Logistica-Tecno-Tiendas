
import React, { useState, useEffect } from 'react';
import { LandingScreen } from './screens/LandingScreen';
import { RouteScreen } from './screens/RouteScreen';
import { AdminDashboardScreen } from './screens/AdminDashboardScreen';
import { AuthScreen } from './screens/AuthScreen';
import { ServiceDetailScreen } from './screens/ServiceDetailScreen';
import { ClosureScreen } from './screens/ClosureScreen';
import { CreateServiceScreen } from './screens/CreateServiceScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { RegistrationScreen } from './screens/RegistrationScreen';
import { StatsScreen } from './screens/StatsScreen';
import { DirectoryScreen } from './screens/DirectoryScreen';
import { SateliteInventoryScreen } from './screens/SateliteInventoryScreen';
import { Servicio, User, UserRole, AppSettings } from './types';
import { supabaseService } from './services/supabaseService';
import { PWAService } from './services/pwaService';

export default function App() {
  const [user, setUser] = useState<User | null>(supabaseService.getCurrentUser());
  const [currentScreen, setCurrentScreen] = useState<'landing' | 'auth' | 'main' | 'detail' | 'closure' | 'create' | 'settings' | 'history' | 'register' | 'stats' | 'directory' | 'satelite_inventory'>('landing');
  const [selectedService, setSelectedService] = useState<Servicio | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings>(supabaseService.getSettings());
  const [prefillService, setPrefillService] = useState<Partial<Servicio> | null>(null);

  // --- MANEJO DE DEEP LINKING (Notificaciones) ---
  
  const handleDeepLink = async (serviceId: string) => {
    try {
      const all = await supabaseService.getAllServicios();
      const target = all.find(s => s.id === serviceId);
      if (target) {
        setSelectedService(target);
        setCurrentScreen('detail');
      }
    } catch (err) {
      console.error("Error al cargar servicio desde Deep Link:", err);
    }
  };

  useEffect(() => {
    // 1. Manejar mensajes directos del SW (App ya abierta en segundo plano)
    if ('serviceWorker' in navigator) {
      const onMessage = (event: MessageEvent) => {
        if (event.data?.type === 'NAVIGATE' && event.data.serviceId) {
          handleDeepLink(event.data.serviceId);
        }
      };
      navigator.serviceWorker.addEventListener('message', onMessage);
      return () => navigator.serviceWorker.removeEventListener('message', onMessage);
    }
  }, []);

  useEffect(() => {
    // 2. Manejar parámetros de URL al iniciar (App abierta desde estado Killed)
    const params = new URLSearchParams(window.location.search);
    const serviceId = params.get('serviceId');
    if (serviceId && user) {
      handleDeepLink(serviceId);
      // Limpiar URL para no re-abrir al recargar
      window.history.replaceState({}, document.title, "/");
    }
  }, [user]);

  // --- INICIALIZACIÓN Y PERMISOS ---

  useEffect(() => {
    PWAService.init();
    if (user) {
      // Solicitar permisos solo después de que el usuario haya interactuado (Login exitoso)
      PWAService.requestNotificationPermission();
    }
  }, [user]);

  useEffect(() => {
    const unsubscribe = supabaseService.subscribeToSettings((newSettings) => {
      setAppSettings(newSettings);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user && currentScreen === 'landing') {
      setCurrentScreen('main');
    }
  }, [user]);

  const handleLogin = (u: User) => {
    setUser(u);
    setCurrentScreen('main');
  };

  const handleLogout = () => {
    supabaseService.logout();
    setUser(null);
    setCurrentScreen('landing');
  };

  const navigateToDetail = (servicio: Servicio) => {
    setSelectedService(servicio);
    setCurrentScreen('detail');
  };

  const handleOpenRegisterOrEdit = (uToEdit?: User) => {
    setEditingUser(uToEdit || null);
    setCurrentScreen('register');
  };

  const handleProgramarRecogida = (data: Partial<Servicio>) => {
    setPrefillService(data);
    setCurrentScreen('create');
  };

  const fontSizeClass = `font-size-${appSettings.fontSize || 'small'}`;
  const themeClass = appSettings.theme === 'whatsapp' 
    ? 'theme-whatsapp' 
    : appSettings.theme === 'light' 
      ? 'theme-light' 
      : '';

  return (
    <div className={`min-h-screen bg-background-dark text-text-main font-display ${themeClass} ${fontSizeClass}`}>
      {currentScreen === 'landing' && (
        <LandingScreen 
          onNavigateLogin={() => setCurrentScreen('auth')} 
          onNavigateRegister={() => handleOpenRegisterOrEdit()} 
        />
      )}

      {currentScreen === 'auth' && (
        <AuthScreen 
          onLogin={handleLogin} 
          onNavigateRegister={() => handleOpenRegisterOrEdit()}
          onBack={() => setCurrentScreen('landing')}
        />
      )}

      {currentScreen === 'register' && (
        <RegistrationScreen 
          userToEdit={editingUser}
          onBack={() => {
            setEditingUser(null);
            user ? setCurrentScreen('main') : setCurrentScreen('landing');
          }} 
          onSuccess={(u) => {
            setEditingUser(null);
            if (user && user.role === UserRole.ADMIN) {
              setCurrentScreen('main');
            } else {
              handleLogin(u);
            }
          }}
        />
      )}

      {currentScreen === 'main' && user && (
        user.role === UserRole.ADMIN ? (
          <AdminDashboardScreen 
            user={user} 
            onLogout={handleLogout} 
            onOpenSettings={() => setCurrentScreen('settings')}
            onOpenHistory={() => setCurrentScreen('history')}
            onOpenCreate={() => { setPrefillService(null); setCurrentScreen('create'); }}
            onOpenClosure={() => setCurrentScreen('closure')}
            onOpenStats={() => setCurrentScreen('stats')}
            onOpenDirectory={() => setCurrentScreen('directory')}
            onOpenSateliteInventory={() => setCurrentScreen('satelite_inventory')}
            onOpenRegisterDomi={handleOpenRegisterOrEdit}
            onSelectService={navigateToDetail}
          />
        ) : (
          <RouteScreen 
            user={user}
            onSelectService={navigateToDetail} 
            onOpenClosure={() => setCurrentScreen('closure')} 
            onOpenSettings={() => setCurrentScreen('settings')}
            onOpenHistory={() => setCurrentScreen('history')}
            onLogout={handleLogout}
          />
        )
      )}
      
      {currentScreen === 'detail' && selectedService && (
        <ServiceDetailScreen 
          servicio={selectedService} 
          onBack={() => setCurrentScreen('main')} 
        />
      )}

      {currentScreen === 'closure' && (
        <ClosureScreen onBack={() => setCurrentScreen('main')} />
      )}

      {currentScreen === 'create' && (
        <CreateServiceScreen 
          prefillData={prefillService} 
          onBack={() => { setPrefillService(null); setCurrentScreen('main'); }} 
        />
      )}

      {currentScreen === 'settings' && (
        <SettingsScreen onBack={() => { setCurrentScreen('main'); }} />
      )}

      {currentScreen === 'history' && (
        <HistoryScreen 
          onBack={() => setCurrentScreen('main')} 
          onSelectService={navigateToDetail} 
        />
      )}

      {currentScreen === 'stats' && (
        <StatsScreen onBack={() => setCurrentScreen('main')} onSelectService={navigateToDetail} />
      )}

      {currentScreen === 'directory' && (
        <DirectoryScreen onBack={() => setCurrentScreen('main')} />
      )}

      {currentScreen === 'satelite_inventory' && (
        <SateliteInventoryScreen 
          onBack={() => setCurrentScreen('main')} 
          onProgramarRecogida={handleProgramarRecogida}
          onSelectService={navigateToDetail}
        />
      )}
    </div>
  );
}
