
import React, { useState, useEffect } from 'react';
import { PWAService } from '../services/pwaService';

interface Props {
  onNavigateLogin: () => void;
  onNavigateRegister: () => void;
}

const TUTORIAL_STEPS = [
  {
    title: "Optimiza tu Ruta",
    description: "Visualiza tus entregas y recogidas del día en un mapa inteligente. Ahorra tiempo y combustible.",
    icon: "distance",
    color: "text-primary"
  },
  {
    title: "Chat en Tiempo Real",
    description: "Mantente conectado con el administrador. Resuelve dudas y envía actualizaciones al instante.",
    icon: "forum",
    color: "text-success"
  },
  {
    title: "Evidencia Digital",
    description: "Captura fotos del estado de los equipos y recibos. Garantiza la seguridad de cada gestión.",
    icon: "photo_camera",
    color: "text-amber-500"
  },
  {
    title: "Cierre de Caja",
    description: "Registra tus gastos y cobros. Al final del día, genera tu reporte de balance automáticamente.",
    icon: "account_balance_wallet",
    color: "text-secondary"
  }
];

export const LandingScreen: React.FC<Props> = ({ onNavigateLogin, onNavigateRegister }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    PWAService.init();
    
    const checkPWA = () => {
      const isStandalone = PWAService.isStandalone();
      const isIOSDevice = PWAService.isIOS();
      setIsIOS(isIOSDevice);
      
      // Mostrar banner si no está instalada
      if (!isStandalone) {
        setShowInstallBanner(true);
      }
    };

    checkPWA();
    window.addEventListener('pwa-installable', () => setShowInstallBanner(true));
    
    // Solicitar notificaciones en el primer render
    setTimeout(() => {
      PWAService.requestNotificationPermission();
    }, 2000);

    return () => window.removeEventListener('pwa-installable', () => setShowInstallBanner(true));
  }, []);

  const handleInstall = async () => {
    if (isIOS) {
      alert("Para instalar en iPhone:\n1. Toca el botón 'Compartir' (cuadrado con flecha).\n2. Selecciona 'Agregar a inicio'.");
    } else {
      const installed = await PWAService.install();
      if (installed) setShowInstallBanner(false);
    }
  };

  const nextStep = () => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onNavigateLogin();
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col bg-background-dark overflow-hidden relative">
      {/* PWA Install Banner */}
      {showInstallBanner && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 w-[90%] z-[100] animate-in slide-in-from-top duration-700">
          <div className="bg-surface-dark/80 backdrop-blur-xl border border-primary/30 p-4 rounded-[24px] shadow-neon-strong flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary">
                <span className="material-symbols-outlined">install_mobile</span>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-primary">App Disponible</p>
                <p className="text-[11px] font-bold text-white">Instalar para mejor experiencia</p>
              </div>
            </div>
            <button 
              onClick={handleInstall}
              className="bg-primary text-white text-[10px] font-black uppercase px-4 py-2 rounded-full shadow-neon"
            >
              Instalar
            </button>
          </div>
        </div>
      )}

      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />
      <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/5 blur-[100px] rounded-full" />
      
      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 z-10">
        <div className="mb-8 animate-in zoom-in duration-700">
          <div className="w-24 h-24 bg-surface-dark border border-white/10 rounded-[32px] flex items-center justify-center shadow-neon-strong relative">
            <span className="material-symbols-outlined text-5xl text-primary">local_shipping</span>
            <div className="absolute -bottom-2 -right-2 bg-success w-8 h-8 rounded-full border-4 border-surface-dark flex items-center justify-center">
               <span className="material-symbols-outlined text-white text-xs">bolt</span>
            </div>
          </div>
        </div>

        <div className="text-center space-y-2 mb-12">
          <h1 className="text-4xl font-black tracking-tighter">Tecno Logistics</h1>
          <p className="text-xs text-slate-500 font-black uppercase tracking-[0.3em]">Smart Fleet Management</p>
        </div>

        {/* Tutorial Content */}
        <div className="w-full bg-surface-dark/50 backdrop-blur-md border border-white/5 rounded-[40px] p-8 space-y-6 animate-in slide-in-from-bottom duration-500">
          <div className="flex justify-center gap-1.5">
            {TUTORIAL_STEPS.map((_, idx) => (
              <div 
                key={idx} 
                className={`h-1.5 rounded-full transition-all duration-300 ${currentStep === idx ? 'w-8 bg-primary shadow-neon' : 'w-2 bg-white/10'}`} 
              />
            ))}
          </div>

          <div key={currentStep} className="text-center space-y-4 py-4 animate-in fade-in slide-in-from-right duration-300">
            <div className={`w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-2 ${TUTORIAL_STEPS[currentStep].color}`}>
              <span className="material-symbols-outlined text-3xl">{TUTORIAL_STEPS[currentStep].icon}</span>
            </div>
            <h3 className="text-xl font-bold">{TUTORIAL_STEPS[currentStep].title}</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              {TUTORIAL_STEPS[currentStep].description}
            </p>
          </div>

          <button 
            onClick={nextStep}
            className="w-full py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-neon-strong active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {currentStep === TUTORIAL_STEPS.length - 1 ? '¡EMPEZAR AHORA!' : 'SIGUIENTE'}
            <span className="material-symbols-outlined text-sm">
              {currentStep === TUTORIAL_STEPS.length - 1 ? 'rocket_launch' : 'arrow_forward'}
            </span>
          </button>
        </div>
      </div>

      {/* Footer Actions */}
      <footer className="p-8 space-y-4 z-10">
        <div className="flex flex-col gap-3">
          <button 
            onClick={onNavigateLogin}
            className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl font-black text-[10px] uppercase tracking-widest text-white hover:bg-white/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">login</span>
            Ingresar Usuario Existente
          </button>
          
          <button 
            onClick={onNavigateRegister}
            className="w-full py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-primary transition-colors flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">add_business</span>
            Registrar Nueva Empresa
          </button>
        </div>
        
        <p className="text-center text-[9px] text-slate-700 font-black uppercase tracking-widest pt-4">
          Powered by Tecno Tiendas Engine © 2024
        </p>
      </footer>
    </div>
  );
};
