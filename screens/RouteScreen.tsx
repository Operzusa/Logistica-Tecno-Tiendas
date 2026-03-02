
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabaseService } from '../services/supabaseService';
import { audioService } from '../services/audioService';
import { localStorageService } from '../services/localStorageService';
import { getColombiaDateString, isBeforeColombiaDay } from '../utils/dateUtils';
import { CachedImage } from '../components/CachedImage';
import { Ruta, Servicio, EstadoServicio, TipoServicio, ServiceLog, User, UserRole, PaymentData } from '../types';

interface Props {
  user: User;
  onSelectService: (s: Servicio) => void;
  onOpenClosure: () => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onLogout: () => void;
}

// Helper para formatear duraciones (gaps)
const formatDuration = (minutes: number) => {
  if (minutes < 60) return `+${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `+${h}h ${m}m` : `+${h}h`;
};

const getPendingMessagesForDomi = (logs: ServiceLog[] = []) => {
  const safeLogs = logs || [];
  if (safeLogs.length === 0) return 0;
  
  let count = 0;
  // Count unread admin messages from the end
  for (let i = safeLogs.length - 1; i >= 0; i--) {
    const log = safeLogs[i];
    if (log.autor === 'Administrador' && log.status !== 'read') count++;
    else if (log.autor === 'Domiciliario') break; // Si ya hay uno mío o leído, paramos (lógica simple)
  }
  
  // ALSO count unread payment confirmations
  const unreadPayments = safeLogs.filter(log => log.type === 'payment' && log.paymentStatus === 'paid' && log.viewed !== true).length;
  
  return count + unreadPayments;
};

// --- WIDGET UNIFICADO DE RUTA ACTIVA (Dashboard Panel) ---
const ActiveRoutePanel: React.FC<{ startTime: Date | null; dateString: string; onOpenMap: () => void }> = ({ startTime, dateString, onOpenMap }) => {
  const [elapsed, setElapsed] = useState('00:00:00');
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!startTime) return;
    const interval = setInterval(() => {
      const now = new Date();
      const diff = now.getTime() - startTime.getTime();
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setElapsed(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  if (!startTime) return null;

  return (
    <div className="bg-surface-dark border border-white/10 rounded-2xl mb-4 shadow-lg overflow-hidden animate-in fade-in slide-in-from-top duration-500 transition-all">
       {/* Sección Superior: Fecha y Navegación */}
       <div className="p-4 flex items-center justify-between relative cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
          <div className="relative z-10 flex-1">
             <div className="flex items-center gap-1 mb-1">
                <p className="text-[10px] font-black text-primary uppercase tracking-widest">Ruta Activa</p>
                <span className={`material-symbols-outlined text-primary text-[14px] transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>expand_more</span>
             </div>
             <h2 className="text-lg font-black text-white capitalize leading-none">{dateString}</h2>
          </div>
          
          <button 
            onClick={(e) => { e.stopPropagation(); onOpenMap(); }}
            className="w-10 h-10 rounded-full bg-background-dark border border-primary/30 flex items-center justify-center text-primary shadow-neon hover:bg-primary hover:text-white transition-all active:scale-90 z-10"
            title="Abrir Mapa Completo"
          >
             <span className="material-symbols-outlined text-lg">near_me</span>
          </button>

          {/* Fondo Decorativo */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
       </div>

       {/* Sección Inferior: Timer e Inicio - Colapsible */}
       <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? 'max-h-32 opacity-100 border-t border-white/5' : 'max-h-0 opacity-0'}`}>
         <div className="bg-black/20 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
               <span className="material-symbols-outlined text-primary text-xl animate-pulse">timer</span>
               <div>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Tiempo en Ruta</p>
                  <p className="text-xl font-black text-white font-mono leading-none tracking-tight">{elapsed}</p>
               </div>
            </div>
            <div className="text-right pl-4 border-l border-white/5">
               <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Inicio</p>
               <p className="text-xs font-bold text-white">{startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
         </div>
       </div>
    </div>
  );
};

const FastTruckIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
    <rect x="0" y="7" width="4" height="1.5" rx="0.75" />
    <rect x="0" y="10" width="3" height="1.5" rx="0.75" />
    <rect x="0" y="13" width="2" height="1.5" rx="0.75" />
  </svg>
);

export const RouteScreen: React.FC<Props> = ({ 
  user,
  onSelectService, 
  onOpenClosure, 
  onOpenSettings, 
  onOpenHistory,
  onLogout
}) => {
  const [ruta, setRuta] = useState<Ruta | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatServicioId, setChatServicioId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [newServiceAlert, setNewServiceAlert] = useState(false);
  const [paymentSuccessData, setPaymentSuccessData] = useState<{serviceId: string, logId: string} | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [isOverdueExpanded, setIsOverdueExpanded] = useState(false);
  
  const [routeStartTime, setRouteStartTime] = useState<Date | null>(null);
  const [serviceGaps, setServiceGaps] = useState<Record<string, number>>({});

  const prevLogsCountMap = useRef<Record<string, number>>({});
  const prevServicesIds = useRef<string[]>([]);
  const prevUpdatedAtMap = useRef<Record<string, string>>({});
  const paidLogIds = useRef<Set<string>>(new Set());

  const calculateTimings = (servicios: Servicio[]) => {
    const sortedServices = [...servicios].sort((a, b) => 
       new Date(a.fecha_asignacion).getTime() - new Date(b.fecha_asignacion).getTime()
    );

    if (sortedServices.length > 0) {
      const first = sortedServices[0];
      setRouteStartTime(new Date(first.fecha_asignacion));
    }

    const closedServices = sortedServices
      .filter(s => s.estado === EstadoServicio.COMPLETADO || s.estado === EstadoServicio.POR_CONFIRMAR)
      .sort((a, b) => new Date(a.updated_at!).getTime() - new Date(b.updated_at!).getTime());

    const gaps: Record<string, number> = {};
    let previousTime = routeStartTime ? routeStartTime.getTime() : (closedServices.length > 0 ? new Date(closedServices[0].fecha_asignacion).getTime() : Date.now());

    closedServices.forEach((s) => {
        if (!s.updated_at) return;
        const currentFinishTime = new Date(s.updated_at).getTime();
        const diffMinutes = Math.floor((currentFinishTime - previousTime) / (1000 * 60));
        gaps[s.id] = diffMinutes;
        previousTime = currentFinishTime;
    });

    setServiceGaps(gaps);
  };

  const fetchData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const data = await supabaseService.getRutaDelDia(user.id);
      
      const isFirstFetch = prevServicesIds.current.length === 0;

      const currentIds = (data.servicios || []).map(s => s.id);
      if (!isFirstFetch) {
        const hasNewService = currentIds.some(id => !prevServicesIds.current.includes(id));
        if (hasNewService) {
          audioService.playNewService();
          setNewServiceAlert(true);
          setTimeout(() => setNewServiceAlert(false), 8000);
        }
      }
      prevServicesIds.current = currentIds;

      let anyUpdate = false;
      let anyNewMessage = false;
      let newPaymentCompletedData: {serviceId: string, logId: string} | null = null;

      (data.servicios || []).forEach(s => {
        const currentLogs = s.logs || [];
        const currentCount = currentLogs.length;
        const prevCount = prevLogsCountMap.current[s.id] || 0;

        // Check for paid payments
        currentLogs.forEach(log => {
          if (log.type === 'payment' && log.paymentStatus === 'paid' && log.viewed !== true) {
            if (!paidLogIds.current.has(log.id)) {
              if (!isFirstFetch) {
                newPaymentCompletedData = { serviceId: s.id, logId: log.id };
              }
              paidLogIds.current.add(log.id);
            }
          }
        });

        if (s.updated_at && prevUpdatedAtMap.current[s.id] && s.updated_at !== prevUpdatedAtMap.current[s.id]) {
          if (currentCount === prevCount) {
             anyUpdate = true;
          }
        }
        if (s.updated_at) prevUpdatedAtMap.current[s.id] = s.updated_at;

        if (currentCount > prevCount) {
          const lastLog = currentLogs[currentCount - 1];
          if (lastLog?.autor === 'Administrador') {
            anyNewMessage = true;
          }
        }
        prevLogsCountMap.current[s.id] = currentCount;
      });

      if (newPaymentCompletedData) {
        audioService.playPaymentCompleted();
        setPaymentSuccessData(newPaymentCompletedData);
        setTimeout(() => setPaymentSuccessData(null), 8000);
      } else if (anyUpdate) {
        audioService.playUpdate();
      } else if (anyNewMessage) {
        audioService.playMessage();
      }

      setRuta(data);
      calculateTimings(data.servicios);

    } catch (error) {
      console.error("Error al sincronizar ruta:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Fallback polling every 60 seconds (reduced from 5s to save egress)
    const interval = setInterval(fetchData, 60000);
    
    // Realtime subscription for instant updates without aggressive polling
    const channel = supabaseService.client.channel('route-screen')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'servicios' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabaseService.client.removeChannel(channel);
    };
  }, [user.id]);

  const openFullRoute = () => {
    if (!ruta || !ruta.servicios || ruta.servicios.length === 0) return;
    const settings = supabaseService.getSettings();
    const pendingServices = ruta.servicios.filter(s => s.estado === EstadoServicio.PENDIENTE || s.estado === EstadoServicio.EN_CAMINO);
    
    if (pendingServices.length === 0) {
      alert("No hay servicios pendientes en la ruta.");
      return;
    }

    const destinations = pendingServices.map(s => {
      const queryBase = s.cliente.direccion || `${s.cliente.coordenadas_gps?.lat},${s.cliente.coordenadas_gps?.lng}`;
      return encodeURIComponent(`${queryBase}, ${settings.ciudad}, ${settings.pais}`);
    });

    const origin = "My+Location";
    const destination = destinations[destinations.length - 1];
    const waypoints = destinations.slice(0, -1).join('|');

    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}&travelmode=driving`;
    window.open(url, '_blank');
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background-dark">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  const allServicesForList = ruta?.servicios || [];
  const activeChatServicio = ruta?.servicios?.find(s => s.id === chatServicioId);

  const todayStr = getColombiaDateString();

  const overdueServices = allServicesForList.filter(s => 
    isBeforeColombiaDay(s.fecha_asignacion, todayStr) && 
    s.estado !== EstadoServicio.COMPLETADO && 
    s.estado !== EstadoServicio.POR_CONFIRMAR
  );

  const todaysServices = allServicesForList.filter(s => !isBeforeColombiaDay(s.fecha_asignacion, todayStr));

  const closedCount = todaysServices.filter(s => s.estado === EstadoServicio.COMPLETADO || s.estado === EstadoServicio.POR_CONFIRMAR).length || 0;
  const totalCount = todaysServices.length || 0;
  const progressPercent = totalCount > 0 ? (closedCount / totalCount) * 100 : 0;
  const settings = supabaseService.getSettings();

  const filteredServicesForList = todaysServices.filter(s => 
    showCompleted || (s.estado !== EstadoServicio.COMPLETADO && s.estado !== EstadoServicio.POR_CONFIRMAR)
  );

  // Fecha Actual Formateada
  const todayDateFormatted = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  
  // Lógica de visualización del Banner: Mostrar solo si hay servicios Y NO todos están terminados
  const isRouteActive = totalCount > 0 && closedCount < totalCount;

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col relative">
      {newServiceAlert && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] w-[90%] animate-in slide-in-from-top duration-500">
           <div className="bg-primary text-white p-5 rounded-[24px] shadow-neon-strong border border-white/20 flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center animate-bounce">
                <span className="material-symbols-outlined text-white text-2xl">local_shipping</span>
              </div>
              <div className="flex-1">
                 <p className="text-xs font-black uppercase tracking-widest leading-none mb-1">Nueva Tarea Asignada</p>
                 <p className="text-[10px] font-bold opacity-90">El administrador te ha asignado un nuevo servicio.</p>
              </div>
           </div>
        </div>
      )}

      {paymentSuccessData && (
        <div 
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] w-[90%] animate-in slide-in-from-top duration-500 cursor-pointer"
          onClick={async () => {
            setChatServicioId(paymentSuccessData.serviceId);
            await supabaseService.markPaymentLogAsViewed(paymentSuccessData.serviceId, paymentSuccessData.logId);
            setPaymentSuccessData(null);
            fetchData();
            // Opcional: Si quisieras hacer scroll específico al logId, podrías pasarlo al modal
            // Por ahora, el modal ya hace auto-scroll al fondo donde está el comprobante.
          }}
        >
           <div className="bg-success text-white p-5 rounded-[24px] shadow-neon-strong border border-white/20 flex items-center gap-4 active:scale-95 transition-transform">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
                <span className="material-symbols-outlined text-white text-2xl">check_circle</span>
              </div>
              <div className="flex-1">
                 <p className="text-xs font-black uppercase tracking-widest leading-none mb-1">¡Pago Completado!</p>
                 <p className="text-[10px] font-bold opacity-90">El administrador ha confirmado un pago y adjuntó el comprobante. Toca para ver.</p>
              </div>
           </div>
        </div>
      )}

      <header className="p-4 border-b border-white/10 flex flex-col sticky top-0 bg-background-dark/95 backdrop-blur-md z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={onOpenSettings}
              className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400"
            >
              <span className="material-symbols-outlined">settings</span>
            </button>
            <div>
              <h1 className="text-lg font-bold leading-none">{settings.nombre_compania}</h1>
              <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1">
                Hola, {user.nombre?.split(' ')[0] || 'Usuario'} 👋
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={onLogout} className="p-2 hover:bg-white/5 rounded-full text-secondary">
              <span className="material-symbols-outlined">logout</span>
            </button>
            <button onClick={onOpenClosure} className="bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full text-xs font-bold">
              Cierre
            </button>
          </div>
        </div>
      </header>

      <div className="px-4 py-2 flex gap-2">
        <button 
          onClick={() => setViewMode('list')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-black uppercase transition-all ${viewMode === 'list' ? 'bg-primary text-white shadow-neon' : 'bg-surface-dark text-slate-500 border border-white/5'}`}
        >
          <span className="material-symbols-outlined text-sm">format_list_bulleted</span>
          Lista
        </button>
        <button 
          onClick={() => setViewMode('map')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-black uppercase transition-all ${viewMode === 'map' ? 'bg-primary text-white shadow-neon' : 'bg-surface-dark text-slate-500 border border-white/5'}`}
        >
          <span className="material-symbols-outlined text-sm">map</span>
          Mapa
        </button>
      </div>

      <main className="flex-1 p-4 pb-32">
        {/* Unified Active Route Panel */}
        {isRouteActive && (
          <ActiveRoutePanel 
            startTime={routeStartTime} 
            dateString={todayDateFormatted}
            onOpenMap={openFullRoute}
          />
        )}

        <div className="mb-6 bg-surface-dark p-4 rounded-2xl border border-white/5">
          <div className="flex justify-between items-end mb-2">
            <div className="flex items-center gap-2">
               <span className="text-sm font-bold">Progreso de Hoy</span>
               <button 
                 onClick={() => setShowCompleted(!showCompleted)}
                 className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${showCompleted ? 'bg-primary/20 text-primary' : 'bg-slate-800 text-slate-500'}`}
               >
                 <span className="material-symbols-outlined text-[16px]">{showCompleted ? 'visibility' : 'visibility_off'}</span>
               </button>
            </div>
            <span className="text-xs text-slate-400 font-bold">{closedCount}/{totalCount}</span>
          </div>
          <div className="h-3 w-full bg-background-dark rounded-full overflow-hidden p-0.5">
            <div 
              className="h-full bg-primary rounded-full transition-all duration-700 shadow-neon" 
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {overdueServices.length > 0 && (
          <div className="mb-6 space-y-4 animate-in slide-in-from-top duration-500">
            <button 
              onClick={() => setIsOverdueExpanded(!isOverdueExpanded)}
              className="w-full flex items-center justify-between text-left"
            >
              <h2 className="text-xs font-black uppercase tracking-widest text-red-500 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm animate-pulse">warning</span>
                ⚠️ SERVICIOS ATRASADOS SIN CERRAR ({overdueServices.length})
              </h2>
              <span className="material-symbols-outlined text-red-500 transition-transform duration-300" style={{ transform: isOverdueExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                expand_more
              </span>
            </button>
            
            {isOverdueExpanded && (
              <div className="space-y-4">
                {overdueServices.map((servicio, idx) => (
                  <div key={servicio.id} className="relative">
                    <div className="absolute -inset-0.5 bg-red-500/20 rounded-[26px] blur-sm"></div>
                    <div className="relative border border-red-500/50 rounded-[24px] overflow-hidden bg-background-dark">
                      <ServiceCard 
                        servicio={servicio} 
                        index={idx + 1}
                        onClick={() => onSelectService(servicio)}
                        onOpenChat={() => setChatServicioId(servicio.id)}
                        gapTime={serviceGaps[servicio.id]}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {viewMode === 'list' ? (
          <div className="space-y-4">
            {filteredServicesForList.map((servicio, idx) => (
              <ServiceCard 
                key={servicio.id} 
                servicio={servicio} 
                index={allServicesForList.indexOf(servicio) + 1}
                onClick={() => onSelectService(servicio)}
                onOpenChat={() => setChatServicioId(servicio.id)}
                gapTime={serviceGaps[servicio.id]}
              />
            ))}
          </div>
        ) : (
          <div className="h-[400px] rounded-2xl bg-surface-dark border border-white/5 flex items-center justify-center overflow-hidden">
             <button 
                onClick={openFullRoute}
                className="bg-primary px-6 py-3 rounded-xl font-bold text-xs uppercase shadow-neon"
              >
                Abrir Ruta en Maps
              </button>
          </div>
        )}
      </main>

      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-[360px] bg-surface-dark/95 backdrop-blur-xl border border-white/10 h-16 rounded-2xl shadow-neon-strong flex justify-around items-center px-4 z-40">
         <button className="flex flex-col items-center gap-1 text-primary">
            <FastTruckIcon className="w-6 h-6" />
            <span className="text-[8px] font-black uppercase">Ruta</span>
         </button>
         <button onClick={onOpenHistory} className="flex flex-col items-center gap-1 text-slate-500">
            <span className="material-symbols-outlined">history</span>
            <span className="text-[8px] font-black uppercase">Historial</span>
         </button>
         <button onClick={onOpenClosure} className="flex flex-col items-center gap-1 text-slate-500">
            <span className="material-symbols-outlined">account_balance_wallet</span>
            <span className="text-[8px] font-black uppercase">Caja</span>
         </button>
         <button onClick={onOpenSettings} className="flex flex-col items-center gap-1 text-slate-500">
            <span className="material-symbols-outlined">person</span>
            <span className="text-[8px] font-black uppercase">Perfil</span>
         </button>
      </nav>

      {activeChatServicio && (
        <ServiceChatModal 
          servicio={activeChatServicio} 
          onClose={() => setChatServicioId(null)} 
          onMessageSent={fetchData}
        />
      )}
    </div>
  );
};

// Componente para los Checks (Chulos)
const MessageStatusTicks: React.FC<{ status?: 'sent' | 'delivered' | 'read' }> = ({ status }) => {
  const iconStyle = "text-[16px] -ml-1";
  if (!status || status === 'sent') {
    return <span className={`material-symbols-outlined ${iconStyle} text-slate-400`}>check</span>;
  }
  if (status === 'delivered') {
    return <span className={`material-symbols-outlined ${iconStyle} text-slate-400`}>done_all</span>;
  }
  if (status === 'read') {
    return <span className={`material-symbols-outlined ${iconStyle} text-[#53bdeb]`}>done_all</span>;
  }
  return null;
};

