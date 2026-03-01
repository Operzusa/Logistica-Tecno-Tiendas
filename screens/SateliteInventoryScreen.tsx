
import React, { useState, useEffect } from 'react';
import { supabaseService } from '../services/supabaseService';
import { Servicio, TipoServicio, EstadoServicio, ServiceLog, TecnicoSatelite } from '../types';
import { ServiceChatModal } from './RouteScreen';

interface Props {
  onBack: () => void;
  onProgramarRecogida: (prefill: Partial<Servicio>) => void;
  onSelectService: (s: Servicio) => void;
}

export const SateliteInventoryScreen: React.FC<Props> = ({ onBack, onProgramarRecogida, onSelectService }) => {
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<Servicio[]>([]);
  const [tecnicos, setTecnicos] = useState<TecnicoSatelite[]>([]);
  const [chatService, setChatService] = useState<Servicio | null>(null);
  
  // States for Technician Change Modal
  const [changeModalService, setChangeModalService] = useState<Servicio | null>(null);
  const [selectedNewTech, setSelectedNewTech] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [submittingChange, setSubmittingChange] = useState(false);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const [allServices, allTecnicos] = await Promise.all([
        supabaseService.getAllServicios(),
        supabaseService.getTecnicosSatelite()
      ]);
      
      setTecnicos(allTecnicos);

      // Filtramos equipos que están en satélite (Llevar) y cuya gestión fue completada (Entregados al técnico)
      const sateliteLlevar = allServices.filter(s => 
        s.tipo === TipoServicio.SATELITE && 
        s.satelite_info?.accion === 'Llevar' && 
        s.estado === EstadoServicio.COMPLETADO
      );

      // Verificamos si ya existe una recogida para ese equipo/orden para no duplicar en lista
      const sateliteRecoger = allServices.filter(s => 
        s.tipo === TipoServicio.SATELITE && 
        s.satelite_info?.accion === 'Recoger'
      );

      // El equipo sigue en inventario si no hay un servicio de RECOGER posterior para esa misma orden/dispositivo
      const filtered = sateliteLlevar.filter(llevar => {
        const yaFueRecogido = sateliteRecoger.some(recoger => 
          recoger.satelite_info?.no_orden === llevar.satelite_info?.no_orden &&
          recoger.cliente.nombre === llevar.cliente.nombre
        );
        return !yaFueRecogido;
      });

      setInventory(filtered);
    } catch (e) {
      console.error("Error cargando inventario satélite:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const handleAction = (e: React.MouseEvent, item: Servicio) => {
    e.stopPropagation();
    
    // Clonar logs existentes para mantener historial
    const existingLogs = item.logs || [];
    
    // Agregar log de sistema informando transferencia
    const transferLog: ServiceLog = {
        id: supabaseService.generateUUID(),
        timestamp: new Date().toISOString(),
        mensaje: `🔄 Historial transferido del servicio anterior #${item.id.slice(-4)} (Satélite)`,
        autor: 'Administrador',
        status: 'read',
        type: 'text'
    };

    const newLogs = [...existingLogs, transferLog];

    // Preparamos los datos para crear un servicio de RECOGER
    const prefill: Partial<Servicio> = {
      tipo: TipoServicio.SATELITE,
      cliente: { ...item.cliente },
      dispositivo: { ...item.dispositivo },
      satelite_info: {
        nombre_tecnico_externo: item.satelite_info?.nombre_tecnico_externo || '',
        costo_reparacion: item.satelite_info?.costo_reparacion || 0,
        accion: 'Recoger',
        no_orden: item.satelite_info?.no_orden
      },
      logs: newLogs // Pasamos los logs completos al nuevo servicio
    };
    onProgramarRecogida(prefill);
  };

  const handleOpenChat = (e: React.MouseEvent, item: Servicio) => {
    e.stopPropagation();
    setChatService(item);
  };

  const handleOpenChangeModal = (e: React.MouseEvent, item: Servicio) => {
    e.stopPropagation();
    setChangeModalService(item);
    setSelectedNewTech('');
    setChangeReason('');
  };

  const submitTechnicianChange = async () => {
    if (!changeModalService || !selectedNewTech || !changeReason.trim()) {
      alert("Por favor selecciona un técnico y escribe una razón.");
      return;
    }

    const techObj = tecnicos.find(t => t.id === selectedNewTech);
    if (!techObj) return;

    setSubmittingChange(true);
    try {
      await supabaseService.requestTechnicianChange(changeModalService.id, {
        new_technician_id: techObj.id,
        new_technician_name: techObj.nombre,
        reason: changeReason,
        timestamp: new Date().toISOString()
      });
      alert("Solicitud enviada al Administrador.");
      setChangeModalService(null);
      fetchInventory();
    } catch (e) {
      alert("Error enviando solicitud.");
    } finally {
      setSubmittingChange(false);
    }
  };

  const getDaysInWorkshop = (timestamp: string) => {
    if (!timestamp) return 0;
    const start = new Date(timestamp).getTime();
    const now = new Date().getTime();
    const diff = now - start;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    return days;
  };

  const getUnreadCount = (logs: ServiceLog[] = []) => {
    return logs.length;
  };

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col bg-background-dark animate-in slide-in-from-right duration-300">
      <header className="p-4 flex items-center gap-4 border-b border-white/10 sticky top-0 bg-background-dark/95 backdrop-blur-md z-10">
        <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-full">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div>
          <h1 className="text-xl font-bold">Control Satélite</h1>
          <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Equipos en Taller Externo</p>
        </div>
      </header>

      <main className="flex-1 p-4 space-y-4 overflow-y-auto pb-32">
        {loading ? (
          <div className="py-20 flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-black uppercase text-slate-500">Analizando Inventario...</p>
          </div>
        ) : inventory.length === 0 ? (
          <div className="py-20 text-center opacity-20">
            <span className="material-symbols-outlined text-6xl">inventory_2</span>
            <p className="text-xs font-black uppercase mt-4">No hay equipos en Satélite actualmente</p>
          </div>
        ) : (
          <div className="space-y-4">
            {inventory.map(item => {
              // CHANGE: Use created_at if available, fallback to fecha_asignacion (creation time proxy).
              // Never use updated_at for calculating total duration in workshop.
              const startTimestamp = item.created_at || item.fecha_asignacion;
              const days = getDaysInWorkshop(startTimestamp);
              const msgCount = getUnreadCount(item.logs);
              const hasPendingChange = !!item.satelite_info?.pending_change;
              
              return (
                <div 
                  key={item.id} 
                  onClick={() => onSelectService(item)}
                  className="bg-surface-dark border border-white/5 p-4 rounded-2xl space-y-4 relative overflow-hidden group hover:border-purple-500/30 transition-all shadow-lg cursor-pointer active:scale-[0.99]"
                >
                  <div className="absolute top-0 right-0 p-3 z-10">
                    <span className={`text-[9px] font-black px-2 py-1 rounded-full uppercase ${days > 3 ? 'bg-secondary text-white animate-pulse' : 'bg-white/10 text-slate-400'}`}>
                      {days === 0 ? 'Hoy' : `${days} Días`}
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-400 shrink-0">
                      <span className="material-symbols-outlined">laptop_mac</span>
                    </div>
                    <div className="flex-1 min-w-0 pr-12">
                      <h3 className="font-bold text-white truncate text-sm">{item.dispositivo.modelo}</h3>
                      <p className="text-[10px] text-slate-500 font-bold uppercase truncate">Orden: {item.satelite_info?.no_orden || 'N/A'}</p>
                    </div>
                  </div>

                  {/* INFO TÉCNICO Y BOTÓN DE CAMBIO */}
                  <div className="bg-black/20 rounded-xl p-3">
                    <div className="grid grid-cols-2 gap-4 mb-2">
                      <div>
                        <p className="text-[8px] font-black text-slate-500 uppercase mb-0.5">Técnico Externo</p>
                        <p className="text-xs font-bold text-white truncate">{item.satelite_info?.nombre_tecnico_externo}</p>
                      </div>
                      <div>
                        <p className="text-[8px] font-black text-slate-500 uppercase mb-0.5">Costo Estimado</p>
                        <p className="text-xs font-black text-purple-400">${item.satelite_info?.costo_reparacion.toLocaleString()}</p>
                      </div>
                    </div>
                    
                    <div className="pt-2 border-t border-white/5 flex justify-end">
                       <button 
                          onClick={(e) => handleOpenChangeModal(e, item)}
                          disabled={hasPendingChange}
                          className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all ${hasPendingChange ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white border border-white/5'}`}
                        >
                          <span className="material-symbols-outlined text-[12px]">{hasPendingChange ? 'hourglass_empty' : 'sync_alt'}</span>
                          {hasPendingChange ? 'Solicitud Pendiente' : 'Solicitar Cambio de Técnico'}
                        </button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={(e) => handleOpenChat(e, item)}
                      className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border transition-all ${msgCount > 0 ? 'bg-purple-500/20 border-purple-500 text-purple-400' : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'}`}
                    >
                      <span className="material-symbols-outlined">forum</span>
                    </button>
                    
                    <button 
                      onClick={(e) => handleAction(e, item)}
                      className="flex-1 bg-purple-600 hover:bg-purple-500 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest text-white shadow-neon flex items-center justify-center gap-2 active:scale-95 transition-all"
                    >
                      <span className="material-symbols-outlined text-sm">hail</span>
                      PROGRAMAR RECOGIDA
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* MODAL DE CAMBIO DE TÉCNICO */}
      {changeModalService && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-surface-dark w-full max-sm rounded-[32px] border border-white/10 p-6 space-y-4 shadow-2xl animate-in zoom-in duration-300">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center text-purple-400">
                <span className="material-symbols-outlined">transfer_within_a_station</span>
              </div>
              <div>
                <h3 className="text-sm font-black uppercase text-white">Cambiar Técnico</h3>
                <p className="text-[10px] text-slate-500 font-bold">Solicitar autorización al Administrador</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Nuevo Técnico</label>
                <select 
                  className="w-full bg-background-dark border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                  value={selectedNewTech}
                  onChange={(e) => setSelectedNewTech(e.target.value)}
                >
                  <option value="">-- Seleccionar --</option>
                  {tecnicos
                    .filter(t => t.nombre !== changeModalService.satelite_info?.nombre_tecnico_externo)
                    .map(t => (
                      <option key={t.id} value={t.id}>{t.nombre}</option>
                    ))
                  }
                </select>
              </div>
              
              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Motivo del Cambio</label>
                <input 
                  type="text" 
                  className="w-full bg-background-dark border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                  placeholder="Ej. No tiene repuestos, demora mucho..."
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button 
                onClick={() => setChangeModalService(null)}
                disabled={submittingChange}
                className="flex-1 py-3 bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400"
              >
                Cancelar
              </button>
              <button 
                onClick={submitTechnicianChange}
                disabled={submittingChange || !selectedNewTech || !changeReason.trim()}
                className="flex-[2] py-3 bg-purple-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-neon active:scale-95 disabled:opacity-50"
              >
                {submittingChange ? 'Enviando...' : 'Solicitar Cambio'}
              </button>
            </div>
          </div>
        </div>
      )}

      {chatService && (
        <ServiceChatModal 
          servicio={chatService} 
          onClose={() => setChatService(null)} 
          onMessageSent={() => fetchInventory()} 
        />
      )}
    </div>
  );
};
