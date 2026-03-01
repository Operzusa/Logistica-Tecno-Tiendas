
import React, { useState, useEffect } from 'react';
import { supabaseService } from '../services/supabaseService';
import { User, UserRole } from '../types';

interface Props {
  onLogin: (u: User) => void;
  onNavigateRegister: () => void;
  onBack: () => void;
}

export const AuthScreen: React.FC<Props> = ({ onLogin, onNavigateRegister, onBack }) => {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [admins, setAdmins] = useState<User[]>([]);
  const [delivery, setDelivery] = useState<User[]>([]);
  const [fetching, setFetching] = useState(true);

  const settings = supabaseService.getSettings();

  useEffect(() => {
    const fetchUsers = async () => {
      setFetching(true);
      try {
        await supabaseService.forceRefreshUsers();
        
        const allAdmins = [
            ...supabaseService.getUsersByRole(UserRole.SUPERADMIN),
            ...supabaseService.getUsersByRole(UserRole.ADMIN)
        ];
        
        setAdmins(allAdmins);
        setDelivery(supabaseService.getUsersByRole(UserRole.DOMICILIARIO));
      } catch (e) {
        console.error("Error fetching users:", e);
      } finally {
        setFetching(false);
      }
    };
    
    fetchUsers();
  }, []);

  const handleUserClick = async (u: User) => {
    // Si ya validó su contraseña hoy, entramos directo
    if (supabaseService.isDailyAuthValid(u.id)) {
      setLoading(true);
      try {
        await supabaseService.login(u.id);
        onLogin(u);
      } catch (e: any) {
        // Si falla (ej: expiró la sesión o cambió algo), mostramos el modal
        setSelectedUser(u);
      } finally {
        setLoading(false);
      }
    } else {
      // Si es un nuevo día, pedimos contraseña
      setSelectedUser(u);
    }
  };

  const handleLoginClick = async () => {
    if (!selectedUser) return;
    setLoading(true);
    setError('');
    try {
      await supabaseService.login(selectedUser.id, password);
      onLogin(selectedUser);
    } catch (e: any) {
      setError(e.message || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col items-center justify-center p-6 bg-background-dark relative">
      <button 
        onClick={onBack}
        className="absolute top-6 left-6 w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-all"
      >
        <span className="material-symbols-outlined">arrow_back</span>
      </button>

      <div className="mb-12 text-center animate-in fade-in zoom-in duration-700">
        <div className="w-20 h-20 bg-primary/20 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-neon">
          <span className="material-symbols-outlined text-4xl text-primary">local_shipping</span>
        </div>
        <h1 className="text-3xl font-black tracking-tighter">{settings.nombre_compania}</h1>
        <p className="text-xs text-slate-500 font-bold uppercase tracking-[0.2em] mt-2">Logistics Control System</p>
      </div>

      {fetching ? (
        <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="w-full space-y-8 animate-in slide-in-from-bottom duration-500 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            <section>
            <label className="text-[10px] font-black text-slate-500 uppercase mb-4 block tracking-widest text-center">Acceso Administrativo</label>
            <div className="space-y-3">
                {admins.length > 0 ? admins.map(u => (
                <UserCard key={u.id} user={u} onClick={() => handleUserClick(u)} />
                )) : (
                <p className="text-center text-[10px] text-slate-600 font-bold">No hay administradores registrados</p>
                )}
            </div>
            </section>

            <section>
            <label className="text-[10px] font-black text-slate-500 uppercase mb-4 block tracking-widest text-center">Perfil Domiciliario</label>
            <div className="space-y-3">
                {delivery.length > 0 ? delivery.map(u => (
                <UserCard key={u.id} user={u} onClick={() => handleUserClick(u)} />
                )) : (
                <p className="text-center text-[10px] text-slate-600 font-bold">No hay domiciliarios registrados</p>
                )}
            </div>
            </section>
        </div>
      )}

      <button 
        onClick={onNavigateRegister}
        className="mt-8 w-full border border-primary/30 text-primary py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/5 transition-all flex items-center justify-center gap-2"
      >
        <span className="material-symbols-outlined text-sm">person_add</span>
        Registrar Nueva Empresa / Usuario
      </button>

      <footer className="mt-12 text-center text-[10px] text-slate-600 font-bold uppercase tracking-widest">
        v2.5.0 • Enterprise Edition
      </footer>

      {/* Modal de Contraseña */}
      {selectedUser && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="bg-surface-dark w-full max-sm rounded-[40px] border border-white/10 p-8 space-y-6 shadow-2xl animate-in zoom-in duration-300">
              <div className="text-center space-y-3">
                 <div className="w-20 h-20 rounded-3xl overflow-hidden border-2 border-primary mx-auto shadow-neon mb-2">
                    <img src={selectedUser.avatar} alt={selectedUser.nombre} className="w-full h-full object-cover" />
                 </div>
                 <h3 className="text-xl font-bold text-white">{selectedUser.nombre}</h3>
                 <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Ingrese su contraseña de acceso</p>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-500">lock</span>
                  <input 
                    type="password"
                    inputMode="numeric"
                    autoFocus
                    placeholder="••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLoginClick()}
                    className="w-full bg-background-dark border-2 border-white/5 rounded-2xl py-4 pl-12 pr-4 text-center text-2xl font-black tracking-[1em] focus:border-primary outline-none transition-all placeholder:tracking-normal placeholder:text-slate-700"
                  />
                </div>

                {error && (
                  <p className="text-center text-secondary text-[10px] font-black uppercase tracking-wider animate-shake">{error}</p>
                )}

                <div className="flex gap-3">
                   <button 
                     onClick={() => { setSelectedUser(null); setPassword(''); setError(''); }}
                     className="flex-1 py-4 bg-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-white/10 transition-all"
                   >
                      Cerrar
                   </button>
                   <button 
                     disabled={loading || !password}
                     onClick={handleLoginClick}
                     className="flex-1 py-4 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-neon-strong active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                   >
                      {loading ? 'Validando...' : 'Entrar'}
                      <span className="material-symbols-outlined text-sm">login</span>
                   </button>
                </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const UserCard: React.FC<{ user: User; onClick: () => void }> = ({ user, onClick }) => (
  <button 
    onClick={onClick}
    className="w-full bg-surface-dark border border-white/5 p-4 rounded-2xl flex items-center gap-4 hover:border-primary/40 transition-all active:scale-95 group"
  >
    <img src={user.avatar} alt={user.nombre} className="w-12 h-12 rounded-xl bg-background-dark p-1 border border-white/10 group-hover:shadow-neon transition-all object-cover" />
    <div className="text-left">
      <h3 className="font-bold text-white group-hover:text-primary transition-colors">{user.nombre}</h3>
      <p className="text-[10px] text-slate-500 font-black uppercase tracking-tighter">{user.role}</p>
    </div>
    <span className="material-symbols-outlined ml-auto text-slate-600 group-hover:text-primary transition-colors">lock_open</span>
  </button>
);
    