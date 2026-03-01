
import React, { useState, useEffect } from 'react';
import { supabaseService } from '../services/supabaseService';
import { TipoServicio, EstadoServicio, User, UserRole, Proveedor, TecnicoSatelite, Servicio } from '../types';

interface Props {
  onBack: () => void;
  prefillData?: Partial<Servicio> | null;
}

export const CreateServiceScreen: React.FC<Props> = ({ onBack, prefillData }) => {
  const [loading, setLoading] = useState(false);
  const [tipo, setTipo] = useState<TipoServicio>(prefillData?.tipo || TipoServicio.RECOGER);
  
  const [domiciliarios, setDomiciliarios] = useState<User[]>([]);
  const [selectedDomiId, setSelectedDomiId] = useState<string>('');
  
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [tecnicos, setTecnicos] = useState<TecnicoSatelite[]>([]);

  const [clientName, setClientName] = useState(prefillData?.cliente?.nombre || '');
  const [phone, setPhone] = useState(prefillData?.cliente?.telefono || ''); 
  const [address, setAddress] = useState(prefillData?.cliente?.direccion || '');
  const [locationLink, setLocationLink] = useState(prefillData?.cliente?.google_maps_link || '');
  const [deviceModel, setDeviceModel] = useState(prefillData?.dispositivo?.modelo || '');
  const [notes, setNotes] = useState(prefillData?.dispositivo?.falla || ''); 
  const [valueToCollect, setValueToCollect] = useState('0');
  
  const [sateliteAction, setSateliteAction] = useState<'Recoger' | 'Llevar'>(prefillData?.satelite_info?.accion || 'Llevar');
  const [sateliteCosto, setSateliteCosto] = useState(prefillData?.satelite_info?.costo_reparacion?.toString() || '0');
  const [noOrden, setNoOrden] = useState(prefillData?.satelite_info?.no_orden || '');

  const [garantiaAction, setGarantiaAction] = useState<'Recoger' | 'Entregar'>('Recoger');
  const [cantidad, setCantidad] = useState('1');
  const [compraPhoto, setCompraPhoto] = useState<string | null>(null);
  const [cotizarPhoto, setCotizarPhoto] = useState<string | null>(null);

  const [showMagicPaste, setShowMagicPaste] = useState(false);
  const [rawPasteText, setRawPasteText] = useState('');

  useEffect(() => {
    const loadData = async () => {
      await supabaseService.forceRefreshUsers();
      const users = supabaseService.getUsersByRole(UserRole.DOMICILIARIO);
      setDomiciliarios(users);
      
      if (users.length > 0 && !selectedDomiId) {
        setSelectedDomiId(users[0].id);
      }

      try {
        const p = await supabaseService.getProveedores();
        const t = await supabaseService.getTecnicosSatelite();
        setProveedores(p);
        setTecnicos(t);
      } catch (e) { console.error(e); }
    };
    
    loadData();
  }, []); 

  const handleSelectContact = (contact: Proveedor | TecnicoSatelite) => {
    setClientName(contact.nombre);
    setPhone(contact.telefono);
    setAddress(contact.direccion);
  };

  const handleMagicParse = () => {
    if (!rawPasteText.trim()) return;

    const lines = rawPasteText.split('\n');
    let extractedName = '';
    let extractedPhone = '';
    let extractedAddress = '';
    let extractedLocation = '';
    let extractedDevice = '';
    let extractedNotes = [];

    const firstLine = lines[0].toUpperCase();
    if (firstLine.includes('RECOGER')) setTipo(TipoServicio.RECOGER);
    else if (firstLine.includes('ENTREGAR')) setTipo(TipoServicio.ENTREGAR);
    else if (firstLine.includes('SATELITE')) setTipo(TipoServicio.SATELITE);
    else if (firstLine.includes('GARANTIA')) setTipo(TipoServicio.GARANTIA);
    else if (firstLine.includes('COMPRAR')) setTipo(TipoServicio.COMPRAR);
    else if (firstLine.includes('COTIZAR')) setTipo(TipoServicio.COTIZAR);
    else if (firstLine.includes('CONSIGNAR')) setTipo(TipoServicio.CONSIGNAR);
    else if (firstLine.includes('DILIGENCIA')) setTipo(TipoServicio.DILIGENCIA);

    lines.forEach(line => {
      const lowerLine = line.toLowerCase();
      if (lowerLine.includes('nombre:')) extractedName = line.split(/nombre:/i)[1].trim();
      else if (lowerLine.includes('dirección:') || lowerLine.includes('direccion:')) extractedAddress = line.split(/direcci[oó]n:/i)[1].trim();
      else if (lowerLine.includes('teléfono:') || lowerLine.includes('telefono:') || lowerLine.includes('tel:')) extractedPhone = line.split(/tel[eé]fono:|tel:/i)[1].trim();
      else if (lowerLine.includes('dispositivo:') || lowerLine.includes('equipo:') || lowerLine.includes('artículo:') || lowerLine.includes('detalle:')) extractedDevice = line.split(/dispositivo:|equipo:|art[ií]culo:|detalle:/i)[1].trim();
      else if (lowerLine.includes('ubicación:') || lowerLine.includes('ubicacion:') || lowerLine.includes('maps.google') || lowerLine.includes('https://maps')) {
        const linkMatch = line.match(/https?:\/\/[^\s]+/);
        if (linkMatch) extractedLocation = linkMatch[0];
      }
      else if (lowerLine.includes('serial:')) extractedNotes.push(`Serial: ${line.split(/serial:/i)[1].trim()}`);
      else if (lowerLine.includes('accesorios:')) extractedNotes.push(`Accesorios: ${line.split(/accesorios:/i)[1].trim()}`);
      else if (lowerLine.includes('falla:')) extractedNotes.push(`Falla: ${line.split(/falla:/i)[1].trim()}`);
      else if (lowerLine.includes('email:')) extractedNotes.push(`Email: ${line.split(/email:/i)[1].trim()}`);
    });

    if (extractedName) setClientName(extractedName);
    if (extractedPhone) setPhone(extractedPhone);
    if (extractedAddress) setAddress(extractedAddress);
    if (extractedLocation) setLocationLink(extractedLocation);
    if (extractedDevice) setDeviceModel(extractedDevice);
    if (extractedNotes.length > 0) setNotes(extractedNotes.join(' | '));

    setRawPasteText('');
    setShowMagicPaste(false);
  };

  const handlePhotoUpload = async (type: 'compra' | 'cotizar', e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const url = await supabaseService.uploadPhoto(e.target.files[0]);
        if (type === 'compra') setCompraPhoto(url);
        else setCotizarPhoto(url);
      } catch (err: any) {
        alert(`Error al subir la fotografía: ${err.message}`);
      }
    }
  };

  const handleCreate = async () => {
    if (loading) return;

    if (!selectedDomiId) {
      const confirmNoDomi = window.confirm('⚠️ No has seleccionado ningún domiciliario.\n¿Deseas crear el servicio como "Sin Asignar"?');
      if (!confirmNoDomi) return;
    }

    if (tipo === TipoServicio.COTIZAR) {
      if (!deviceModel.trim()) { alert('⚠️ Faltan datos para Cotizar: Ingresa el Equipo.'); return; }
    } else if (tipo === TipoServicio.COMPRAR) {
      if (!deviceModel.trim()) { alert('⚠️ Faltan datos: Ingresa el nombre del Artículo.'); return; }
    } else if (tipo === TipoServicio.SATELITE) {
      if (!clientName.trim() || !deviceModel.trim()) { alert('⚠️ Faltan datos: Ingresa Técnico y Equipo.'); return; }
    } else if (tipo === TipoServicio.CONSIGNAR) {
      if (!clientName.trim() || !deviceModel.trim() || !valueToCollect || valueToCollect === '0') {
        alert('⚠️ Faltan datos: Banco, Número de Cuenta y Valor son obligatorios.'); return;
      }
    } else {
      // General checks for generic types + DILIGENCIA
      if (!clientName.trim() || !address.trim() || !deviceModel.trim()) {
        const detailLabel = tipo === TipoServicio.DILIGENCIA ? 'Detalle' : 'Equipo';
        alert(`⚠️ Faltan datos: Nombre, Dirección y ${detailLabel} son obligatorios.`); return;
      }
    }

    setLoading(true);

    try {
      let finalEvidencia: string[] = [];
      if (tipo === TipoServicio.COMPRAR && compraPhoto) finalEvidencia = [compraPhoto];
      if (tipo === TipoServicio.COTIZAR && cotizarPhoto) finalEvidencia = [cotizarPhoto];

      const safeValueToCollect = parseFloat(valueToCollect) || 0;
      const safeQuantity = parseInt(cantidad) || 1;
      const safeSateliteCosto = parseFloat(sateliteCosto) || 0;

      const newServiceData: any = {
        tipo: tipo,
        domiciliario_id: selectedDomiId || null, 
        cliente: {
          nombre: clientName.trim() || (tipo === TipoServicio.COTIZAR ? 'Cotización General' : 'Cliente General'),
          direccion: address.trim() || (tipo === TipoServicio.COTIZAR ? 'En Sitio' : tipo === TipoServicio.CONSIGNAR ? 'Transacción Bancaria' : 'Dirección Pendiente'),
          google_maps_link: locationLink.trim() || '',
          telefono: phone.trim() || (tipo === TipoServicio.CONSIGNAR ? '0000000000' : ''),
          coordenadas_gps: { lat: 4.6097, lng: -74.0817 }
        },
        dispositivo: {
          modelo: deviceModel.trim() || 'Genérico',
          marca: '',
          serial: '',
          accesorios: [],
          falla: notes.trim() || '',
          cantidad: tipo === TipoServicio.COMPRAR ? safeQuantity : 1
        },
        financiero: {
          valor_a_cobrar: safeValueToCollect,
          valor_cobrado: 0,
          metodo_pago: 'Pendiente'
        },
        evidencia: finalEvidencia,
        control_calidad: false,
        // IMPORTANTE: Si venimos de un "Programar Recogida" (satélite), heredamos los logs
        logs: prefillData?.logs || []
      };

      if (tipo === TipoServicio.SATELITE) {
        newServiceData.satelite_info = {
          nombre_tecnico_externo: clientName.trim() || 'Externo',
          costo_reparacion: safeSateliteCosto,
          accion: sateliteAction,
          no_orden: noOrden
        };
      }

      if (tipo === TipoServicio.GARANTIA) {
        newServiceData.garantia_info = { accion: garantiaAction };
      }

      await supabaseService.addServicio(newServiceData);
      onBack();

    } catch (error: any) {
      console.error("Error creating service:", error);
      alert(`❌ ERROR DE BASE DE DATOS:\n${error.message || JSON.stringify(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const isSatelite = tipo === TipoServicio.SATELITE;
  const isComprar = tipo === TipoServicio.COMPRAR;
  const isGarantia = tipo === TipoServicio.GARANTIA;
  const isRecoger = tipo === TipoServicio.RECOGER;
  const isCotizar = tipo === TipoServicio.COTIZAR;
  const isConsignar = tipo === TipoServicio.CONSIGNAR;
  const isDiligencia = tipo === TipoServicio.DILIGENCIA;

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col bg-background-dark animate-in slide-in-from-right duration-300">
      <header className="sticky top-0 z-30 flex items-center justify-between bg-surface-dark p-4 border-b border-white/5">
        <button onClick={onBack} disabled={loading} className="p-2 hover:bg-white/5 rounded-full disabled:opacity-30">
          <span className="material-symbols-outlined">close</span>
        </button>
        <h1 className="text-lg font-bold">Crear Servicio</h1>
        <button 
          onClick={() => setShowMagicPaste(true)}
          disabled={loading}
          className="p-2 bg-primary/20 text-primary rounded-full hover:bg-primary hover:text-white transition-all shadow-neon disabled:opacity-30"
          title="Pegado Inteligente"
        >
          <span className="material-symbols-outlined">auto_fix_high</span>
        </button>
      </header>

      <main className="p-4 space-y-6 flex-1 overflow-y-auto pb-32">
        {prefillData && (
          <div className="bg-purple-500/10 border border-purple-500/30 p-4 rounded-2xl flex items-center gap-3 animate-in zoom-in">
            <span className="material-symbols-outlined text-purple-400">auto_fix_high</span>
            <p className="text-[10px] font-black uppercase text-purple-300 tracking-widest">Datos pre-llenados desde Inventario Satélite</p>
          </div>
        )}

        <section className="bg-primary/5 border border-primary/20 p-4 rounded-2xl animate-in fade-in duration-500">
          <label className="text-xs font-black text-primary uppercase mb-4 block tracking-widest flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">person_pin_circle</span>
            Asignar Domiciliario
          </label>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {domiciliarios.length > 0 ? (
              domiciliarios.map(domi => (
                <button
                  key={domi.id}
                  type="button"
                  disabled={loading}
                  onClick={() => setSelectedDomiId(domi.id)}
                  className={`flex flex-col items-center gap-2 shrink-0 transition-all ${
                    selectedDomiId === domi.id ? 'scale-110' : 'opacity-40 grayscale'
                  }`}
                >
                  <div className={`w-14 h-14 rounded-2xl overflow-hidden border-2 p-0.5 ${
                    selectedDomiId === domi.id ? 'border-primary shadow-neon' : 'border-transparent'
                  }`}>
                    <img src={domi.avatar} alt={domi.nombre} className="w-full h-full object-cover rounded-xl" />
                  </div>
                  <span className={`text-[9px] font-black uppercase truncate w-16 text-center ${
                    selectedDomiId === domi.id ? 'text-primary' : 'text-slate-500'
                  }`}>
                    {domi.nombre.split(' ')[0]}
                  </span>
                </button>
              ))
            ) : (
              <div className="w-full text-center py-2 border border-dashed border-secondary/30 rounded-xl bg-secondary/5">
                 <p className="text-[10px] font-bold text-secondary uppercase animate-pulse">⚠️ No hay domiciliarios cargados</p>
                 <p className="text-[9px] text-slate-500 mt-1">Verifica tu conexión o crea uno</p>
              </div>
            )}
          </div>
        </section>

        <section>
          <label className="text-xs font-black text-slate-500 uppercase mb-3 block tracking-widest text-center">Tipo de Gestión</label>
          <div className="grid grid-cols-3 gap-2">
            {Object.values(TipoServicio).map((t) => (
              <button
                key={t}
                type="button"
                disabled={loading}
                onClick={() => { setTipo(t); setClientName(''); setPhone(''); setAddress(''); setLocationLink(''); setNotes(''); setValueToCollect('0'); }}
                className={`py-3 rounded-xl text-[9px] font-black border transition-all ${
                  tipo === t 
                  ? t === TipoServicio.DILIGENCIA ? 'bg-lime-600 border-lime-600 shadow-neon text-white' : 'bg-primary border-primary shadow-neon text-white' 
                  : 'bg-surface-dark border-white/5 text-slate-500'
                }`}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>
        </section>

        {isComprar ? (
          <section className="space-y-4 animate-in fade-in zoom-in duration-300">
            <h3 className="font-bold flex items-center gap-2 text-primary">
              <span className="material-symbols-outlined">shopping_cart</span>
              Detalles de la Compra
            </h3>
            
            <InputField label="Artículo (Obligatorio)" placeholder="Ej. Pantalla PS5" value={deviceModel} onChange={setDeviceModel} disabled={loading} />

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Seleccionar Proveedor</label>
              <select 
                className="w-full bg-surface-dark border border-white/5 rounded-xl py-3 px-4 text-white text-sm focus:border-primary outline-none"
                onChange={(e) => {
                  const p = proveedores.find(x => x.id === e.target.value);
                  if (p) handleSelectContact(p);
                }}
                disabled={loading}
              >
                <option value="">-- Seleccionar Proveedor --</option>
                {proveedores.map(p => <option key={p.id} value={p.id}>{String(p.nombre)}</option>)}
              </select>
            </div>

            <InputField label="Proveedor / Local" placeholder="Ej. Local 201 Centro" value={clientName} onChange={setClientName} disabled={loading} />
            <InputField label="Dirección del Proveedor" placeholder="Ej. Carrera 10 #12-34" value={address} onChange={setAddress} disabled={loading} />
            <InputField label="Notas / Instrucciones" placeholder="..." value={notes} onChange={setNotes} disabled={loading} />

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider">Foto Referencia</label>
              <label className={`h-24 w-full rounded-xl border-2 border-dashed flex items-center justify-center gap-2 overflow-hidden ${compraPhoto ? 'border-primary bg-primary/5' : 'border-white/5 bg-surface-dark cursor-pointer'}`}>
                {compraPhoto ? <img src={compraPhoto} className="w-full h-full object-cover" /> : <span className="material-symbols-outlined">camera_alt</span>}
                {!loading && <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handlePhotoUpload('compra', e)} />}
              </label>
            </div>
          </section>
        ) : isCotizar ? (
          <section className="space-y-4 animate-in fade-in zoom-in duration-300">
            <h3 className="font-bold flex items-center gap-2 text-primary">
              <span className="material-symbols-outlined">request_quote</span>
              Detalles de Cotización
            </h3>
            
            <InputField label="Equipo (Obligatorio)" placeholder="Ej. PS5 Slim" value={deviceModel} onChange={setDeviceModel} disabled={loading} />
            <InputField label="Lugar (Opcional)" placeholder="Ej. Local 101 Centro" value={clientName} onChange={setClientName} disabled={loading} />
            <InputField label="Notas / Detalles" placeholder="Especifique lo que requiere cotizar" value={notes} onChange={setNotes} disabled={loading} />

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider">Foto Referencia</label>
              <label className={`h-24 w-full rounded-xl border-2 border-dashed flex items-center justify-center gap-2 overflow-hidden ${cotizarPhoto ? 'border-primary bg-primary/5' : 'border-white/5 bg-surface-dark cursor-pointer'}`}>
                {cotizarPhoto ? <img src={cotizarPhoto} className="w-full h-full object-cover" /> : <span className="material-symbols-outlined">camera_alt</span>}
                {!loading && <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handlePhotoUpload('cotizar', e)} />}
              </label>
            </div>
          </section>
        ) : isConsignar ? (
          <section className="space-y-4 animate-in fade-in zoom-in duration-300">
            <h3 className="font-bold flex items-center gap-2 text-primary">
              <span className="material-symbols-outlined">account_balance</span>
              Detalles de Consignación
            </h3>
            <InputField label="Banco / Entidad" placeholder="Ej. Bancolombia" value={clientName} onChange={setClientName} disabled={loading} />
            <InputField label="Número de Cuenta / Referencia" placeholder="Ej. 031-12345-67" value={deviceModel} onChange={setDeviceModel} disabled={loading} />
            <InputField label="Valor a Consignar" placeholder="0.00" value={valueToCollect} onChange={setValueToCollect} type="number" disabled={loading} />
          </section>
        ) : isSatelite ? (
          /* VISTA EXCLUSIVA SATÉLITE */
          <section className="animate-in fade-in duration-300 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <button type="button" onClick={() => setSateliteAction('Recoger')} className={`py-4 rounded-2xl flex items-center justify-center gap-2 border-2 transition-all ${sateliteAction === 'Recoger' ? 'bg-purple-500/20 border-purple-500 text-purple-400' : 'bg-surface-dark border-white/5 text-slate-500'}`}><span className="material-symbols-outlined">download</span>RECOGER</button>
              <button type="button" onClick={() => setSateliteAction('Llevar')} className={`py-4 rounded-2xl flex items-center justify-center gap-2 border-2 transition-all ${sateliteAction === 'Llevar' ? 'border-purple-500 bg-purple-500/20 text-purple-400' : 'bg-surface-dark border-white/5 text-slate-500'}`}><span className="material-symbols-outlined">upload</span>LLEVAR</button>
            </div>

            <div className="bg-purple-500/5 p-4 rounded-2xl border border-purple-500/10 space-y-4">
              {/* 1. SELECCIONAR TÉCNICO */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Seleccionar Técnico</label>
                <select 
                  className="w-full bg-surface-dark border border-purple-500/20 rounded-xl py-3 px-4 text-white text-sm focus:border-purple-500 outline-none"
                  onChange={(e) => {
                    const t = tecnicos.find(x => x.id === e.target.value);
                    if (t) handleSelectContact(t);
                  }}
                  disabled={loading}
                >
                  <option value="">-- Seleccionar Técnico --</option>
                  {tecnicos.map(t => <option key={t.id} value={t.id}>{String(t.nombre)}</option>)}
                </select>
              </div>

              {/* 2. EQUIPO */}
              <InputField label="Equipo" placeholder="Ej. PS5 Slim" value={deviceModel} onChange={setDeviceModel} disabled={loading} />

              {/* 3. NO. DE ORDEN */}
              <InputField label="No. Orden (Satélite)" placeholder="S-123" value={noOrden} onChange={setNoOrden} disabled={loading} />

              {/* 4. FALLA REPORTADA / NOTAS */}
              <InputField label="Falla Reportada / Notas" placeholder="..." value={notes} onChange={setNotes} disabled={loading} />

              {/* 5. COSTO DE REPARACIÓN (SOLO SI ES RECOGER) */}
              {sateliteAction === 'Recoger' && (
                <div className="animate-in fade-in slide-in-from-top duration-300">
                   <InputField label="Costo de Reparación" placeholder="0.00" value={sateliteCosto} onChange={setSateliteCosto} type="number" disabled={loading} />
                </div>
              )}
            </div>
            
            {/* 6. DATOS DEL TÉCNICO (RELACIONADOS) */}
            <div className="bg-surface-dark border border-white/5 p-4 rounded-2xl space-y-4">
               <h3 className="font-bold flex items-center gap-2 text-purple-400">
                  <span className="material-symbols-outlined">perm_contact_calendar</span>
                  Datos del Técnico
               </h3>
               <InputField label="Nombre del Técnico" placeholder="Nombre" value={clientName} onChange={setClientName} disabled={loading} />
               <InputField label="Teléfono" placeholder="Teléfono" value={phone} onChange={setPhone} type="tel" disabled={loading} />
               <InputField label="Dirección" placeholder="Dirección" value={address} onChange={setAddress} disabled={loading} />
               <InputField label="Link Ubicación (Google Maps)" placeholder="Maps Link" value={locationLink} onChange={setLocationLink} disabled={loading} />
            </div>
          </section>
        ) : (
          /* VISTA GENÉRICA PARA OTROS TIPOS + DILIGENCIA */
          <>
            <section className="space-y-4">
              <h3 className={`font-bold flex items-center gap-2 ${isDiligencia ? 'text-lime-500' : 'text-primary'}`}>
                <span className="material-symbols-outlined">{isGarantia ? 'verified' : isDiligencia ? 'fact_check' : 'person'}</span>
                Información del Cliente
              </h3>
              <div className="space-y-4">
                <InputField 
                  label={isDiligencia ? "Detalle de la Diligencia" : "Equipo"} 
                  placeholder={isDiligencia ? "Ej. Pagar recibo luz" : "Ej. PS5 Slim"} 
                  value={deviceModel} 
                  onChange={setDeviceModel} 
                  disabled={loading} 
                />
                <InputField label="Nombre del Cliente" placeholder="Juan Pérez" value={clientName} onChange={setClientName} disabled={loading} />
                <InputField label="Dirección" placeholder="Calle 123" value={address} onChange={setAddress} disabled={loading} />
                <InputField label="Link Ubicación (Google Maps)" placeholder="https://maps.app.goo.gl/..." value={locationLink} onChange={setLocationLink} disabled={loading} />
                <InputField label="Teléfono" placeholder="300 123 4567" value={phone} onChange={setPhone} type="tel" disabled={loading} />
                <InputField label="Notas" placeholder="..." value={notes} onChange={setNotes} disabled={loading} />
              </div>
            </section>

            {!isGarantia && !isRecoger && !isDiligencia && (
              <section className="space-y-4">
                <h3 className="font-bold flex items-center gap-2 text-primary">
                  <span className="material-symbols-outlined">payments</span>
                  Financiero
                </h3>
                <InputField label="Valor a Cobrar" placeholder="0.00" value={valueToCollect} onChange={setValueToCollect} type="number" disabled={loading} />
              </section>
            )}
          </>
        )}
      </main>

      {/* Magic Paste Modal */}
      {showMagicPaste && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-surface-dark w-full max-sm rounded-[32px] border border-white/10 p-6 space-y-4 shadow-2xl animate-in zoom-in duration-300">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary">
                <span className="material-symbols-outlined">auto_fix_high</span>
              </div>
              <div>
                <h3 className="text-sm font-black uppercase text-white">Pegado Inteligente</h3>
                <p className="text-[10px] text-slate-500 font-bold">Pega los datos del cliente aquí</p>
              </div>
            </div>
            
            <textarea 
              autoFocus
              className="w-full h-48 bg-background-dark border border-white/5 rounded-2xl p-4 text-xs text-white focus:border-primary outline-none resize-none placeholder:text-slate-700 font-mono"
              placeholder="Ej:&#10;RECOGER&#10;Dispositivo: 1 Control PS5&#10;Nombre: Germán Javier...&#10;Dirección: Carrera 31...&#10;Teléfono: 3507...&#10;Ubicación: https://maps..."
              value={rawPasteText}
              onChange={(e) => setRawPasteText(e.target.value)}
            />

            <div className="flex gap-2">
              <button 
                onClick={() => { setShowMagicPaste(false); setRawPasteText(''); }}
                className="flex-1 py-3 bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400"
              >
                Cancelar
              </button>
              <button 
                onClick={handleMagicParse}
                className="flex-[2] py-3 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-neon active:scale-95"
              >
                Procesar y Llenar
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 bg-background-dark/95 backdrop-blur-md border-t border-white/5 z-40">
        <button 
          onClick={handleCreate} 
          disabled={loading} 
          className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all ${loading ? 'bg-slate-700' : 'bg-primary shadow-neon-strong active:scale-95'}`}
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              <span>Guardando...</span>
            </>
          ) : (
            <>
              <span>Confirmar y Asignar</span>
              <span className="material-symbols-outlined text-sm">send</span>
            </>
          )}
        </button>
      </footer>
    </div>
  );
};

const InputField: React.FC<{ label: string; placeholder: string; value: string; onChange: (v: string) => void; type?: string; disabled?: boolean }> = ({ label, placeholder, value, onChange, type = "text", disabled = false }) => (
  <div className="group">
    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 block tracking-wider group-focus-within:text-primary transition-colors">{label}</label>
    <input 
      type={type} 
      disabled={disabled} 
      placeholder={placeholder} 
      value={value} 
      onChange={(e) => onChange(e.target.value)} 
      className="w-full bg-surface-dark border border-white/5 rounded-xl py-3 px-4 focus:border-primary outline-none text-white text-sm transition-all placeholder:text-slate-700" 
    />
  </div>
);
