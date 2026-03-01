
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { 
  User, AppSettings, Servicio, Ruta, CierreCaja, Actividad, Proveedor, 
  TecnicoSatelite, ServiceLog, UserRole, PaymentData, EstadoServicio, Gasto, PendingTechnicianChange, TipoServicio
} from '../types';

const SUPABASE_URL = 'https://mrzrlcpaopmuyqefisjr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yenJsY3Bhb3BtdXlxZWZpc2pyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxNzk2MDIsImV4cCI6MjA4Mzc1NTYwMn0.OKkqHqSYZaim7A8tW0RtOF1dnpVY5JtFOJrlW8V5AqU';

import { getColombiaDateString, getColombiaStartOfDayUTC, getColombiaEndOfDayUTC, isBeforeColombiaDay } from '../utils/dateUtils';

class SupabaseService {
  public client: SupabaseClient;
  private usersCache: User[] = [];
  private settings: AppSettings;
  private currentUser: User | null = null;
  private listeners: ((settings: AppSettings) => void)[] = [];

  constructor() {
    this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Default settings
    this.settings = {
        pais: 'Colombia',
        codigo_pais: '57',
        ciudad: 'Bogotá',
        nombre_compania: 'Tecno Logistics',
        theme: 'default',
        fontSize: 'medium',
        audio: {
            message: { url: 'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3', repeats: 1 },
            newService: { url: 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3', repeats: 1 },
            update: { url: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3', repeats: 1 }
        }
    };

    this.loadInitialData();
  }

  private async loadInitialData() {
    // Load settings
    const savedSettings = localStorage.getItem('appSettings');
    if (savedSettings) {
      try { this.settings = { ...this.settings, ...JSON.parse(savedSettings) }; } catch {}
    }

    // Load User
    const savedUserId = localStorage.getItem('current_user_id');
    if (savedUserId) {
        try {
            const { data, error } = await this.client.from('profiles').select('*').eq('id', savedUserId).single();
            if (data && !error) {
                this.currentUser = data as User;
                // Force cache refresh immediately
                this.forceRefreshUsers(); 
            }
        } catch (e) {
            console.error("Error restoring session:", e);
        }
    }
  }

  generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  getSettings(): AppSettings {
    return this.settings;
  }

  subscribeToSettings(callback: (s: AppSettings) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  saveSettings(newSettings: AppSettings) {
    this.settings = newSettings;
    localStorage.setItem('appSettings', JSON.stringify(newSettings));
    this.listeners.forEach(l => l(newSettings));
  }

  async login(id: string, password?: string): Promise<void> {
    const { data, error } = await this.client.from('profiles').select('*').eq('id', id).single();
    if (error || !data) throw new Error("Usuario no encontrado");
    
    // Default passwords based on role if not set
    const defaultPassword = (data.role === UserRole.ADMIN || data.role === UserRole.SUPERADMIN) ? '4321' : '1234';
    const actualPassword = data.password || defaultPassword;

    if (password && actualPassword !== password) throw new Error("Contraseña incorrecta");
    
    this.currentUser = data as User;
    localStorage.setItem('current_user_id', data.id);
    
    // Mark as authenticated for today
    const today = getColombiaDateString();
    localStorage.setItem(`auth_${id}_${today}`, 'true');
  }

  logout() {
    this.currentUser = null;
    localStorage.removeItem('current_user_id');
  }

  isDailyAuthValid(userId: string): boolean {
    const today = getColombiaDateString();
    return localStorage.getItem(`auth_${userId}_${today}`) === 'true';
  }

  // --- USERS ---

  async forceRefreshUsers(): Promise<User[]> {
    const { data, error } = await this.client.from('profiles').select('*');
    if (error) console.error(error);
    this.usersCache = (data || []) as User[];
    return this.usersCache;
  }

  getUsersByRole(role: UserRole): User[] {
    return this.usersCache.filter(u => u.role === role);
  }

  async registerUser(userData: Partial<User>): Promise<User> {
    const defaultPassword = (userData.role === UserRole.ADMIN || userData.role === UserRole.SUPERADMIN) ? '4321' : '1234';
    const finalData = {
        ...userData,
        password: userData.password || defaultPassword,
        avatar: userData.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userData.nombre?.replace(/\s/g, '')}`
    };

    const { data, error } = await this.client.from('profiles').insert(finalData).select().single();
    if (error) throw error;
    await this.forceRefreshUsers();
    return data as User;
  }

  async updateUserProfile(id: string, data: Partial<User>) {
    const { error } = await this.client.from('profiles').update(data).eq('id', id);
    if (error) throw error;
    if (this.currentUser && this.currentUser.id === id) {
        this.currentUser = { ...this.currentUser, ...data };
    }
    await this.forceRefreshUsers();
  }

  async deleteUser(id: string) {
    const { error } = await this.client.from('profiles').delete().eq('id', id);
    if (error) throw error;
    await this.forceRefreshUsers();
  }

  // --- SERVICES ---

  private mapServiceFromDB(s: any): Servicio {
    if (s.dispositivo?.original_tipo) {
      s.tipo = s.dispositivo.original_tipo;
    }
    if (!s.cliente) {
      s.cliente = { nombre: 'Desconocido', direccion: '', telefono: '' };
    }
    if (!s.dispositivo) {
        s.dispositivo = { modelo: 'Desconocido', marca: '', serial: '', accesorios: [] };
    }
    return s as Servicio;
  }

  async getAllServicios(): Promise<Servicio[]> {
    const { data, error } = await this.client.from('servicios').select('*').order('fecha_asignacion', { ascending: true });
    if (error) return [];
    return (data || []).map(s => this.mapServiceFromDB(s));
  }

  async addServicio(servicio: Partial<Servicio>) {
    const now = new Date().toISOString();
    let dbTipo = servicio.tipo;
    let dbDispositivo = { ...servicio.dispositivo };

    if (servicio.tipo === TipoServicio.CONSIGNAR) {
      dbTipo = TipoServicio.ENTREGAR;
      dbDispositivo.original_tipo = TipoServicio.CONSIGNAR;
    }

    const cleanPayload = JSON.parse(JSON.stringify({
      ...servicio,
      tipo: dbTipo,
      dispositivo: dbDispositivo,
      estado: EstadoServicio.PENDIENTE,
      fecha_asignacion: now,
      updated_at: now,
      logs: servicio.logs || [] // Modified to accept existing logs
    }));

    const { error } = await this.client.from('servicios').insert([cleanPayload]);
    if (error) throw error;
  }

  async updateServicio(id: string, data: Partial<Servicio>) {
    const { error } = await this.client.from('servicios').update({
        ...data,
        updated_at: new Date().toISOString()
    }).eq('id', id);
    if (error) throw error;
  }

  async updateEstadoServicio(id: string, estado: string, data: any = {}) {
    const updateData = { ...data, estado, updated_at: new Date().toISOString() };
    
    // Add finish log if completing
    if (estado === EstadoServicio.COMPLETADO) {
        try {
            const { data: currentSrv, error: fetchError } = await this.client.from('servicios').select('logs, fecha_asignacion').eq('id', id).single();
            
            if (fetchError) {
                console.error("Error fetching service for completion:", fetchError);
            } else {
                const logs = currentSrv?.logs || [];
                updateData.logs = [...logs, {
                    id: `FINISH-${this.generateUUID()}`,
                    timestamp: new Date().toISOString(),
                    mensaje: "✅ El servicio ha sido finalizado exitosamente.",
                    autor: 'Sistema',
                    status: 'read',
                    type: 'text'
                }];

                // Check for late closure
                if (currentSrv?.fecha_asignacion) {
                    const todayStr = getColombiaDateString();
                    if (isBeforeColombiaDay(currentSrv.fecha_asignacion, todayStr)) {
                        updateData.cierre_tardio = true;
                        updateData.cerrado_por_rol = this.currentUser?.role === UserRole.ADMIN || this.currentUser?.role === UserRole.SUPERADMIN ? 'Administrador' : 'Domiciliario';
                    }
                }
            }
        } catch (e) {
            console.error("Unexpected error during completion logic:", e);
        }
    }

    const { error } = await this.client.from('servicios').update(updateData).eq('id', id);
    if (error) {
        console.error("Error updating service state:", error);
        throw error;
    }
  }

  async deleteServicio(id: string) {
    const { error } = await this.client.from('servicios').delete().eq('id', id);
    if (error) throw error;
  }

  async getRutaDelDia(userId: string): Promise<Ruta> {
    const today = getColombiaDateString();
    const startUTC = getColombiaStartOfDayUTC(today);
    const endUTC = getColombiaEndOfDayUTC(today);
    
    const { data } = await this.client.from('servicios')
      .select('*')
      .eq('domiciliario_id', userId)
      .or(`and(fecha_asignacion.gte.${startUTC},fecha_asignacion.lte.${endUTC}),and(fecha_asignacion.lt.${startUTC},estado.neq.Completado)`)
      .order('fecha_asignacion', { ascending: true });
    
    return {
        id: `ruta-${userId}-${today}`,
        domiciliario_id: userId,
        fecha: today,
        servicios: (data || []).map(s => this.mapServiceFromDB(s))
    };
  }

  // --- LOGS & CHAT ---

  async addServiceLog(serviceId: string, mensaje: string, image?: string, paymentData?: PaymentData) {
    const userRole = this.currentUser?.role === UserRole.ADMIN ? 'Administrador' : 'Domiciliario';
    
    const { data: srv } = await this.client.from('servicios').select('logs').eq('id', serviceId).single();
    const currentLogs = srv?.logs || [];
    
    const newLog: ServiceLog = {
      id: this.generateUUID(),
      timestamp: new Date().toISOString(),
      mensaje,
      autor: userRole as 'Administrador' | 'Domiciliario',
      status: 'sent',
      type: paymentData ? 'payment' : 'text',
      image,
      paymentData,
      paymentStatus: paymentData ? 'pending' : undefined
    };

    const { error } = await this.client.from('servicios').update({
        logs: [...currentLogs, newLog],
        updated_at: new Date().toISOString()
    }).eq('id', serviceId);

    if (error) throw error;
  }

  async markChatAsRead(servicioId: string, myRole: string): Promise<void> {
    const { data: currentSrv } = await this.client.from('servicios').select('logs').eq('id', servicioId).single();
    if (!currentSrv || !currentSrv.logs) return;

    let hasChanges = false;
    const updatedLogs = currentSrv.logs.map((log: ServiceLog) => {
      if (log.autor !== myRole && log.status !== 'read') {
        hasChanges = true;
        return { ...log, status: 'read' };
      }
      return log;
    });

    if (hasChanges) {
      await this.client.from('servicios').update({ logs: updatedLogs }).eq('id', servicioId);
    }
  }

  async confirmPaymentLog(serviceId: string, logId: string, receiptUrl: string) {
      const { data: srv } = await this.client.from('servicios').select('logs').eq('id', serviceId).single();
      const logs = srv?.logs || [];
      const updatedLogs = logs.map((l: ServiceLog) => {
          if (l.id === logId) {
              return { ...l, paymentStatus: 'paid', receiptUrl: receiptUrl };
          }
          return l;
      });
      
      const targetLog = logs.find((l: ServiceLog) => l.id === logId);
      if (targetLog && targetLog.paymentData) {
         try {
            await this.addGasto({
                tipo: 'Pago',
                descripcion: `Pago a ${targetLog.paymentData.beneficiary}: ${targetLog.paymentData.note || ''}`,
                monto: targetLog.paymentData.amount,
                fecha: new Date().toISOString()
            });
         } catch(e) { console.error("Error auto expense", e); }
      }

      await this.client.from('servicios').update({ logs: updatedLogs, updated_at: new Date().toISOString() }).eq('id', serviceId);
  }

  // --- TECHNICIAN CHANGE RESOLUTION ---

  async resolveTechnicianChange(servicioId: string, approve: boolean): Promise<void> {
    const { data: currentSrv } = await this.client.from('servicios').select('satelite_info, logs, cliente').eq('id', servicioId).single();
    if (!currentSrv || !currentSrv.satelite_info || !currentSrv.satelite_info.pending_change) return;

    const pending = currentSrv.satelite_info.pending_change;
    const now = new Date().toISOString();
    const formattedDate = new Date().toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });

    let updatedSateliteInfo = { ...currentSrv.satelite_info };
    let updatedCliente = { ...currentSrv.cliente };
    let logMessage = '';
    
    if (approve) {
      const oldTechName = updatedSateliteInfo.nombre_tecnico_externo;
      updatedSateliteInfo.nombre_tecnico_externo = pending.new_technician_name;
      updatedCliente.nombre = pending.new_technician_name; // Sync
      
      delete updatedSateliteInfo.pending_change;

      logMessage = `✅ CHANGE APPROVED: Service reassigned to ${pending.new_technician_name} on ${formattedDate}.\nPrevious: ${oldTechName}`;
    } else {
      delete updatedSateliteInfo.pending_change;
      logMessage = "❌ CHANGE REJECTED by Admin. The service continues with the current technician.";
    }

    const systemLog: ServiceLog = {
      id: `SYS-CHANGE-${this.generateUUID()}`,
      timestamp: now,
      mensaje: logMessage,
      autor: 'Administrador',
      status: 'read',
      type: 'text'
    };

    await this.client.from('servicios').update({
      satelite_info: updatedSateliteInfo,
      cliente: updatedCliente,
      logs: [...(currentSrv.logs || []), systemLog],
      updated_at: now
    }).eq('id', servicioId);
  }

  async requestTechnicianChange(id: string, data: any, isFailure?: boolean) {
     const { data: srv } = await this.client.from('servicios').select('satelite_info, logs').eq('id', id).single();
     if (!srv) return;
     
     const updatedSatelite = {
         ...srv.satelite_info,
         pending_change: data
     };
     
     let logs = srv.logs || [];
     if (isFailure) {
        const failureLog: ServiceLog = {
            id: `FAIL-${this.generateUUID()}`,
            timestamp: new Date().toISOString(),
            mensaje: `⚠️ REQUEST: CHANGE TECHNICIAN\n\nCurrent Tech: ${srv.satelite_info.nombre_tecnico_externo}\nNew Tech: ${data.new_technician_name}\nReason: ${data.reason}`,
            autor: 'Domiciliario',
            status: 'sent',
            type: 'text'
        };
        logs = [...logs, failureLog];
     } else {
        // Log normal request
        const reqLog: ServiceLog = {
            id: `REQ-${this.generateUUID()}`,
            timestamp: new Date().toISOString(),
            mensaje: `🔄 Solicitud de cambio de técnico:\nNuevo: ${data.new_technician_name}\nRazón: ${data.reason}`,
            autor: 'Domiciliario',
            status: 'sent',
            type: 'text'
        };
        logs = [...logs, reqLog];
     }

     const { error } = await this.client.from('servicios').update({
         satelite_info: updatedSatelite,
         logs: logs,
         updated_at: new Date().toISOString()
     }).eq('id', id);

     if (error) throw error;
  }

  // --- FINANCES & REPORT ---

  async getReporteCierre(): Promise<CierreCaja> {
    const today = getColombiaDateString();
    const startUTC = getColombiaStartOfDayUTC(today);
    const endUTC = getColombiaEndOfDayUTC(today);
    
    // Services Completed Today or Por Confirmar (for dashboard preview)
    const { data: services } = await this.client.from('servicios')
        .select('financiero')
        .eq('estado', 'Completado')
        .gte('updated_at', startUTC)
        .lte('updated_at', endUTC);
    
    // Expenses Today
    const { data: gastos } = await this.client.from('gastos')
        .select('monto')
        .gte('fecha', today); // Assuming 'fecha' in gastos is just a date string, if it's a timestamp we should change this too.

    const totalCobrado = (services || []).reduce((sum, s) => sum + (s.financiero?.valor_cobrado || 0), 0);
    const totalGastado = (gastos || []).reduce((sum, g) => sum + (g.monto || 0), 0);

    return {
        total_cobrado: totalCobrado,
        total_gastado: totalGastado,
        balance_final: totalCobrado - totalGastado,
        num_servicios: (services || []).length
    };
  }

  async addGasto(gasto: Partial<Gasto>) {
    const { error } = await this.client.from('gastos').insert([gasto]);
    if (error) throw error;
  }

  // UPDATED: Now inserts precise description for Admin Filtering and returns valid Promise
  async reportarFaltaGasolina(): Promise<void> {
    const uuid = this.generateUUID();
    const { error } = await this.client.from('actividades').insert({
        id: uuid,
        descripcion: 'SOLICITUD DE COMBUSTIBLE',
        tipo: 'Gasolina',
        detalle: `El domiciliario ${this.currentUser?.nombre || 'Usuario'} reporta falta de gasolina.`,
        timestamp: new Date().toISOString(),
        color: 'text-amber-500'
    });
    if (error) throw error;
  }

  // NEW: Allows Admin to resolve/dispatch the fuel request
  async resolverAlertaGasolina(actividadId: string): Promise<void> {
    const { error } = await this.client.from('actividades')
      .update({ 
        descripcion: 'GASOLINA DESPACHADA', 
        color: 'text-success' 
      })
      .eq('id', actividadId);
    
    if (error) throw error;
  }

  async realizarCierreDiario(reporte: CierreCaja) {
    await this.client.from('actividades').insert({
        id: this.generateUUID(),
        descripcion: 'CIERRE DE CAJA',
        tipo: 'Sistema',
        detalle: `Cierre realizado. Balance: $${reporte.balance_final.toLocaleString()}. Servicios: ${reporte.num_servicios}`,
        timestamp: new Date().toISOString(),
        color: 'text-success'
    });
  }

  async getHistorial(): Promise<Actividad[]> {
    const { data } = await this.client.from('actividades').select('*').order('timestamp', { ascending: false }).limit(50);
    return (data || []) as Actividad[];
  }

  // --- DIRECTORY ---

  async getProveedores(): Promise<Proveedor[]> {
    const { data } = await this.client.from('proveedores').select('*').order('nombre');
    return data || [];
  }
  async getTecnicosSatelite(): Promise<TecnicoSatelite[]> {
    const { data } = await this.client.from('tecnicos_satelite').select('*').order('nombre');
    return data || [];
  }
  
  async addProveedor(data: Partial<Proveedor>) {
      const { error } = await this.client.from('proveedores').insert(data);
      if (error) throw error;
  }
  async updateProveedor(id: string, data: Partial<Proveedor>) {
      const { error } = await this.client.from('proveedores').update(data).eq('id', id);
      if (error) throw error;
  }
  async deleteProveedor(id: string) {
      const { error } = await this.client.from('proveedores').delete().eq('id', id);
      if (error) throw error;
  }

  async addTecnicoSatelite(data: Partial<TecnicoSatelite>) {
      const { error } = await this.client.from('tecnicos_satelite').insert(data);
      if (error) throw error;
  }
  async updateTecnicoSatelite(id: string, data: Partial<TecnicoSatelite>) {
      const { error } = await this.client.from('tecnicos_satelite').update(data).eq('id', id);
      if (error) throw error;
  }
  async deleteTecnicoSatelite(id: string) {
      const { error } = await this.client.from('tecnicos_satelite').delete().eq('id', id);
      if (error) throw error;
  }

  // --- UTILS ---

  async compressImage(file: File): Promise<File> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxWidth = 800;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(file); // fallback
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (blob) {
              const newFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
                type: 'image/webp',
                lastModified: Date.now(),
              });
              resolve(newFile);
            } else {
              resolve(file); // fallback
            }
          }, 'image/webp', 0.8);
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
    });
  }

  async uploadPhoto(file: File): Promise<string> {
    const compressedFile = await this.compressImage(file);
    const fileName = `${Math.random()}.webp`;
    const filePath = `evidencias/${fileName}`;
    const { data, error } = await this.client.storage.from('media').upload(filePath, compressedFile);
    
    if (error) throw error;
    
    const { data: publicUrl } = this.client.storage.from('media').getPublicUrl(filePath);
    return publicUrl.publicUrl;
  }

  getWhatsAppLink(phone: string): string {
    const p = phone.replace(/\D/g, '');
    return `https://wa.me/${this.settings.codigo_pais}${p}`;
  }
}

export const supabaseService = new SupabaseService();
