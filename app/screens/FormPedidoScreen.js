import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, StatusBar,
  TouchableOpacity, TextInput, ScrollView, Alert, Modal, FlatList,
  Switch, KeyboardAvoidingView, Platform, TouchableWithoutFeedback,
  Keyboard, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  addPedido, addProductoAPedido,
  updatePedido, deleteProductosByPedido, getProductosByPedido,
  getIngredientesByReceta,
} from '../database/db';
import { useApp } from '../contexts/AppContext';
import { calcularCostoIngrediente } from '../utils/conversions';
import LoadingOverlay from '../components/LoadingOverlay';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';

// ─── Constantes ────────────────────────────────────────────────
const STEPS = [
  { id: 0, title: 'Cliente', icon: 'person-outline' },
  { id: 1, title: 'Productos', icon: 'basket-outline' },
  { id: 2, title: 'Detalles', icon: 'color-palette-outline' },
  { id: 3, title: 'Entrega', icon: 'bicycle-outline' },
];

// ─── Componente principal ──────────────────────────────────────
export default function FormPedidoScreen({ navigation, route }) {
  const pedidoEditar = route.params?.pedido;

  const { recetasConPrecio, cargarPedidos, cargarEntregas } = useApp();

  // ── Wizard state ──
  const [step, setStep] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const prevStep = useRef(0);

  // ── Paso 1: Cliente ──
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');

  // ── Paso 2: Productos ──
  const [productosSeleccionados, setProductosSeleccionados] = useState([]);
  const [modalRecetas, setModalRecetas] = useState(false);
  const [costoTotal, setCostoTotal] = useState(0);

  // ── Paso 3: Detalles personalizados ──
  const [color, setColor] = useState('');
  const [relleno, setRelleno] = useState('');
  const [decoracion, setDecoracion] = useState('');

  // ── Paso 4: Entrega ──
  const [domicilio, setDomicilio] = useState(false);
  const [direccion, setDireccion] = useState('');
  const [fecha, setFecha] = useState(new Date());
  const [hora, setHora] = useState('');
  const [estado, setEstado] = useState('pendiente');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // ── Recalcular costo total ──
  useEffect(() => {
    const total = productosSeleccionados.reduce(
      (sum, p) => sum + (p.precioVenta || 0) * p.cantidad, 0
    );
    setCostoTotal(total);
  }, [productosSeleccionados]);

  // ── Cargar datos si es edición ──
  useEffect(() => {
    if (pedidoEditar) {
      cargarDatosPedido();
    }
  }, []);

  const cargarDatosPedido = async () => {
    setNombre(pedidoEditar.cliente_nombre);
    setTelefono(pedidoEditar.cliente_telefono || '');
    setDomicilio(pedidoEditar.domicilio === 1);
    setDireccion(pedidoEditar.direccion || '');

    // Parseo seguro de fecha (evita el bug de UTC)
    const [y, m, d] = pedidoEditar.fecha_entrega.split('-').map(Number);
    setFecha(new Date(y, m - 1, d));

    setHora(pedidoEditar.hora_entrega || '');
    setEstado(pedidoEditar.estado || 'pendiente');
    setColor(pedidoEditar.color || '');
    setRelleno(pedidoEditar.relleno || '');
    setDecoracion(pedidoEditar.decoracion || '');

    const prods = await getProductosByPedido(pedidoEditar.id);
    const prodsCompletos = await Promise.all(
      prods.map(async (p) => {
        const r = recetasConPrecio.find(rec => rec.id === p.receta_id);
        if (!r) return null;
        const ingredientes = await getIngredientesByReceta(p.receta_id);
        const costoMat = ingredientes.reduce(
          (sum, ing) => sum + calcularCostoIngrediente(ing), 0
        );
        const costoAdicional = costoMat * (r.porcentaje_costos_adicionales / 100);
        const costoTotalRec = costoMat + costoAdicional;
        const precioVenta = (costoTotalRec / r.unidades) * (1 + r.porcentaje_beneficio / 100);
        return { id: p.receta_id, nombre: p.receta_nombre, cantidad: p.cantidad, precioVenta };
      })
    );
    setProductosSeleccionados(prodsCompletos.filter(Boolean));
    setCostoTotal(pedidoEditar.costo_total);
  };

  // ─── Navegación entre pasos ────────────────────────────────
  const animateStep = (nextStep) => {
    const direction = nextStep > prevStep.current ? 1 : -1;
    slideAnim.setValue(direction * 300);
    prevStep.current = nextStep;
    setStep(nextStep);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  };

  const validateStep = () => {
    if (step === 0) {
      if (!nombre.trim()) {
        Alert.alert('Campo requerido', 'Ingresa el nombre del cliente.');
        return false;
      }
    }
    if (step === 1) {
      if (productosSeleccionados.length === 0) {
        Alert.alert('Sin productos', 'Agrega al menos un producto al pedido.');
        return false;
      }
    }
    return true;
  };

  const goNext = () => {
    if (!validateStep()) return;
    if (step < STEPS.length - 1) animateStep(step + 1);
  };

  const goBack = () => {
    if (step > 0) animateStep(step - 1);
    else navigation.goBack();
  };

  // ─── Guardar pedido ────────────────────────────────────────
  const guardar = async () => {
    if (!nombre.trim() || productosSeleccionados.length === 0) {
      Alert.alert('Faltan datos', 'Revisa cliente y productos.');
      return;
    }
    setGuardando(true);
    try {
      const fechaStr = [
        fecha.getFullYear(),
        String(fecha.getMonth() + 1).padStart(2, '0'),
        String(fecha.getDate()).padStart(2, '0'),
      ].join('-');

      let pedidoId = pedidoEditar?.id;

      if (pedidoEditar) {
        await updatePedido(
          pedidoId, nombre.trim(), telefono.trim(),
          domicilio ? 1 : 0, domicilio ? direccion.trim() : '',
          fechaStr, hora, costoTotal, estado,
          color.trim(), relleno.trim(), decoracion.trim()
        );
        await deleteProductosByPedido(pedidoId);
      } else {
        pedidoId = await addPedido(
          nombre.trim(), telefono.trim(),
          domicilio ? 1 : 0, domicilio ? direccion.trim() : '',
          fechaStr, hora, costoTotal, estado,
          color.trim(), relleno.trim(), decoracion.trim()
        );
      }

      for (const prod of productosSeleccionados) {
        await addProductoAPedido(pedidoId, prod.id, prod.cantidad);
      }

      Alert.alert(
        '¡Listo!',
        `Pedido ${pedidoEditar ? 'actualizado' : 'guardado'} correctamente.`,
        [{ text: 'OK', onPress: () => { cargarPedidos(); cargarEntregas(); navigation.goBack(); } }]
      );
    } catch {
      Alert.alert('Error', 'No se pudo guardar el pedido. Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  // ─── Productos ─────────────────────────────────────────────
  const agregarProducto = (receta) => {
    const existe = productosSeleccionados.find(p => p.id === receta.id);
    if (existe) {
      setProductosSeleccionados(prev =>
        prev.map(p => p.id === receta.id ? { ...p, cantidad: p.cantidad + 1 } : p)
      );
    } else {
      setProductosSeleccionados(prev => [
        ...prev,
        { id: receta.id, nombre: receta.nombre, cantidad: 1, precioVenta: receta.precioVenta },
      ]);
    }
    setModalRecetas(false);
  };

  const actualizarCantidad = (id, delta) => {
    setProductosSeleccionados(prev =>
      prev.map(p => p.id === id ? { ...p, cantidad: Math.max(1, p.cantidad + delta) } : p)
    );
  };

  const eliminarProducto = (id) => {
    setProductosSeleccionados(prev => prev.filter(p => p.id !== id));
  };

  // ─── Date / Time pickers ───────────────────────────────────
  const onChangeFecha = (_, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) setFecha(selectedDate);
  };

  const onChangeHora = (_, selectedTime) => {
    setShowTimePicker(false);
    if (selectedTime) {
      let h = selectedTime.getHours();
      const min = selectedTime.getMinutes();
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      setHora(`${h}:${String(min).padStart(2, '0')} ${ampm}`);
    }
  };

  const fechaLabel = `${String(fecha.getDate()).padStart(2, '0')}/${String(fecha.getMonth() + 1).padStart(2, '0')}/${fecha.getFullYear()}`;

  // ─── Render por paso ───────────────────────────────────────
  const renderStepContent = () => {
    switch (step) {
      case 0: return <StepCliente nombre={nombre} setNombre={setNombre} telefono={telefono} setTelefono={setTelefono} />;
      case 1: return (
        <StepProductos
          productosSeleccionados={productosSeleccionados}
          recetasConPrecio={recetasConPrecio}
          costoTotal={costoTotal}
          setCostoTotal={setCostoTotal}
          onAgregar={() => setModalRecetas(true)}
          onActualizarCantidad={actualizarCantidad}
          onEliminar={eliminarProducto}
        />
      );
      case 2: return (
        <StepDetalles
          color={color} setColor={setColor}
          relleno={relleno} setRelleno={setRelleno}
          decoracion={decoracion} setDecoracion={setDecoracion}
        />
      );
      case 3: return (
        <StepEntrega
          fecha={fecha} fechaLabel={fechaLabel}
          hora={hora}
          domicilio={domicilio} setDomicilio={setDomicilio}
          direccion={direccion} setDireccion={setDireccion}
          estado={estado} setEstado={setEstado}
          pedidoEditar={pedidoEditar}
          onPressFecha={() => setShowDatePicker(true)}
          onPressHora={() => setShowTimePicker(true)}
        />
      );
      default: return null;
    }
  };

  const isLastStep = step === STEPS.length - 1;

  // ─── UI ────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0f0f1a" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>
            {pedidoEditar ? 'Editar Pedido' : 'Nuevo Pedido'}
          </Text>
          <Text style={s.headerSub}>{STEPS[step].title}</Text>
        </View>
        {/* Indicador numérico */}
        <View style={s.stepBadge}>
          <Text style={s.stepBadgeTxt}>{step + 1}/{STEPS.length}</Text>
        </View>
      </View>

      {/* Stepper visual */}
      <StepperBar currentStep={step} />

      {/* Contenido animado */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <Animated.View style={[s.stepContent, { transform: [{ translateX: slideAnim }] }]}>
              <ScrollView
                contentContainerStyle={s.scroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {renderStepContent()}
                <View style={{ height: 20 }} />
              </ScrollView>
            </Animated.View>
          </TouchableWithoutFeedback>
        </GestureHandlerRootView>
      </KeyboardAvoidingView>

      {/* Barra de navegación fija abajo */}
      <NavBar
        step={step}
        isLastStep={isLastStep}
        onBack={goBack}
        onNext={goNext}
        onGuardar={guardar}
      />

      {/* Pickers */}
      <LoadingOverlay visible={guardando} message="Guardando pedido..." />
      {showDatePicker && (
        <DateTimePicker value={fecha} mode="date" display="default" onChange={onChangeFecha} />
      )}
      {showTimePicker && (
        <DateTimePicker value={new Date()} mode="time" is24Hour={false} display="default" onChange={onChangeHora} />
      )}

      {/* Modal productos */}
      <Modal visible={modalRecetas} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Agregar Producto</Text>
              <TouchableOpacity onPress={() => setModalRecetas(false)} style={s.closeBtn}>
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={recetasConPrecio}
              keyExtractor={item => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity style={s.recetaItem} onPress={() => agregarProducto(item)}>
                  <View style={s.recetaIcon}>
                    <Ionicons name="book-outline" size={20} color="#F59E0B" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.recetaNombre}>{item.nombre}</Text>
                    <Text style={s.recetaPrecio}>Precio venta: ${item.precioVenta.toFixed(2)}</Text>
                  </View>
                  <Ionicons name="add-circle-outline" size={24} color="#10B981" />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={s.emptyText}>No hay recetas disponibles.</Text>
              }
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── StepperBar ────────────────────────────────────────────────
function StepperBar({ currentStep }) {
  return (
    <View style={s.stepperContainer}>
      {STEPS.map((st, idx) => {
        const done = idx < currentStep;
        const active = idx === currentStep;
        return (
          <React.Fragment key={st.id}>
            <View style={s.stepItem}>
              <View style={[
                s.stepCircle,
                active && s.stepCircleActive,
                done && s.stepCircleDone,
              ]}>
                {done
                  ? <Ionicons name="checkmark" size={13} color="#000" />
                  : <Ionicons name={st.icon} size={14} color={active ? '#000' : '#555'} />
                }
              </View>
              <Text style={[s.stepLabel, active && s.stepLabelActive, done && s.stepLabelDone]}>
                {st.title}
              </Text>
            </View>
            {idx < STEPS.length - 1 && (
              <View style={[s.stepLine, done && s.stepLineDone]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

// ─── NavBar inferior ───────────────────────────────────────────
function NavBar({ step, isLastStep, onBack, onNext, onGuardar }) {
  return (
    <View style={s.navBar}>
      <TouchableOpacity style={s.navBtnSecondary} onPress={onBack}>
        <Ionicons name={step === 0 ? 'close' : 'arrow-back'} size={18} color="#aaa" />
        <Text style={s.navBtnSecondaryTxt}>{step === 0 ? 'Cancelar' : 'Atrás'}</Text>
      </TouchableOpacity>

      {isLastStep ? (
        <TouchableOpacity style={s.navBtnPrimary} onPress={onGuardar}>
          <Ionicons name="checkmark-circle-outline" size={20} color="#000" />
          <Text style={s.navBtnPrimaryTxt}>Confirmar Pedido</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={s.navBtnPrimary} onPress={onNext}>
          <Text style={s.navBtnPrimaryTxt}>Siguiente</Text>
          <Ionicons name="arrow-forward" size={18} color="#000" />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Paso 1: Cliente ───────────────────────────────────────────
function StepCliente({ nombre, setNombre, telefono, setTelefono }) {
  return (
    <View>
      <StepTitle icon="person-outline" title="Datos del cliente" subtitle="¿Quién hace el pedido?" />

      <Label text="Nombre completo *" />
      <TextInput
        style={s.input}
        placeholder="Ej: María García"
        placeholderTextColor="#444"
        value={nombre}
        onChangeText={setNombre}
        autoFocus
      />

      <Label text="Teléfono (opcional)" />
      <TextInput
        style={s.input}
        placeholder="Ej: +53 55 555 555"
        placeholderTextColor="#444"
        keyboardType="phone-pad"
        value={telefono}
        onChangeText={setTelefono}
      />
    </View>
  );
}

// ─── Paso 2: Productos ─────────────────────────────────────────
function StepProductos({
  productosSeleccionados, recetasConPrecio, costoTotal, setCostoTotal,
  onAgregar, onActualizarCantidad, onEliminar,
}) {
  return (
    <View>
      <StepTitle icon="basket-outline" title="Productos" subtitle="¿Qué va a pedir?" />

      <TouchableOpacity style={s.addProdBtn} onPress={onAgregar}>
        <Ionicons name="add-circle-outline" size={20} color="#F59E0B" />
        <Text style={s.addProdBtnTxt}>Agregar producto</Text>
      </TouchableOpacity>

      {productosSeleccionados.length === 0 ? (
        <View style={s.emptyCard}>
          <Ionicons name="basket-outline" size={36} color="#333" />
          <Text style={s.emptyCardTxt}>Sin productos aún</Text>
          <Text style={s.emptyCardSub}>Toca el botón de arriba para agregar</Text>
        </View>
      ) : (
        productosSeleccionados.map(item => (
          <Swipeable
            key={item.id}
            renderRightActions={() => (
              <TouchableOpacity style={s.deleteAction} onPress={() => onEliminar(item.id)}>
                <Ionicons name="trash-outline" size={22} color="#fff" />
              </TouchableOpacity>
            )}
          >
            <View style={s.prodCard}>
              <View style={s.prodInfo}>
                <Text style={s.prodNombre}>{item.nombre}</Text>
                <Text style={s.prodPrecio}>${(item.precioVenta || 0).toFixed(2)} c/u</Text>
              </View>
              <View style={s.qtyRow}>
                <TouchableOpacity style={s.qtyBtn} onPress={() => onActualizarCantidad(item.id, -1)}>
                  <Ionicons name="remove" size={16} color="#fff" />
                </TouchableOpacity>
                <Text style={s.qtyTxt}>{item.cantidad}</Text>
                <TouchableOpacity style={s.qtyBtn} onPress={() => onActualizarCantidad(item.id, 1)}>
                  <Ionicons name="add" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </Swipeable>
        ))
      )}

      {/* Total del pedido */}
      {productosSeleccionados.length > 0 && (
        <View style={s.totalBox}>
          <Text style={s.totalLabel}>Total calculado</Text>
          <TextInput
            style={s.totalInput}
            keyboardType="decimal-pad"
            value={String(costoTotal.toFixed(2))}
            onChangeText={v => setCostoTotal(parseFloat(v) || 0)}
          />
          <Text style={s.totalHint}>Puedes ajustarlo manualmente si lo necesitas</Text>
        </View>
      )}
    </View>
  );
}

// ─── Paso 3: Detalles personalizados ──────────────────────────
function StepDetalles({ color, setColor, relleno, setRelleno, decoracion, setDecoracion }) {
  return (
    <View>
      <StepTitle icon="color-palette-outline" title="Personalización" subtitle="Detalles del diseño del pedido" />

      <View style={s.row}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Label text="Color" />
          <TextInput style={s.input} placeholder="Ej: Azul pastel" placeholderTextColor="#444" value={color} onChangeText={setColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Label text="Relleno" />
          <TextInput style={s.input} placeholder="Ej: Nutella" placeholderTextColor="#444" value={relleno} onChangeText={setRelleno} />
        </View>
      </View>

      <Label text="Decoración" />
      <TextInput
        style={[s.input, { height: 90, textAlignVertical: 'top', paddingTop: 14 }]}
        placeholder="Ej: Flores de fondant, letras doradas..."
        placeholderTextColor="#444"
        multiline
        value={decoracion}
        onChangeText={setDecoracion}
      />

      {/* Indicador si el paso está vacío */}
      {!color && !relleno && !decoracion && (
        <View style={s.skipHint}>
          <Ionicons name="information-circle-outline" size={16} color="#555" />
          <Text style={s.skipHintTxt}>Este paso es opcional. Puedes continuar sin rellenar nada.</Text>
        </View>
      )}
    </View>
  );
}

// ─── Paso 4: Entrega ───────────────────────────────────────────
function StepEntrega({
  fecha, fechaLabel, hora,
  domicilio, setDomicilio, direccion, setDireccion,
  estado, setEstado, pedidoEditar,
  onPressFecha, onPressHora,
}) {
  return (
    <View>
      <StepTitle icon="bicycle-outline" title="Entrega" subtitle="¿Cuándo y cómo?" />

      <View style={s.row}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Label text="Fecha de entrega" />
          <TouchableOpacity style={s.dateBtn} onPress={onPressFecha}>
            <Ionicons name="calendar-outline" size={18} color="#F59E0B" />
            <Text style={s.dateBtnTxt}>{fechaLabel}</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1 }}>
          <Label text="Hora" />
          <TouchableOpacity style={s.dateBtn} onPress={onPressHora}>
            <Ionicons name="time-outline" size={18} color="#F59E0B" />
            <Text style={s.dateBtnTxt}>{hora || 'Seleccionar'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={s.switchRow}>
        <View>
          <Text style={s.switchLabel}>¿Envío a domicilio?</Text>
          <Text style={s.switchSub}>{domicilio ? 'Sí, se entrega en casa' : 'No, recoge en local'}</Text>
        </View>
        <Switch
          value={domicilio}
          onValueChange={setDomicilio}
          trackColor={{ false: '#16213e', true: '#F59E0B' }}
          thumbColor={domicilio ? '#fff' : '#888'}
        />
      </View>

      {domicilio && (
        <>
          <Label text="Dirección de entrega" />
          <TextInput
            style={[s.input, { height: 80, textAlignVertical: 'top', paddingTop: 14 }]}
            placeholder="Calle, número, referencias..."
            placeholderTextColor="#444"
            multiline
            value={direccion}
            onChangeText={setDireccion}
          />
        </>
      )}

      {pedidoEditar && (
        <View style={[s.switchRow, { marginTop: 20 }]}>
          <View>
            <Text style={s.switchLabel}>¿Pedido entregado?</Text>
            <Text style={s.switchSub}>Mueve el pedido a historial de entregas</Text>
          </View>
          <Switch
            value={estado === 'entregado'}
            onValueChange={val => setEstado(val ? 'entregado' : 'pendiente')}
            trackColor={{ false: '#16213e', true: '#10B981' }}
            thumbColor={estado === 'entregado' ? '#fff' : '#888'}
          />
        </View>
      )}
    </View>
  );
}

// ─── Helpers de UI ─────────────────────────────────────────────
function StepTitle({ icon, title, subtitle }) {
  return (
    <View style={s.stepTitleBox}>
      <View style={s.stepTitleIcon}>
        <Ionicons name={icon} size={24} color="#F59E0B" />
      </View>
      <View>
        <Text style={s.stepTitleText}>{title}</Text>
        <Text style={s.stepTitleSub}>{subtitle}</Text>
      </View>
    </View>
  );
}

function Label({ text }) {
  return <Text style={s.label}>{text}</Text>;
}

// ─── Estilos ───────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f0f1a' },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 12 },
  backBtn: { padding: 8, backgroundColor: '#ffffff10', borderRadius: 12 },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 12, color: '#F59E0B', fontWeight: '600', marginTop: 1 },
  stepBadge: { backgroundColor: '#F59E0B20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: '#F59E0B40' },
  stepBadgeTxt: { color: '#F59E0B', fontWeight: '800', fontSize: 13 },

  // Stepper
  stepperContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16 },
  stepItem: { alignItems: 'center', gap: 4 },
  stepCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#16213e', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#333' },
  stepCircleActive: { backgroundColor: '#F59E0B', borderColor: '#F59E0B' },
  stepCircleDone: { backgroundColor: '#10B981', borderColor: '#10B981' },
  stepLabel: { fontSize: 9, color: '#555', fontWeight: '700', textTransform: 'uppercase' },
  stepLabelActive: { color: '#F59E0B' },
  stepLabelDone: { color: '#10B981' },
  stepLine: { flex: 1, height: 1, backgroundColor: '#222', marginBottom: 14 },
  stepLineDone: { backgroundColor: '#10B981' },

  // Content
  stepContent: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },

  // Step title
  stepTitleBox: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24, backgroundColor: '#16213e', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#ffffff08' },
  stepTitleIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#F59E0B15', alignItems: 'center', justifyContent: 'center' },
  stepTitleText: { fontSize: 17, fontWeight: '800', color: '#fff' },
  stepTitleSub: { fontSize: 12, color: '#666', marginTop: 2 },

  // Form
  label: { fontSize: 12, color: '#888', fontWeight: '700', marginBottom: 8, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.8 },
  input: { backgroundColor: '#16213e', borderRadius: 16, padding: 16, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: '#ffffff08' },
  row: { flexDirection: 'row' },

  // Date buttons
  dateBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#16213e', borderRadius: 16, padding: 16, gap: 10, borderWidth: 1, borderColor: '#ffffff08' },
  dateBtnTxt: { color: '#fff', fontSize: 15 },

  // Switch
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#16213e', borderRadius: 18, padding: 16, marginTop: 16, borderWidth: 1, borderColor: '#ffffff08' },
  switchLabel: { color: '#fff', fontSize: 15, fontWeight: '700' },
  switchSub: { color: '#666', fontSize: 12, marginTop: 2 },

  // Productos
  addProdBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#F59E0B15', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F59E0B40', borderStyle: 'dashed', marginBottom: 16 },
  addProdBtnTxt: { color: '#F59E0B', fontWeight: '700', fontSize: 15 },
  prodCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#16213e', borderRadius: 18, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#ffffff08' },
  prodInfo: { flex: 1 },
  prodNombre: { color: '#fff', fontSize: 15, fontWeight: '700' },
  prodPrecio: { color: '#F59E0B', fontSize: 12, marginTop: 3, fontWeight: '600' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qtyBtn: { backgroundColor: '#ffffff10', padding: 6, borderRadius: 8 },
  qtyTxt: { color: '#fff', fontSize: 16, fontWeight: '700', minWidth: 22, textAlign: 'center' },
  deleteAction: { backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', width: 68, borderRadius: 18, marginBottom: 10, marginLeft: 8 },

  // Empty card
  emptyCard: { alignItems: 'center', backgroundColor: '#ffffff04', borderRadius: 20, padding: 32, borderWidth: 1, borderColor: '#ffffff08', borderStyle: 'dashed', gap: 8 },
  emptyCardTxt: { color: '#555', fontSize: 15, fontWeight: '700' },
  emptyCardSub: { color: '#444', fontSize: 13 },

  // Total
  totalBox: { marginTop: 20, backgroundColor: '#16213e', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#F59E0B30' },
  totalLabel: { color: '#888', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  totalInput: { color: '#F59E0B', fontSize: 28, fontWeight: '800', textAlign: 'center', paddingVertical: 4 },
  totalHint: { color: '#444', fontSize: 11, textAlign: 'center', marginTop: 6 },

  // Skip hint
  skipHint: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, backgroundColor: '#ffffff05', borderRadius: 12, padding: 14 },
  skipHintTxt: { color: '#555', fontSize: 13, flex: 1, lineHeight: 18 },

  // NavBar
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#ffffff08', backgroundColor: '#0f0f1a', gap: 12 },
  navBtnSecondary: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#ffffff08', borderRadius: 16 },
  navBtnSecondaryTxt: { color: '#aaa', fontWeight: '600', fontSize: 14 },
  navBtnPrimary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#F59E0B', borderRadius: 16, paddingVertical: 14 },
  navBtnPrimaryTxt: { color: '#000', fontWeight: '800', fontSize: 15 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#0f0f1a', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '80%', borderWidth: 1, borderColor: '#ffffff10' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  closeBtn: { backgroundColor: '#ffffff10', borderRadius: 10, padding: 4 },
  recetaItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#ffffff05' },
  recetaIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#F59E0B15', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  recetaNombre: { color: '#fff', fontSize: 15, fontWeight: '600' },
  recetaPrecio: { color: '#888', fontSize: 12, marginTop: 2 },
  emptyText: { color: '#555', textAlign: 'center', marginTop: 20, fontSize: 14 },
});