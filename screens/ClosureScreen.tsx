
import React, { useState, useEffect } from 'react';
import { supabaseService } from '../services/supabaseService';
import { CierreCaja, UserRole, Servicio, EstadoServicio } from '../types';

interface Props {
  onBack: () => void;
}

export const ClosureScreen: React.FC<Props> = ({ onBack }) => {
  const [reporte, setReporte] = useState<CierreCaja | null>(null);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [newExpense, setNewExpense] = useState({ tipo: 'Gasolina' as any, monto: '', desc: '' });
  const [reportingGas, setReportingGas] = useState(false);
  
  // Admin & Pending Confirmations
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingServices, setPendingServices] = useState<Servicio[]>([]);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // Modales
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [closing, setClosing] = useState(false);

  const fetchData = async () => {
    // Reporte financiero
    const data = await supabaseService.getReporteCierre();
    setReporte(data);

    // Cargar pendientes según Rol
    const user = supabaseService.getCurrentUser();
    const all = await supabaseService.getAllServicios();
    
    if (user && user.role === UserRole.ADMIN) {
      setIsAdmin(true);
      // Admin ve TODOS los pendientes de confirmar
      const pending = all.filter(s => s.estado === EstadoServicio.POR_CONFIRMAR);
      setPendingServices(pending);
    } else if (user) {
      setIsAdmin(false);
      // Domiciliario ve SOLO SUS pendientes de confirmar
      const myPending = all.filter(s => s.estado === EstadoServicio.POR_CONFIRMAR && s.domiciliario_id === user.id);
      setPendingServices(myPending);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleConfirmService = async (serviceId: string) => {
    setConfirmingId(serviceId);
    try {
      await supabaseService.updateEstadoServicio(serviceId, EstadoServicio.COMPLETADO);
      await fetchData(); // Recargar lista y totales
    } catch (e) {
      alert("Error al confirmar el servicio.");
    } finally {
      setConfirmingId(null);
    }
  };

  const handleAddExpense = async () => {
    if (!newExpense.monto || !newExpense.desc) return;
    try {
      await supabaseService.addGasto({
        tipo: newExpense.tipo,
        monto: parseFloat(newExpense.monto),
        descripcion: newExpense.desc,
        fecha: new Date().toISOString()
      });
      setShowExpenseForm(false);
      setNewExpense({ tipo: 'Gasolina', monto: '', desc: '' });
      fetchData();
    } catch (e) {
      alert("Error registrando gasto");
    }
  };

  const handleGasAlert = async () => {
    if (!window.confirm("¿Confirmar reporte de falta de gasolina? Se enviará una alerta urgente al administrador.")) {
      return;
    }

    setReportingGas(true);
    try {
      await supabaseService.reportarFaltaGasolina();
      alert("✅ Alerta enviada exitosamente a la central.");
    } catch (e: any) {
      console.error(e);
      alert(`Error enviando alerta: ${e.message || "Error de conexión"}`);
    } finally {
      setReportingGas(false);
    }
  };

  const confirmClose = async () => {
    if (!reporte) return;
    setClosing(true);
    try {
      await supabaseService.realizarCierreDiario(reporte);
      setShowConfirmModal(false);
      setShowSummaryModal(true);
    } catch (e: any) {
      alert(`Error al realizar el cierre: ${e.message || JSON.stringify(e)}`);
      console.error(e);
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col bg-background-dark animate-in slide-in-from-right duration-300">
      <header className="p-4 flex items-center gap-4 border-b border-white/10 sticky top-0 bg-background-dark/95 backdrop-blur-md z-10">
        <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-full">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-xl font-bold">Cierre de Caja</h1>
      </header>

      <main className="flex-1 p-6 space-y-6 overflow-y-auto pb-32">
        
        {/* SECCIÓN PENDIENTES (Visible para Admin y Domi) */}
        {pendingServices.length > 0 && (
          <section className="space-y-3 animate-in fade-in slide-in-from-top duration-300">
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-cyan-400 animate-pulse">notifications_active</span>
              <h3 className="text-xs font-black text-cyan-400 uppercase tracking-widest">
                {isAdmin ? `Autorizaciones Pendientes (${pendingServices.length})` : `Enviados a Confirmación (${pendingServices.length})`}
              </h3>
            </div>
            
            <div className="space-y-3">
              {pendingServices.map(s => (
                <div key={s.id} className={`bg-surface-dark border p-4 rounded-2xl shadow-[0_0_15px_rgba(34,211,238,0.1)] ${isAdmin ? 'border-cyan-500/30' : 'border-white/10 opacity-90'}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-bold text-white text-sm">{s.dispositivo.modelo}</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{s.cliente.nombre}</p>
                    </div>
                    <div className="text-right">
                       <span className="block text-lg font-black text-primary">${(s.financiero.valor_cobrado || 0).toLocaleString()}</span>
                       <span className="text-[9px] text-slate-500 uppercase font-black">Recaudado</span>
                    </div>
                  </div>
                  
                  {isAdmin ? (
                    <button 
                      onClick={() => handleConfirmService(s.id)}
                      disabled={confirmingId === s.id}
                      className="w-full py-3 bg-cyan-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-neon flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {confirmingId === s.id ? 'Confirmando...' : 'Confirmar Cierre'}
                      {!confirmingId && <span className="material-symbols-outlined text-sm">check_circle</span>}
                    </button>
                  ) : (
                    <div className="w-full py-3 bg-white/5 text-slate-400 rounded-xl font-black text-[10px] uppercase tracking-widest border border-white/5 flex items-center justify-center gap-2">
                       <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                       Esperando Aprobación
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="h-px bg-white/10 my-4" />
          </section>
        )}

        {/* Si no hay pendientes y es domiciliario, mostrar mensaje friendly */}
        {!isAdmin && pendingServices.length === 0 && (
           <div className="bg-white/5 border border-dashed border-white/10 p-4 rounded-2xl text-center">
              <p className="text-[10px] text-slate-500 font-bold uppercase">No tienes servicios pendientes de confirmación.</p>
           </div>
        )}

        <div className="grid grid-cols-2 gap-4">
           <div className="bg-surface-dark border border-white/5 p-4 rounded-2xl shadow-lg">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Ingresos</p>
              <h3 className="text-2xl font-bold text-primary shadow-neon">
                ${reporte?.total_cobrado.toLocaleString() || '0'}
              </h3>
           </div>
           <div className="bg-surface-dark border border-white/5 p-4 rounded-2xl shadow-lg">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Gastos</p>
              <h3 className="text-2xl font-bold text-secondary">
                ${reporte?.total_gastado.toLocaleString() || '0'}
              </h3>
           </div>
        </div>

        <div className="bg-gradient-to-br from-surface-dark to-background-dark border border-white/10 p-6 rounded-3xl flex flex-col items-center justify-center gap-2 shadow-2xl relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-secondary to-primary" />
           <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Balance Total en Caja</p>
           <h2 className="text-4xl font-black text-white tracking-tighter">
             ${reporte?.balance_final.toLocaleString() || '0'}
           </h2>
           <p className="text-[10px] font-bold text-slate-500">{reporte?.num_servicios || 0} Servicios Finalizados</p>
        </div>

        {!isAdmin && (
          <button 
            onClick={handleGasAlert}
            disabled={reportingGas}
            className="w-full bg-amber-500/10 border border-amber-500/30 py-4 rounded-2xl flex items-center justify-center gap-2 text-amber-500 font-black text-[10px] uppercase tracking-widest hover:bg-amber-500/20 active:scale-[0.98] transition-all"
          >
             <span className="material-symbols-outlined text-lg animate-pulse">local_gas_station</span>
             {reportingGas ? 'Enviando Alerta...' : 'Reportar Falta de Gasolina'}
          </button>
        )}

        <section className="space-y-4">
           <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Gastos del Día</h3>
              <button 
                onClick={() => setShowExpenseForm(!showExpenseForm)}
                className="text-primary text-[10px] font-black uppercase tracking-widest flex items-center gap-1 hover:underline"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                Registrar Gasto
              </button>
           </div>
           
           {showExpenseForm && (
             <div className="bg-surface-dark border border-white/10 p-4 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top duration-300">
                <div className="grid grid-cols-2 gap-3">
                   <select 
                     value={newExpense.tipo}
                     onChange={(e) => setNewExpense({...newExpense, tipo: e.target.value as any})}
                     className="bg-background-dark border border-white/5 rounded-xl text-xs text-white px-3 py-2 outline-none focus:border-secondary"
                   >
                      <option value="Gasolina">Gasolina</option>
                      <option value="Mantenimiento">Mantenimiento</option>
                      <option value="Otros">Otros</option>
                   </select>
                   <input 
                     type="number"
                     placeholder="Monto"
                     value={newExpense.monto}
                     onChange={(e) => setNewExpense({...newExpense, monto: e.target.value})}
                     className="bg-background-dark border border-white/5 rounded-xl text-xs text-white px-3 py-2 outline-none focus:border-secondary"
                   />
                </div>
                <input 
                   type="text"
                   placeholder="Descripción (Opcional)"
                   value={newExpense.desc}
                   onChange={(e) => setNewExpense({...newExpense, desc: e.target.value})}
                   className="w-full bg-background-dark border border-white/5 rounded-xl text-xs text-white px-3 py-2 outline-none focus:border-secondary"
                />
                <button 
                   onClick={handleAddExpense}
                   className="w-full bg-secondary text-white py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                >
                   Guardar Gasto
                </button>
             </div>
           )}
        </section>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 bg-background-dark/95 backdrop-blur-md border-t border-white/5 z-20">
        <button 
          onClick={() => setShowConfirmModal(true)}
          className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-300 hover:bg-white/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined">lock</span>
          Cerrar Caja Definitivo
        </button>
      </footer>

      {/* Modal de Confirmación */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="bg-surface-dark w-full max-sm rounded-[32px] border border-white/10 p-6 space-y-6 shadow-2xl animate-in zoom-in duration-300">
              <div className="text-center space-y-3">
                 <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center text-secondary mx-auto mb-2 border border-secondary/20 shadow-[0_0_20px_rgba(255,77,77,0.2)]">
                    <span className="material-symbols-outlined text-3xl">warning</span>
                 </div>
                 <h3 className="text-xl font-bold text-white">¿Está Seguro de Cerrar Caja?</h3>
                 <p className="text-xs text-slate-400 leading-relaxed px-2 font-bold uppercase text-amber-500 animate-pulse">
                    Asegúrese que todos los ingresos y egresos estén correctos.
                 </p>
                 <p className="text-[10px] text-slate-500">Esta acción registrará el cierre en el historial y preparará el sistema para el día siguiente.</p>
              </div>

              <div className="flex gap-3 pt-2">
                 <button 
                   disabled={closing}
                   onClick={() => setShowConfirmModal(false)}
                   className="flex-1 py-4 bg-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 border border-white/5 hover:bg-white/10 transition-all"
                 >
                    NO, CANCELAR
                 </button>
                 <button 
                   disabled={closing}
                   onClick={confirmClose}
                   className="flex-1 py-4 bg-secondary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-neon-strong flex items-center justify-center gap-2 active:scale-95 transition-all"
                 >
                    {closing ? 'CERRANDO...' : 'SÍ, CERRAR'}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Modal de Resumen Final */}
      {showSummaryModal && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-500">
           <div className="w-full max-w-sm bg-surface-dark border border-white/10 rounded-[32px] p-8 relative overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-500">
              <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
              
              <div className="text-center space-y-6 relative z-10">
                 <div className="w-20 h-20 bg-success/20 rounded-full flex items-center justify-center text-success mx-auto shadow-neon mb-2">
                    <span className="material-symbols-outlined text-4xl">check_circle</span>
                 </div>
                 
                 <div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Resumen del Día</h2>
                    <p className="text-xs text-slate-500 font-bold uppercase mt-1">Cierre Exitoso</p>
                 </div>

                 <div className="bg-background-dark/50 rounded-2xl p-4 space-y-3 border border-white/5">
                    <div className="flex justify-between items-center text-sm">
                       <span className="text-slate-400">Ingresos Totales</span>
                       <span className="font-bold text-primary">${reporte?.total_cobrado.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                       <span className="text-slate-400">Gastos Registrados</span>
                       <span className="font-bold text-secondary">-${reporte?.total_gastado.toLocaleString()}</span>
                    </div>
                    <div className="h-px bg-white/10 my-2" />
                    <div className="flex justify-between items-center text-lg font-black">
                       <span className="text-white">Balance Final</span>
                       <span className="text-white shadow-neon">${reporte?.balance_final.toLocaleString()}</span>
                    </div>
                 </div>

                 <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
                    <p className="text-[10px] text-primary font-black uppercase tracking-widest mb-1 flex items-center justify-center gap-1">
                       <span className="material-symbols-outlined text-xs">tips_and_updates</span>
                       Recomendación
                    </p>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                       Recuerda cargar el dispositivo al 100% para la jornada de mañana. La caja se iniciará en $0 automáticamente.
                    </p>
                 </div>

                 <button 
                   onClick={() => { setShowSummaryModal(false); onBack(); }}
                   className="w-full py-4 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 active:scale-95 transition-all shadow-lg"
                 >
                    Entendido, Finalizar
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
