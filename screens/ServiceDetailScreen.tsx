
import React, { useState, useEffect, useRef } from 'react';
import { supabaseService } from '../services/supabaseService';
import { Servicio, EstadoServicio, TipoServicio, UserRole, User, TecnicoSatelite } from '../types';
import { ServiceChatModal } from './RouteScreen';

interface Props {
  servicio: Servicio;
  onBack: () => void;
}

export const ServiceDetailScreen: React.FC<Props> = ({ servicio, onBack }) => {
  const user = supabaseService.getCurrentUser();
  const isAdmin = user?.role === UserRole.ADMIN;

  const [photos, setPhotos] = useState<{ serial?: string; state?: string; purchase?: string; evidence?: string }>({});
  const [valorCobrado, setValorCobrado] = useState(String(servicio.financiero?.valor_a_cobrar || 0));
  const [sateliteCosto, setSateliteCosto] = useState(String(servicio.satelite_info?.costo_reparacion || 0));
  const [saving, setSaving] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Modales
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showFinishConfirmation, setShowFinishConfirmation] = useState(false);
  const [showFailedRepairModal, setShowFailedRepairModal] = useState(false);

  // Estados para cambio de técnico (Fallo)
  const [tecnicos, setTecnicos] = useState<TecnicoSatelite[]>([]);
  const [selectedNewTech, setSelectedNewTech] = useState('');
  const [failureReason, setFailureReason] = useState('');

  const [domis, setDomis] = useState<User[]>([]);
  
  // State principal y form
  const [editForm, setEditForm] = useState<Servicio>(JSON.parse(JSON.stringify(servicio)));
  const [currentServicio, setCurrentServicio] = useState<Servicio>(servicio);
  
  // Estado para resaltar cambios (Feedback visual)
  const [highlightField, setHighlightField] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      const allDomis = supabaseService.getUsersByRole(UserRole.DOMICILIARIO);
      setDomis(allDomis);
    }
  }, [isAdmin]);

  // Función para recargar datos frescos (usada post-chat/aprobación)
  const fetchServiceDetails = async () => {
    try {
      const all = await supabaseService.getAllServicios();
      const fresh = all.find(s => s.id === currentServicio.id);
      if (fresh) {
        // Detectar cambio de técnico para highlight
        if (fresh.satelite_info?.nombre_tecnico_externo !== currentServicio.satelite_info?.nombre_tecnico_externo) {
          setHighlightField(true);
          setTimeout(() => setHighlightField(false), 2000);
        }
        setCurrentServicio(fresh);
        setEditForm(JSON.parse(JSON.stringify(fresh)));
        // Actualizar estados locales derivados
        setValorCobrado(String(fresh.financiero?.valor_a_cobrar || 0));
        setSateliteCosto(String(fresh.satelite_info?.costo_reparacion || 0));
      }
    } catch (e) {
      console.error("Error refreshing details", e);
    }
  };

  const loadTecnicos = async () => {
    try {
      const t = await supabaseService.getTecnicosSatelite();
      setTecnicos(t);
    } catch (e) {
      console.error("Error loading technicians", e);
    }
  };

  const isComprar = currentServicio.tipo === TipoServicio.COMPRAR;
  const isSatelite = currentServicio.tipo === TipoServicio.SATELITE;
  const isGarantia = currentServicio.tipo === TipoServicio.GARANTIA;
  const isCotizar = currentServicio.tipo === TipoServicio.COTIZAR;
  const isRecoger = currentServicio.tipo === TipoServicio.RECOGER;
  const isConsignar = currentServicio.tipo === TipoServicio.CONSIGNAR;
  const isDiligencia = currentServicio.tipo === TipoServicio.DILIGENCIA;
  const isFinished = currentServicio.estado === EstadoServicio.COMPLETADO;
  const isPendingConfirm = currentServicio.estado === EstadoServicio.POR_CONFIRMAR;
  const hasPendingChange = !!currentServicio.satelite_info?.pending_change;

  const handlePhotoUpload = async (type: 'serial' | 'state' | 'purchase' | 'evidence', e: React.ChangeEvent<HTMLInputElement>) => {
    if (isFinished || isPendingConfirm) return;
    if (e.target.files && e.target.files[0]) {
      try {
        const url = await supabaseService.uploadPhoto(e.target.files[0]);
        setPhotos(prev => ({ ...prev, [type]: url }));
      } catch (error) {
        alert("Error al subir imagen. Intente nuevamente.");
      }
    }
  };

  const handleMainAction = () => {
    if (isFinished || isPendingConfirm || hasPendingChange) return;
    setShowFinishConfirmation(true);
  };

  const handleComplete = async () => {
    setIsConfirming(true);

    try {
      const existingPhotos = currentServicio.evidencia?.filter(Boolean) || [];
      const newPhotos = Object.values(photos).filter(Boolean) as string[];

      const updateData: Partial<Servicio> = {
        financiero: {
          ...currentServicio.financiero,
          valor_cobrado: parseFloat(valorCobrado) || 0
        },
        evidencia: [...existingPhotos, ...newPhotos],
        control_calidad: true
      };

      if (isSatelite && currentServicio.satelite_info) {
        updateData.satelite_info = {
          ...currentServicio.satelite_info,
          costo_reparacion: parseFloat(sateliteCosto) || 0
        };
      }

      // Determinar estado: Si es admin finaliza, si es domi pasa a POR_CONFIRMAR
      const nuevoEstado = isAdmin ? EstadoServicio.COMPLETADO : EstadoServicio.POR_CONFIRMAR;
      
      await supabaseService.updateEstadoServicio(currentServicio.id, nuevoEstado, updateData);

      // Agregar log de sistema para notificar en el chat
      if (!isAdmin) {
         await supabaseService.addServiceLog(currentServicio.id, "✅ Solicitud de cierre enviada. Esperando autorización de caja.");
      }

      setShowFinishConfirmation(false);
      onBack();
    } catch (error: any) {
      console.error("Error finalizando servicio:", error);
      
      // Detectar error específico de Constraint de base de datos
      if (error.message && error.message.includes('servicios_estado_check')) {
        alert(
          "⚠️ ERROR DE CONFIGURACIÓN DE BASE DE DATOS\n\n" +
          "La base de datos no permite el estado 'Por_Confirmar'.\n\n" +
          "SOLUCIÓN: Debes ejecutar este SQL en Supabase:\n\n" +
          "ALTER TABLE servicios DROP CONSTRAINT servicios_estado_check;\n" +
          "ALTER TABLE servicios ADD CONSTRAINT servicios_estado_check CHECK (estado IN ('Pendiente', 'En_Camino', 'Por_Confirmar', 'Completado', 'Failed'));"
        );
      } else {
        alert(`Error al guardar: ${error.message || 'Intente nuevamente'}`);
      }
    } finally {
      setIsConfirming(false);
    }
  };

  const handleAdminSave = async () => {
    setSaving(true);
    try {
      await supabaseService.updateServicio(currentServicio.id, editForm);
      await fetchServiceDetails();
      setIsEditing(false);
    } catch (error) {
      alert("Error al guardar cambios");
    } finally {
      setSaving(false);
    }
  };

  const executeAdminDelete = async () => {
    setSaving(true);
    try {
      await supabaseService.deleteServicio(currentServicio.id);
      onBack();
    } catch (err) {
      console.error("Error eliminando servicio:", err);
      alert("No se pudo eliminar el servicio");
    } finally {
       setSaving(false);
    }
  };

  const handleSubmitFailedRepair = async () => {
    if (!selectedNewTech || !failureReason.trim()) {
      alert("Por favor selecciona un nuevo técnico y explica la razón.");
      return;
    }
    const techObj = tecnicos.find(t => t.id === selectedNewTech);
    if (!techObj) return;

    setSaving(true);
    try {
      await supabaseService.requestTechnicianChange(currentServicio.id, {
        new_technician_id: techObj.id,
        new_technician_name: techObj.nombre,
        reason: failureReason,
        timestamp: new Date().toISOString()
      }, true); // isFailureReport = true
      
      alert("Solicitud enviada al Administrador. El servicio quedará en espera.");
      setShowFailedRepairModal(false);
      await fetchServiceDetails();
    } catch (e) {
      alert("Error enviando reporte.");
    } finally {
      setSaving(false);
    }
  };

  // --- ACTION HANDLERS ---
  const handleCall = () => {
    const phone = currentServicio.cliente.telefono;
    if (phone) window.open(`tel:${phone}`, '_system');
    else alert("No hay teléfono registrado");
  };

  const handleWhatsApp = () => {
    const phone = currentServicio.cliente.telefono;
    if (phone) window.open(supabaseService.getWhatsAppLink(phone), '_blank');
    else alert("No hay teléfono registrado");
  };

  const handleMap = () => {
    const link = currentServicio.cliente.google_maps_link;
    const address = currentServicio.cliente.direccion;
    const settings = supabaseService.getSettings();

    if (link && link.length > 5) {
      window.open(link, '_blank');
    } else if (address) {
      const query = encodeURIComponent(`${address}, ${settings.ciudad}, ${settings.pais}`);
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
    } else {
      alert("No hay ubicación registrada");
    }
  };

  const lastLog = currentServicio.logs && currentServicio.logs.length > 0 
    ? currentServicio.logs[currentServicio.logs.length - 1] 
    : null;
  const isFromAdmin = lastLog?.autor === 'Administrador';

  // Helper para verificar si hay datos técnicos para mostrar el encabezado
  const hasTechnicalInfo = editForm.dispositivo?.modelo || editForm.dispositivo?.marca || editForm.dispositivo?.serial || (editForm.dispositivo?.accesorios && editForm.dispositivo.accesorios.length > 0) || isEditing;

  // Lógica para determinar qué nombre mostrar en el campo principal
  const primaryNameValue = isSatelite 
    ? (editForm.satelite_info?.nombre_tecnico_externo || editForm.cliente?.nombre || '') 
    : (editForm.cliente?.nombre || '');

  return (
    <div className={`max-w-md mx-auto min-h-screen flex flex-col pb-28 ${isFinished ? 'bg-background-dark/80' : ''}`}>
      <header className="sticky top-0 z-30 flex items-center justify-between bg-surface-dark p-4 border-b border-white/5">
        <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-full">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="flex flex-col items-center">
          <h1 className="text-lg font-bold">Detalle {String(currentServicio.tipo)}</h1>
          <span className={`text-[10px] uppercase font-bold tracking-widest ${isFinished ? 'text-success' : isPendingConfirm || hasPendingChange ? 'text-cyan-400 animate-pulse' : 'text-primary'}`}>
            {isPendingConfirm ? 'POR CONFIRMAR' : hasPendingChange ? 'SOLICITUD PENDIENTE' : String(currentServicio.estado).replace('_', ' ')}
          </span>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <>
              <button 
                onClick={() => setShowDeleteModal(true)}
                className="p-2 rounded-full hover:bg-secondary/10 text-secondary transition-colors"
              >
                <span className="material-symbols-outlined">delete</span>
              </button>
              <button 
                onClick={() => setIsEditing(!isEditing)}
                className={`p-2 rounded-full transition-colors ${isEditing ? 'bg-warning/20 text-warning' : 'hover:bg-white/5 text-slate-400'}`}
              >
                <span className="material-symbols-outlined">{isEditing ? 'close' : 'edit'}</span>
              </button>
            </>
          )}
          <button 
            onClick={() => setShowChat(true)}
            className={`p-2 rounded-full transition-colors relative ${currentServicio.logs?.length ? 'bg-primary/20 text-primary' : 'hover:bg-white/5 text-slate-400'}`}
          >
            <span className="material-symbols-outlined">forum</span>
            {isFromAdmin && !isAdmin && (
              <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-secondary rounded-full border-2 border-surface-dark animate-ping" />
            )}
          </button>
        </div>
      </header>

      <main className="p-4 space-y-6">
        {/* Status Messages */}
        {isFinished && (
           <div className="bg-success/10 border border-success/30 p-4 rounded-2xl flex items-center gap-3 animate-in fade-in zoom-in">
              <span className="material-symbols-outlined text-success">task_alt</span>
              <p className="text-[10px] font-black uppercase text-success tracking-widest">Este servicio ha sido finalizado y verificado.</p>
           </div>
        )}

        {isPendingConfirm && !isAdmin && (
           <div className="bg-cyan-500/10 border border-cyan-500/30 p-4 rounded-2xl flex items-center gap-3 animate-in fade-in">
              <span className="material-symbols-outlined text-cyan-400 animate-spin">sync</span>
              <p className="text-[10px] font-black uppercase text-cyan-400 tracking-widest leading-tight">Gestión enviada. Esperando que el administrador confirme el cierre.</p>
           </div>
        )}
        
        {hasPendingChange && (
           <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl flex items-center gap-3 animate-in fade-in">
              <span className="material-symbols-outlined text-amber-500 animate-pulse">hourglass_top</span>
              <p className="text-[10px] font-black uppercase text-amber-500 tracking-widest leading-tight">Solicitud de cambio de técnico enviada. Servicio pausado hasta autorización.</p>
           </div>
        )}

        {lastLog && (
          <div 
            onClick={() => setShowChat(true)}
            className={`p-4 rounded-xl border flex items-center gap-3 transition-all cursor-pointer active:scale-[0.98] ${
              isFromAdmin 
                ? 'bg-primary/5 border-primary/30 shadow-neon' 
                : 'bg-surface-dark border-white/5 opacity-80'
            }`}
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isFromAdmin ? 'bg-primary text-white' : 'bg-white/5 text-slate-500'}`}>
              <span className="material-symbols-outlined text-sm">{isFromAdmin ? 'support_agent' : 'person'}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center mb-0.5">
                <span className={`text-[10px] font-black uppercase tracking-widest ${isFromAdmin ? 'text-primary' : 'text-slate-500'}`}>
                  {isFromAdmin ? 'Mensaje del Admin' : 'Última nota'}
                </span>
                <span className="text-[9px] text-slate-500 font-bold">
                  {new Date(lastLog.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className={`text-sm italic truncate ${isFromAdmin ? 'text-white font-medium' : 'text-slate-400'}`}>
                "{String(lastLog.mensaje)}"
              </p>
            </div>
            <span className="material-symbols-outlined text-slate-700">chevron_right</span>
          </div>
        )}

        <div className="bg-surface-dark rounded-3xl border border-white/5 overflow-hidden shadow-lg space-y-1">
          {/* HEADER DEL CARD + ACTION BUTTONS */}
          <div className="bg-white/5 border-b border-white/5">
             <div className="p-4 flex items-center justify-between">
                <h2 className="font-bold flex items-center gap-2 text-sm sm:text-base">
                  <span className={`material-symbols-outlined ${isDiligencia ? 'text-lime-500' : 'text-primary'}`}>
                    {isComprar ? 'shopping_bag' : isSatelite ? 'hub' : isGarantia ? 'verified' : isCotizar ? 'request_quote' : isConsignar ? 'account_balance' : isDiligencia ? 'fact_check' : 'person'}
                  </span>
                  Detalles del Servicio
                </h2>
             </div>
             
             {/* MOVED ACTION BUTTONS HERE - COMPACT */}
             {!isEditing && (
                <div className="flex justify-evenly pb-4 px-4 animate-in slide-in-from-top duration-300">
                   <CompactActionButton icon="call" label="Llamar" onClick={handleCall} color="bg-emerald-500" />
                   <CompactActionButton icon="chat" label="WhatsApp" onClick={handleWhatsApp} color="bg-[#25D366]" />
                   <CompactActionButton icon="near_me" label="Mapa" onClick={handleMap} color="bg-primary" />
                </div>
             )}
          </div>
          
          <div className="p-5 space-y-6">
            {/* SECCIÓN CLIENTE */}
            <div className="space-y-4">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                 <span className="material-symbols-outlined text-sm">person_pin</span> Cliente / Lugar
              </h3>
              <div className="grid grid-cols-1 gap-4">
                <EditItem 
                  label={isCotizar ? "Lugar / Cliente" : isComprar ? "Proveedor / Local" : isSatelite ? "Técnico Externo" : isConsignar ? "Banco / Punto" : "Nombre"} 
                  value={primaryNameValue} 
                  isEditing={isEditing}
                  disabled={isFinished || isPendingConfirm}
                  highlight={isSatelite && highlightField}
                  onChange={(v) => {
                    // Si es satélite, editamos tanto satelite_info como cliente para consistencia
                    const updated = { ...editForm, cliente: { ...editForm.cliente, nombre: v } };
                    if (isSatelite && updated.satelite_info) {
                      updated.satelite_info.nombre_tecnico_externo = v;
                    }
                    setEditForm(updated);
                  }}
                />
                
                <EditItem 
                  label="Dirección" 
                  value={String(editForm.cliente?.direccion || '')} 
                  isEditing={isEditing}
                  disabled={isFinished || isPendingConfirm}
                  onChange={(v) => setEditForm({ ...editForm, cliente: { ...editForm.cliente, direccion: v } })}
                />
              </div>
            </div>

            {/* SECCIÓN DISPOSITIVO / DETALLES */}
            {hasTechnicalInfo && (
               <div className="space-y-4">
                 <div className="h-px bg-white/5" />
                 <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                   <span className="material-symbols-outlined text-sm">devices</span> {isDiligencia ? 'Detalles de la Diligencia' : 'Información Técnica'}
                 </h3>
                 
                 <div className="grid grid-cols-2 gap-4">
                    <EditItem 
                      label={isComprar ? "Artículo" : isConsignar ? "Referencia" : isDiligencia ? "Detalle / Asunto" : "Equipo / Modelo"} 
                      value={String(editForm.dispositivo?.modelo || '')} 
                      isEditing={isEditing}
                      disabled={isFinished || isPendingConfirm}
                      onChange={(v) => setEditForm({ ...editForm, dispositivo: { ...editForm.dispositivo, modelo: v } })}
                    />
                    
                    {!isDiligencia && (
                      <EditItem 
                        label="Marca" 
                        value={String(editForm.dispositivo?.marca || '')} 
                        isEditing={isEditing}
                        disabled={isFinished || isPendingConfirm}
                        onChange={(v) => setEditForm({ ...editForm, dispositivo: { ...editForm.dispositivo, marca: v } })}
                      />
                    )}

                    {!isDiligencia && (
                      <EditItem 
                        label="Serial / IMEI" 
                        value={String(editForm.dispositivo?.serial || '')} 
                        isEditing={isEditing}
                        disabled={isFinished || isPendingConfirm}
                        onChange={(v) => setEditForm({ ...editForm, dispositivo: { ...editForm.dispositivo, serial: v } })}
                      />
                    )}

                    {!isDiligencia && (
                      <EditItem 
                        label="Cantidad" 
                        value={String(editForm.dispositivo?.cantidad || '1')} 
                        isEditing={isEditing}
                        disabled={isFinished || isPendingConfirm}
                        type="number"
                        onChange={(v) => setEditForm({ ...editForm, dispositivo: { ...editForm.dispositivo, cantidad: parseInt(v) || 1 } })}
                      />
                    )}
                 </div>

                 {!isDiligencia && (
                  <EditItem 
                      label="Accesorios" 
                      value={Array.isArray(editForm.dispositivo?.accesorios) ? editForm.dispositivo.accesorios.join(', ') : String(editForm.dispositivo?.accesorios || '')} 
                      isEditing={isEditing}
                      disabled={isFinished || isPendingConfirm}
                      onChange={(v) => setEditForm({ ...editForm, dispositivo: { ...editForm.dispositivo, accesorios: v.split(',').map(s => s.trim()) } })}
                   />
                 )}
               </div>
            )}
            
             {/* NOTAS / FALLA (Always show if present, moved outside conditional hasTechnicalInfo block slightly for layout) */}
             {(currentServicio.dispositivo?.falla || isEditing) && (
                 <>
                   {isEditing ? (
                     <div className="space-y-1 pt-2">
                         <label className="text-[10px] text-slate-500 uppercase font-black">Reporte de Falla / Instrucciones</label>
                         <textarea 
                           value={String(editForm.dispositivo?.falla || '')}
                           disabled={isFinished || isPendingConfirm}
                           onChange={(e) => setEditForm({ ...editForm, dispositivo: { ...editForm.dispositivo, falla: e.target.value } })}
                           className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-primary outline-none"
                           rows={3}
                         />
                     </div>
                   ) : (
                     <div className="bg-white/5 p-4 rounded-xl border border-white/5 mt-2">
                       <div className="flex items-center gap-2 mb-2">
                         <span className="material-symbols-outlined text-secondary text-sm animate-warning-glow">warning</span>
                         <p className="text-[10px] text-slate-500 uppercase font-black">Reporte de Falla / Instrucciones</p>
                       </div>
                       <p className="text-sm text-white font-medium italic leading-relaxed">"{String(currentServicio.dispositivo.falla)}"</p>
                     </div>
                   )}
                 </>
             )}
          </div>
        </div>

        {!isEditing && !isSatelite && !isCotizar && !isGarantia && !isRecoger && !isDiligencia && (
          <section className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">
                Monto Final a Recaudar
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary font-bold text-xl">$</span>
                <input 
                  type="number"
                  disabled={isFinished || isPendingConfirm}
                  value={valorCobrado}
                  onChange={(e) => setValorCobrado(e.target.value)}
                  className="w-full bg-surface-dark border-2 border-white/5 rounded-xl py-4 pl-10 text-xl font-bold focus:border-primary outline-none transition-all shadow-inner"
                />
              </div>
            </div>
          </section>
        )}

        {!isEditing && !isCotizar && (
          <section className="space-y-4">
            <h3 className="font-bold flex items-center gap-2 text-primary">
              <span className="material-symbols-outlined">photo_camera</span>
              Evidencia Adjunta
            </h3>
            
            <div className="grid grid-cols-2 gap-3">
              <PhotoUploader 
                label="Foto Principal" 
                captured={!!photos.evidence || !!photos.purchase || (currentServicio.evidencia && currentServicio.evidencia.length > 0)} 
                onUpload={(e) => handlePhotoUpload('evidence', e)}
                preview={photos.evidence || (currentServicio.evidencia ? currentServicio.evidencia[currentServicio.evidencia.length-1] : undefined)}
                disabled={isFinished || isPendingConfirm}
              />
              <PhotoUploader 
                label="Estado Físico" 
                captured={!!photos.state || (currentServicio.evidencia && currentServicio.evidencia.length > 1)} 
                onUpload={(e) => handlePhotoUpload('state', e)}
                preview={photos.state || (currentServicio.evidencia ? currentServicio.evidencia[0] : undefined)}
                disabled={isFinished || isPendingConfirm}
              />
            </div>
          </section>
        )}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 bg-background-dark/80 backdrop-blur-md border-t border-white/5 z-20 space-y-3">
        {isEditing ? (
          <button 
            disabled={saving}
            onClick={handleAdminSave}
            className="w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 bg-warning shadow-neon-strong active:scale-[0.98] transition-all disabled:opacity-50 text-black"
          >
            {saving ? 'GUARDANDO...' : 'GUARDAR CAMBIOS'}
          </button>
        ) : (
          <>
            {/* Failed Repair Button (New) */}
            {!isFinished && !isPendingConfirm && !hasPendingChange && (isRecoger || isSatelite) && (
              <button 
                onClick={() => {
                  loadTecnicos();
                  setShowFailedRepairModal(true);
                }}
                className="w-full py-3 bg-white/5 border border-white/10 rounded-xl font-black text-xs uppercase tracking-widest text-slate-400 hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">build_circle</span>
                Reparación Fallida / Cambiar Técnico
              </button>
            )}

            <button 
              disabled={saving || isFinished || isPendingConfirm || hasPendingChange}
              onClick={handleMainAction}
              className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-neon-strong active:scale-[0.98] transition-all disabled:opacity-30 ${isFinished ? 'bg-slate-700' : isPendingConfirm || hasPendingChange ? 'bg-cyan-600/50' : isSatelite ? 'bg-purple-600' : 'bg-primary'}`}
            >
              {saving ? (
                <>
                   <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                   GUARDANDO...
                </>
              ) : isFinished ? 'SERVICIO FINALIZADO' : isPendingConfirm ? 'ESPERANDO CONFIRMACIÓN' : hasPendingChange ? 'CAMBIO SOLICITADO' : 'CONFIRMAR Y FINALIZAR'}
              {!saving && !isFinished && !isPendingConfirm && !hasPendingChange && <span className="material-symbols-outlined">send</span>}
            </button>
          </>
        )}
      </footer>

      {/* MODAL REPARACIÓN FALLIDA */}
      {showFailedRepairModal && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-surface-dark border border-white/10 rounded-[28px] p-6 w-full max-w-sm space-y-4 shadow-2xl animate-in zoom-in duration-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-amber-500/20 rounded-2xl flex items-center justify-center text-amber-500 border border-amber-500/30">
                <span className="material-symbols-outlined text-2xl">hardware</span>
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-tight">Reportar Fallo</h3>
                <p className="text-[10px] text-slate-400 font-bold">Solicitar cambio de técnico</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                 <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Nuevo Técnico</label>
                 <select 
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                    value={selectedNewTech}
                    onChange={(e) => setSelectedNewTech(e.target.value)}
                 >
                    <option value="">-- Seleccionar --</option>
                    {tecnicos
                       .filter(t => t.nombre !== currentServicio.satelite_info?.nombre_tecnico_externo)
                       .map(t => (
                          <option key={t.id} value={t.id}>{t.nombre}</option>
                       ))
                    }
                 </select>
              </div>
              <div>
                 <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Motivo del Fallo</label>
                 <textarea 
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                    placeholder="Ej. No tiene repuestos, no pudo reparar..."
                    rows={2}
                    value={failureReason}
                    onChange={(e) => setFailureReason(e.target.value)}
                 />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setShowFailedRepairModal(false)} 
                disabled={saving}
                className="flex-1 py-3 bg-white/5 rounded-xl font-black text-[10px] uppercase tracking-widest text-slate-400 border border-white/5 hover:bg-white/10"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSubmitFailedRepair} 
                disabled={saving || !selectedNewTech || !failureReason}
                className="flex-1 py-3 bg-amber-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-neon disabled:opacity-50"
              >
                {saving ? 'Enviando...' : 'Solicitar Cambio'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE FINALIZACIÓN */}
      {showFinishConfirmation && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-surface-dark border border-white/10 rounded-[28px] p-6 w-full max-w-sm space-y-6 shadow-2xl animate-in zoom-in duration-200">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center text-primary border border-primary/30 shadow-neon">
                <span className="material-symbols-outlined text-3xl">check_circle</span>
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">¿Finalizar Servicio?</h3>
                <p className="text-xs text-slate-400 font-bold mt-1">
                  {isAdmin 
                    ? "El servicio se marcará como Completado inmediatamente." 
                    : "Se enviará una notificación al administrador para que autorice el cierre."}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setShowFinishConfirmation(false)} 
                disabled={isConfirming}
                className="flex-1 py-3.5 bg-white/5 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-400 border border-white/5 active:scale-95 transition-all disabled:opacity-50"
              >
                No, Volver
              </button>
              <button 
                onClick={handleComplete} 
                disabled={isConfirming}
                className="flex-1 py-3.5 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-neon active:scale-95 transition-all disabled:opacity-50"
              >
                {isConfirming ? 'Cerrando...' : 'Sí, Finalizar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-surface-dark border border-white/10 rounded-2xl p-6 w-full max-w-xs space-y-4">
            <h3 className="text-lg font-bold text-center">¿Eliminar Servicio?</h3>
            <p className="text-center text-sm text-slate-400">Esta acción no se puede deshacer.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-3 bg-white/10 rounded-xl font-bold">Cancelar</button>
              <button onClick={executeAdminDelete} className="flex-1 py-3 bg-secondary text-white rounded-xl font-bold">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {showChat && (
        <ServiceChatModal 
          servicio={currentServicio} 
          onClose={() => setShowChat(false)} 
          onMessageSent={fetchServiceDetails} 
        />
      )}
    </div>
  );
};

