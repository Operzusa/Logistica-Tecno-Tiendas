
import React, { useState, useEffect } from 'react';
import { supabaseService } from '../services/supabaseService';
import { UserRole, AppSettings, User } from '../types';

interface Props {
  onBack: () => void;
  onSuccess: (u: User) => void;
  userToEdit?: User | null; 
}

export const RegistrationScreen: React.FC<Props> = ({ onBack, onSuccess, userToEdit }) => {
  const isEditMode = !!userToEdit;
  const [tab, setTab] = useState<'empresa' | 'usuario'>(isEditMode ? 'usuario' : 'empresa');
  const [loading, setLoading] = useState(false);
  
  // Empresa State
  const [settings, setSettings] = useState<AppSettings>(supabaseService.getSettings());

  // Usuario State
  const [role, setRole] = useState<UserRole>(userToEdit?.role || UserRole.DOMICILIARIO);
  const [name, setName] = useState(userToEdit?.nombre || '');
  const [phone, setPhone] = useState(userToEdit?.telefono || '');
  const [cedula, setCedula] = useState(userToEdit?.cedula || '');
  const [address, setAddress] = useState(userToEdit?.direccion || '');
  const [password, setPassword] = useState(userToEdit?.password || '');
  
  // Vehículo State (solo domis)
  const [placa, setPlaca] = useState(userToEdit?.vehicle?.placa || '');
  const [modelo, setModelo] = useState(userToEdit?.vehicle?.modelo || '');
  const [marca, setMarca] = useState(userToEdit?.vehicle?.marca || '');
  const [color, setColor] = useState(userToEdit?.vehicle?.color || '');

  const handleSaveUser = async () => {
    if (!name || !phone) {
      alert('Por favor completa Nombre y Teléfono');
      return;
    }

    setLoading(true);
    
    // Default password logic based on roles
    const defaultPwd = (role === UserRole.SUPERADMIN || role === UserRole.ADMIN) ? '4321' : '1234';
    
    const userData: Partial<User> = {
      nombre: name,
      role: role,
      telefono: phone,
      cedula: cedula,
      direccion: address,
      password: password || defaultPwd,
      avatar: userToEdit?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name.replace(/\s/g, '')}`,
      vehicle: role === UserRole.DOMICILIARIO ? {
        placa, modelo, marca, color
      } : undefined
    };

    try {
      if (isEditMode && userToEdit) {
        await supabaseService.updateUserProfile(userToEdit.id, userData);
        setLoading(false);
        onSuccess({ ...userToEdit, ...userData } as User);
      } else {
        const newUser = await supabaseService.registerUser(userData as Omit<User, 'id'>);
        setLoading(false);
        onSuccess(newUser);
      }
    } catch (e: any) {
      alert("Error: " + e.message);
      setLoading(false);
    }
  };

  const handleSaveCompany = () => {
    supabaseService.saveSettings(settings);
    setTab('usuario');
    if (!isEditMode) {
      alert('Empresa configurada con éxito. Ahora registra un usuario.');
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col bg-background-dark animate-in slide-in-from-right duration-300">
      <header className="p-4 flex items-center gap-4 border-b border-white/10 sticky top-0 bg-background-dark/95 backdrop-blur-md z-10">
        <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-full">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-xl font-bold">{isEditMode ? 'Editar Usuario' : 'Registro de Sistema'}</h1>
      </header>

      {!isEditMode && (
        <div className="flex p-4 gap-2">
          <TabButton active={tab === 'empresa'} onClick={() => setTab('empresa')} label="1. Empresa" icon="business" />
          <TabButton active={tab === 'usuario'} onClick={() => setTab('usuario')} label="2. Usuarios" icon="person_add" />
        </div>
      )}

      <main className="flex-1 p-6 space-y-6 overflow-y-auto pb-32">
        {tab === 'empresa' ? (
          <section className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-primary/5 p-4 rounded-2xl border border-primary/20 flex gap-4 items-center">
              <span className="material-symbols-outlined text-primary text-3xl">info</span>
              <p className="text-xs text-slate-400 leading-tight">Configura los datos de tu empresa para personalizar la plataforma.</p>
            </div>
            
            <InputGroup 
              label="Nombre de la Compañía" 
              placeholder="Ej. Tecno Tiendas S.A." 
              value={settings.nombre_compania} 
              onChange={(v) => setSettings({...settings, nombre_compania: v})} 
            />
            
            <div className="grid grid-cols-2 gap-4">
              <InputGroup 
                label="País" 
                placeholder="Colombia" 
                value={settings.pais} 
                onChange={(v) => setSettings({...settings, pais: v})} 
              />
              <InputGroup 
                label="Ciudad" 
                placeholder="Bogotá" 
                value={settings.ciudad} 
                onChange={(v) => setSettings({...settings, ciudad: v})} 
              />
            </div>

            <button 
              onClick={handleSaveCompany}
              className="w-full bg-primary py-4 rounded-xl font-black text-xs uppercase tracking-widest shadow-neon-strong active:scale-95 transition-all"
            >
              Guardar Configuración
            </button>
          </section>
        ) : (
          <section className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col items-center mb-4">
               <div className="w-20 h-20 rounded-3xl overflow-hidden border-2 border-primary shadow-neon mb-2">
                 <img src={userToEdit?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name || 'Guest'}`} alt="Avatar" />
               </div>
               <span className="text-[10px] font-black text-slate-500 uppercase">{isEditMode ? 'Avatar Actual' : 'Avatar Generado'}</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <RoleButton 
                active={role === UserRole.SUPERADMIN} 
                onClick={() => setRole(UserRole.SUPERADMIN)} 
                label="SuperAdmin" 
                icon="shield_person" 
              />
              <RoleButton 
                active={role === UserRole.ADMIN} 
                onClick={() => setRole(UserRole.ADMIN)} 
                label="Admin" 
                icon="admin_panel_settings" 
              />
              <RoleButton 
                active={role === UserRole.DOMICILIARIO} 
                onClick={() => setRole(UserRole.DOMICILIARIO)} 
                label="Domiciliario" 
                icon="delivery_dining" 
              />
            </div>

            <InputGroup label="Nombre Completo" placeholder="Ej. Carlos Mendoza" value={name} onChange={setName} />
            <InputGroup label="Contraseña (Predeterminada: 1234/4321)" placeholder="Ej. 1122" value={password} onChange={setPassword} type="password" />
            <InputGroup label="Teléfono / WhatsApp" placeholder="Ej. 300 123 4567" value={phone} onChange={setPhone} type="tel" />
            <InputGroup label="Dirección (Opcional)" placeholder="Av. Siempre Viva 123" value={address} onChange={setAddress} />
            
            {role === UserRole.DOMICILIARIO && (
              <div className="space-y-6 border-t border-white/5 pt-6 animate-in slide-in-from-top duration-300">
                <h3 className="font-bold flex items-center gap-2 text-primary">
                  <span className="material-symbols-outlined">motorcycle</span>
                  Datos del Vehículo
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <InputGroup label="Placa" placeholder="ABC-123" value={placa} onChange={setPlaca} />
                  <InputGroup label="Marca" placeholder="Yamaha / Honda" value={marca} onChange={setMarca} />
                  <InputGroup label="Modelo" placeholder="Fz 25 / 2024" value={modelo} onChange={setModelo} />
                  <InputGroup label="Color" placeholder="Negro / Rojo" value={color} onChange={setColor} />
                </div>
              </div>
            )}

            <button 
              onClick={handleSaveUser}
              disabled={loading}
              className={`w-full py-4 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                loading ? 'bg-slate-700 animate-pulse' : 'bg-primary shadow-neon-strong active:scale-95'
              }`}
            >
              {loading ? 'PROCESANDO...' : (isEditMode ? 'GUARDAR CAMBIOS' : 'REGISTRAR USUARIO')}
              <span className="material-symbols-outlined">{isEditMode ? 'save' : 'person_add'}</span>
            </button>
          </section>
        )}
      </main>
    </div>
  );
};

