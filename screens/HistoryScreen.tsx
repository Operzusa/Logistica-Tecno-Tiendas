
import React, { useState, useEffect, useMemo } from 'react';
import { supabaseService } from '../services/supabaseService';
import { getColombiaDateString } from '../utils/dateUtils';
import { Actividad, Servicio, EstadoServicio, TipoServicio } from '../types';

interface Props {
  onBack: () => void;
  onSelectService: (s: Servicio) => void;
}

type TimelineItem = {
  id: string;
  timestamp: string;
  type: 'activity' | 'service';
  data: Actividad | Servicio;
};

type DateGroup = {
  dateKey: string; // YYYY-MM-DD
  displayDate: string; // e.g. "Lunes, 25 Oct"
  items: TimelineItem[];
  stats: {
    totalRevenue: number;
    completedServices: number;
    fuelAlerts: number;
  };
};

const typeColors: Record<string, string> = {
  [TipoServicio.ENTREGAR]: 'text-primary',
  [TipoServicio.RECOGER]: 'text-emerald-500',
  [TipoServicio.SATELITE]: 'text-purple-500',
  [TipoServicio.GARANTIA]: 'text-amber-500',
  [TipoServicio.COTIZAR]: 'text-cyan-500',
  [TipoServicio.COMPRAR]: 'text-pink-500',
  [TipoServicio.CONSIGNAR]: 'text-indigo-500',
  [TipoServicio.DILIGENCIA]: 'text-lime-500',
};

// --- HELPER FUNCTIONS ---