// Componente de Botón de Acción Circular Compacto
const CompactActionButton: React.FC<{ icon: string; label: string; onClick: () => void; color: string }> = ({ icon, label, onClick, color }) => (
  <button 
    onClick={onClick}
    className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
  >
    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg ${color} group-hover:brightness-110 transition-all`}>
      <span className="material-symbols-outlined text-lg">{icon}</span>
    </div>
    <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest group-hover:text-white transition-colors">{label}</span>
  </button>
);

const EditItem: React.FC<{ label: string; value: string; isEditing: boolean; isPhone?: boolean; disabled?: boolean; highlight?: boolean; type?: string; onChange: (v: string) => void }> = ({ label, value, isEditing, isPhone, disabled, highlight, type = "text", onChange }) => {
  // Hide empty fields when not editing
  if (!isEditing && (!value || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0))) {
    return null;
  }

  return (
    <div className={`${disabled ? 'opacity-70' : ''} transition-all duration-500 ${highlight ? 'bg-emerald-500/20 p-2 rounded-lg ring-1 ring-emerald-500' : ''}`}>
      <p className={`text-[10px] font-black tracking-wider mb-1 uppercase ${highlight ? 'text-emerald-400' : 'text-slate-500'}`}>{label}</p>
      {isEditing ? (
        <input 
          type={isPhone ? "tel" : type} 
          value={value} 
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-primary outline-none"
        />
      ) : (
        <p className={`text-sm font-bold break-words border-b pb-2 min-h-[1.5rem] ${highlight ? 'text-white border-emerald-500/50' : 'text-white border-white/5'}`}>{value}</p>
      )}
    </div>
  );
};

const PhotoUploader: React.FC<{ label: string; captured: boolean; onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void; preview?: string; disabled?: boolean }> = ({ label, captured, onUpload, preview, disabled }) => (
  <label className={`relative h-32 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all overflow-hidden ${captured ? 'border-primary bg-primary/5' : 'border-slate-700'} ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-slate-500 cursor-pointer'}`}>
    {preview ? (
      <img src={preview} alt="preview" className="absolute inset-0 w-full h-full object-cover opacity-60" />
    ) : (
      <span className="material-symbols-outlined text-slate-500 text-3xl">add_a_photo</span>
    )}
    <span className="text-[9px] font-black uppercase text-center px-2 z-10 leading-tight">{label}</span>
    {captured && (
      <div className="absolute top-2 right-2 bg-primary text-white rounded-full p-0.5 z-20">
        <span className="material-symbols-outlined text-[14px]">check</span>
      </div>
    )}
    {!disabled && <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onUpload} />}
  </label>
);
