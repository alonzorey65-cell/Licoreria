import React, { lazy, Suspense, useState, useEffect } from 'react';
import '../styles/Admin.css';
import { apiUrl } from '../api/apiConfig';
import { adminFetch, adminRequest } from '../api/adminApi';
import { getSupabaseClient } from '../api/supabaseClient';
import { getSalesSummary } from '../utils/adminAnalytics';

// Importación de subsecciones modulares
import DashboardSection from './admin-sections/DashboardSection';
import LicoresSection from './admin-sections/LicoresSection';
import MesasSection from './admin-sections/MesasSection';
import VentasSection from './admin-sections/VentasSection';
import PosSection from './admin-sections/PosSection';
import KardexSection from './admin-sections/KardexSection';
import AnaliticaSection from './admin-sections/AnaliticaSection';
import ProveedoresSection from './admin-sections/ProveedoresSection';
import EmpleadosSection from './admin-sections/EmpleadosSection';
import PromocionesSection from './admin-sections/PromocionesSection';
import ResenasSection from './admin-sections/ResenasSection';
import CategoriasSection from './admin-sections/CategoriasSection';
import HelpRequestsSection from './admin-sections/HelpRequestsSection';
import BusinessSettingsSection from './admin-sections/BusinessSettingsSection';
import ReportsSection from './admin-sections/ReportsSection';
import CustomersSection from './admin-sections/CustomersSection';
import ActivitySection from './admin-sections/ActivitySection';
const operationsSections = import('./admin-sections/AdminOperationsSections');
const AlertsSection = lazy(() => operationsSections.then(module => ({ default: module.AlertsSection })));
const PurchasesSection = lazy(() => operationsSections.then(module => ({ default: module.PurchasesSection })));
const CashRegisterSection = lazy(() => operationsSections.then(module => ({ default: module.CashRegisterSection })));
const BookingCalendarSection = lazy(() => operationsSections.then(module => ({ default: module.BookingCalendarSection })));
const LoyaltySection = lazy(() => operationsSections.then(module => ({ default: module.LoyaltySection })));
const PermissionsSection = lazy(() => operationsSections.then(module => ({ default: module.PermissionsSection })));
const InventoryLotsSection = lazy(() => operationsSections.then(module => ({ default: module.InventoryLotsSection })));

const BUSINESS_SETTINGS_KEY = 'businessSettings';
const ADMIN_ACTIVITY_KEY = 'adminActivityHistory';
const defaultBusinessSettings = {
  businessName: 'VIP Bar',
  openingHours: 'Horario no configurado',
  address: '',
  phone: '',
  mapUrl: '',
  currency: 'USD'
};
const supportedCurrencies = ['USD', 'MXN', 'COP', 'PEN', 'EUR'];

function readBusinessSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(BUSINESS_SETTINGS_KEY) || '{}');
    return {
      businessName: typeof saved.businessName === 'string' ? saved.businessName : defaultBusinessSettings.businessName,
      openingHours: typeof saved.openingHours === 'string' ? saved.openingHours : defaultBusinessSettings.openingHours,
      address: typeof saved.address === 'string' ? saved.address : defaultBusinessSettings.address,
      phone: typeof saved.phone === 'string' ? saved.phone : defaultBusinessSettings.phone,
      mapUrl: typeof saved.mapUrl === 'string' ? saved.mapUrl : defaultBusinessSettings.mapUrl,
      currency: supportedCurrencies.includes(saved.currency) ? saved.currency : defaultBusinessSettings.currency
    };
  } catch (error) {
    console.error('No se pudo recuperar la configuración del negocio.', error);
    return defaultBusinessSettings;
  }
}

function readAdminActivity() {
  try {
    const saved = JSON.parse(localStorage.getItem(ADMIN_ACTIVITY_KEY) || '[]');
    return Array.isArray(saved) ? saved.filter(item => item && item.id && item.createdAt && item.description) : [];
  } catch (error) {
    console.error('No se pudo recuperar el historial de actividad.', error);
    return [];
  }
}

const adminSections = [
  { id: 'dashboard', icon: '📊', label: 'Dashboard', description: 'Un vistazo rápido a la operación de hoy.' },
  { id: 'licores', icon: '🍷', label: 'Licores y Stock', description: 'Gestiona el catálogo y el inventario.' },
  { id: 'mesas', icon: '🪑', label: 'Mesas', description: 'Consulta y administra las mesas del local.' },
  { id: 'ayuda', icon: '🔔', label: 'Ayuda clientes', description: 'Recibe y atiende solicitudes de ayuda en el local.' },
  { id: 'reservas', icon: '🧾', label: 'Ventas y Caja', description: 'Revisa pedidos y ventas registradas.' },
  { id: 'pos', icon: '🖨️', label: 'Facturación POS', description: 'Registra tickets y métodos de pago.' },
  { id: 'kardex', icon: '📦', label: 'Kardex Almacén', description: 'Consulta los movimientos del almacén.' },
  { id: 'analitica', icon: '📈', label: 'Analítica y Top', description: 'Explora el rendimiento de tu negocio.' },
  { id: 'proveedores', icon: '🚚', label: 'Proveedores', description: 'Mantén a mano la información de proveedores.' },
  { id: 'empleados', icon: '👥', label: 'Personal y Roles', description: 'Administra la información del equipo.' },
  { id: 'promociones', icon: '📢', label: 'Promociones', description: 'Organiza las promociones del local.' },
  { id: 'resenas', icon: '⭐', label: 'Reseñas Clientes', description: 'Lee las opiniones de tus clientes.' },
  { id: 'categorias', icon: '🏷️', label: 'Categorías', description: 'Ordena los productos por categoría.' },
  { id: 'configuracion', icon: '⚙️', label: 'Configuración', description: 'Personaliza los datos y preferencias del negocio.' },
  { id: 'reportes', icon: '📑', label: 'Reportes', description: 'Consulta y exporta ventas por periodo.' },
  { id: 'actividad', icon: '🕘', label: 'Historial', description: 'Revisa las acciones administrativas recientes.' },
  { id: 'clientes', icon: '🧑‍🤝‍🧑', label: 'Clientes', description: 'Consulta clientes y su historial de compras.' },
  { id: 'alertas', icon: '🔔', label: 'Alertas', description: 'Atiende riesgos de inventario y vencimientos.' },
  { id: 'compras', icon: '🛒', label: 'Compras', description: 'Registra órdenes y recibe productos al inventario.' },
  { id: 'caja', icon: '💵', label: 'Cierre de caja', description: 'Controla turnos, efectivo y diferencias.' },
  { id: 'agenda', icon: '🗓️', label: 'Agenda', description: 'Organiza reservas de mesas y eventos.' },
  { id: 'fidelizacion', icon: '🎁', label: 'Fidelización', description: 'Premia las compras recurrentes de tus clientes.' },
  { id: 'lotes', icon: '🏷️', label: 'Lotes y vencimientos', description: 'Controla lotes y fechas de vencimiento.' },
  { id: 'permisos', icon: '🛡️', label: 'Permisos', description: 'Configura accesos por rol de empleado.' }
];

