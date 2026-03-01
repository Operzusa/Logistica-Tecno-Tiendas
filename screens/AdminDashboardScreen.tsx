
import React, { useState, useEffect, useRef } from 'react';
import { supabaseService } from '../services/supabaseService';
import { audioService } from '../services/audioService';
import { getColombiaDateString, isSameColombiaDay, isBeforeColombiaDay } from '../utils/dateUtils';
import { User, UserRole, Servicio, CierreCaja, EstadoServicio, ServiceLog, TipoServicio, Actividad } from '../types';
import { ServiceChatModal } from './RouteScreen';

interface Props {
  user: User;
  onLogout: () => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onOpenCreate: () => void;
  onOpenClosure: () => void;
  onOpenStats: () => void;
  onOpenDirectory: () => void;
  onOpenSateliteInventory: () => void;
  onOpenRegisterDomi: (u?: User) => void; 
  onSelectService: (s: Servicio) => void;
}

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

const typeTextColors: Record<string, string> = {
  [TipoServicio.ENTREGAR]: 'text-primary',
  [TipoServicio.RECOGER]: 'text-emerald-500',
  [TipoServicio.SATELITE]: 'text-purple-400',
  [TipoServicio.GARANTIA]: 'text-amber-500',
  [TipoServicio.COTIZAR]: 'text-cyan-400',
  [TipoServicio.COMPRAR]: 'text-pink-400',
  [TipoServicio.CONSIGNAR]: 'text-indigo-400',
  [TipoServicio.DILIGENCIA]: 'text-lime-400',
};

// Helper para formatear duraciones (gaps)
const formatDuration = (minutes: number) => {
  if (minutes < 60) return `+${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `+${h}h ${m}m` : `+${h}h`;
};

// Helper para formatear fecha extendida (24 May, 14:30)
const formatFullDate = (iso: string) => {
  const d = new Date(iso);
  const day = d.getDate();
  const month = d.toLocaleString('es-ES', { month: 'short' });
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${day} ${month}, ${time}`;
};