// --- HELPER DATE FORMATTING ---
const getDayLabel = (date: Date) => {
  const todayStr = getColombiaDateString();
  const dateStr = getColombiaDateString(date);
  
  const todayObj = new Date(todayStr + 'T12:00:00Z'); // Midday to avoid timezone shifts
  const yesterdayObj = new Date(todayObj);
  yesterdayObj.setDate(todayObj.getDate() - 1);
  const yesterdayStr = getColombiaDateString(yesterdayObj);

  if (dateStr === todayStr) return 'Hoy';
  if (dateStr === yesterdayStr) return 'Ayer';
  
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
};

const formatMessageTime = (iso: string) => {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();
};

export const ServiceChatModal: React.FC<{ 
  servicio: Servicio; 
  onClose: () => void; 
  onMessageSent: () => void 
}> = ({ servicio, onClose, onMessageSent }) => {
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [localLogs, setLocalLogs] = useState<ServiceLog[]>(servicio.logs || []);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<PaymentData>({ beneficiary: '', bank: '', accountNumber: '', amount: 0, note: '' });
  
  // State for Payment Confirmation (Admin side)
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [activePaymentLogId, setActivePaymentLogId] = useState<string | null>(null);

  const chatRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isUserAtBottom = useRef(true);
  const initialScrollDone = useRef(false);
  
  const settings = supabaseService.getSettings();
  const isLightMode = settings.theme === 'light';

  const user = supabaseService.getCurrentUser();
  const myRole = user?.role === UserRole.ADMIN ? 'Administrador' : 'Domiciliario';
  const isAdmin = user?.role === UserRole.ADMIN;

  // Sync props with local state, but preserve local optimistic updates if needed
  useEffect(() => {
    if (servicio.logs) {
      setLocalLogs(servicio.logs);
    }
  }, [servicio.logs]);

  // Mark as read
  useEffect(() => {
    const markRead = async () => {
      await supabaseService.markChatAsRead(servicio.id, myRole);
      onMessageSent();
    };
    markRead();
  }, [servicio.id, myRole]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (chatRef.current) {
        if (isUserAtBottom.current || !initialScrollDone.current) {
            setTimeout(() => {
                chatRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
                initialScrollDone.current = true;
            }, 100);
        }
    }
  }, [localLogs]);

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      isUserAtBottom.current = scrollHeight - scrollTop - clientHeight < 150;
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      // Reset height to allow shrinking
      textareaRef.current.style.height = '24px';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 120);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [msg]);

  // --- HANDLERS ---

  const handleSend = async (imagePath?: string, paymentData?: PaymentData, customMessage?: string) => {
    const textToSend = customMessage !== undefined ? customMessage : msg;

    if (!textToSend.trim() && !imagePath && !paymentData) return;
    
    // OPTIMISTIC UPDATE
    const tempId = `temp-${Date.now()}`;
    const optimisticLog: ServiceLog = {
        id: tempId,
        timestamp: new Date().toISOString(),
        mensaje: textToSend,
        autor: myRole as 'Administrador' | 'Domiciliario',
        status: 'sent',
        type: paymentData ? 'payment' : 'text',
        image: imagePath,
        paymentData
    };

    isUserAtBottom.current = true;
    setLocalLogs(prev => [...prev, optimisticLog]);
    
    if (customMessage === undefined) {
        setMsg('');
        if (textareaRef.current) textareaRef.current.style.height = '24px';
    }
    
    setSending(true);

    try {
      await supabaseService.addServiceLog(servicio.id, optimisticLog.mensaje, imagePath, paymentData);
      onMessageSent(); // Trigger polling update
    } catch (e) {
      console.error(e);
      alert("Error al enviar mensaje");
      // Rollback could happen here in a more complex app
    } finally {
      setSending(false);
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSending(true);
      try {
        const url = await supabaseService.uploadPhoto(e.target.files[0]);
        await handleSend(url);
      } catch (err) {
        alert("Error al subir imagen");
        setSending(false);
      }
    }
  };

  // Payment Confirmation Handlers
  const handleConfirmClick = (logId: string) => {
    setActivePaymentLogId(logId);
    receiptInputRef.current?.click();
  };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && activePaymentLogId) {
      setUploadingReceipt(true);
      try {
        // 1. Upload the receipt image
        const url = await supabaseService.uploadPhoto(e.target.files[0]);
        
        // 2. Confirm the payment with the receipt URL
        await supabaseService.confirmPaymentLog(servicio.id, activePaymentLogId, url);
        
        onMessageSent(); // Refresh
      } catch (err) {
        console.error(err);
        alert("Error al subir el comprobante");
      } finally {
        setUploadingReceipt(false);
        setActivePaymentLogId(null);
        // Reset input
        if (receiptInputRef.current) receiptInputRef.current.value = '';
      }
    }
  };

  const handlePaymentSubmit = () => {
    if (!paymentDetails.beneficiary || !paymentDetails.bank || !paymentDetails.accountNumber || !paymentDetails.amount) {
      alert("Por favor completa todos los campos del pago.");
      return;
    }
    const message = `Solicitud de Pago: $${paymentDetails.amount}`;
    handleSend(undefined, paymentDetails, message);
    setShowPaymentForm(false);
    setPaymentDetails({ beneficiary: '', bank: '', accountNumber: '', amount: 0, note: '' });
  };

  const handleCopyPaymentInfo = (data: PaymentData) => {
    const text = `Solicitud de Pago\nBeneficiario: ${data.beneficiary}\nBanco: ${data.bank}\nCuenta: ${data.accountNumber}\nValor: $${data.amount.toLocaleString()}\nNota: ${data.note || ''}`;
    navigator.clipboard.writeText(text).then(() => alert("Datos copiados al portapapeles"));
  };

  // Grouping logs by date
  const groupedLogs = useMemo(() => {
    const groups: { [key: string]: ServiceLog[] } = {};
    localLogs.forEach(log => {
        const date = new Date(log.timestamp);
        const dateKey = date.toDateString(); // Uses browser locale date string as key
        if (!groups[dateKey]) groups[dateKey] = [];
        groups[dateKey].push(log);
    });
    return groups;
  }, [localLogs]);

  return (
    <div className="fixed inset-0 z-50 bg-[#0b141a] flex flex-col h-full w-full animate-in slide-in-from-bottom duration-300">
      {/* Hidden File Input for Receipts */}
      <input 
        type="file" 
        ref={receiptInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleReceiptUpload}
      />

      {/* Background Pattern Overlay - Fixed outside scroll view */}
      <div 
        className="absolute inset-0 opacity-[0.06] pointer-events-none z-0" 
        style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundRepeat: 'repeat' }} 
      />

      {/* HEADER */}
      <header className="flex items-center gap-3 p-3 bg-[#202c33] border-b border-[#202c33] shrink-0 z-20 shadow-sm relative">
        <button onClick={onClose} className="p-2 rounded-full hover:bg-white/5 text-[#aebac1] transition-colors">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        
        <div className="w-10 h-10 rounded-full bg-white/10 overflow-hidden flex items-center justify-center border border-white/5">
           <span className="material-symbols-outlined text-white text-xl">
             {isAdmin ? 'support_agent' : 'person'}
           </span>
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-white text-base truncate leading-tight">
             {isAdmin ? 'Domiciliario' : 'Soporte Administrativo'}
          </h3>
          <p className="text-xs text-[#8696a0] truncate">
             {servicio.cliente?.nombre ? `Ref: ${servicio.cliente.nombre}` : 'Chat de Servicio'}
          </p>
        </div>
        
        {/* Actions header (could be expanded) */}
        <button className="p-2 text-[#aebac1] hover:text-white">
           <span className="material-symbols-outlined">more_vert</span>
        </button>
      </header>

      {/* CHAT BODY (BACKGROUND IMAGE) */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-transparent relative z-10 custom-scrollbar"
      >
        <div className="flex flex-col gap-2 pb-2">
            {/* System Info Banner */}
            <div className="bg-[#1f2c34] text-[#ffd279] text-xs p-3 rounded-lg text-center shadow-sm mx-4 mb-4 border border-[#ffd279]/20">
               🔒 Los mensajes están cifrados de extremo a extremo. ID: #{servicio.id.slice(-4)}
            </div>

            {Object.keys(groupedLogs).map(dateKey => {
                const logs = groupedLogs[dateKey];
                const firstLogDate = new Date(logs[0].timestamp);
                
                return (
                    <div key={dateKey} className="flex flex-col gap-1">
                        {/* Date Divider */}
                        <div className="flex justify-center my-3 sticky top-2 z-20">
                            <span className="bg-[#1f2c34] text-[#8696a0] text-[11px] font-bold px-3 py-1.5 rounded-lg shadow-sm border border-[#1f2c34]">
                                {getDayLabel(firstLogDate)}
                            </span>
                        </div>

                        {logs.map((log) => {
                            const isMe = log.autor === myRole;
                            const isPayment = log.type === 'payment';
                            
                            return (
                                <div key={log.id} className={`flex w-full mb-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                    <div 
                                      className={`relative max-w-[85%] sm:max-w-[70%] rounded-lg p-2 text-sm shadow-sm group ${
                                        isMe 
                                          ? 'bg-[#005c4b] text-[#e9edef] rounded-tr-none' 
                                          : 'bg-[#202c33] text-[#e9edef] rounded-tl-none'
                                      }`}
                                    >
                                        {/* Image Thumbnail */}
                                        {log.image && (
                                            <div 
                                              onClick={() => setPreviewImage(log.image || null)}
                                              className="mb-1 cursor-pointer overflow-hidden rounded-lg bg-black/20 active:opacity-80 transition-opacity"
                                            >
                                                <CachedImage 
                                                  src={log.image} 
                                                  alt="Adjunto" 
                                                  className="w-full h-full max-h-[300px] object-cover" 
                                                />
                                            </div>
                                        )}

                                        {/* Payment Block */}
                                        {isPayment && log.paymentData && (
                                            <div className={`p-2 rounded-lg mb-1 border transition-all ${log.paymentStatus === 'paid' ? 'bg-emerald-900/30 border-emerald-500/50' : 'bg-black/20 border-white/5'}`}>
                                                <div className="flex items-center gap-2 mb-2">
                                                    {log.paymentStatus === 'paid' ? (
                                                       <>
                                                         <span className="material-symbols-outlined text-emerald-400">check_circle</span>
                                                         <span className="font-bold text-xs uppercase tracking-wider text-emerald-400">Pago Realizado</span>
                                                       </>
                                                    ) : (
                                                       <>
                                                         <span className="material-symbols-outlined text-[#ffd279] animate-pulse">payments</span>
                                                         <span className="font-bold text-xs uppercase tracking-wider text-[#ffd279]">Solicitud de Pago</span>
                                                       </>
                                                    )}
                                                </div>
                                                <p className="font-bold text-lg mb-1">${log.paymentData.amount.toLocaleString()}</p>
                                                <p className="text-xs opacity-80">{log.paymentData.bank} • {log.paymentData.beneficiary}</p>
                                                
                                                {/* Payment Actions / Receipt */}
                                                <div className="mt-3 pt-3 border-t border-white/5">
                                                   {log.paymentStatus === 'paid' && log.receiptUrl ? (
                                                      <div 
                                                        onClick={async () => {
                                                            setPreviewImage(log.receiptUrl || null);
                                                            if (!isAdmin && log.viewed !== true) {
                                                                await supabaseService.markPaymentLogAsViewed(servicio.id, log.id);
                                                                onMessageSent(); // Trigger refresh
                                                            }
                                                        }}
                                                        className="mt-2 cursor-pointer overflow-hidden rounded-lg bg-black/20 active:opacity-80 transition-opacity border border-white/10 relative"
                                                      >
                                                         {/* Unread Badge */}
                                                         {!isAdmin && log.viewed !== true && (
                                                            <div className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-neon-strong z-10" />
                                                         )}
                                                         <div className="bg-black/40 p-2 flex items-center justify-between">
                                                            <p className="text-[10px] font-bold text-white uppercase">Comprobante Adjunto</p>
                                                            <span className="material-symbols-outlined text-slate-400 text-sm">open_in_full</span>
                                                         </div>
                                                         <CachedImage 
                                                            src={log.receiptUrl} 
                                                            alt="Comprobante de Pago"
                                                            className="w-full h-auto max-h-[200px] object-contain bg-black/50" 
                                                         />
                                                      </div>
                                                   ) : isAdmin ? (
                                                      log.paymentStatus === 'paid' ? (
                                                         <p className="text-[10px] text-center text-emerald-400 font-bold uppercase">Procesado</p>
                                                      ) : (
                                                         <button 
                                                            onClick={() => handleConfirmClick(log.id)}
                                                            disabled={uploadingReceipt && activePaymentLogId === log.id}
                                                            className="w-full py-2 bg-emerald-600 text-white rounded font-bold text-xs uppercase shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                                                         >
                                                            {uploadingReceipt && activePaymentLogId === log.id ? 'Subiendo Comprobante...' : 'Confirmar Pago'}
                                                            {!uploadingReceipt && <span className="material-symbols-outlined text-sm">upload_file</span>}
                                                         </button>
                                                      )
                                                   ) : (
                                                      // Driver View
                                                      log.paymentStatus === 'paid' ? null : (
                                                         <div className="bg-amber-500/10 border border-amber-500/20 rounded p-2 text-center">
                                                            <p className="text-[10px] font-bold text-amber-500 uppercase animate-pulse">Esperando Aprobación...</p>
                                                         </div>
                                                      )
                                                   )}
                                                </div>

                                                {/* Copy Data Button (Always available) */}
                                                <button 
                                                  onClick={() => handleCopyPaymentInfo(log.paymentData!)}
                                                  className="mt-2 w-full py-1.5 bg-white/5 rounded text-[10px] font-bold uppercase hover:bg-white/10 text-slate-400"
                                                >
                                                  Copiar Datos
                                                </button>
                                            </div>
                                        )}

                                        {/* Text Content */}
                                        {log.mensaje && (
                                            <p className="whitespace-pre-wrap leading-relaxed px-1 pb-1">{log.mensaje}</p>
                                        )}

                                        {/* Metadata (Time & Checks) */}
                                        <div className="flex justify-end items-center gap-1 mt-0.5 select-none">
                                            <span className="text-[10px] text-[#ffffff99] min-w-[45px] text-right">
                                                {formatMessageTime(log.timestamp)}
                                            </span>
                                            {isMe && (
                                                <MessageStatusTicks status={log.status} />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                );
            })}
            <div ref={chatRef} />
        </div>
      </div>

      {/* Payment Form Overlay */}
      {showPaymentForm && (
        <div className="absolute inset-x-0 bottom-[70px] z-30 bg-[#1f2c34] border-t border-[#2a3942] p-4 rounded-t-2xl shadow-2xl animate-in slide-in-from-bottom duration-200 mx-2">
           <div className="flex justify-between items-center mb-4 text-[#e9edef]">
              <h3 className="font-bold text-sm uppercase tracking-wider text-[#ffd279] flex items-center gap-2">
                 <span className="material-symbols-outlined">payments</span>
                 Solicitar Pago
              </h3>
              <button onClick={() => setShowPaymentForm(false)} className="p-1 rounded-full hover:bg-white/10">
                 <span className="material-symbols-outlined">close</span>
              </button>
           </div>
           
           <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                 <input 
                   placeholder="Beneficiario" 
                   value={paymentDetails.beneficiary}
                   onChange={(e) => setPaymentDetails({...paymentDetails, beneficiary: e.target.value})}
                   className="bg-[#2a3942] border border-[#2a3942] text-[#e9edef] text-sm rounded-lg p-3 outline-none focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884] placeholder:text-[#8696a0]"
                 />
                 <input 
                   type="number"
                   placeholder="Valor" 
                   value={paymentDetails.amount || ''}
                   onChange={(e) => setPaymentDetails({...paymentDetails, amount: parseFloat(e.target.value)})}
                   className="bg-[#2a3942] border border-[#2a3942] text-[#e9edef] text-sm rounded-lg p-3 outline-none focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884] placeholder:text-[#8696a0] font-bold"
                 />
              </div>
              <div className="grid grid-cols-2 gap-3">
                 <input 
                   placeholder="Banco" 
                   value={paymentDetails.bank}
                   onChange={(e) => setPaymentDetails({...paymentDetails, bank: e.target.value})}
                   className="bg-[#2a3942] border border-[#2a3942] text-[#e9edef] text-sm rounded-lg p-3 outline-none focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884] placeholder:text-[#8696a0]"
                 />
                 <input 
                   placeholder="No. Cuenta" 
                   value={paymentDetails.accountNumber}
                   onChange={(e) => setPaymentDetails({...paymentDetails, accountNumber: e.target.value})}
                   className="bg-[#2a3942] border border-[#2a3942] text-[#e9edef] text-sm rounded-lg p-3 outline-none focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884] placeholder:text-[#8696a0]"
                 />
              </div>
              <input 
                 placeholder="Nota (Opcional)" 
                 value={paymentDetails.note}
                 onChange={(e) => setPaymentDetails({...paymentDetails, note: e.target.value})}
                 className="w-full bg-[#2a3942] border border-[#2a3942] text-[#e9edef] text-sm rounded-lg p-3 outline-none focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884] placeholder:text-[#8696a0]"
               />
               
               <button 
                 onClick={handlePaymentSubmit}
                 className="w-full bg-[#00a884] text-white py-3 rounded-lg font-bold uppercase text-xs tracking-widest shadow-md active:scale-95 transition-all flex justify-center gap-2 hover:bg-[#008f6f]"
               >
                 Enviar Solicitud <span className="material-symbols-outlined text-sm">send</span>
               </button>
           </div>
        </div>
      )}

      {/* INPUT AREA */}
      <footer className="min-h-[50px] bg-[#202c33] border-t border-[#202c33] px-1 py-1 flex items-end gap-1 shrink-0 z-20 relative">
         
         {/* Actions Group (Compact) */}
         <div className="flex items-center gap-0 shrink-0 mb-1 ml-0.5">
             {/* Payment Request Button */}
             <button 
                onClick={() => setShowPaymentForm(!showPaymentForm)}
                className="p-2 text-[#ffd279] hover:text-[#ffe69c] hover:bg-white/5 rounded-full transition-colors"
                title="Solicitar Pago"
             >
                <span className="material-symbols-outlined text-[24px]">attach_money</span>
             </button>

             {/* Attach Image Button */}
             <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-[#8696a0] hover:text-[#aebac1] hover:bg-white/5 rounded-full transition-colors -ml-2"
                title="Adjuntar Imagen"
             >
                <span className="material-symbols-outlined text-[24px]">add_photo_alternate</span>
             </button>
             <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleImageSelect}
             />
         </div>

         {/* Message Input (Expanded) */}
         <div className={`flex-1 ${isLightMode ? 'bg-white border-gray-300' : 'bg-[#2a3942] border-transparent'} rounded-2xl flex items-center min-h-[40px] px-3 py-1 border focus-within:border-[#00a884]/50 transition-colors mb-1 ml-0.5`}>
            <textarea 
               ref={textareaRef}
               rows={1}
               value={msg}
               onChange={(e) => setMsg(e.target.value)}
               onKeyDown={(e) => {
                   if (e.key === 'Enter' && !e.shiftKey) {
                       e.preventDefault();
                       handleSend();
                   }
               }}
               placeholder="Mensaje"
               className={`w-full bg-transparent ${isLightMode ? 'text-slate-900 placeholder-slate-500' : 'text-white placeholder-[#8696a0]'} text-[15px] resize-none focus:outline-none max-h-32 py-1 leading-relaxed`}
               style={{ height: '22px' }}
            />
         </div>

         {/* Send Button */}
         <button 
            onClick={() => handleSend()}
            disabled={!msg.trim() && !sending}
            className={`w-10 h-10 rounded-full mb-1 shrink-0 transition-all duration-200 flex items-center justify-center mr-0.5 ${
               msg.trim() || sending ? 'bg-[#00a884] text-white shadow-lg hover:bg-[#008f6f] transform hover:scale-105' : 'bg-[#202c33] text-[#8696a0] cursor-not-allowed'
            }`}
         >
            {sending ? (
               <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
            ) : (
               <span className="material-symbols-outlined text-xl ml-0.5">send</span>
            )}
         </button>
      </footer>

      {/* LIGHTBOX FOR IMAGES */}
      {previewImage && (
         <div 
           className="fixed inset-0 z-[60] bg-black/95 flex flex-col animate-in fade-in duration-200"
           onClick={() => setPreviewImage(null)}
         >
            <div className="flex justify-between items-center p-4 text-white">
               <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                     <span className="material-symbols-outlined">person</span>
                  </div>
                  <span className="font-bold">Vista Previa</span>
               </div>
               <button className="p-2 hover:bg-white/10 rounded-full">
                  <span className="material-symbols-outlined">close</span>
               </button>
            </div>
            
            <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
               <CachedImage 
                 src={previewImage} 
                 alt="Full size" 
                 className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                 onClick={(e) => e.stopPropagation()} // Prevent close on image click
               />
            </div>
            
            <div className="p-8 text-center text-white/50 text-xs">
               Toca en cualquier lugar para cerrar
            </div>
         </div>
      )}
    </div>
  );
};

const ServiceCard: React.FC<{ servicio: Servicio; index: number; onClick: () => void; onOpenChat: () => void; gapTime?: number }> = ({ servicio, index, onClick, onOpenChat, gapTime }) => {
  const isCompleted = servicio.estado === EstadoServicio.COMPLETADO;
  const isPendingConfirm = servicio.estado === EstadoServicio.POR_CONFIRMAR;
  const pendingMessages = getPendingMessagesForDomi(servicio.logs);
  
  const typeColors: Record<string, string> = {
    [TipoServicio.ENTREGAR]: 'bg-primary',
    [TipoServicio.RECOGER]: 'bg-emerald-500',
    [TipoServicio.SATELITE]: 'bg-purple-500',
    [TipoServicio.GARANTIA]: 'bg-amber-500',
    [TipoServicio.COTIZAR]: 'bg-cyan-500',
    [TipoServicio.COMPRAR]: 'bg-pink-500',
    [TipoServicio.CONSIGNAR]: 'bg-indigo-500',
    [TipoServicio.DILIGENCIA]: 'bg-lime-600',
  };

  const currentTypeColor = typeColors[servicio.tipo] || 'bg-slate-500';
  
  return (
    <div className={`group relative bg-surface-dark border border-white/5 rounded-2xl overflow-hidden transition-all ${
      isCompleted ? 'opacity-40 grayscale border-dashed shadow-none' : isPendingConfirm ? 'border-cyan-500/50 shadow-[0_0_15px_rgba(34,211,238,0.1)]' : 'shadow-lg cursor-pointer hover:border-white/20'
    }`}>
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isPendingConfirm ? 'bg-cyan-400' : currentTypeColor}`} />
      
      <div className="p-4 pl-6 flex items-center gap-4">
        <div className="flex flex-col items-center justify-center min-w-[3.5rem] py-1 bg-white/5 rounded-xl border border-white/5 relative">
          <span className="text-lg font-black text-white leading-none">{index}</span>
          <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">Servicio</span>
          {gapTime !== undefined && gapTime > 0 && (
            <span className={`absolute -top-2 -right-2 text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-sm border border-background-dark/50 ${gapTime > 45 ? 'bg-secondary text-white' : 'bg-primary text-white'}`}>
              {formatDuration(gapTime)}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0" onClick={onClick}>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[9px] font-black uppercase text-white px-2 py-0.5 rounded ${isPendingConfirm ? 'bg-cyan-500' : currentTypeColor}`}>
              {isPendingConfirm ? 'PENDIENTE CIERRE' : servicio.tipo}
            </span>
            <span className="text-[9px] text-slate-500 font-bold uppercase">ID #{servicio.id?.slice(-4)}</span>
            {isPendingConfirm && <span className="text-[8px] font-black text-cyan-400 animate-pulse">Waiting...</span>}
          </div>
          <h3 className="font-bold text-white truncate">{servicio.dispositivo.modelo}</h3>
          <p className="text-xs text-slate-500 truncate">{servicio.cliente.nombre}</p>

          {/* Service Notes Display Updated */}
          {servicio.dispositivo?.falla && (
             <div className="mt-3 bg-slate-900 border border-slate-700 p-3 rounded-xl flex items-start gap-3">
                <span className="material-symbols-outlined text-red-500 text-[20px] shrink-0 animate-pulse mt-0.5">warning</span>
                <p className="text-xs text-slate-200 font-medium italic leading-tight">
                   "{servicio.dispositivo.falla}"
                </p>
             </div>
          )}
        </div>

        {!isCompleted && !isPendingConfirm && (
          <button 
            onClick={(e) => { e.stopPropagation(); onOpenChat(); }}
            className={`relative w-11 h-11 rounded-xl border flex items-center justify-center transition-all shrink-0 ${
              pendingMessages > 0 ? 'bg-red-600/20 border-red-600 text-red-500 shadow-neon' : 'bg-background-dark border-white/5 text-slate-400'
            }`}
          >
            <span className="material-symbols-outlined text-xl">forum</span>
            {pendingMessages > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white text-[10px] font-black rounded-full border-2 border-surface-dark flex items-center justify-center shadow-lg animate-pulse">
                {pendingMessages}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
