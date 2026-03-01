
import React, { useState, useEffect } from 'react';
import { supabaseService } from '../services/supabaseService';
import { Proveedor, TecnicoSatelite } from '../types';

interface Props {
  onBack: () => void;
}

export const DirectoryScreen: React.FC<Props> = ({ onBack }) => {
  const [tab, setTab] = useState<'proveedores' | 'tecnicos'>('proveedores');
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<(Proveedor | TecnicoSatelite)[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');

  const [contactToDelete, setContactToDelete] = useState<Proveedor | TecnicoSatelite | null>(null);

  const fetchList = async () => {
    setLoading(true);
    try {
      if (tab === 'proveedores') {
        const data = await supabaseService.getProveedores();
        setList(data || []);
      } else {
        const data = await supabaseService.getTecnicosSatelite();
        setList(data || []);
      }
    } catch (e) {
      console.error("Error cargando directorio:", e);
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [tab]);

  const handleEditClick = (item: Proveedor | TecnicoSatelite) => {
    setEditingId(item.id);
    setNewName(String(item.nombre || ''));
    setNewPhone(String(item.telefono || ''));
    setNewAddress(String(item.direccion || ''));
    setShowAddForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setNewName('');
    setNewPhone('');
    setNewAddress('');
    setShowAddForm(false);
  };

  const handleSave = async () => {
    if (!newName || !newPhone) {
      alert("Nombre y Teléfono son requeridos");
      return;
    }
    
    setLoading(true);
    try {
      if (editingId) {
        if (tab === 'proveedores') {
          await supabaseService.updateProveedor(editingId, { nombre: newName, telefono: newPhone, direccion: newAddress });
        } else {
          await supabaseService.updateTecnicoSatelite(editingId, { nombre: newName, telefono: newPhone, direccion: newAddress });
        }
        alert(`✅ Contacto actualizado.`);
      } else {
        if (tab === 'proveedores') {
          await supabaseService.addProveedor({ nombre: newName, telefono: newPhone, direccion: newAddress });
        } else {
          await supabaseService.addTecnicoSatelite({ nombre: newName, telefono: newPhone, direccion: newAddress });
        }
        alert(`✅ ${tab === 'proveedores' ? 'Proveedor' : 'Técnico'} guardado.`);
      }
      
      handleCancelEdit();
      await fetchList();
    } catch (e: any) {
      console.error("Error al persistir contacto:", e);
      alert(`❌ ERROR:\n${e.message || "Error desconocido."}`);
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!contactToDelete) return;
    
    setLoading(true);
    try {
      if (tab === 'proveedores') {
        await supabaseService.deleteProveedor(contactToDelete.id);
      } else {
        await supabaseService.deleteTecnicoSatelite(contactToDelete.id);
      }
      setContactToDelete(null);
      await fetchList();
      alert("✅ Contacto eliminado con éxito.");
    } catch (e: any) {
      alert(`Error al eliminar: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col bg-background-dark animate-in slide-in-from-right duration-300">
      <header className="p-4 flex items-center gap-4 border-b border-white/10 sticky top-0 bg-background-dark/95 backdrop-blur-md z-10">
        <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-full transition-colors">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-xl font-bold">Directorio de Contactos</h1>
      </header>

      <div className="p-4 flex gap-2">
        <button 
          onClick={() => { setTab('proveedores'); handleCancelEdit(); }}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${
            tab === 'proveedores' ? 'bg-primary border-primary shadow-neon text-white' : 'bg-surface-dark text-slate-500 border-white/5'
          }`}
        >
          <span className="material-symbols-outlined text-sm">factory</span>
          Proveedores
        </button>
        <button 
          onClick={() => { setTab('tecnicos'); handleCancelEdit(); }}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${
            tab === 'tecnicos' ? 'bg-purple-500 border-purple-500 shadow-neon text-white' : 'bg-surface-dark text-slate-500 border-white/5'
          }`}
        >
          <span className="material-symbols-outlined text-sm">engineering</span>
          Técnicos
        </button>
      </div>

      <main className="flex-1 p-4 space-y-4 overflow-y-auto pb-32">
        <button 
          onClick={() => editingId ? handleCancelEdit() : setShowAddForm(!showAddForm)}
          disabled={loading}
          className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all ${
            showAddForm ? 'bg-white/5 text-slate-400' : 'bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 shadow-sm'
          }`}
        >
          <span className="material-symbols-outlined">{showAddForm ? 'close' : 'person_add'}</span>
          {showAddForm ? 'Cerrar Formulario' : `Añadir Nuevo ${tab === 'proveedores' ? 'Proveedor' : 'Técnico'}`}
        </button>

        {showAddForm && (
          <div className="bg-surface-dark border border-white/10 p-5 rounded-[24px] space-y-4 animate-in slide-in-from-top duration-300 shadow-xl">
            <div className="flex items-center gap-2 mb-2">
              <span className={`material-symbols-outlined text-sm ${editingId ? 'text-amber-500' : 'text-primary'}`}>
                {editingId ? 'edit' : 'add_circle'}
              </span>
              <h3 className="text-xs font-black uppercase tracking-widest text-white">
                {editingId ? 'Editando Contacto' : 'Nuevo Registro'}
              </h3>
            </div>
            
            <InputField label="Nombre" placeholder="Nombre completo" value={newName} onChange={setNewName} disabled={loading} />
            <InputField label="Teléfono" placeholder="WhatsApp / Tel" value={newPhone} onChange={setNewPhone} type="tel" disabled={loading} />
            <InputField label="Dirección" placeholder="Ubicación física" value={newAddress} onChange={setNewAddress} disabled={loading} />
            
            <div className="flex gap-2">
              {editingId && (
                <button 
                  onClick={handleCancelEdit}
                  className="flex-1 bg-white/5 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest text-slate-400 border border-white/5 active:scale-95 transition-all"
                >
                  Cancelar
                </button>
              )}
              <button 
                onClick={handleSave}
                disabled={loading}
                className={`flex-[2] py-4 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-neon active:scale-95 disabled:opacity-50 transition-all ${
                  editingId ? 'bg-amber-600 text-white' : 'bg-primary text-white'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-sm">{editingId ? 'save_as' : 'save'}</span>
                  {loading ? 'Procesando...' : editingId ? 'Actualizar Contacto' : 'Guardar Contacto'}
                </div>
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {loading && !showAddForm && !contactToDelete ? (
            <div className="py-20 flex justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div>
          ) : list.map((item) => (
            <div key={item.id} className="bg-surface-dark border border-white/5 p-4 rounded-2xl flex items-center gap-4 group hover:border-white/10 transition-colors shadow-sm">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${tab === 'proveedores' ? 'bg-primary/10 text-primary' : 'bg-purple-500/10 text-purple-400'}`}>
                <span className="material-symbols-outlined">{tab === 'proveedores' ? 'factory' : 'engineering'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-white truncate">{String(item.nombre || 'Sin nombre')}</h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="material-symbols-outlined text-[10px] text-slate-500">call</span>
                  <p className="text-[10px] text-slate-500 font-bold uppercase truncate">{String(item.telefono || '---')}</p>
                </div>
                {item.direccion && (
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="material-symbols-outlined text-[10px] text-slate-600">location_on</span>
                    <p className="text-[10px] text-slate-600 truncate">{String(item.direccion)}</p>
                  </div>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <button 
                  onClick={() => handleEditClick(item)}
                  className="w-10 h-10 rounded-full hover:bg-amber-500/10 text-amber-500 transition-colors flex items-center justify-center"
                  title="Editar"
                >
                  <span className="material-symbols-outlined text-lg">edit</span>
                </button>
                <button 
                  onClick={() => setContactToDelete(item)}
                  className="w-10 h-10 rounded-full hover:bg-secondary/10 text-secondary transition-colors flex items-center justify-center"
                  title="Eliminar"
                >
                  <span className="material-symbols-outlined text-lg">delete</span>
                </button>
              </div>
            </div>
          ))}
          {!loading && list.length === 0 && !showAddForm && (
            <div className="py-20 text-center opacity-20">
              <span className="material-symbols-outlined text-5xl">person_off</span>
              <p className="text-xs font-black uppercase mt-2">No hay contactos guardados</p>
            </div>
          )}
        </div>
      </main>

      {contactToDelete && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="bg-surface-dark w-full max-sm rounded-[32px] border border-white/10 p-6 space-y-6 shadow-2xl animate-in zoom-in duration-300">
              <div className="text-center space-y-3">
                 <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center text-secondary mx-auto mb-2 border border-secondary/20 shadow-[0_0_20px_rgba(255,77,77,0.2)]">
                    <span className="material-symbols-outlined text-3xl">delete_forever</span>
                 </div>
                 <h3 className="text-xl font-bold text-white">¿Estás seguro?</h3>
                 <p className="text-xs text-slate-400 leading-relaxed px-2">
                    ¿Deseas eliminar permanentemente a <span className="text-white font-bold">{contactToDelete.nombre}</span>?
                 </p>
              </div>

              <div className="flex gap-3 pt-2">
                 <button 
                   onClick={() => setContactToDelete(null)}
                   className="flex-1 py-4 bg-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 border border-white/5 active:scale-95 transition-all"
                 >
                    NO, CANCELAR
                 </button>
                 <button 
                   onClick={confirmDelete}
                   className="flex-1 py-4 bg-secondary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-neon-strong flex items-center justify-center gap-2 active:scale-95 transition-all"
                 >
                    SÍ, ELIMINAR
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const InputField: React.FC<{ label: string; placeholder: string; value: string; onChange: (v: string) => void; type?: string; disabled?: boolean }> = ({ label, placeholder, value, onChange, type = "text", disabled = false }) => (
  <div className="group">
    <label className="text-[9px] font-black text-slate-500 uppercase mb-1.5 block tracking-widest group-focus-within:text-primary transition-colors">{label}</label>
    <input 
      type={type}
      disabled={disabled}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-background-dark border border-white/5 rounded-xl py-3 px-4 focus:border-primary outline-none text-white text-sm disabled:opacity-50 transition-all"
    />
  </div>
);