export const AdminDashboardScreen: React.FC<Props> = ({ 
  user, onLogout, onOpenSettings, onOpenHistory, onOpenCreate, onOpenClosure, onOpenStats, onOpenDirectory, onOpenSateliteInventory, onOpenRegisterDomi, onSelectService
}) => {
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [domis, setDomis] = useState<User[]>([]);
  const [cierre, setCierre] = useState<CierreCaja | null>(null);
  const [historial, setHistorial] = useState<Actividad[]>([]);
  const [activeFuelAlerts, setActiveFuelAlerts] = useState<Actividad[]>([]);
  const [isOverdueExpanded, setIsOverdueExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [chatServicioId, setChatServicioId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  
  const [selectedDomiTimeline, setSelectedDomiTimeline] = useState<User | null>(null);
  const [serviceToConfirm, setServiceToConfirm] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  // Nuevo estado para controlar el modo de gestión de flota
  const [isFleetManagementMode, setIsFleetManagementMode] = useState(false);

  const prevLogsCountMap = useRef<Record<string, number>>({});
  const prevServiceStatusMap = useRef<Record<string, EstadoServicio>>({});
  
  // Track previously known alerts to trigger sound only on new ones
  const prevFuelAlertIds = useRef<Set<string>>(new Set());

  const fetchData = async () => {
    try {
      const s = await supabaseService.getAllServicios();
      const c = await supabaseService.getReporteCierre();
      // Force refresh para asegurar lista actualizada al borrar/crear
      const d = await supabaseService.forceRefreshUsers();
      const domisOnly = d.filter(u => u.role === UserRole.DOMICILIARIO);
      
      const h = await supabaseService.getHistorial();
      setHistorial(h);

      // --- LOGIC FOR FUEL ALERTS ---
      // Filter for Gasolina type AND 'SOLICITUD DE COMBUSTIBLE' description (unresolved)
      const currentAlerts = h.filter(act => 
        act.tipo === 'Gasolina' && 
        act.descripcion === 'SOLICITUD DE COMBUSTIBLE'
      );
      
      setActiveFuelAlerts(currentAlerts);

      // Check for NEW alerts to play sound
      const currentAlertIds = new Set(currentAlerts.map(a => a.id));
      const hasNewAlert = currentAlerts.some(a => !prevFuelAlertIds.current.has(a.id));
      
      if (hasNewAlert) {
        audioService.playFuelAlert();
      }
      prevFuelAlertIds.current = currentAlertIds;
      // -----------------------------

      let anyNewMessage = false;
      let anyNewPendingConfirm = false;
      let anyNewPaymentRequest = false;

      (s || []).forEach(serv => {
        const currentLogs = serv.logs || [];
        const currentCount = currentLogs.length;
        const prevCount = prevLogsCountMap.current[serv.id] || 0;
        const prevStatus = prevServiceStatusMap.current[serv.id];
        
        if (currentCount > prevCount) {
          const newLogs = currentLogs.slice(prevCount);
          
          // Check specifically for NEW payment requests
          if (newLogs.some(l => l.type === 'payment' && l.autor === 'Domiciliario')) {
             anyNewPaymentRequest = true;
          }

          const lastLog = currentLogs[currentCount - 1];
          if (lastLog?.autor === 'Domiciliario') {
            anyNewMessage = true;
          }
        }

        // Si el estado CAMBIA a POR_CONFIRMAR, suena alerta
        if (prevStatus && prevStatus !== EstadoServicio.POR_CONFIRMAR && serv.estado === EstadoServicio.POR_CONFIRMAR) {
          anyNewPendingConfirm = true;
        }

        prevLogsCountMap.current[serv.id] = currentCount;
        prevServiceStatusMap.current[serv.id] = serv.estado;
      });

      // Priority for audio: Payment > Pending Confirm > Message
      if (anyNewPaymentRequest) {
        audioService.playPaymentRequest();
      } else if (anyNewPendingConfirm) {
        audioService.playUpdate(); // Sonido específico de actualización
      } else if (anyNewMessage) {
        audioService.playMessage();
      }

      setServicios(s || []);
      setCierre(c);
      setDomis(domisOnly || []);
    } catch (e) {
      console.error("Dashboard error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Fallback polling every 60 seconds (reduced from 5s to save egress)
    const interval = setInterval(fetchData, 60000); 
    
    // Realtime subscription for instant updates without aggressive polling
    const channel = supabaseService.client.channel('admin-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'servicios' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'actividades' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabaseService.client.removeChannel(channel);
    };
  }, []);

  const handleResolveFuelAlert = async (activityId: string) => {
    try {
      await supabaseService.resolverAlertaGasolina(activityId);
      // Optimistically remove from UI or wait for next poll
      setActiveFuelAlerts(prev => prev.filter(a => a.id !== activityId));
      fetchData();
    } catch (e) {
      alert("Error al resolver alerta.");
    }
  };

  const handleConfirmService = (e: React.MouseEvent, srvId: string) => {
    e.stopPropagation();
    setServiceToConfirm(srvId);
  };

  const executeConfirmService = async () => {
    if (!serviceToConfirm) return;
    setIsConfirming(true);
    try {
      await supabaseService.updateEstadoServicio(serviceToConfirm, EstadoServicio.COMPLETADO);
      setServicios(prev => prev.map(s => s.id === serviceToConfirm ? { ...s, estado: EstadoServicio.COMPLETADO } : s));
      // fetchData() is optional since we do optimistic update, but good to keep sync
      fetchData();
    } catch (err: any) {
      alert(`Error al confirmar servicio: ${err.message || 'Intente nuevamente'}`);
    } finally {
      setIsConfirming(false);
      setServiceToConfirm(null);
    }
  };

  const executeRejectService = async () => {
    if (!serviceToConfirm) return;
    try {
      await supabaseService.updateEstadoServicio(serviceToConfirm, EstadoServicio.PENDIENTE);
      await supabaseService.addServiceLog(serviceToConfirm, "⚠️ Cierre denegado por Administrador. Retornado a ruta.");
      fetchData();
    } catch (err) {
      alert("Error al retornar servicio a ruta");
    } finally {
      setServiceToConfirm(null);
    }
  };

  const executeDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await supabaseService.deleteUser(userToDelete.id);
      setUserToDelete(null);
      await fetchData();
    } catch (e: any) {
      alert(`Error al eliminar usuario: ${e.message}`);
    }
  };

  const getDomiStats = (domiId: string) => {
    const todayStr = getColombiaDateString();
    const mineToday = servicios.filter(s => s.domiciliario_id === domiId && isSameColombiaDay(s.fecha_asignacion, todayStr));
    const completed = mineToday.filter(s => s.estado === EstadoServicio.COMPLETADO).length;
    return { 
      total: Number(mineToday.length), 
      completed: Number(completed), 
      percent: mineToday.length ? (completed / mineToday.length) * 100 : 0 
    };
  };

  const getPendingMessagesForAdmin = (logs: ServiceLog[] = []) => {
    const safeLogs = logs || [];
    if (safeLogs.length === 0) return 0;
    const lastLog = safeLogs[safeLogs.length - 1];
    if (lastLog.autor === 'Administrador') return 0;
    let count = 0;
    for (let i = safeLogs.length - 1; i >= 0; i--) {
      if (safeLogs[i].autor === 'Domiciliario') count++;
      else break;
    }
    return Number(count);
  };

  const getRelativeIndexForDomi = (servicio: Servicio) => {
    if (!servicio.domiciliario_id) return 0;
    const todayStr = getColombiaDateString();
    const domiRouteToday = servicios
      .filter(s => s.domiciliario_id === servicio.domiciliario_id && isSameColombiaDay(s.fecha_asignacion, todayStr))
      .sort((a, b) => new Date(a.fecha_asignacion).getTime() - new Date(b.fecha_asignacion).getTime());
    
    const index = domiRouteToday.findIndex(s => s.id === servicio.id);
    return index !== -1 ? Number(index + 1) : 0;
  };

  const getTimelineData = (domiId: string) => {
    const todayStr = getColombiaDateString();
    const allDomiServices = servicios
      .filter(s => s.domiciliario_id === domiId && isSameColombiaDay(s.fecha_asignacion, todayStr))
      .sort((a, b) => new Date(a.fecha_asignacion).getTime() - new Date(b.fecha_asignacion).getTime());

    const closed = allDomiServices
      .filter(s => s.estado === EstadoServicio.COMPLETADO || s.estado === EstadoServicio.POR_CONFIRMAR)
      .sort((a, b) => new Date(a.updated_at || a.fecha_asignacion).getTime() - new Date(b.updated_at || b.fecha_asignacion).getTime());

    let previousTime = allDomiServices.length > 0 ? new Date(allDomiServices[0].fecha_asignacion).getTime() : Date.now();
    
    return closed.map(s => {
      const current = new Date(s.updated_at || s.fecha_asignacion).getTime();
      const gap = Math.floor((current - previousTime) / (1000 * 60));
      previousTime = current;
      return {
        id: String(s.id),
        modelo: String(s.dispositivo?.modelo || 'Sin modelo'),
        estado: String(s.estado),
        time: new Date(s.updated_at || s.fecha_asignacion).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        gap: Number(gap > 0 ? gap : 0)
      };
    });
  };

  const todayStr = getColombiaDateString();
  const todaysMonitorServices = servicios.filter(s => isSameColombiaDay(s.fecha_asignacion, todayStr));
  
  const pendingConfirm = servicios.filter(s => s.estado === EstadoServicio.POR_CONFIRMAR);
  
  const activeServices = todaysMonitorServices.filter(s => s.estado !== EstadoServicio.COMPLETADO && s.estado !== EstadoServicio.POR_CONFIRMAR);
  const completedServices = todaysMonitorServices.filter(s => s.estado === EstadoServicio.COMPLETADO);
  
  const overdueServices = servicios.filter(s => 
    isBeforeColombiaDay(s.fecha_asignacion, todayStr) && 
    s.estado !== EstadoServicio.COMPLETADO && 
    s.estado !== EstadoServicio.POR_CONFIRMAR
  );

  const activeChatServicio = servicios.find(s => s.id === chatServicioId);

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col pb-32">
      {/* --- RED ALERT BANNER FOR FUEL --- */}
      {activeFuelAlerts.length > 0 && (
        <div className="bg-red-600 text-white p-4 animate-in slide-in-from-top duration-300 shadow-neon-strong sticky top-0 z-50">
          {activeFuelAlerts.map(alert => (
            <div key={alert.id} className="flex items-center justify-between gap-4 mb-2 last:mb-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center animate-bounce">
                  <span className="material-symbols-outlined text-xl">local_gas_station</span>
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest leading-none">¡ALERTA!: SOLICITUD DE COMBUSTIBLE</h3>
                  <p className="text-[10px] font-medium mt-1">{alert.detalle} • {new Date(alert.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                </div>
              </div>
              <button 
                onClick={() => handleResolveFuelAlert(alert.id)}
                className="bg-white text-red-600 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-slate-100 active:scale-95 transition-all flex items-center gap-2"
              >
                DESPACHAR <span className="material-symbols-outlined text-sm">check</span>
              </button>
            </div>
          ))}
        </div>
      )}

      <header className="p-4 border-b border-white/10 flex items-center justify-between sticky top-0 bg-background-dark/95 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <img src={String(user.avatar || '')} className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20" alt="Admin" />
          <div>
            <h1 className="text-sm font-black uppercase tracking-widest text-primary leading-none">Administrador</h1>
            <p className="text-xs font-bold text-white mt-0.5">{String(user.nombre || 'Sin nombre')}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={onOpenDirectory} 
            className="p-2 hover:bg-cyan-500/10 rounded-full text-cyan-400 transition-colors"
            title="Directorio de Contactos"
          >
            <span className="material-symbols-outlined">contacts</span>
          </button>
          <button 
            onClick={onOpenSateliteInventory} 
            className="p-2 hover:bg-purple-500/10 rounded-full text-purple-400 transition-colors"
            title="Inventario Satélite"
          >
            <span className="material-symbols-outlined">hub</span>
          </button>
          <button onClick={onOpenSettings} className="p-2 hover:bg-white/5 rounded-full text-slate-400">
            <span className="material-symbols-outlined">settings</span>
          </button>
          <button onClick={onLogout} className="p-2 hover:bg-white/5 rounded-full text-secondary">
            <span className="material-symbols-outlined">logout</span>
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
           <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <main className="p-4 space-y-6">
          <section className="grid grid-cols-2 gap-4">
            <div className="bg-surface-dark border border-white/5 p-4 rounded-2xl shadow-lg">
              <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Recaudo Confirmado</p>
              <h3 className="text-xl font-bold text-primary shadow-neon">
                ${cierre ? Number(cierre.total_cobrado).toLocaleString() : '0'}
              </h3>
            </div>
            <div className="bg-surface-dark border border-white/5 p-4 rounded-2xl shadow-lg">
              <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Gestiones Hoy</p>
              <h3 className="text-xl font-bold text-white">{Number(todaysMonitorServices.length)}</h3>
            </div>
          </section>

          {overdueServices.length > 0 && (
            <section className="space-y-4 animate-in slide-in-from-top duration-500">
              <button 
                onClick={() => setIsOverdueExpanded(!isOverdueExpanded)}
                className="w-full flex items-center justify-between text-left"
              >
                <h2 className="text-xs font-black uppercase tracking-widest text-red-500 flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm animate-pulse">warning</span>
                  ⚠️ SERVICIOS ATRASADOS SIN CERRAR ({Number(overdueServices.length)})
                </h2>
                <span className="material-symbols-outlined text-red-500 transition-transform duration-300" style={{ transform: isOverdueExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                  expand_more
                </span>
              </button>
              
              {isOverdueExpanded && (
                <div className="space-y-3">
                  {overdueServices.map(s => {
                    const domi = domis.find(d => d.id === s.domiciliario_id);
                    return (
                      <div key={String(s.id)} onClick={() => onSelectService(s)} className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl flex items-center gap-4 shadow-[0_0_15px_rgba(239,68,68,0.1)] group cursor-pointer">
                        <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 group-hover:scale-110 transition-transform">
                          <span className="material-symbols-outlined text-xl">error</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start mb-1">
                            <p className="font-bold text-red-400 text-sm leading-tight">{String(s.cliente?.nombre || 'Sin Cliente')}</p>
                            <span className="text-[10px] font-bold text-red-500/70 bg-red-500/10 px-2 py-0.5 rounded-full">
                              {new Date(s.fecha_asignacion).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                          <p className="text-xs text-red-400/70 truncate">{String(s.tipo)} • {String(s.dispositivo?.modelo || 'Sin modelo')}</p>
                          <p className="text-[10px] text-red-500/50 font-bold mt-1 uppercase">Domi: {domi?.nombre || 'Sin asignar'}</p>
                        </div>
                        <span className="material-symbols-outlined text-red-500/50 group-hover:text-red-400 transition-colors">chevron_right</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {pendingConfirm.length > 0 && (
            <section className="space-y-4 animate-in slide-in-from-top duration-500">
              <h2 className="text-xs font-black uppercase tracking-widest text-cyan-400 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm animate-pulse">new_releases</span>
                Por Confirmar ({Number(pendingConfirm.length)})
              </h2>
              <div className="space-y-3">
                {pendingConfirm.map(s => {
                  const domi = domis.find(d => d.id === s.domiciliario_id);
                  return (
                    <div key={String(s.id)} onClick={() => onSelectService(s)} className="bg-cyan-500/5 border border-cyan-500/30 p-4 rounded-2xl flex items-center gap-4 shadow-[0_0_15px_rgba(34,211,238,0.1)] group cursor-pointer">
                      <div className="flex-1 min-w-0">
                         <div className="flex items-center gap-2 mb-1">
                            <span className="text-[9px] font-black uppercase bg-cyan-500 text-white px-2 py-0.5 rounded">Revisar</span>
                            <span className="text-[9px] text-slate-500 font-bold">#{String(s.id).slice(-4)}</span>
                         </div>
                         <h4 className="text-sm font-bold text-white truncate">{String(s.dispositivo?.modelo || 'Sin modelo')}</h4>
                         <p className="text-[10px] text-slate-400 truncate">Entregado por: <span className="text-white font-bold">{String(domi?.nombre || 'S.A.')}</span></p>
                      </div>
                      <button onClick={(e) => handleConfirmService(e, s.id)} className="bg-cyan-500 text-white px-4 py-3 rounded-xl font-black text-[10px] shadow-neon hover:bg-cyan-400 active:scale-95 transition-all">CONFIRMAR</button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">Monitoreo Global</h2>
              <button onClick={() => setShowCompleted(!showCompleted)} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all border ${showCompleted ? 'bg-primary/20 border-primary/30 text-primary' : 'bg-surface-dark border-white/10 text-slate-500'}`}><span className="material-symbols-outlined text-lg">{showCompleted ? 'visibility' : 'visibility_off'}</span></button>
            </div>
            <div className="space-y-3">
              {[...activeServices, ...(showCompleted ? completedServices : [])].map((s) => {
                const domi = domis.find(d => d.id === s.domiciliario_id);
                const pendingMessages = getPendingMessagesForAdmin(s.logs);
                const isFinished = s.estado === EstadoServicio.COMPLETADO;
                const turnNumber = getRelativeIndexForDomi(s);
                const hasPendingPayment = s.logs?.some(l => l.type === 'payment' && l.paymentStatus === 'pending');

                return (
                  <div key={String(s.id)} onClick={() => onSelectService(s)} className={`relative bg-surface-dark border border-white/5 p-4 pl-6 rounded-2xl flex items-center gap-4 transition-all overflow-hidden ${isFinished ? 'opacity-50' : 'shadow-lg cursor-pointer hover:border-white/10'}`}>
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${typeColors[s.tipo] || 'bg-slate-500'} ${!isFinished && 'shadow-neon'}`} />
                    
                    {/* Turno Number Box */}
                    <div className="flex flex-col items-center justify-center min-w-[3.2rem] py-1 bg-white/5 rounded-xl border border-white/5 shrink-0">
                      <span className="text-lg font-black text-white leading-none">{Number(turnNumber)}</span>
                      <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">Servicio</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-2">
                         <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                               <span className={`text-[10px] font-black uppercase tracking-widest ${typeTextColors[s.tipo] || 'text-primary'}`}>
                                  {String(s.tipo)}
                               </span>
                               <span className="text-[9px] text-slate-500 font-bold">#{String(s.id).slice(-4)}</span>
                               {hasPendingPayment && (
                                  <span className="material-symbols-outlined text-amber-500 animate-pulse text-sm" title="Solicitud de Pago Pendiente">attach_money</span>
                               )}
                            </div>
                            <h4 className="text-sm font-bold text-white truncate mt-1">{String(s.dispositivo?.modelo || 'Sin modelo')}</h4>
                         </div>
                         <div className="text-right shrink-0">
                            <p className="text-[10px] font-black text-slate-500 uppercase leading-none">{formatFullDate(s.updated_at || s.fecha_asignacion)}</p>
                            <p className={`text-[9px] font-black uppercase mt-1 ${isFinished ? 'text-success' : 'text-primary'}`}>
                               {String(s.estado).replace('_', ' ')}
                            </p>
                         </div>
                      </div>

                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                        <div className="flex items-center gap-2 min-w-0">
                          <img src={domi?.avatar || `https://api.dicebear.com/7.x/shapes/svg?seed=${domi?.nombre || 'domi'}`} className="w-5 h-5 rounded-full border border-white/10" alt="Domi" />
                          <p className="text-[10px] text-slate-400 truncate">
                            <span className="text-white font-bold">{domi?.nombre?.split(' ')[0] || '---'}</span> • {String(s.cliente?.nombre || 'S.C.')}
                          </p>
                        </div>
                        {!isFinished && (
                          <button onClick={(e) => { e.stopPropagation(); setChatServicioId(s.id); }} className={`relative w-8 h-8 rounded-lg bg-background-dark border flex items-center justify-center ${pendingMessages > 0 ? 'border-red-600 text-red-500 animate-pulse' : 'border-white/5 text-slate-500'}`}>
                            <span className="material-symbols-outlined text-[18px]">forum</span>
                            {pendingMessages > 0 && <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center font-black">{Number(pendingMessages)}</span>}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="space-y-4 pb-12">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-black uppercase text-slate-400">Flota</h2>
              <div className="flex gap-2">
                {isFleetManagementMode && (
                  <button 
                    onClick={() => onOpenRegisterDomi()}
                    className="bg-primary/10 border border-primary/20 text-primary px-3 py-1.5 rounded-full flex items-center gap-1 text-[9px] font-black uppercase tracking-widest hover:bg-primary/20 transition-all active:scale-95 animate-in fade-in slide-in-from-right"
                  >
                    <span className="material-symbols-outlined text-sm">person_add</span>
                    NUEVO
                  </button>
                )}
                <button 
                  onClick={() => setIsFleetManagementMode(!isFleetManagementMode)}
                  className={`border px-3 py-1.5 rounded-full flex items-center gap-1 text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 ${isFleetManagementMode ? 'bg-white/10 text-white border-white/20' : 'bg-surface-dark text-slate-500 border-white/5 hover:bg-white/5'}`}
                >
                  <span className="material-symbols-outlined text-sm">{isFleetManagementMode ? 'check' : 'edit_road'}</span>
                  {isFleetManagementMode ? 'LISTO' : 'GESTIONAR RUTA'}
                </button>
              </div>
            </div>

            {domis.map(d => {
              const stats = getDomiStats(d.id);
              return (
                <div key={String(d.id)} className="bg-surface-dark border border-white/5 p-4 rounded-2xl space-y-3 group/domi relative">
                  <div className="flex items-center justify-between">
                    <div 
                      onClick={() => setSelectedDomiTimeline(d)}
                      className="flex items-center gap-3 cursor-pointer"
                    >
                      <div className="relative">
                        <img src={String(d.avatar || '')} className="w-10 h-10 rounded-xl transition-transform group-hover/domi:scale-105" alt={String(d.nombre || 'Domi')} />
                        <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover/domi:opacity-100 rounded-xl transition-opacity" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white group-hover/domi:text-primary transition-colors">{String(d.nombre || 'Sin nombre')}</h4>
                        <p className="text-[10px] text-slate-500 uppercase font-bold">{Number(stats.completed)}/{Number(stats.total)} Hoy</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-1">
                      {isFleetManagementMode && (
                        <>
                          <button 
                            onClick={() => onOpenRegisterDomi(d)}
                            className="w-8 h-8 rounded-lg bg-white/5 text-slate-400 hover:text-white transition-colors flex items-center justify-center border border-white/5 hover:bg-white/10 animate-in fade-in zoom-in"
                            title="Editar Domiciliario"
                          >
                            <span className="material-symbols-outlined text-sm">edit</span>
                          </button>
                          <button 
                            onClick={() => setUserToDelete(d)}
                            className="w-8 h-8 rounded-lg bg-white/5 text-slate-400 hover:text-secondary transition-colors flex items-center justify-center border border-white/5 hover:bg-secondary/10 animate-in fade-in zoom-in"
                            title="Eliminar Domiciliario"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        </>
                      )}
                      <button 
                        onClick={() => setSelectedDomiTimeline(d)} 
                        className="w-8 h-8 rounded-lg bg-white/5 text-primary hover:text-white transition-colors flex items-center justify-center border border-white/5 hover:bg-primary/20"
                        title="Ver Ruta"
                      >
                        <span className="material-symbols-outlined text-sm">timer</span>
                      </button>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-background-dark rounded-full overflow-hidden border border-white/5">
                    <div className="h-full bg-primary shadow-neon transition-all" style={{ width: `${stats.percent}%` }} />
                  </div>
                </div>
              );
            })}
          </section>
        </main>
      )}

      {selectedDomiTimeline && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-end sm:items-center justify-center p-0 animate-in fade-in duration-300">
          <div className="bg-surface-dark w-full max-sm h-[80vh] rounded-t-[32px] border border-white/10 flex flex-col overflow-hidden shadow-2xl">
            <header className="p-5 border-b border-white/5 flex items-center justify-between">
              <h3 className="font-bold text-white uppercase text-xs">Ruta de {String(selectedDomiTimeline.nombre || 'Domiciliario')}</h3>
              <button onClick={() => setSelectedDomiTimeline(null)} className="p-2 hover:bg-white/10 rounded-full"><span className="material-symbols-outlined">close</span></button>
            </header>
            <div className="flex-1 overflow-y-auto p-6 relative">
              <div className="absolute left-9 top-0 bottom-0 w-0.5 bg-white/5" />
              {getTimelineData(selectedDomiTimeline.id).length === 0 ? (
                <div className="py-20 text-center opacity-30"><p className="text-xs font-black uppercase">Sin actividad hoy</p></div>
              ) : getTimelineData(selectedDomiTimeline.id).map((item, idx) => (
                <div key={String(item.id || idx)} className="relative pl-10 mb-8">
                  <div className="absolute left-[30px] top-1.5 w-3 h-3 rounded-full bg-primary border-4 border-background-dark z-10" />
                  <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[9px] font-black text-slate-500">{String(item.time)}</span>
                      {item.gap > 0 && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${item.gap > 45 ? 'bg-secondary/20 text-secondary' : 'bg-primary/20 text-primary'}`}>{formatDuration(item.gap)}</span>}
                    </div>
                    <p className="text-sm font-bold text-white">{String(item.modelo)}</p>
                    <p className="text-[10px] text-slate-400">{String(item.estado) === EstadoServicio.POR_CONFIRMAR ? 'PENDIENTE CIERRE' : 'FINALIZADO'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Servicio */}
      {serviceToConfirm && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-200">
           <div className="bg-surface-dark border border-white/10 rounded-[28px] p-6 w-full max-w-sm space-y-6 shadow-2xl animate-in zoom-in duration-200">
              <div className="text-center space-y-3">
                 <div className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center text-cyan-400 mx-auto mb-2 border border-cyan-500/30 shadow-neon">
                    <span className="material-symbols-outlined text-3xl">check_circle</span>
                 </div>
                 <h3 className="text-lg font-black text-white uppercase tracking-tight">¿Confirmar Finalización?</h3>
                 <p className="text-sm text-slate-400 font-medium">
                    ¿Confirma que este servicio ha sido Completado?
                 </p>
              </div>

              <div className="flex gap-3">
                 <button 
                   onClick={executeRejectService} 
                   disabled={isConfirming}
                   className="flex-1 py-3.5 bg-white/5 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-400 border border-white/5 active:scale-95 transition-all hover:bg-white/10 disabled:opacity-50"
                 >
                    No
                 </button>
                 <button 
                   onClick={executeConfirmService} 
                   disabled={isConfirming}
                   className="flex-1 py-3.5 bg-cyan-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-neon active:scale-95 transition-all disabled:opacity-50"
                 >
                    {isConfirming ? 'Cerrando...' : 'Si'}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Modal de Eliminación de Usuario */}
      {userToDelete && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-200">
           <div className="bg-surface-dark border border-white/10 rounded-[28px] p-6 w-full max-w-sm space-y-6 shadow-2xl animate-in zoom-in duration-200">
              <div className="text-center space-y-3">
                 <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center text-secondary mx-auto mb-2 border border-secondary/20">
                    <span className="material-symbols-outlined text-3xl">person_remove</span>
                 </div>
                 <h3 className="text-lg font-black text-white uppercase tracking-tight">¿Eliminar Domiciliario?</h3>
                 <p className="text-sm text-slate-400 font-medium px-2">
                    Esta acción eliminará permanentemente a <strong className="text-white">{userToDelete.nombre}</strong>. Sus servicios históricos quedarán sin asignar.
                 </p>
              </div>

              <div className="flex gap-3">
                 <button 
                   onClick={() => setUserToDelete(null)}
                   className="flex-1 py-3.5 bg-white/5 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-400 border border-white/5 active:scale-95 transition-all hover:bg-white/10"
                 >
                    Cancelar
                 </button>
                 <button 
                   onClick={executeDeleteUser} 
                   className="flex-1 py-3.5 bg-secondary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-neon-strong active:scale-95 transition-all"
                 >
                    Eliminar
                 </button>
              </div>
           </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-surface-dark/95 backdrop-blur-lg border-t border-white/5 h-20 flex justify-around items-center px-2 z-40">
        <NavItem active icon="dashboard" label="Panel" onClick={() => {}} />
        <NavItem icon="bar_chart" label="Stats" onClick={onOpenStats} />
        <div className="relative -top-5 flex flex-col items-center">
          <button onClick={onOpenCreate} className="w-16 h-16 bg-primary rounded-full flex items-center justify-center text-white shadow-neon-strong border-4 border-background-dark active:scale-90"><span className="material-symbols-outlined text-3xl">add</span></button>
        </div>
        <NavItem 
          icon="account_balance_wallet" 
          label="Cierre" 
          onClick={onOpenClosure} 
          badgeCount={pendingConfirm.length} 
        />
        <NavItem icon="history" label="Historial" onClick={onOpenHistory} />
      </nav>

      {activeChatServicio && (
        <ServiceChatModal servicio={activeChatServicio} onClose={() => setChatServicioId(null)} onMessageSent={fetchData} />
      )}
    </div>
  );
};

const NavItem: React.FC<{ icon: string; label: string; active?: boolean; onClick?: () => void; badgeCount?: number }> = ({ icon, label, active, onClick, badgeCount }) => (
  <div onClick={onClick} className={`relative flex flex-col items-center gap-1 cursor-pointer transition-all flex-1 py-2 ${active ? 'text-primary' : 'text-slate-500'}`}>
    <span className="material-symbols-outlined text-[24px]">{String(icon)}</span>
    <span className="text-[8px] font-black uppercase text-center">{String(label)}</span>
    {badgeCount !== undefined && badgeCount > 0 && (
      <span className="absolute top-1 right-2 w-5 h-5 bg-secondary text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-surface-dark animate-bounce z-10 shadow-sm">
        {badgeCount}
      </span>
    )}
  </div>
);
