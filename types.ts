
export enum UserRole {
  SUPERADMIN = 'Superadministrador',
  ADMIN = 'Administrador',
  DOMICILIARIO = 'Domiciliario'
}

export interface VehicleInfo {
  placa: string;
  modelo: string;
  marca: string;
  color: string;
  foto_vehiculo?: string;
}

export interface User {
  id: string;
  nombre: string;
  role: UserRole;
  avatar?: string;
  telefono?: string;
  cedula?: string;
  direccion?: string;
  vehicle?: VehicleInfo;
  password?: string;
}

export interface Proveedor {
  id: string;
  nombre: string;
  direccion: string;
  telefono: string;
}

export interface TecnicoSatelite {
  id: string;
  nombre: string;
  direccion: string;
  telefono: string;
}

export enum TipoServicio {
  RECOGER = 'Recoger',
  ENTREGAR = 'Entregar',
  COTIZAR = 'Cotizar',
  COMPRAR = 'Comprar',
  GARANTIA = 'Garantia',
  SATELITE = 'Satelite',
  CONSIGNAR = 'Consignar',
  DILIGENCIA = 'Diligencia'
}

export enum EstadoServicio {
  PENDIENTE = 'Pendiente',
  EN_CAMINO = 'En_Camino',
  POR_CONFIRMAR = 'Por_Confirmar',
  COMPLETADO = 'Completado',
  FALLIDO = 'Failed'
}

export interface SoundSetting {
  url: string;
  repeats: number;
}

export interface AudioConfig {
  message: SoundSetting;
  newService: SoundSetting;
  update: SoundSetting;
}

export interface AppSettings {
  pais: string;
  codigo_pais: string;
  ciudad: string;
  nombre_compania: string;
  theme: 'default' | 'whatsapp' | 'light';
  fontSize: 'small' | 'medium' | 'large';
  audio: AudioConfig;
}

export interface Actividad {
  id: string;
  timestamp: string;
  descripcion: string;
  tipo: 'Servicio' | 'Gasto' | 'Sistema' | 'Gasolina';
  detalle: string;
  color?: string;
}

export interface Cliente {
  nombre: string;
  telefono: string;
  direccion: string;
  google_maps_link?: string;
  coordenadas_gps: {
    lat: number;
    lng: number;
  };
}

export interface Dispositivo {
  modelo: string;
  marca: string;
  serial: string;
  accesorios: string[];
  falla?: string;
  cantidad?: number;
  original_tipo?: string; // Campo para compatibilidad con DB
}

export interface Financiero {
  valor_a_cobrar: number;
  valor_cobrado: number;
  metodo_pago: string;
}

export interface PendingTechnicianChange {
  new_technician_id: string;
  new_technician_name: string;
  reason: string;
  timestamp: string;
}

export interface SateliteInfo {
  nombre_tecnico_externo: string;
  costo_reparacion: number;
  accion: 'Recoger' | 'Llevar';
  no_orden?: string;
  pending_change?: PendingTechnicianChange;
}

export interface ComponenteGarantia {
  id: string;
  nombre: string;
  serial?: string;
}

export interface GarantiaInfo {
  accion: 'Recoger' | 'Entregar';
}

export interface PaymentData {
  beneficiary: string;
  bank: string;
  accountNumber: string;
  amount: number;
  note?: string;
}

export interface ServiceLog {
  id: string;
  timestamp: string;
  mensaje: string;
  autor: 'Domiciliario' | 'Administrador';
  image?: string; 
  status?: 'sent' | 'delivered' | 'read';
  type?: 'text' | 'payment';
  paymentData?: PaymentData;
  paymentStatus?: 'pending' | 'paid';
  receiptUrl?: string;
}

export interface Servicio {
  id: string;
  tipo: TipoServicio;
  estado: EstadoServicio;
  cliente: Cliente;
  dispositivo: Dispositivo;
  financiero: Financiero;
  evidencia: string[];
  control_calidad: boolean;
  satelite_info?: SateliteInfo;
  garantia_info?: GarantiaInfo;
  fecha_asignacion: string;
  updated_at?: string;
  created_at?: string;
  logs?: ServiceLog[];
  domiciliario_id?: string;
  cierre_tardio?: boolean;
  cerrado_por_rol?: string;
}

export interface Ruta {
  id: string;
  domiciliario_id: string;
  fecha: string;
  servicios: Servicio[];
}

export interface Gasto {
  id: string;
  tipo: 'Gasolina' | 'Mantenimiento' | 'Otros' | 'Pago';
  descripcion: string;
  monto: number;
  fecha: string;
}

export interface CierreCaja {
  total_cobrado: number;
  total_gastado: number;
  balance_final: number;
  num_servicios: number;
}
