import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react';
import { Alert } from 'react-native';
import {
  getMateriales,
  getRecetas,
  getIngredientesByReceta,
  getPedidosConDetalles,
  getEstadisticasData,
} from '../database/db';
import { calcularCostoIngrediente } from '../utils/conversions';

// ─── Creamos el contexto ───────────────────────────────────────
const AppContext = createContext();

// ─── Hook para usar el contexto fácilmente ────────────────────
export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp debe usarse dentro de AppProvider');
  }
  return context;
};

// ─── Provider ─────────────────────────────────────────────────
export function AppProvider({ children }) {

  // Estados de datos
  const [materiales, setMateriales]   = useState([]);
  const [recetas, setRecetas]         = useState([]);
  const [pedidos, setPedidos]         = useState([]);
  const [entregas, setEntregas]       = useState([]);
  const [recetasConPrecio, setRecetasConPrecio] = useState([]);

  // Estados de carga
  const [cargandoMateriales, setCargandoMateriales] = useState(false);
  const [cargandoRecetas, setCargandoRecetas]       = useState(false);
  const [cargandoPedidos, setCargandoPedidos]       = useState(false);
  const [cargandoEntregas, setCargandoEntregas]     = useState(false);

  // ─── Cargar materiales ──────────────────────────────────────
  const cargarMateriales = useCallback(async () => {
    setCargandoMateriales(true);
    try {
      const data = await getMateriales();
      setMateriales(data);
    } catch (error) {
      Alert.alert('Error', error.message || 'No se pudieron cargar los materiales.');
    } finally {
      setCargandoMateriales(false);
    }
  }, []);

  // ─── Cargar recetas ─────────────────────────────────────────
  const cargarRecetas = useCallback(async () => {
    setCargandoRecetas(true);
    try {
      const data = await getRecetas();
      setRecetas(data);

      // También calculamos el precio de venta de cada receta
      // para usarlo en FormPedido sin recalcular cada vez
      const conPrecio = await Promise.all(data.map(async (r) => {
        const ingredientes = await getIngredientesByReceta(r.id);
        const costoMat = ingredientes.reduce(
          (sum, ing) => sum + calcularCostoIngrediente(ing), 0
        );
        const costoAdicional = costoMat * (r.porcentaje_costos_adicionales / 100);
        const costoTotal = costoMat + costoAdicional;
        const precioVenta = (costoTotal / r.unidades) * (1 + r.porcentaje_beneficio / 100);
        return { ...r, precioVenta };
      }));

      setRecetasConPrecio(conPrecio);
    } catch (error) {
      Alert.alert('Error', error.message || 'No se pudieron cargar las recetas.');
    } finally {
      setCargandoRecetas(false);
    }
  }, []);

  // ─── Cargar pedidos ─────────────────────────────────────────
  const cargarPedidos = useCallback(async () => {
    setCargandoPedidos(true);
    try {
      const data = await getPedidosConDetalles();
      // Pedidos pendientes (para PedidosScreen)
      setPedidos(data.filter(p => p.estado !== 'entregado'));
    } catch (error) {
      Alert.alert('Error', error.message || 'No se pudieron cargar los pedidos.');
    } finally {
      setCargandoPedidos(false);
    }
  }, []);

  // ─── Cargar entregas ─────────────────────────────────────────
  const cargarEntregas = useCallback(async () => {
    setCargandoEntregas(true);
    try {
      const data = await getEstadisticasData();
      setEntregas(data);
    } catch (error) {
      Alert.alert('Error', error.message || 'No se pudieron cargar las entregas.');
    } finally {
      setCargandoEntregas(false);
    }
  }, []);

  // ─── Carga inicial al montar el provider ────────────────────
  useEffect(() => {
    cargarMateriales();
    cargarRecetas();
    cargarPedidos();
    cargarEntregas();
  }, []);

  // ─── Lo que exponemos a todas las pantallas ─────────────────
  const value = {
    // Datos
    materiales,
    recetas,
    recetasConPrecio,
    pedidos,
    entregas,

    // Estados de carga
    cargandoMateriales,
    cargandoRecetas,
    cargandoPedidos,
    cargandoEntregas,

    // Funciones para recargar
    cargarMateriales,
    cargarRecetas,
    cargarPedidos,
    cargarEntregas,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}