const TabButton: React.FC<{ active: boolean; onClick: () => void; label: string; icon: string }> = ({ active, onClick, label, icon }) => (
  <button 
    onClick={onClick}
    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${
      active ? 'bg-primary text-white border-primary shadow-neon' : 'bg-surface-dark text-slate-500 border-white/5'
    }`}
  >
    <span className="material-symbols-outlined text-sm">{icon}</span>
    {label}
  </button>
);

const RoleButton: React.FC<{ active: boolean; onClick: () => void; label: string; icon: string }> = ({ active, onClick, label, icon }) => (
  <button 
    onClick={onClick}
    className={`flex-1 flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition-all ${
      active ? 'border-primary bg-primary/10 text-primary shadow-neon' : 'border-white/5 bg-surface-dark text-slate-500'
    }`}
  >
    <span className="material-symbols-outlined text-2xl">{icon}</span>
    <span className="text-[9px] font-black uppercase tracking-widest truncate w-full px-1">{label}</span>
  </button>
);

const InputGroup: React.FC<{ label: string; placeholder: string; value: string; onChange: (v: string) => void; type?: string }> = ({ label, placeholder, value, onChange, type = "text" }) => (
  <div className="group">
    <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block tracking-wider group-focus-within:text-primary">{label}</label>
    <input 
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-surface-dark border border-white/5 rounded-xl py-3 px-4 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none text-sm transition-all text-white placeholder:text-slate-600"
    />
  </div>
);
