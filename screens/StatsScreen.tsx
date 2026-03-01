
import React, { useState, useEffect, useMemo } from 'react';
import { supabaseService } from '../services/supabaseService';
import { getColombiaDateString, getFirstDayOfColombiaMonth } from '../utils/dateUtils';
import { Servicio, EstadoServicio, TipoServicio, User, UserRole } from '../types';

interface Props {
  onBack: () => void;
  onSelectService: (s: Servicio) => void;
}

export const StatsScreen: React.FC<Props> = ({ onBack, onSelectService }) => {
  const [loading, setLoading] = useState(true);
  const [allServices, setAllServices] = useState<Servicio[]>([]);
  const [domis, setDomis] = useState<User[]>([]);
  const [statusFilter, setStatusFilter] = useState<EstadoServicio | null>(null);
  
  // Rango de fechas por defecto: Mes actual
  const today = getColombiaDateString();
  const firstDayOfMonth = getFirstDayOfColombiaMonth();
  
  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(today);

  useEffect(() => {
    const fetch = async () => {
      const s = await supabaseService.getAllServicios();
      const d = supabaseService.getUsersByRole(UserRole.DOMICILIARIO);
      setAllServices(s);
      setDomis(d);
      setLoading(false);
    };
    fetch();
  }, []);

  const filteredServices = useMemo(() => {
    return allServices.filter(s => {
      const date = getColombiaDateString(new Date(s.fecha_asignacion));
      const matchDate = date >= startDate && date <= endDate;
      const matchStatus = statusFilter ? s.estado === statusFilter : true;
      return matchDate && matchStatus;
    });
  }, [allServices, startDate, endDate, statusFilter]);

  const stats = useMemo(() => {
    const periodServices = allServices.filter(s => {
      const date = getColombiaDateString(new Date(s.fecha_asignacion));
      return date >= startDate && date <= endDate;
    });

    const totalCount = periodServices.length;
    const completedCount = periodServices.filter(s => s.estado === EstadoServicio.COMPLETADO).length;
    
    // Ingreso Bruto (ignorando 'Recoger')
    const grossIncome = periodServices
      .filter(s => s.estado === EstadoServicio.COMPLETADO && s.tipo !== TipoServicio.RECOGER)
      .reduce((sum, s) => sum + (s.financiero.valor_cobrado || 0), 0);

    // Gastos estimados (por ahora solo mock, pero integrado)
    const estimatedExpenses = grossIncome * 0.15; // 15% margen operativo mock

    const distribution = Object.values(TipoServicio).map(type => {
      const count = periodServices.filter(s => s.tipo === type).length;
      return { 
        type, 
        count, 
        percent: totalCount ? (count / totalCount) * 100 : 0 
      };
    });

    const domiRank = domis.map(d => {
      const dServices = periodServices.filter(s => s.domiciliario_id === d.id);
      const dCompleted = dServices.filter(s => s.estado === EstadoServicio.COMPLETADO).length;
      return {
        domi: d,
        total: dServices.length,
        completed: dCompleted,
        percent: dServices.length ? (dCompleted / dServices.length) * 100 : 0
      };
    }).sort((a, b) => b.completed - a.completed);

    return {
      totalCount,
      completedCount,
      grossIncome,
      estimatedExpenses,
      netProfit: grossIncome - estimatedExpenses,
      avgTicket: completedCount ? grossIncome / completedCount : 0,
      distribution,
      domiRank
    };
  }, [allServices, startDate, endDate, domis]);

  if (loading) return (
    <div className="min-h-screen bg-background-dark flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin shadow-neon" />
    </div>
  );

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col pb-32 bg-background-dark animate-in fade-in duration-300">
      <header className="p-4 border-b border-white/10 flex items-center justify-between sticky top-0 bg-background-dark/95 backdrop-blur-md z-30">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-full text-slate-400">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="text-xl font-bold">Análisis de Datos</h1>
        </div>
        {statusFilter && (
          <button 
            onClick={() => setStatusFilter(null)}
            className="text-[9px] font-black bg-secondary text-white px-2 py-1 rounded-full uppercase flex items-center gap-1 animate-pulse"
          >
            Limpia Filtro <span className="material-symbols-outlined text-[10px]">close</span>
          </button>
        )}
      </header>

      <main className="flex-1 p-4 space-y-6 overflow-y-auto">
        {/* Date Filters */}
        <section className="bg-surface-dark border border-white/5 p-4 rounded-3xl space-y-4">
           <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-sm text-primary">calendar_month</span>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Rango de Consulta</p>
           </div>
           <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                 <label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Desde</label>
                 <input 
                   type="date" 
                   value={startDate} 
                   onChange={(e) => setStartDate(e.target.value)}
                   className="w-full bg-background-dark border border-white/5 rounded-xl text-xs font-bold text-white px-3 py-2.5"
                 />
              </div>
              <div className="space-y-1">
                 <label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Hasta</label>
                 <input 
                   type="date" 
                   value={endDate} 
                   onChange={(e) => setEndDate(e.target.value)}
                   className="w-full bg-background-dark border border-white/5 rounded-xl text-xs font-bold text-white px-3 py-2.5"
                 />
              </div>
           </div>
        </section>

        {/* Hero Financial Cards */}
        <section className="grid grid-cols-2 gap-3">
           <StatCard 
             label="Ingreso Bruto" 
             value={`$${stats.grossIncome.toLocaleString()}`} 
             color="text-primary" 
             icon="payments" 
           />
           <StatCard 
             label="Utilidad Neta" 
             value={`$${stats.netProfit.toLocaleString()}`} 
             color="text-success" 
             icon="trending_up" 
           />
           <StatCard 
             label="Ticket Prom" 
             value={`$${stats.avgTicket.toFixed(0)}`} 
             color="text-amber-400" 
             icon="avg_time" 
           />
           <button 
             onClick={() => setStatusFilter(statusFilter === EstadoServicio.COMPLETADO ? null : EstadoServicio.COMPLETADO)}
             className="text-left group"
           >
              <StatCard 
                label="Completados" 
                value={`${stats.completedCount}/${stats.totalCount}`} 
                color={statusFilter === EstadoServicio.COMPLETADO ? "text-primary" : "text-white"} 
                icon="check_circle" 
                active={statusFilter === EstadoServicio.COMPLETADO}
              />
           </button>
        </section>

        {/* Distribution Breakdown */}
        <section className="bg-surface-dark border border-white/5 p-5 rounded-3xl space-y-4">
           <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <span className="material-symbols-outlined text-sm text-primary">pie_chart</span>
              Distribución por Tipo
           </h3>
           <div className="space-y-3">
              {stats.distribution.filter(d => d.count > 0).map(d => (
                <div key={d.type} className="space-y-1.5">
                   <div className="flex justify-between text-[10px] font-bold uppercase">
                      <span className="text-white">{d.type}</span>
                      <span className="text-slate-500">{d.count} servicios • {d.percent.toFixed(1)}%</span>
                   </div>
                   <div className="h-1.5 w-full bg-background-dark rounded-full overflow-hidden p-0.5 border border-white/5">
                      <div className="h-full bg-primary shadow-neon rounded-full transition-all duration-1000" style={{ width: `${d.percent}%` }} />
                   </div>
                </div>
              ))}
           </div>
        </section>

        {/* Detailed Service Log */}
        <section className="space-y-4">
           <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                 <span className="material-symbols-outlined text-sm">list_alt</span>
                 Explorador de Servicios ({filteredServices.length})
              </h3>
              {statusFilter && (
                <span className="text-[8px] font-black bg-primary/10 text-primary px-2 py-0.5 rounded uppercase">Filtrado por: {statusFilter}</span>
              )}
           </div>
           <div className="space-y-2">
              {filteredServices.slice(0, 50).map(s => (
                <div 
                  key={s.id} 
                  onClick={() => onSelectService(s)}
                  className="bg-surface-dark/50 border border-white/5 p-3 rounded-2xl flex items-center justify-between group active:scale-[0.98] transition-all cursor-pointer"
                >
                   <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2 h-2 rounded-full ${s.estado === EstadoServicio.COMPLETADO ? 'bg-success shadow-neon' : 'bg-amber-500 animate-pulse'}`} />
                      <div className="min-w-0">
                         <h4 className="text-xs font-bold text-white truncate">{s.dispositivo.modelo}</h4>
                         <p className="text-[9px] text-slate-500 uppercase font-black truncate">{s.cliente.nombre} • {s.tipo}</p>
                      </div>
                   </div>
                   <div className="text-right">
                      <p className="text-[11px] font-bold text-primary">${(s.financiero.valor_cobrado || 0).toLocaleString()}</p>
                      <p className="text-[8px] text-slate-600 font-bold">{getColombiaDateString(new Date(s.fecha_asignacion))}</p>
                   </div>
                </div>
              ))}
              {filteredServices.length === 0 && (
                <div className="text-center py-10 opacity-20">
                   <span className="material-symbols-outlined text-4xl mb-2">search_off</span>
                   <p className="text-[10px] font-black uppercase">Sin resultados en este rango</p>
                </div>
              )}
              {filteredServices.length > 50 && (
                <p className="text-center text-[9px] text-slate-500 italic py-2">Mostrando los primeros 50 resultados...</p>
              )}
           </div>
        </section>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-surface-dark/95 backdrop-blur-lg border-t border-white/5 h-20 flex justify-around items-center px-4 z-40">
        <button onClick={onBack} className="flex flex-col items-center gap-1 text-slate-500">
           <span className="material-symbols-outlined">dashboard</span>
           <span className="text-[8px] font-black uppercase">Panel</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-primary">
           <span className="material-symbols-outlined">bar_chart</span>
           <span className="text-[8px] font-black uppercase">Stats</span>
        </button>
        <div className="w-16" />
        <button onClick={onBack} className="flex flex-col items-center gap-1 text-slate-500">
           <span className="material-symbols-outlined">person</span>
           <span className="text-[8px] font-black uppercase">Perfil</span>
        </button>
      </nav>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string; color: string; icon: string; active?: boolean }> = ({ label, value, color, icon, active }) => (
  <div className={`bg-surface-dark border p-4 rounded-3xl shadow-lg transition-all ${active ? 'border-primary shadow-neon ring-1 ring-primary/30' : 'border-white/5'}`}>
    <div className="flex items-center justify-between mb-2">
       <span className={`material-symbols-outlined text-sm ${color}`}>{icon}</span>
       <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
    </div>
    <h3 className={`text-sm font-black truncate ${color}`}>{value}</h3>
  </div>
);