const formatTime = (iso: string) => {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getIconForActivity = (item: Actividad) => {
  if (item.descripcion === 'ALERTA COMBUSTIBLE' || item.tipo === 'Gasolina') return 'local_gas_station';
  if (item.tipo === 'Gasto') return 'payments';
  if (item.descripcion === 'CIERRE DE CAJA') return 'account_balance_wallet';
  return 'settings_suggest';
};

const getIconForService = (type: TipoServicio) => {
  switch (type) {
    case TipoServicio.ENTREGAR: return 'local_shipping';
    case TipoServicio.RECOGER: return 'inventory';
    case TipoServicio.SATELITE: return 'hub';
    case TipoServicio.GARANTIA: return 'verified';
    case TipoServicio.COTIZAR: return 'request_quote';
    case TipoServicio.COMPRAR: return 'shopping_bag';
    case TipoServicio.CONSIGNAR: return 'account_balance';
    case TipoServicio.DILIGENCIA: return 'fact_check';
    default: return 'package_2';
  }
};

// --- SUB-COMPONENT: Daily History Accordion Group ---

const DailyHistoryGroup: React.FC<{ group: DateGroup; onSelectService: (s: Servicio) => void }> = ({ group, onSelectService }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="animate-in fade-in slide-in-from-bottom duration-500">
      {/* DAILY SUMMARY CARD - Clickable Header */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="sticky top-[116px] z-20 mb-4 bg-slate-900/95 backdrop-blur border border-white/10 p-4 rounded-2xl shadow-lg flex items-center justify-between ring-1 ring-white/5 cursor-pointer hover:bg-white/5 transition-all active:scale-[0.99]"
      >
        <div>
          <h3 className="text-sm font-black text-white capitalize">{group.displayDate}</h3>
          <div className="flex flex-col gap-0.5 mt-0.5">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              {group.stats.completedServices} Servicios Completados
            </p>
            {group.stats.fuelAlerts > 0 && (
              <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1 animate-pulse">
                <span className="material-symbols-outlined text-[11px]">local_gas_station</span>
                {group.stats.fuelAlerts} Alertas Combustible
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right mr-1">
            <span className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Ingresos</span>
            <span className="text-sm font-black text-emerald-400 shadow-neon">${group.stats.totalRevenue.toLocaleString()}</span>
          </div>
          <div className={`w-8 h-8 rounded-full bg-white/5 flex items-center justify-center transition-transform duration-300 ${isExpanded ? 'rotate-180 bg-white/10' : ''}`}>
             <span className="material-symbols-outlined text-slate-400">expand_more</span>
          </div>
        </div>
      </div>

      {/* Timeline Items for this Day - Collapsible */}
      {isExpanded && (
        <div className="relative pl-4 space-y-0 animate-in slide-in-from-top duration-300 origin-top">
          {/* Vertical Line for the Day */}
          <div className="absolute left-[21px] top-0 bottom-4 w-0.5 bg-white/5" />

          {group.items.map((item) => {
            if (item.type === 'activity') {
              const act = item.data as Actividad;
              return (
                <div key={item.id} className="relative pl-10 pb-6 group">
                  {/* Dot */}
                  <div className={`absolute left-[13px] top-1 w-2.5 h-2.5 rounded-full z-10 border-2 border-background-dark ${
                    act.descripcion === 'ALERTA COMBUSTIBLE' ? 'bg-amber-500' :
                    act.tipo === 'Gasto' ? 'bg-secondary' : 'bg-slate-500'
                  }`} />
                  
                  {/* Card */}
                  <div className="bg-surface-dark border border-white/5 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`material-symbols-outlined text-sm ${act.color || 'text-slate-400'}`}>
                          {getIconForActivity(act)}
                        </span>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${act.color || 'text-slate-500'}`}>
                          {act.descripcion}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-bold">{formatTime(item.timestamp)}</span>
                    </div>
                    <p className="text-xs text-white/80 font-medium leading-relaxed">{act.detalle}</p>
                  </div>
                </div>
              );
            } else {
              const srv = item.data as Servicio;
              return (
                <div key={item.id} className="relative pl-10 pb-6 group">
                  {/* Dot */}
                  <div className="absolute left-[13px] top-1 w-2.5 h-2.5 rounded-full z-10 border-2 border-background-dark bg-primary shadow-neon" />
                  
                  {/* Card */}
                  <div 
                    onClick={() => onSelectService(srv)}
                    className="bg-surface-dark border border-white/5 rounded-2xl p-4 shadow-lg group-active:scale-[0.98] transition-all cursor-pointer hover:border-primary/30 relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`material-symbols-outlined text-sm ${typeColors[srv.tipo] || 'text-primary'}`}>
                          {getIconForService(srv.tipo)}
                        </span>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${typeColors[srv.tipo] || 'text-primary'}`}>
                          {srv.tipo}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-bold">{formatTime(item.timestamp)}</span>
                    </div>
                    
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-white">{srv.dispositivo.modelo}</h4>
                      <div className="flex items-center gap-2 text-slate-500">
                        <span className="material-symbols-outlined text-xs">person</span>
                        <p className="text-[11px] font-bold uppercase truncate">{srv.cliente.nombre}</p>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-white/5 flex justify-between items-center">
                      <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-success shadow-neon"></span>
                          <span className="text-[9px] font-black text-success uppercase">Finalizado</span>
                      </div>
                      <p className="text-[11px] font-black text-primary">${(srv.financiero?.valor_cobrado || 0).toLocaleString()}</p>
                    </div>
                    {srv.cierre_tardio && (
                      <div className="mt-2 pt-2 border-t border-red-500/10 flex items-center gap-1 text-red-500/80">
                        <span className="material-symbols-outlined text-[10px]">flag</span>
                        <span className="text-[9px] font-bold uppercase">Cerrado tarde por: {srv.cerrado_por_rol || 'Desconocido'}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            }
          })}
        </div>
      )}
    </div>
  );
};

// --- MAIN COMPONENT ---

export const HistoryScreen: React.FC<Props> = ({ onBack, onSelectService }) => {
  const [loading, setLoading] = useState(true);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [groupingMode, setGroupingMode] = useState<'day' | 'week' | 'month' | 'year'>('day');

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [actividades, servicios] = await Promise.all([
          supabaseService.getHistorial(),
          supabaseService.getAllServicios(),
        ]);

        const items: TimelineItem[] = [
          ...actividades.map(a => ({ id: a.id, timestamp: a.timestamp, type: 'activity' as const, data: a })),
          ...servicios
            .filter(s => s.estado === EstadoServicio.COMPLETADO)
            .map(s => ({ id: s.id, timestamp: s.updated_at || s.fecha_asignacion, type: 'service' as const, data: s }))
        ];

        // Ordenar por tiempo descendente (Global)
        items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setTimeline(items);
      } catch (e) {
        console.error("Error cargando historial unificado:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  // Agrupamiento por Fechas
  const groupedTimeline = useMemo(() => {
    const groups: Record<string, DateGroup> = {};

    timeline.forEach(item => {
      const dateObj = new Date(item.timestamp);
      
      let dateKey = '';
      let displayDate = '';

      if (groupingMode === 'day') {
        dateKey = getColombiaDateString(dateObj); // YYYY-MM-DD
        const formatted = dateObj.toLocaleDateString('es-ES', { 
          timeZone: 'America/Bogota', weekday: 'long', day: 'numeric', month: 'short' 
        });
        displayDate = formatted.charAt(0).toUpperCase() + formatted.slice(1);
      } else if (groupingMode === 'week') {
        const d = new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
        const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
        dateKey = `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
        displayDate = `Semana ${weekNo} - ${d.getUTCFullYear()}`;
      } else if (groupingMode === 'month') {
        const year = dateObj.toLocaleDateString('es-ES', { timeZone: 'America/Bogota', year: 'numeric' });
        const month = dateObj.toLocaleDateString('es-ES', { timeZone: 'America/Bogota', month: '2-digit' });
        dateKey = `${year}-${month}`;
        const formatted = dateObj.toLocaleDateString('es-ES', { timeZone: 'America/Bogota', month: 'long', year: 'numeric' });
        displayDate = formatted.charAt(0).toUpperCase() + formatted.slice(1);
      } else if (groupingMode === 'year') {
        dateKey = dateObj.toLocaleDateString('es-ES', { timeZone: 'America/Bogota', year: 'numeric' });
        displayDate = dateKey;
      }

      if (!groups[dateKey]) {
        groups[dateKey] = {
          dateKey,
          displayDate,
          items: [],
          stats: { totalRevenue: 0, completedServices: 0, fuelAlerts: 0 }
        };
      }

      groups[dateKey].items.push(item);

      // Calcular Estadísticas Diarias
      if (item.type === 'service') {
        const srv = item.data as Servicio;
        groups[dateKey].stats.completedServices += 1;
        // Solo sumar si no es 'RECOGER' (opcional, dependiendo de lógica de negocio, aquí sumamos todo lo cobrado)
        if (srv.financiero?.valor_cobrado) {
          groups[dateKey].stats.totalRevenue += srv.financiero.valor_cobrado;
        }
      } else if (item.type === 'activity') {
        const act = item.data as Actividad;
        // Detectar alertas de gasolina
        if (act.tipo === 'Gasolina' || act.descripcion.toUpperCase().includes('COMBUSTIBLE') || act.descripcion.toUpperCase().includes('GASOLINA')) {
          groups[dateKey].stats.fuelAlerts += 1;
        }
      }
    });

    // Retornar array ordenado por fecha descendente
    return Object.values(groups).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [timeline, groupingMode]);

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col bg-background-dark animate-in slide-in-from-bottom duration-300">
      <header className="p-4 border-b border-white/10 flex flex-col gap-4 sticky top-0 bg-background-dark/95 backdrop-blur-md z-30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-full">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <h1 className="text-xl font-bold">Historial Maestro</h1>
          </div>
          <div className="bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
            <span className="text-[10px] text-primary font-black uppercase tracking-widest">Global</span>
          </div>
        </div>
        
        {/* Grouping Controls */}
        <div className="flex bg-surface-dark rounded-xl p-1 border border-white/5 shadow-inner">
          {(['day', 'week', 'month', 'year'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setGroupingMode(mode)}
              className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${
                groupingMode === mode 
                  ? 'bg-primary text-white shadow-md' 
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {mode === 'day' ? 'Día' : mode === 'week' ? 'Semana' : mode === 'month' ? 'Mes' : 'Año'}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 p-4 relative pb-32">
        {loading ? (
          <div className="h-full flex items-center justify-center pt-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : groupedTimeline.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <span className="material-symbols-outlined text-5xl mb-4 block opacity-20">history</span>
            <p className="font-bold">No hay actividad registrada</p>
          </div>
        ) : (
          <div className="space-y-8">
            {groupedTimeline.map((group) => (
              <DailyHistoryGroup 
                key={group.dateKey} 
                group={group} 
                onSelectService={onSelectService} 
              />
            ))}
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-surface-dark/95 backdrop-blur-lg border-t border-white/5 h-20 flex justify-around items-center px-4 z-40">
        <button onClick={onBack} className="flex flex-col items-center gap-1 text-slate-500">
          <span className="material-symbols-outlined text-[26px]">dashboard</span>
          <span className="text-[9px] font-black uppercase tracking-widest">Panel</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-primary">
          <span className="material-symbols-outlined text-[26px]">history</span>
          <span className="text-[9px] font-black uppercase tracking-widest">Historial</span>
        </button>
        <button onClick={() => {}} className="flex flex-col items-center gap-1 text-slate-500">
          <span className="material-symbols-outlined text-[26px]">map</span>
          <span className="text-[9px] font-black uppercase tracking-widest">Mapa</span>
        </button>
        <button onClick={onBack} className="flex flex-col items-center gap-1 text-slate-500">
          <span className="material-symbols-outlined text-[26px]">person</span>
          <span className="text-[9px] font-black uppercase tracking-widest">Perfil</span>
        </button>
      </nav>
    </div>
  );
};