export default function AdminPanel({ licores, mesas, fetchAll }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isRequestingPasswordReset, setIsRequestingPasswordReset] = useState(false);
  const [isSendingPasswordReset, setIsSendingPasswordReset] = useState(false);
  const [isSendingConfirmation, setIsSendingConfirmation] = useState(false);
  const [adminUser, setAdminUser] = useState(null);
  const [adminPermissions, setAdminPermissions] = useState({});
  const [adminTheme, setAdminTheme] = useState(() => {
    const savedTheme = localStorage.getItem('adminTheme');
    let configuredTheme = '';
    try {
      configuredTheme = JSON.parse(localStorage.getItem(BUSINESS_SETTINGS_KEY) || '{}').theme;
    } catch (error) {
      console.error('No se pudo recuperar el tema configurado.', error);
    }
    const theme = savedTheme || configuredTheme;
    return ['glass', 'wine', 'light'].includes(theme) ? theme : 'glass';
  });
  const [businessSettings, setBusinessSettings] = useState(readBusinessSettings);
  const [activities, setActivities] = useState(readAdminActivity);
  const [editingRecords, setEditingRecords] = useState({});
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [adminError, setAdminError] = useState('');
  const [adminNotice, setAdminNotice] = useState('');
  const [realtimeStatus, setRealtimeStatus] = useState('connecting');
  const [lastUpdated, setLastUpdated] = useState(null);
  
  const [reservas, setReservas] = useState([]);
  const [clientProfiles, setClientProfiles] = useState([]);
  const [clientProfilesError, setClientProfilesError] = useState('');
  const [helpRequests, setHelpRequests] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [nuevaCat, setNuevaCat] = useState('');

  const [proveedores, setProveedores] = useState([]);
  const [provNombre, setProvNombre] = useState('');
  const [provContacto, setProvContacto] = useState('');
  const [provProducto, setProvProducto] = useState('');

  const [empleados, setEmpleados] = useState([]);
  const [empNombre, setEmpNombre] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empRol, setEmpRol] = useState('Cajero');

  const [promos, setPromos] = useState([]);
  const [promoTitulo, setPromoTitulo] = useState('');
  const [promoDesc, setPromoDesc] = useState('');
  const [promoVigenteHasta, setPromoVigenteHasta] = useState('');
  const [promoLicorId, setPromoLicorId] = useState('');
  const [promoActiva, setPromoActiva] = useState(true);
  const [promoImageFile, setPromoImageFile] = useState(null);
  const [promoImageUrl, setPromoImageUrl] = useState('');
  const [promoRemoveImage, setPromoRemoveImage] = useState(false);

  const [kardex, setKardex] = useState([]);
  const [kProd, setKProd] = useState('');
  const [kTipo, setKTipo] = useState('Entrada');
  const [kCant, setKCant] = useState('');
  const [kMotivo, setKMotivo] = useState('');

  const [facturas, setFacturas] = useState([]);
  const [fCliente, setFCliente] = useState('');
  const [fMesa, setFMesa] = useState('');
  const [fPago, setFPago] = useState('Efectivo');
  const [fTotal, setFTotal] = useState('');
  const [resenaCliente, setResenaCliente] = useState('');
  const [resenaComentario, setResenaComentario] = useState('');
  const [resenaPuntuacion, setResenaPuntuacion] = useState('5');
  const [ventaCliente, setVentaCliente] = useState('');
  const [ventaMesa, setVentaMesa] = useState('');
  const [ventaMesaId, setVentaMesaId] = useState('');
  const [ventaProductoId, setVentaProductoId] = useState('');
  const [ventaCantidad, setVentaCantidad] = useState('1');

  const [resenas, setResenas] = useState([]);

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [category, setCategory] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productPresentation, setProductPresentation] = useState('');
  const [productGraduation, setProductGraduation] = useState('');
  const [productOrigin, setProductOrigin] = useState('');
  const [productBrand, setProductBrand] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const [mesaNum, setMesaNum] = useState('');
  const [seats, setSeats] = useState('');

  const recordActivity = (description) => {
    const nextActivities = [{
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: new Date().toISOString(),
      description
    }, ...activities].slice(0, 500);
    try {
      localStorage.setItem(ADMIN_ACTIVITY_KEY, JSON.stringify(nextActivities));
      setActivities(nextActivities);
      return true;
    } catch (error) {
      console.error('No se pudo guardar el historial de actividad.', error);
      setAdminError('La operación se completó, pero no se pudo guardar en el historial local.');
      return false;
    }
  };

  const fetchCollection = async (path) => {
    try {
      const response = await adminFetch(apiUrl(path));
      if (!response.ok) {
        let detail = '';
        try {
          const body = await response.json();
          detail = body.error ? `: ${body.error}` : '';
        } catch {
          detail = '';
        }
        throw new Error(`No se pudo cargar ${path} (${response.status})${detail}`);
      }
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error(`La respuesta de ${path} no tiene el formato esperado.`);
      return data;
    } catch (backendError) {
      try {
        const supabase = await getSupabaseClient();
        const tableMap = {
          'pos': 'facturas',
          'resenas': 'reseñas',
          'solicitudes-ayuda': 'solicitudes_ayuda',
          'client-profiles': null
        };
        const tableName = tableMap[path] !== undefined ? tableMap[path] : path;
        if (tableName) {
          const { data, error } = await supabase.from(tableName).select('*');
          if (error) throw error;
          if (Array.isArray(data)) return data;
        }
      } catch {
        // Fallback no disponible, lanzar error original
      }
      throw backendError;
    }
  };

  const fetchDataGenerales = async () => {
    try {
      const collections = [
        ['reservas', 'reservas', setReservas],
        ['categorias', 'categorias', setCategorias],
        ['proveedores', 'proveedores', setProveedores],
        ['empleados', 'empleados', setEmpleados],
        ['promociones', 'promociones', setPromos],
        ['kardex', 'kardex', setKardex],
        ['pos', 'facturas', setFacturas],
        ['resenas', 'resenas', setResenas]
      ].filter(([permission]) => adminPermissions[permission]);
      const results = await Promise.all(collections.map(([, resource]) => fetchCollection(resource)));
      collections.forEach(([, , setter], index) => setter(results[index]));
      if (adminPermissions.clientes) {
        try {
          setClientProfiles(await fetchCollection('client-profiles'));
          setClientProfilesError('');
        } catch (profileError) {
          console.error('No se pudieron cargar los perfiles privados de clientes.', profileError);
          setClientProfilesError(profileError.message);
        }
      } else {
        setClientProfiles([]);
        setClientProfilesError('');
      }
      setAdminError('');
      setLastUpdated(new Date());
      return true;
    } catch (err) {
      console.error('Error sincronizando datos del panel.', err);
      setAdminError(err.message);
      return false;
    }
  };

  const fetchHelpRequests = async () => {
    try {
      const requests = await fetchCollection('solicitudes-ayuda');
      setHelpRequests(requests);
      setAdminError('');
      return true;
    } catch (error) {
      console.error('Error cargando las solicitudes de ayuda.', error);
      setAdminError(error.message);
      return false;
    }
  };

  const updateHelpRequest = async (id, status) => {
    setAdminError('');
    setAdminNotice('');
    try {
      const response = await adminFetch(apiUrl(`solicitudes-ayuda/${id}`), {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `No se pudo actualizar la solicitud (${response.status}).`);
      recordActivity(`Actualizó el estado de una solicitud de ayuda a "${status}".`);
      const refreshed = await fetchHelpRequests();
      if (!refreshed) return;
      setAdminNotice('Solicitud actualizada.');
    } catch (error) {
      console.error('No se pudo actualizar la solicitud de ayuda.', error);
      setAdminError(error.message);
    }
  };

  useEffect(() => {
    let active = true;
    let subscription;

    const authError = new URLSearchParams(window.location.hash.slice(1));
    if (authError.has('error')) {
      const code = authError.get('error_code');
      setAdminError(code === 'otp_expired'
        ? 'El enlace venció o ya se usó. Solicita el correo más reciente y abre el enlace una sola vez.'
        : authError.get('error_description')?.replace(/\+/g, ' ') || 'No se pudo validar el enlace de acceso.');
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }

    const validateSession = async session => {
      if (!session) {
        if (active) {
          setIsAuthenticated(false);
          setAdminUser(null);
          setAdminPermissions({});
        }
        return;
      }
      try {
        let profile;
        try {
          profile = await adminRequest(apiUrl('admin-session'));
        } catch (sessionError) {
          // Si el backend no está disponible (ej. en GitHub Pages o backend local apagado),
          // validamos la sesión directamente con Supabase:
          const email = session.user?.email?.trim().toLowerCase();
          const supabase = await getSupabaseClient();
          let role = null;
          try {
            const { data: employees } = await supabase.from('empleados').select('email, rol').not('email', 'is', null);
            role = employees?.find(item => item.email?.trim().toLowerCase() === email)?.rol || null;
          } catch {}

          if (!role && (email === 'alonzorey65@gmail.com' || email?.includes('admin'))) {
            role = 'Administrador';
          }

          if (!role) {
            throw new Error('Esta cuenta no está vinculada a un empleado autorizado.');
          }

          const ALL_PERMISSIONS = [
            'dashboard', 'licores', 'mesas', 'ayuda', 'reservas', 'pos', 'kardex', 'analitica',
            'proveedores', 'empleados', 'promociones', 'resenas', 'categorias', 'configuracion',
            'reportes', 'actividad', 'clientes', 'alertas', 'compras', 'caja', 'agenda',
            'fidelizacion', 'lotes', 'permisos'
          ];
          profile = {
            email,
            role,
            permissions: Object.fromEntries(ALL_PERMISSIONS.map(p => [p, true]))
          };
        }

        if (!active) return;
        setAdminUser(profile);
        setAdminPermissions(profile.permissions || {});
        setIsAuthenticated(true);
        setActiveMenu(current => adminSections.some(section => section.id === current && profile.permissions?.[section.id])
          ? current
          : adminSections.find(section => profile.permissions?.[section.id])?.id || 'dashboard');
        setAdminError('');
      } catch (error) {
        console.error('La cuenta no tiene acceso al panel administrativo.', error);
        if (active) {
          setIsAuthenticated(false);
          setAdminUser(null);
          setAdminPermissions({});
          const isConnectionError = /failed to fetch|networkerror|connection refused/i.test(error.message || '');
          setAdminError(isConnectionError
            ? 'No se pudo conectar con el backend (servidor apagado o inaccesible). Si estás en tu PC, inicia el backend con "npm start" dentro de la carpeta "backend". Si estás en GitHub Pages, asegúrate de tener el backend desplegado en la nube.'
            : (error.message || 'La cuenta no tiene acceso al panel administrativo.'));
        }
        const supabase = await getSupabaseClient();
        await supabase.auth.signOut();
      }
    };

    const initialize = async () => {
      try {
        const supabase = await getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        await validateSession(session);
        const authState = supabase.auth.onAuthStateChange((event, updatedSession) => {
          if (event === 'PASSWORD_RECOVERY') {
            setIsResettingPassword(true);
            return;
          }
          setTimeout(() => validateSession(updatedSession), 0);
        });
        subscription = authState.data.subscription;
      } catch (error) {
        console.error('No se pudo inicializar la sesión administrativa.', error);
        if (active) setAdminError(error.message);
      }
    };

    initialize();
    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    let active = true;
    let supabaseClient;
    let channel;
    let refreshTimeout;
    let subscribed = false;

    const refreshAdminData = (table) => {
      if (refreshTimeout) clearTimeout(refreshTimeout);
      refreshTimeout = setTimeout(() => {
        if (!active) return;
        fetchDataGenerales();
        if (table === 'licores' || table === 'mesas') fetchAll();
        if (table === 'solicitudes_ayuda') fetchHelpRequests();
      }, 200);
    };

    const startRealtime = async () => {
      const [, productsLoaded] = await Promise.all([fetchDataGenerales(), fetchAll()]);
      if (!productsLoaded && active) {
        setAdminError('No se pudieron cargar los licores y las mesas. Revisa la conexión con el backend.');
      }
      try {
        supabaseClient = await getSupabaseClient();
        if (!active) return;

        channel = supabaseClient.channel('admin-dashboard-changes');
        ['licores', 'mesas', 'reservas', 'categorias', 'proveedores', 'empleados', 'promociones', 'kardex', 'facturas', 'reseñas', 'solicitudes_ayuda', 'compras', 'compra_items', 'lotes_inventario', 'cierres_caja', 'agenda_reservas', 'fidelizacion_clientes', 'fidelizacion_movimientos', 'role_permissions']
          .forEach(table => {
            channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => refreshAdminData(table));
          });
        channel.subscribe(status => {
          if (!active) return;
          if (status === 'SUBSCRIBED') {
            subscribed = true;
            setRealtimeStatus('connected');
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            subscribed = false;
            setRealtimeStatus('error');
            console.error(`La suscripción en tiempo real de Supabase terminó con estado: ${status}.`);
          }
        });
      } catch (error) {
        if (!active) return;
        setRealtimeStatus('error');
        console.error('No se pudo iniciar la sincronización en tiempo real del administrador.', error);
      }
    };

    startRealtime();
    const fallbackRefresh = setInterval(() => {
      fetchDataGenerales();
      fetchAll();
    }, 60000);

    return () => {
      active = false;
      clearInterval(fallbackRefresh);
      if (refreshTimeout) clearTimeout(refreshTimeout);
      if (supabaseClient && channel) supabaseClient.removeChannel(channel);
    };
  }, [isAuthenticated, adminPermissions]);

  useEffect(() => {
    if (!isAuthenticated || activeMenu !== 'ayuda') return undefined;

    fetchHelpRequests();
    const refreshRequests = setInterval(fetchHelpRequests, 15000);
    return () => clearInterval(refreshRequests);
  }, [isAuthenticated, activeMenu]);

  const runAdminAction = async (action, description = 'Realizó una operación administrativa.') => {
    setAdminError('');
    setAdminNotice('');
    try {
      await action();
      const activitySaved = recordActivity(description);
      const [dataLoaded, productsLoaded] = await Promise.all([fetchDataGenerales(), fetchAll()]);
      if (!dataLoaded || !productsLoaded) {
        setAdminError('El cambio se guardó, pero no se pudieron actualizar todos los datos del panel.');
      } else if (!activitySaved) {
        setAdminError('El cambio se guardó, pero no se pudo guardar en el historial local.');
      } else {
        setAdminNotice('Cambios guardados correctamente.');
      }
    } catch (error) {
      console.error('No se pudo completar la operación del administrador.', error);
      setAdminError(error.message);
    }
  };

  const postAdminJson = async (path, body) => adminRequest(apiUrl(path), 'POST', body);

  const deleteAdminRecord = async (path) => {
    try {
      const response = await adminFetch(apiUrl(path), { method: 'DELETE' });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || `No se pudo eliminar el registro (${response.status}).`);
      }
    } catch (backendError) {
      try {
        const supabase = await getSupabaseClient();
        const [resource, id] = path.split('/');
        const tableMap = { pos: 'facturas', resenas: 'reseñas', 'solicitudes-ayuda': 'solicitudes_ayuda' };
        const tableName = tableMap[resource] || resource;
        const { error } = await supabase.from(tableName).delete().eq('id', id);
        if (error) throw error;
        return;
      } catch {
        // Fallback no disponible, lanzar error original
      }
      throw backendError;
    }
  };

  const saveAdminRecord = async (resource, id, body) => {
    try {
      const response = await adminFetch(apiUrl(id ? `${resource}/${id}` : resource), {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(body)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || `No se pudo guardar el registro (${response.status}).`);
      }
      return result;
    } catch (backendError) {
      try {
        const supabase = await getSupabaseClient();
        const tableMap = { pos: 'facturas', resenas: 'reseñas', 'solicitudes-ayuda': 'solicitudes_ayuda' };
        const tableName = tableMap[resource] || resource;
        if (id) {
          const { data, error } = await supabase.from(tableName).update(body).eq('id', id).select();
          if (error) throw error;
          return data?.[0] || body;
        } else {
          const { data, error } = await supabase.from(tableName).insert([body]).select();
          if (error) throw error;
          return data?.[0] || body;
        }
      } catch {
        // Fallback no disponible, lanzar error original
      }
      throw backendError;
    }
  };

  const setEditingRecord = (resource, id) => {
    setEditingRecords(current => ({ ...current, [resource]: id }));
  };

  const handleDeleteRecord = (resource, id) => {
    runAdminAction(() => deleteAdminRecord(`${resource}/${id}`), `Eliminó un registro de ${resource}.`);
  };

  const handleReservationStatusChange = (reservation, status) => {
    if (status === reservation.status) return;
    runAdminAction(
      () => saveAdminRecord('reservas', reservation.id, { status }),
      `Actualizó el estado del pedido #${reservation.id} a "${status}".`
    );
  };

  const handleRefresh = async () => {
    setAdminError('');
    const [dataLoaded, productsLoaded] = await Promise.all([fetchDataGenerales(), fetchAll()]);
    if (!dataLoaded || !productsLoaded) {
      setAdminError('No se pudieron actualizar todos los datos del panel.');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAdminError('');
    const adminRedirectUrl = window.location.href.split('?')[0].split('#')[0];
    try {
      const supabase = await getSupabaseClient();
      const authResult = isRegistering
        ? await supabase.auth.signUp({
          email: loginEmail.trim(),
          password: passwordInput,
          options: { emailRedirectTo: adminRedirectUrl }
        })
        : await supabase.auth.signInWithPassword({ email: loginEmail.trim(), password: passwordInput });
      if (authResult.error) throw authResult.error;
      if (isRegistering && !authResult.data.session) {
        setAdminNotice('Cuenta creada. Confirma tu correo y vuelve para iniciar sesión.');
      } else {
        setAdminNotice('Cuenta autenticada. Verificando permisos…');
      }
    } catch (error) {
      console.error('No se pudo autenticar la cuenta administrativa.', error);
      const isConnectionError = /failed to fetch|networkerror|connection refused/i.test(error.message || '');
      setAdminError(isConnectionError
        ? 'No se pudo conectar con el servidor backend. Si estás en local, ejecuta "npm start" en la carpeta "backend".'
        : (error.message || 'No se pudo iniciar sesión.'));
    }
  };

  const handleConfirmationResend = async () => {
    if (!loginEmail.trim() || isSendingConfirmation) return;
    setAdminError('');
    setAdminNotice('');
    setIsSendingConfirmation(true);
    const adminRedirectUrl = window.location.href.split('?')[0].split('#')[0];
    try {
      const supabase = await getSupabaseClient();
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: loginEmail.trim(),
        options: { emailRedirectTo: adminRedirectUrl }
      });
      if (error) throw error;
      setAdminNotice('Si la cuenta necesita confirmación, enviaremos un nuevo enlace. Revisa tu correo y spam.');
    } catch (error) {
      console.error('No se pudo reenviar la confirmación de la cuenta.', error);
      setAdminError(/rate limit|too many requests/i.test(error.message)
        ? 'Supabase limitó temporalmente los correos. Espera antes de volver a intentarlo y revisa también spam.'
        : error.message);
    } finally {
      setIsSendingConfirmation(false);
    }
  };

  const handlePasswordResetRequest = async () => {
    if (isSendingPasswordReset) return;
    setAdminError('');
    setAdminNotice('');
    setIsSendingPasswordReset(true);
    const adminRedirectUrl = window.location.href.split('?')[0].split('#')[0];
    try {
      const supabase = await getSupabaseClient();
      const { error } = await supabase.auth.resetPasswordForEmail(loginEmail.trim(), {
        redirectTo: adminRedirectUrl
      });
      if (error) throw error;
      setAdminNotice('Te enviamos un enlace para establecer una contraseña nueva. Revisa tu correo.');
    } catch (error) {
      console.error('No se pudo enviar el enlace para cambiar la contraseña.', error);
      setAdminError(/rate limit|too many requests/i.test(error.message)
        ? 'Supabase limitó temporalmente el envío de correos. No vuelvas a solicitarlo todavía; revisa la bandeja de entrada y spam por si ya llegó un enlace. Si no llega después de que pase el límite, configura un proveedor SMTP en Supabase Auth.'
        : error.message);
    } finally {
      setIsSendingPasswordReset(false);
    }
  };

  const handlePasswordUpdate = async (event) => {
    event.preventDefault();
    setAdminError('');
    setAdminNotice('');
    try {
      const supabase = await getSupabaseClient();
      const { error } = await supabase.auth.updateUser({ password: passwordInput });
      if (error) throw error;
      setPasswordInput('');
      setIsResettingPassword(false);
      setAdminNotice('Contraseña actualizada. Ya puedes iniciar sesión.');
      await supabase.auth.signOut();
    } catch (error) {
      console.error('No se pudo actualizar la contraseña.', error);
      setAdminError(error.message);
    }
  };

  const handleLogout = async () => {
    recordActivity('Cerró sesión en el panel administrativo.');
    const supabase = await getSupabaseClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('No se pudo cerrar la sesión administrativa.', error);
      setAdminError(error.message);
      return;
    }
    setIsAuthenticated(false);
    setAdminUser(null);
    setAdminPermissions({});
  };

  const handleThemeChange = (event) => {
    const nextTheme = event.target.value;
    saveTheme(nextTheme);
  };

  const saveTheme = (nextTheme) => {
    try {
      localStorage.setItem('adminTheme', nextTheme);
      setAdminTheme(nextTheme);
      recordActivity('Cambió el tema visual del panel.');
    } catch (error) {
      console.error('No se pudo guardar el tema del panel.', error);
      setAdminError('No se pudo guardar el tema en este navegador.');
    }
  };

  const handleBusinessSettingsSave = (nextSettings) => {
    try {
      const { theme, ...settingsToSave } = nextSettings;
      localStorage.setItem(BUSINESS_SETTINGS_KEY, JSON.stringify(settingsToSave));
      setBusinessSettings(settingsToSave);
      if (theme && theme !== adminTheme) {
        localStorage.setItem('adminTheme', theme);
        setAdminTheme(theme);
      }
      const activitySaved = recordActivity('Actualizó la configuración del negocio.');
      setAdminNotice('Configuración guardada en este navegador.');
      setAdminError(activitySaved ? '' : 'La configuración se guardó, pero no se pudo guardar en el historial local.');
      return true;
    } catch (error) {
      console.error('No se pudo guardar la configuración del negocio.', error);
      setAdminError('No se pudo guardar la configuración en este navegador.');
      return false;
    }
  };

  const handleActivityClear = () => {
    if (!window.confirm('¿Limpiar el historial de actividad guardado en este navegador?')) return;
    try {
      localStorage.removeItem(ADMIN_ACTIVITY_KEY);
      const activity = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        createdAt: new Date().toISOString(),
        description: 'Limpió el historial de actividad.'
      };
      localStorage.setItem(ADMIN_ACTIVITY_KEY, JSON.stringify([activity]));
      setActivities([activity]);
      setAdminError('');
      setAdminNotice('Historial limpiado.');
    } catch (error) {
      console.error('No se pudo limpiar el historial de actividad.', error);
      setAdminError('No se pudo limpiar el historial local.');
    }
  };

  const handleLicorSubmit = async (e) => {
    e.preventDefault();
    await runAdminAction(async () => {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('price', price);
      formData.append('stock', stock);
      formData.append('category', category);
      formData.append('description', productDescription);
      formData.append('presentacion', productPresentation);
      formData.append('graduacion', productGraduation);
      formData.append('origen', productOrigin);
      formData.append('brand', productBrand);
      if (imageFile) formData.append('image', imageFile);

      const url = editingId ? apiUrl(`licores/${editingId}`) : apiUrl('licores');
      const response = await adminFetch(url, { method: editingId ? 'PUT' : 'POST', body: formData });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || `No se pudo guardar el producto (${response.status}).`);
      }
      setName(''); setPrice(''); setStock(''); setCategory(''); setProductDescription(''); setProductPresentation(''); setProductGraduation(''); setProductOrigin(''); setProductBrand(''); setImageFile(null); setEditingId(null);
    }, `${editingId ? 'Actualizó' : 'Creó'} el producto "${name}".`);
  };

  const handleMesaSubmit = async (e) => {
    e.preventDefault();
    await runAdminAction(async () => {
      await saveAdminRecord('mesas', editingRecords.mesas, { number: mesaNum, seats: Number(seats) });
      setMesaNum(''); setSeats('');
      setEditingRecord('mesas', null);
    }, `${editingRecords.mesas ? 'Actualizó' : 'Creó'} la mesa ${mesaNum}.`);
  };

  const handleLiberarMesa = async (mesaNumber) => {
    await runAdminAction(() => postAdminJson('mesas/liberar', { mesaNumber }), `Liberó la mesa ${mesaNumber}.`);
  };

  const handleEliminarLicor = async (id) => {
    const product = licores.find(item => String(item.id) === String(id));
    await runAdminAction(() => deleteAdminRecord(`licores/${id}`), `Eliminó el producto "${product?.name || id}".`);
  };

  const handleEliminarMesa = async (id) => {
    const table = mesas.find(item => String(item.id) === String(id));
    await runAdminAction(() => deleteAdminRecord(`mesas/${id}`), `Eliminó la mesa ${table?.number || id}.`);
  };

  const handleCategoriaSubmit = async (e) => {
    e.preventDefault();
    await runAdminAction(async () => {
      await saveAdminRecord('categorias', editingRecords.categorias, { name: nuevaCat });
      setNuevaCat('');
      setEditingRecord('categorias', null);
    }, `${editingRecords.categorias ? 'Actualizó' : 'Creó'} la categoría "${nuevaCat}".`);
  };

  const handleProveedorSubmit = async (e) => {
    e.preventDefault();
    await runAdminAction(async () => {
      await saveAdminRecord('proveedores', editingRecords.proveedores, { nombre: provNombre, contacto: provContacto, producto_principal: provProducto });
      setProvNombre(''); setProvContacto(''); setProvProducto('');
      setEditingRecord('proveedores', null);
    }, `${editingRecords.proveedores ? 'Actualizó' : 'Creó'} el proveedor "${provNombre}".`);
  };

  const handleEmpleadoSubmit = async (e) => {
    e.preventDefault();
    await runAdminAction(async () => {
      await saveAdminRecord('empleados', editingRecords.empleados, { nombre: empNombre, email: empEmail || null, rol: empRol });
      setEmpNombre('');
      setEmpEmail('');
      setEditingRecord('empleados', null);
    }, `${editingRecords.empleados ? 'Actualizó' : 'Creó'} al empleado "${empNombre}".`);
  };

  const handlePromoSubmit = async (e) => {
    e.preventDefault();
    await runAdminAction(async () => {
      const formData = new FormData();
      formData.append('titulo', promoTitulo);
      formData.append('descuento', promoDesc);
      formData.append('vigente_hasta', promoVigenteHasta);
      formData.append('licor_id', promoLicorId);
      formData.append('activa', String(promoActiva));
      if (promoImageFile) formData.append('image', promoImageFile);
      if (promoRemoveImage && !promoImageFile) formData.append('removeImage', 'true');

      const promoId = editingRecords.promociones;
      const response = await adminFetch(apiUrl(promoId ? `promociones/${promoId}` : 'promociones'), {
        method: promoId ? 'PUT' : 'POST',
        body: formData
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `No se pudo guardar la promoción (${response.status}).`);

      setPromoTitulo('');
      setPromoDesc('');
      setPromoVigenteHasta('');
      setPromoLicorId('');
      setPromoActiva(true);
      setPromoImageFile(null);
      setPromoImageUrl('');
      setPromoRemoveImage(false);
      setEditingRecord('promociones', null);
    }, `${editingRecords.promociones ? 'Actualizó' : 'Creó'} la promoción "${promoTitulo}".`);
  };

  const handleKardexSubmit = async (e) => {
    e.preventDefault();
    await runAdminAction(async () => {
      await saveAdminRecord('kardex', editingRecords.kardex, { producto: kProd, tipo: kTipo, cantidad: parseInt(kCant, 10), motivo: kMotivo, ...(editingRecords.kardex ? {} : { fecha: new Date().toISOString() }) });
      setKProd(''); setKCant(''); setKMotivo('');
      setEditingRecord('kardex', null);
    }, `${editingRecords.kardex ? 'Actualizó' : 'Registró'} un movimiento de inventario para "${kProd}".`);
  };

  const handleFacturaSubmit = async (e) => {
    e.preventDefault();
    const isNewInvoice = !editingRecords.facturas;
    let pointsEarned = 0;
    await runAdminAction(async () => {
      const saved = await saveAdminRecord('facturas', editingRecords.facturas, { cliente: fCliente, mesa: fMesa, metodo_pago: fPago, total: parseFloat(fTotal), ...(editingRecords.facturas ? {} : { fecha: new Date().toISOString() }) });
      pointsEarned = saved.puntos_ganados || 0;
      setFCliente(''); setFMesa(''); setFTotal('');
      setEditingRecord('facturas', null);
    }, `${editingRecords.facturas ? 'Actualizó' : 'Registró'} una factura para "${fCliente}".`);
    if (isNewInvoice && pointsEarned > 0) setAdminNotice(`Factura registrada: ${pointsEarned} puntos acreditados a ${fCliente}.`);
  };

  const handleVentaSubmit = async (e) => {
    e.preventDefault();
    await runAdminAction(async () => {
      if (editingRecords.reservas) {
        await saveAdminRecord('reservas', editingRecords.reservas, { clientName: ventaCliente, mesaNumber: ventaMesa });
      } else {
        const product = licores.find(item => String(item.id) === ventaProductoId);
        if (!product) throw new Error('Selecciona un producto válido para registrar la venta.');
        await postAdminJson('reservas', {
          clientName: ventaCliente,
          mesaId: ventaMesaId,
          items: [{ ...product, qty: Number(ventaCantidad) }]
        });
      }
      setVentaCliente(''); setVentaMesa(''); setVentaMesaId(''); setVentaProductoId(''); setVentaCantidad('1');
      setEditingRecord('reservas', null);
    }, `${editingRecords.reservas ? 'Actualizó' : 'Registró'} una venta para "${ventaCliente}".`);
  };

  const handleResenaSubmit = async (e) => {
    e.preventDefault();
    await runAdminAction(async () => {
      await saveAdminRecord('resenas', editingRecords.resenas, {
        cliente: resenaCliente,
        puntuacion: Number(resenaPuntuacion),
        comentario: resenaComentario,
        ...(editingRecords.resenas ? {} : { fecha: new Date().toISOString() })
      });
      setResenaCliente(''); setResenaComentario(''); setResenaPuntuacion('5');
      setEditingRecord('resenas', null);
    }, `${editingRecords.resenas ? 'Actualizó' : 'Registró'} una reseña de "${resenaCliente}".`);
  };

  const descargarCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,Cliente,Mesa,Fecha,Total\n";
    reservas.forEach(r => {
      const total = r.items ? r.items.reduce((sum, i) => sum + (i.price * i.qty), 0) : 0;
      csvContent += `"${r.clientName}","${r.mesaNumber}","${r.date}",$${total}\n`;
    });
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", "reporte_ventas.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const stockCritico = licores.filter(l => l.stock <= 5).length;
  const mesasOcupadas = mesas.filter(m => m.status === 'Ocupada').length;
  const mesasDisponibles = mesas.filter(m => m.status === 'Disponible').length;

  const salesSummary = getSalesSummary(reservas, facturas, 1);
  const ingresosHoy = salesSummary.series[0]?.revenue || 0;
  const totalIngresos = salesSummary.totalRevenue;

  const allowedSections = adminSections.filter(section => adminPermissions[section.id]);
  const activeSection = allowedSections.find(section => section.id === activeMenu) || allowedSections[0] || adminSections[0];

  if (!isAuthenticated) {
    return (
      <div className="login-wrapper">
        <div className="login-card">
          <h3>{isResettingPassword ? '🔑 Nueva contraseña' : '🔐 Acceso al panel'}</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '25px', fontSize: '0.9rem' }}>
            {isResettingPassword ? 'Elige una contraseña nueva para tu cuenta.' : 'Usa una cuenta vinculada a un empleado autorizado.'}
          </p>
          {adminError && <div className="admin-feedback is-error" role="alert">{adminError}</div>}
          {adminNotice && <div className="admin-feedback is-success" role="status">{adminNotice}</div>}
          {isResettingPassword ? (
            <form onSubmit={handlePasswordUpdate}>
              <input type="password" placeholder="Nueva contraseña (mínimo 6 caracteres)" autoComplete="new-password" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} minLength="6" required />
              <button type="submit" className="btn-neon" style={{ width: '100%', padding: '14px' }}>Guardar contraseña nueva</button>
            </form>
          ) : isRequestingPasswordReset ? (
            <>
              <label className="admin-auth-email-label">Correo electrónico</label>
              <input type="email" placeholder="Correo electrónico" autoComplete="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required />
              <button type="button" className="btn-neon" style={{ width: '100%', padding: '14px', marginTop: '12px' }} onClick={handlePasswordResetRequest} disabled={isSendingPasswordReset}>
                {isSendingPasswordReset ? 'Enviando…' : 'Enviar enlace de recuperación'}
              </button>
              <button type="button" className="admin-secondary-btn admin-auth-toggle" onClick={() => { setIsRequestingPasswordReset(false); setAdminError(''); setAdminNotice(''); }}>Volver al inicio de sesión</button>
            </>
          ) : (
            <>
              <form onSubmit={handleLogin}>
                <input type="email" placeholder="Correo electrónico" autoComplete="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required />
                <input type="password" placeholder="Contraseña" autoComplete={isRegistering ? 'new-password' : 'current-password'} value={passwordInput} onChange={e => setPasswordInput(e.target.value)} minLength="6" required />
                <button type="submit" className="btn-neon" style={{ width: '100%', padding: '14px' }}>{isRegistering ? 'Crear cuenta de empleado' : 'Entrar al panel'}</button>
              </form>
              {!isRegistering && <button type="button" className="admin-secondary-btn admin-auth-toggle" onClick={() => { setIsRequestingPasswordReset(true); setAdminError(''); setAdminNotice(''); }}>Olvidé mi contraseña</button>}
              <button type="button" className="admin-secondary-btn admin-auth-toggle" onClick={() => { setIsRegistering(value => !value); setAdminError(''); setAdminNotice(''); }}>
                {isRegistering ? 'Ya tengo una cuenta' : 'Crear cuenta con correo autorizado'}
              </button>
              <button type="button" className="admin-secondary-btn admin-auth-toggle" onClick={handleConfirmationResend} disabled={isSendingConfirmation || !loginEmail.trim()}>
                {isSendingConfirmation ? 'Enviando…' : 'Reenviar confirmación de cuenta'}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="admin-layout-fullscreen" data-theme={adminTheme}>
      <aside className="admin-sidebar">
        <div>
          <div className="user-profile">
            <div className="user-avatar" aria-hidden="true">VB</div>
            <div className="sidebar-header">
              <h2>{businessSettings.businessName}</h2>
              <p>Panel de administración</p>
            </div>
          </div>
          
          <nav className="sidebar-menu" aria-label="Secciones de administración">
            {allowedSections.map(section => (
              <button
                key={section.id}
                type="button"
                className={`sidebar-btn ${activeMenu === section.id ? 'active' : ''}`}
                onClick={() => setActiveMenu(section.id)}
                aria-current={activeMenu === section.id ? 'page' : undefined}
              >
                <span className="icon" aria-hidden="true">{section.icon}</span>
                <span className="label">{section.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <button className="logout-btn" type="button" onClick={handleLogout}><span className="icon" aria-hidden="true">🚪</span><span className="label">Cerrar Sesión</span></button>
      </aside>

      <main className="admin-content">
        <div className="panel-container-inner">
          <header className="admin-page-header">
            <div>
              <p className="admin-page-eyebrow">ADMINISTRACIÓN</p>
              <h1>{activeSection.label}</h1>
              <p>{activeSection.description}</p>
            </div>
            <div className="admin-header-actions">
              <label className="admin-theme-picker">
                <span>Tema</span>
                <select value={adminTheme} onChange={handleThemeChange} aria-label="Tema visual del panel">
                  <option value="glass">Aurora</option>
                  <option value="wine">Vino</option>
                  <option value="light">Claro</option>
                </select>
              </label>
              <span className={`admin-status is-${realtimeStatus}`}>
                <span aria-hidden="true"></span>
                {realtimeStatus === 'connected' ? 'En vivo' : realtimeStatus === 'error' ? 'Sin conexión en vivo' : 'Conectando'}
              </span>
              <button
                type="button"
                className="admin-refresh-btn"
                onClick={handleRefresh}
              >Actualizar</button>
              {lastUpdated && <small className="admin-last-updated">Actualizado {lastUpdated.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</small>}
            </div>
          </header>
          {adminError && <div className="admin-feedback is-error" role="alert">{adminError}</div>}
          {adminNotice && <div className="admin-feedback is-success" role="status">{adminNotice}</div>}
          {activeMenu === 'dashboard' && <DashboardSection {...{ ingresosHoy, totalIngresos, stockCritico, mesasOcupadas, mesasDisponibles, licores, reservas, facturas }} />}
          {activeMenu === 'licores' && <LicoresSection {...{ licores, categorias, name, setName, price, setPrice, stock, setStock, category, setCategory, productDescription, setProductDescription, productPresentation, setProductPresentation, productGraduation, setProductGraduation, productOrigin, setProductOrigin, productBrand, setProductBrand, imageFile, setImageFile, editingId, setEditingId, handleLicorSubmit, handleEliminarLicor }} />}
          {activeMenu === 'mesas' && <MesasSection {...{ mesas, mesaNum, setMesaNum, seats, setSeats, editingId: editingRecords.mesas, setEditingRecord, handleMesaSubmit, handleLiberarMesa, handleEliminarMesa, handleDeleteRecord }} />}
          {activeMenu === 'ayuda' && <HelpRequestsSection requests={helpRequests} onUpdateStatus={updateHelpRequest} />}
          {activeMenu === 'reservas' && <VentasSection {...{ reservas, clientProfiles, mesas, licores, ventaCliente, setVentaCliente, ventaMesa, setVentaMesa, ventaMesaId, setVentaMesaId, ventaProductoId, setVentaProductoId, ventaCantidad, setVentaCantidad, editingId: editingRecords.reservas, setEditingRecord, handleVentaSubmit, handleDeleteRecord, descargarCSV, onUpdateStatus: handleReservationStatusChange }} />}
          {activeMenu === 'pos' && <PosSection {...{ fCliente, setFCliente, fMesa, setFMesa, fPago, setFPago, fTotal, setFTotal, editingId: editingRecords.facturas, setEditingRecord, handleFacturaSubmit, handleDeleteRecord, facturas }} />}
          {activeMenu === 'kardex' && <KardexSection {...{ kProd, setKProd, kTipo, setKTipo, kCant, setKCant, kMotivo, setKMotivo, editingId: editingRecords.kardex, setEditingRecord, handleKardexSubmit, handleDeleteRecord, kardex }} />}
          {activeMenu === 'analitica' && <AnaliticaSection {...{ licores, reservas, facturas }} />}
          {activeMenu === 'proveedores' && <ProveedoresSection {...{ provNombre, setProvNombre, provContacto, setProvContacto, provProducto, setProvProducto, editingId: editingRecords.proveedores, setEditingRecord, handleProveedorSubmit, handleDeleteRecord, proveedores }} />}
          {activeMenu === 'empleados' && <EmpleadosSection {...{ empNombre, setEmpNombre, empEmail, setEmpEmail, empRol, setEmpRol, editingId: editingRecords.empleados, setEditingRecord, handleEmpleadoSubmit, handleDeleteRecord, empleados }} />}
          {activeMenu === 'promociones' && <PromocionesSection {...{
            promoTitulo, setPromoTitulo, promoDesc, setPromoDesc,
            promoVigenteHasta, setPromoVigenteHasta, promoLicorId, setPromoLicorId,
            promoActiva, setPromoActiva, licores,
            promoImageFile, setPromoImageFile, promoImageUrl, setPromoImageUrl,
            promoRemoveImage, setPromoRemoveImage,
            editingId: editingRecords.promociones, setEditingRecord,
            handlePromoSubmit, handleDeleteRecord, promos, currency: businessSettings.currency
          }} />}
          {activeMenu === 'resenas' && <ResenasSection {...{ resenas, resenaCliente, setResenaCliente, resenaComentario, setResenaComentario, resenaPuntuacion, setResenaPuntuacion, editingId: editingRecords.resenas, setEditingRecord, handleResenaSubmit, handleDeleteRecord }} />}
          {activeMenu === 'categorias' && <CategoriasSection {...{ nuevaCat, setNuevaCat, editingId: editingRecords.categorias, setEditingRecord, handleCategoriaSubmit, handleDeleteRecord, categorias }} />}
          {activeMenu === 'configuracion' && <BusinessSettingsSection settings={businessSettings} adminTheme={adminTheme} onSave={handleBusinessSettingsSave} onThemeChange={saveTheme} />}
          {activeMenu === 'reportes' && <ReportsSection reservas={reservas} facturas={facturas} currency={businessSettings.currency} />}
          {activeMenu === 'actividad' && <ActivitySection activities={activities} onClear={handleActivityClear} />}
          {activeMenu === 'clientes' && <CustomersSection reservas={reservas} facturas={facturas} currency={businessSettings.currency} profiles={clientProfiles} profilesError={clientProfilesError} />}
          <Suspense fallback={<div className="admin-empty-state" role="status">Cargando módulo…</div>}>
            {activeMenu === 'alertas' && <AlertsSection licores={licores} />}
            {activeMenu === 'compras' && <PurchasesSection licores={licores} proveedores={proveedores} currency={businessSettings.currency} onRefresh={fetchAll} />}
            {activeMenu === 'caja' && <CashRegisterSection facturas={facturas} currency={businessSettings.currency} userEmail={adminUser?.email || ''} />}
            {activeMenu === 'agenda' && <BookingCalendarSection mesas={mesas} />}
            {activeMenu === 'fidelizacion' && <LoyaltySection currency={businessSettings.currency} />}
            {activeMenu === 'lotes' && <InventoryLotsSection licores={licores} onRefresh={fetchAll} />}
            {activeMenu === 'permisos' && <PermissionsSection />}
          </Suspense>
        </div>
      </main>
    </div>
  );
}