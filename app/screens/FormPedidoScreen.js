import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, StatusBar,
  TouchableOpacity, TextInput, ScrollView, Alert, Modal, FlatList,
  Switch, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { 
  getRecetas, addPedido, addProductoAPedido, 
  updatePedido, deleteProductosByPedido, getProductosByPedido,
  getIngredientesByReceta 
} from '../database/db';
import { useApp } from '../contexts/AppContext';
import { calcularCostoIngrediente } from '../utils/conversions';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';

export default function FormPedidoScreen({ navigation, route }) {
  const pedidoEditar = route.params?.pedido;

  const { recetasConPrecio, cargarPedidos, cargarEntregas } = useApp();
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [domicilio, setDomicilio] = useState(false);
  const [direccion, setDireccion] = useState('');
  const [fecha, setFecha] = useState(new Date());
  const [hora, setHora] = useState('');
  const [estado, setEstado] = useState('pendiente');
  const [color, setColor] = useState('');
  const [relleno, setRelleno] = useState('');
  const [decoracion, setDecoracion] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  
  const [recetasDisponibles, setRecetasDisponibles] = useState([]);
  const [productosSeleccionados, setProductosSeleccionados] = useState([]);
  const [modalRecetas, setModalRecetas] = useState(false);
  const [costoTotal, setCostoTotal] = useState(0);

  useEffect(() => {
    let total = 0;
    productosSeleccionados.forEach(p => {
      total += (p.precioVenta || 0) * p.cantidad;
    });
    setCostoTotal(total);
  }, [productosSeleccionados]);

  
  useEffect(() => {
    if (pedidoEditar) {
      cargarDatosPedido();
    } else {
      // También carga las recetas disponibles para nuevos pedidos
      setRecetasDisponibles(recetasConPrecio);
    }
  }, [pedidoEditar]); // Se ejecuta cuando cambia el pedido a editar

  const cargarDatosPedido = async () => {
    setNombre(pedidoEditar.cliente_nombre);
    setTelefono(pedidoEditar.cliente_telefono || '');
    setDomicilio(pedidoEditar.domicilio === 1);
    setDireccion(pedidoEditar.direccion || '');
    setFecha(new Date(pedidoEditar.fecha_entrega));
    setHora(pedidoEditar.hora_entrega || '');
    setEstado(pedidoEditar.estado || 'pendiente');
    setColor(pedidoEditar.color || '');
    setRelleno(pedidoEditar.relleno || '');
    setDecoracion(pedidoEditar.decoracion || '');
    
    const prods = await getProductosByPedido(pedidoEditar.id);
    const recetasOriginales = await getRecetas();

    const prodsCompletos = await Promise.all(prods.map(async (p) => {
      const r = recetasOriginales.find(rec => rec.id === p.receta_id);
      const ingredientes = await getIngredientesByReceta(p.receta_id);
      const costoMat = ingredientes.reduce((sum, ing) => sum + calcularCostoIngrediente(ing), 0);
      const costoAdicional = costoMat * (r.porcentaje_costos_adicionales / 100);
      const costoTotalReceta = costoMat + costoAdicional;
      const precioVenta = (costoTotalReceta / r.unidades) * (1 + r.porcentaje_beneficio / 100);

      return {
        id: p.receta_id,
        nombre: p.receta_nombre,
        cantidad: p.cantidad,
        precioVenta: precioVenta
      };
    }));
    setProductosSeleccionados(prodsCompletos);
    setCostoTotal(pedidoEditar.costo_total);
  };

  const agregarProducto = (receta) => {
    const existe = productosSeleccionados.find(p => p.id === receta.id);
    if (existe) {
      setProductosSeleccionados(productosSeleccionados.map(p => 
        p.id === receta.id ? { ...p, cantidad: p.cantidad + 1 } : p
      ));
    } else {
      setProductosSeleccionados([...productosSeleccionados, { 
        id: receta.id, 
        nombre: receta.nombre, 
        cantidad: 1, 
        precioVenta: receta.precioVenta 
      }]);
    }
    setModalRecetas(false);
  };

  const actualizarCantidad = (id, delta) => {
    setProductosSeleccionados(productosSeleccionados.map(p => {
      if (p.id === id) {
        const nuevaCant = Math.max(1, p.cantidad + delta);
        return { ...p, cantidad: nuevaCant };
      }
      return p;
    }));
  };

  const eliminarProducto = (id) => {
    setProductosSeleccionados(productosSeleccionados.filter(p => p.id !== id));
  };

  const onChangeFecha = (event, selectedDate) => {
    const currentDate = selectedDate || fecha;
    setShowDatePicker(false);
    setFecha(currentDate);
  };

  const onChangeHora = (event, selectedTime) => {
    setShowTimePicker(false);
    if (selectedTime) {
      let hours = selectedTime.getHours();
      let minutes = selectedTime.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const strMinutes = minutes < 10 ? '0' + minutes : minutes;
      const strTime = `${hours}:${strMinutes} ${ampm}`;
      setHora(strTime);
    }
  };

  const guardar = async () => {
    if (!nombre.trim() || productosSeleccionados.length === 0) {
      Alert.alert('Faltan datos', 'Ingresa el nombre del cliente y al menos un producto.');
      return;
    }

    try {
      const fechaStr = fecha.toISOString().split('T')[0];
      let pedidoId = pedidoEditar?.id;

      if (pedidoEditar) {
        await updatePedido(
          pedidoId,
          nombre.trim(),
          telefono.trim(),
          domicilio ? 1 : 0,
          domicilio ? direccion.trim() : '',
          fechaStr,
          hora,
          costoTotal,
          estado,
          color.trim(),
          relleno.trim(),
          decoracion.trim()
        );
        await deleteProductosByPedido(pedidoId);
      } else {
        pedidoId = await addPedido(
          nombre.trim(),
          telefono.trim(),
          domicilio ? 1 : 0,
          domicilio ? direccion.trim() : '',
          fechaStr,
          hora,
          costoTotal,
          estado,
          color.trim(),
          relleno.trim(),
          decoracion.trim()
        );
      }

      for (const prod of productosSeleccionados) {
        await addProductoAPedido(pedidoId, prod.id, prod.cantidad);
      }

      Alert.alert('Éxito', `Pedido ${pedidoEditar ? 'actualizado' : 'guardado'} correctamente.`,
        [{
          text: 'OK',
          onPress: () => {
            cargarPedidos(); // actualiza lista de pedidos
            cargarEntregas();  // actualiza entregas por si cambió estado
            navigation.goBack();
          }
        }]
      );
    } catch (error) {
      Alert.alert('Error', 'Ocurrió un problema al guardar el pedido. Inténtalo de nuevo.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0f0f1a" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{pedidoEditar ? 'Editar Pedido' : 'Nuevo Pedido'}</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <Text style={styles.label}>Cliente</Text>
          <TextInput
            style={styles.input}
            placeholder="Nombre completo"
            placeholderTextColor="#555"
            value={nombre}
            onChangeText={setNombre}
          />

          <Text style={styles.label}>Teléfono</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: +53 55555555"
            placeholderTextColor="#555"
            keyboardType="phone-pad"
            value={telefono}
            onChangeText={setTelefono}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.sectionTitle}>Productos</Text>
            <TouchableOpacity style={styles.addProdBtn} onPress={() => setModalRecetas(true)}>
              <Ionicons name="add" size={20} color="#000" />
              <Text style={styles.addProdBtnTxt}>Agregar</Text>
            </TouchableOpacity>
          </View>

          {productosSeleccionados.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No hay productos seleccionados</Text>
            </View>
          ) : (
            productosSeleccionados.map((item) => (
              <Swipeable
                key={item.id}
                renderRightActions={() => (
                  <TouchableOpacity 
                    style={styles.deleteAction} 
                    onPress={() => eliminarProducto(item.id)}
                  >
                    <Ionicons name="trash-outline" size={24} color="#fff" />
                  </TouchableOpacity>
                )}
              >
                <View style={styles.prodCard}>
                  <View style={styles.prodInfo}>
                    <Text style={styles.prodNombre}>{item.nombre}</Text>
                    <Text style={styles.prodSub}>${(item.precioVenta || 0).toFixed(2)} c/u</Text>
                  </View>
                  <View style={styles.prodActions}>
                    <TouchableOpacity onPress={() => actualizarCantidad(item.id, -1)} style={styles.qtyBtn}>
                      <Ionicons name="remove" size={16} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.qtyTxt}>{item.cantidad}</Text>
                    <TouchableOpacity onPress={() => actualizarCantidad(item.id, 1)} style={styles.qtyBtn}>
                      <Ionicons name="add" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              </Swipeable>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detalles Personalizados</Text>
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.label}>Color</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: Azul pastel"
                placeholderTextColor="#555"
                value={color}
                onChangeText={setColor}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Relleno</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: Nutella"
                placeholderTextColor="#555"
                value={relleno}
                onChangeText={setRelleno}
              />
            </View>
          </View>
          <Text style={styles.label}>Decoración</Text>
          <TextInput
            style={[styles.input, { height: 60 }]}
            placeholder="Ej: Con flores de fondant..."
            placeholderTextColor="#555"
            multiline
            value={decoracion}
            onChangeText={setDecoracion}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Entrega</Text>
          
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.label}>Fecha</Text>
              <TouchableOpacity style={styles.dateTimeBtn} onPress={() => setShowDatePicker(true)}>
                <Ionicons name="calendar-outline" size={20} color="#F59E0B" />
                <Text style={styles.dateTimeBtnTxt}>{fecha.toLocaleDateString()}</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Hora</Text>
              <TouchableOpacity style={styles.dateTimeBtn} onPress={() => setShowTimePicker(true)}>
                <Ionicons name="time-outline" size={20} color="#F59E0B" />
                <Text style={styles.dateTimeBtnTxt}>{hora || 'Seleccionar'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.label}>¿Es a domicilio?</Text>
            <Switch
              value={domicilio}
              onValueChange={setDomicilio}
              trackColor={{ false: '#16213e', true: '#F59E0B' }}
              thumbColor={domicilio ? '#fff' : '#888'}
            />
          </View>

          {domicilio && (
            <View>
              <Text style={styles.label}>Dirección de entrega</Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                placeholder="Ingresa la dirección completa..."
                placeholderTextColor="#555"
                multiline
                value={direccion}
                onChangeText={setDireccion}
              />
            </View>
          )}
        </View>

        {pedidoEditar && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Estado del Pedido</Text>
            <View style={styles.switchRow}>
              <Text style={styles.label}>¿Pedido entregado?</Text>
              <Switch
                value={estado === 'entregado'}
                onValueChange={(val) => setEstado(val ? 'entregado' : 'pendiente')}
                trackColor={{ false: '#16213e', true: '#10B981' }}
                thumbColor={estado === 'entregado' ? '#fff' : '#888'}
              />
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.label}>Costo Total del Pedido ($)</Text>
          <TextInput
            style={[styles.input, styles.costoInput]}
            placeholder="0.00"
            placeholderTextColor="#F59E0B"
            keyboardType="decimal-pad"
            value={String(costoTotal.toFixed(2))}
            onChangeText={(v) => setCostoTotal(parseFloat(v) || 0)}
          />
          <Text style={styles.helperText}>Calculado automáticamente, pero puedes ajustarlo.</Text>
        </View>

        <TouchableOpacity style={styles.btnGuardar} onPress={guardar}>
          <Ionicons name="checkmark-circle-outline" size={24} color="#000" />
          <Text style={styles.btnGuardarTxt}>{pedidoEditar ? 'Actualizar Pedido' : 'Confirmar Pedido'}</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
            </ScrollView>
          </TouchableWithoutFeedback>
        </GestureHandlerRootView>
      </KeyboardAvoidingView>

      {showDatePicker && (
        <DateTimePicker
          value={fecha}
          mode="date"
          display="default"
          onChange={onChangeFecha}
        />
      )}

      {showTimePicker && (
        <DateTimePicker
          value={new Date()}
          mode="time"
          is24Hour={false}
          display="default"
          onChange={onChangeHora}
        />
      )}

      {/* Modal Selección de Recetas */}
      <Modal visible={modalRecetas} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar Producto</Text>
              <TouchableOpacity onPress={() => setModalRecetas(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={recetasConPrecio}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.recetaItem} onPress={() => agregarProducto(item)}>
                  <View style={styles.recetaIcon}>
                    <Ionicons name="book-outline" size={20} color="#F59E0B" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recetaNombre}>{item.nombre}</Text>
                    <Text style={styles.recetaPrecio}>Venta: ${item.precioVenta.toFixed(2)}</Text>
                  </View>
                  <Ionicons name="add-circle-outline" size={24} color="#10B981" />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No hay recetas creadas aún.</Text>
              }
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f0f1a' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  backBtn: { padding: 8, marginRight: 8, backgroundColor: '#ffffff10', borderRadius: 12 },
  headerTitle: { flex: 1, fontSize: 22, fontWeight: '800', color: '#fff' },
  scroll: { paddingHorizontal: 20 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 12 },
  label: { fontSize: 13, color: '#888', fontWeight: '600', marginBottom: 8, marginTop: 10, textTransform: 'uppercase', letterSpacing: 1 },
  input: { backgroundColor: '#16213e', borderRadius: 16, padding: 16, color: '#fff', fontSize: 16, borderWidth: 1, borderColor: '#ffffff05' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  
  addProdBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F59E0B', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, gap: 4 },
  addProdBtnTxt: { color: '#000', fontWeight: '700', fontSize: 14 },
  
  prodCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#16213e', borderRadius: 20, padding: 16, marginBottom: 10 },
  prodInfo: { flex: 1 },
  prodNombre: { color: '#fff', fontSize: 16, fontWeight: '700' },
  prodSub: { color: '#F59E0B', fontSize: 12, marginTop: 2, fontWeight: '600' },
  prodActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qtyBtn: { backgroundColor: '#ffffff10', padding: 4, borderRadius: 8 },
  qtyTxt: { color: '#fff', fontSize: 16, fontWeight: '700', minWidth: 20, textAlign: 'center' },
  deleteBtn: { marginLeft: 4 },

  emptyCard: { backgroundColor: '#ffffff05', borderRadius: 20, padding: 20, alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#ffffff10' },
  emptyText: { color: '#444', fontSize: 14, textAlign: 'center' },

  dateTimeBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#16213e', borderRadius: 16, padding: 16, gap: 10, borderWidth: 1, borderColor: '#ffffff05' },
  dateTimeBtnTxt: { color: '#fff', fontSize: 16 },

  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 10 },
  costoInput: { color: '#F59E0B', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  helperText: { color: '#444', fontSize: 11, textAlign: 'center', marginTop: 4 },

  btnGuardar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F59E0B', borderRadius: 20, padding: 18, marginTop: 10, gap: 10, shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 5 },
  btnGuardarTxt: { color: '#000', fontWeight: '800', fontSize: 18 },

  modalOverlay: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#0f0f1a', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: '80%', borderWidth: 1, borderColor: '#ffffff10' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  closeBtn: { backgroundColor: '#ffffff10', borderRadius: 12, padding: 4 },
  recetaItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#ffffff05' },
  recetaIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F59E0B15', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  recetaNombre: { color: '#fff', fontSize: 16, fontWeight: '600' },
  recetaPrecio: { color: '#888', fontSize: 12, marginTop: 2 },
  deleteAction: { backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', width: 70, borderRadius: 20, marginBottom: 10, marginLeft: 8 },
});
