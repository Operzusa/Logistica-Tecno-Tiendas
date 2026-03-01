
import React, { useState } from 'react';
import { supabaseService } from '../services/supabaseService';
import { audioService } from '../services/audioService';
import { AppSettings, User, UserRole, AudioConfig, SoundSetting } from '../types';

interface Props {
  onBack: () => void;
}

const COUNTRIES_DATA = [
  { name: 'Colombia', code: '57', cities: ['Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Bucaramanga'] },
  { name: 'México', code: '52', cities: ['Ciudad de México', 'Guadalajara', 'Monterrey', 'Cancún', 'Puebla'] },
  { name: 'España', code: '34', cities: ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Zaragoza'] },
  { name: 'Estados Unidos', code: '1', cities: ['New York', 'Miami', 'Los Angeles', 'Chicago', 'Houston', 'Denver'] },
];

const SOUND_OPTIONS = {
  message: [
    { name: 'Mixkit Pop', url: 'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3' },
    { name: 'Bubble Clip', url: 'https://assets.mixkit.co/active_storage/sfx/2353/2353-preview.mp3' },
    { name: 'Sextant', url: 'https://assets.mixkit.co/active_storage/sfx/2357/2357-preview.mp3' }
  ],
  newService: [
    { name: 'Alert Bell', url: 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3' },
    { name: 'Ding Dong', url: 'https://assets.mixkit.co/active_storage/sfx/2359/2359-preview.mp3' },
    { name: 'Futuristic', url: 'https://assets.mixkit.co/active_storage/sfx/2360/2360-preview.mp3' }
  ],
  update: [
    { name: 'Blip', url: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3' },
    { name: 'Chime', url: 'https://assets.mixkit.co/active_storage/sfx/2567/2567-preview.mp3' },
    { name: 'Soft Pulse', url: 'https://assets.mixkit.co/active_storage/sfx/2569/2569-preview.mp3' }
  ]
};

export const SettingsScreen: React.FC<Props> = ({ onBack }) => {
  const currentSettings = supabaseService.getSettings();
  const currentUser = supabaseService.getCurrentUser();
  const [settings, setSettings] = useState<AppSettings>(currentSettings);
  const [userProfile, setUserProfile] = useState<User | null>(currentUser);
  const [saving, setSaving] = useState(false);

  const handleCountryChange = (countryName: string) => {
    const country = COUNTRIES_DATA.find(c => c.name === countryName);
    if (country) {
      setSettings({
        ...settings,
        pais: country.name,
        codigo_pais: country.code,
        ciudad: country.cities[0]
      });
    }
  };

  const handleAudioSetting = (type: keyof AudioConfig, field: keyof SoundSetting, value: any) => {
    setSettings({
      ...settings,
      audio: {
        ...settings.audio,
        [type]: {
          ...settings.audio[type],
          [field]: value
        }
      }
    });
  };

  const handlePhotoUpload = async (field: 'avatar' | 'foto_vehiculo', e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && userProfile) {
      const url = await supabaseService.uploadPhoto(e.target.files[0]);
      if (field === 'avatar') {
        setUserProfile({ ...userProfile, avatar: url });
      } else {
        setUserProfile({
          ...userProfile,
          vehicle: {
            ...(userProfile.vehicle || { placa: '', modelo: '', marca: '', color: '' }),
            foto_vehiculo: url
          }
        });
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    supabaseService.saveSettings(settings);
    if (userProfile) {
      await supabaseService.updateUserProfile(userProfile.id, userProfile);
    }
    setSaving(false);
    onBack();
  };

  const selectedCountry = COUNTRIES_DATA.find(c => c.name === settings.pais);
  const isDomi = userProfile?.role === UserRole.DOMICILIARIO;

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col bg-background-dark animate-in fade-in duration-300">
      <header className="p-4 flex items-center gap-4 border-b border-white/10 sticky top-0 bg-background-dark/95 backdrop-blur-md z-10">
        <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-full transition-colors">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold leading-none">Configuración</h1>
          <p className="text-[10px] text-primary font-black uppercase tracking-widest mt-1">Preferencias de {userProfile?.nombre}</p>
        </div>
      </header>

      <main className="flex-1 p-6 space-y-10 overflow-y-auto pb-32">
        
        {/* Accesibilidad Visual */}
        <section className="space-y-6 animate-in slide-in-from-top duration-500">
          <div className="flex items-center gap-3 text-primary">
            <span className="material-symbols-outlined">text_increase</span>
            <h2 className="font-bold uppercase tracking-widest text-xs">Tamaño de Interfaz</h2>
          </div>
          
          <div className="bg-surface-dark border border-white/5 p-5 rounded-3xl space-y-5">
            <div className="flex justify-between items-center px-1">
               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Escala de Visualización</p>
               <span className="text-[9px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded uppercase">
                 {settings.fontSize === 'small' ? 'Pequeña' : settings.fontSize === 'medium' ? 'Media' : 'Grande'}
               </span>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FontSizeButton 
                active={settings.fontSize === 'small'} 
                onClick={() => setSettings({...settings, fontSize: 'small'})}
                label="Pequeña"
                iconSize="text-sm"
              />
              <FontSizeButton 
                active={settings.fontSize === 'medium'} 
                onClick={() => setSettings({...settings, fontSize: 'medium'})}
                label="Normal"
                iconSize="text-lg"
              />
              <FontSizeButton 
                active={settings.fontSize === 'large'} 
                onClick={() => setSettings({...settings, fontSize: 'large'})}
                label="Grande"
                iconSize="text-2xl"
              />
            </div>
          </div>
        </section>

        {/* Notificaciones y Sonidos */}
        <section className="space-y-6 animate-in fade-in duration-700">
          <div className="flex items-center gap-3 text-primary">
            <span className="material-symbols-outlined">notifications_active</span>
            <h2 className="font-bold uppercase tracking-widest text-xs">Sonidos y Alertas Personales</h2>
          </div>

          <div className="bg-primary/5 border border-primary/20 p-4 rounded-2xl mb-4">
            <p className="text-[10px] text-slate-400 italic">
              * Estos ajustes son exclusivos de tu cuenta y no afectan a otros usuarios.
            </p>
          </div>

          <div className="space-y-4">
             <AudioSettingItem 
               title="Nuevos Mensajes" 
               options={SOUND_OPTIONS.message} 
               setting={settings.audio.message}
               onChangeUrl={(url) => handleAudioSetting('message', 'url', url)}
               onChangeRepeats={(val) => handleAudioSetting('message', 'repeats', val)}
             />
             <AudioSettingItem 
               title="Servicio Asignado" 
               options={SOUND_OPTIONS.newService} 
               setting={settings.audio.newService}
               onChangeUrl={(url) => handleAudioSetting('newService', 'url', url)}
               onChangeRepeats={(val) => handleAudioSetting('newService', 'repeats', val)}
             />
             <AudioSettingItem 
               title="Actualizaciones" 
               options={SOUND_OPTIONS.update} 
               setting={settings.audio.update}
               onChangeUrl={(url) => handleAudioSetting('update', 'url', url)}
               onChangeRepeats={(val) => handleAudioSetting('update', 'repeats', val)}
             />
          </div>
        </section>

        {/* Perfil del Usuario y Seguridad */}
        <div className="space-y-8 pt-4 border-t border-white/5">
          <section className="space-y-6">
            <div className="flex items-center gap-3 text-primary">
              <span className="material-symbols-outlined">badge</span>
              <h2 className="font-bold uppercase tracking-widest text-xs">Datos de Perfil y Seguridad</h2>
            </div>

            <div className="flex flex-col items-center gap-4 mb-6">
              <div className="relative group">
                <div className="w-24 h-24 rounded-3xl overflow-hidden border-2 border-primary shadow-neon relative bg-surface-dark">
                  <img src={userProfile?.avatar} alt="Avatar" className="w-full h-full object-cover" />
                </div>
                <label className="absolute -bottom-2 -right-2 bg-primary w-10 h-10 rounded-full flex items-center justify-center cursor-pointer shadow-lg active:scale-90 transition-transform">
                  <span className="material-symbols-outlined text-lg">photo_camera</span>
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => handlePhotoUpload('avatar', e)} />
                </label>
              </div>
              <p className="text-[10px] font-black text-slate-500 uppercase">Foto de {userProfile?.role}</p>
            </div>

            <div className="space-y-4">
              <SettingInput 
                label="Nombre Completo" 
                value={userProfile?.nombre || ''} 
                onChange={(v) => setUserProfile({ ...userProfile!, nombre: v })} 
              />
              <SettingInput 
                label="Contraseña de Acceso" 
                value={userProfile?.password || ''} 
                onChange={(v) => setUserProfile({ ...userProfile!, password: v })} 
                type="password"
              />
              <SettingInput 
                label="Teléfono" 
                value={userProfile?.telefono || ''} 
                onChange={(v) => setUserProfile({ ...userProfile!, telefono: v })} 
              />
            </div>
          </section>
        </div>

        {/* Configuración de Apariencia Personal */}
        <div className="space-y-8 pt-4 border-t border-white/5">
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-primary">
              <span className="material-symbols-outlined">palette</span>
              <h2 className="font-bold uppercase tracking-widest text-xs">Mi Tema Visual</h2>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <button 
                onClick={() => setSettings({...settings, theme: 'default'})}
                className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${settings.theme === 'default' ? 'border-primary bg-primary/10' : 'border-white/5 bg-surface-dark'}`}
              >
                <div className="w-8 h-8 rounded-full bg-[#0d93f2]" />
                <span className="text-[10px] font-black uppercase tracking-widest text-center">Tecno Blue</span>
              </button>
              <button 
                onClick={() => setSettings({...settings, theme: 'whatsapp'})}
                className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${settings.theme === 'whatsapp' ? 'border-[#00a884] bg-[#00a884]/10' : 'border-white/5 bg-surface-dark'}`}
              >
                <div className="w-8 h-8 rounded-full bg-[#00a884]" />
                <span className="text-[10px] font-black uppercase tracking-widest text-center">WhatsApp</span>
              </button>
              <button 
                onClick={() => setSettings({...settings, theme: 'light'})}
                className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${settings.theme === 'light' ? 'border-[#0088cc] bg-[#0088cc]/10' : 'border-white/5 bg-surface-dark'}`}
              >
                <div className="w-8 h-8 rounded-full bg-[#0088cc] border border-white/20 shadow-sm" />
                <span className="text-[10px] font-black uppercase tracking-widest text-center">Light Mode</span>
              </button>
            </div>
          </section>

          {!isDomi && (
            <section className="space-y-4">
              <div className="flex items-center gap-3 text-primary">
                <span className="material-symbols-outlined">business</span>
                <h2 className="font-bold uppercase tracking-widest text-xs">Identidad Corporativa</h2>
              </div>

              <SettingInput 
                label="Nombre de la Compañía" 
                value={settings.nombre_compania} 
                onChange={(v) => setSettings({ ...settings, nombre_compania: v })} 
              />
            </section>
          )}
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 bg-background-dark/95 backdrop-blur-md border-t border-white/5 z-20">
        <button 
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-primary py-4 rounded-xl font-black text-sm uppercase tracking-widest shadow-neon-strong active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? 'GUARDANDO MI PERFIL...' : (
            <>
              GUARDAR MIS PREFERENCIAS
              <span className="material-symbols-outlined">save</span>
            </>
          )}
        </button>
      </footer>
    </div>
  );
};

const AudioSettingItem: React.FC<{ 
  title: string; 
  options: { name: string, url: string }[]; 
  setting: SoundSetting;
  onChangeUrl: (url: string) => void;
  onChangeRepeats: (val: number) => void;
}> = ({ title, options, setting, onChangeUrl, onChangeRepeats }) => (
  <div className="bg-surface-dark border border-white/5 p-4 rounded-2xl space-y-4">
    <div className="flex justify-between items-center">
      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300">{title}</h3>
      <button 
        onClick={() => audioService.previewSound(setting.url)}
        className="text-primary hover:text-white transition-colors flex items-center gap-1"
      >
        <span className="material-symbols-outlined text-sm">play_circle</span>
        <span className="text-[10px] font-black uppercase">Probar</span>
      </button>
    </div>

    <div className="space-y-3">
      <div>
        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1.5">Tono de Alerta</label>
        <select 
          value={setting.url}
          onChange={(e) => onChangeUrl(e.target.value)}
          className="w-full bg-background-dark border border-white/10 rounded-xl py-2 px-3 text-xs text-white outline-none focus:border-primary"
        >
          {options.map(opt => (
            <option key={opt.url} value={opt.url}>{opt.name}</option>
          ))}
        </select>
      </div>
      
      <div>
        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1.5">Repetir Alerta</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map(n => (
            <button 
              key={n}
              onClick={() => onChangeRepeats(n)}
              className={`flex-1 py-2 rounded-lg text-[10px] font-black border transition-all ${setting.repeats === n ? 'bg-primary border-primary text-white' : 'bg-background-dark border-white/5 text-slate-500'}`}
            >
              {n}x
            </button>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const FontSizeButton: React.FC<{ active: boolean; onClick: () => void; label: string; iconSize: string }> = ({ active, onClick, label, iconSize }) => (
  <button 
    onClick={onClick}
    className={`py-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 group ${active ? 'border-primary bg-primary/20 shadow-neon' : 'border-white/5 bg-background-dark hover:border-white/20'}`}
  >
    <div className={`font-black ${iconSize} ${active ? 'text-primary scale-110' : 'text-slate-500'} transition-transform`}>
      Aa
    </div>
    <span className={`text-[9px] font-black uppercase tracking-tighter ${active ? 'text-primary' : 'text-slate-600'}`}>{label}</span>
  </button>
);

const SettingInput: React.FC<{ label: string; value: string; onChange: (v: string) => void; type?: string }> = ({ label, value, onChange, type = "text" }) => (
  <div className="group">
    <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block tracking-wider group-focus-within:text-primary transition-colors">{label}</label>
    <input 
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-surface-dark border border-white/5 rounded-xl py-3 px-4 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none text-text-main font-bold transition-all text-sm"
    />
  </div>
);
