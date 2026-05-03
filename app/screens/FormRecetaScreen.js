import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, StatusBar,
  TouchableOpacity, TextInput, ScrollView, Alert, Modal, FlatList,
  KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard,
} from 'react-native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  getMateriales, addReceta, updateReceta,
  getIngredientesByReceta, addIngrediente, deleteIngredientesByReceta,
} from '../database/db';
import {
  UNIDADES,
  convertir,
  calcularCostoIngrediente,
  sonCompatibles,
  mensajeIncompatibilidad,
  TIPO_UNIDAD,
} from '../utils/conversions';

const EMPTY_FORM = {
  nombre: '',
  unidades: '',
  pct_adicionales: '',
  pct_beneficio: '',
};

export default function FormRecetaScreen({ navigation, route }) {
  const recetaExistente = route.params?.receta ?? null;

  const [form, setForm]                       = useState(EMPTY_FORM);
  const [ingredientes, setIngredientes]       = useState([]);
  const [resultado, setResultado]             = useState(null);
  const [modalMat, setModalMat]               = useState(false);
  const [modalCant, setModalCant]             = useState(false);
  const [matSeleccionado, setMatSeleccionado] = useState(null);
  const [cantidadInput, setCantidadInput]     = useState('');
  const [unidadSeleccionada, setUnidadSeleccionada] = useState('');
  const [modalResult, setModalResult]         = useState(false);
  const [todosMateriales, setTodosMateriales] = useState([]);
  const [errorUnidad, setErrorUnidad]         = useState('');
  // ─── Real-time Calculation ──────────────────────────────────
  useEffect(() => {
    const unidades = parseFloat(form.unidades);
    if (!unidades || unidades <= 0 || ingredientes.length === 0) {
      setResultado(null);
      return;
    }

    const pctAd  = parseFloat(form.pct_adicionales)  || 0;
    const pctBen = parseFloat(form.pct_beneficio) || 0;

    const costoMateriales = ingredientes.reduce((total, ing) => {
      return total + calcularCostoIngrediente(ing);
    }, 0);

    const costoAdicionales = costoMateriales * (pctAd / 100);
    const costoTotal       = costoMateriales + costoAdicionales;
    const costoUnitario    = costoTotal / unidades;
    const valorVentaUnit   = costoUnitario * (1 + pctBen / 100);
    const ingresosTotales  = valorVentaUnit * unidades;
    const gananciaTotal    = ingresosTotales - costoTotal;
    const gananciaUnitario = valorVentaUnit - costoUnitario;

    setResultado({ 
      costoMateriales, 
      costoAdicionales, 
      costoTotal, 
      costoUnitario, 
      valorVentaUnit, 
      ingresosTotales,
      gananciaTotal,
      gananciaUnitario,
      pctAd,
      pctBen
    });
  }, [form.unidades, form.pct_adicionales, form.pct_beneficio, ingredientes]);

  useEffect(() => {
    const cargar = async () => {
      const mats = await getMateriales();
      setTodosMateriales(mats);

      if (recetaExistente) {
        // Cargar datos del formulario
        setForm({
          nombre:          recetaExistente.nombre,
          unidades:        String(recetaExistente.unidades),
          pct_adicionales: String(recetaExistente.porcentaje_costos_adicionales),
          pct_beneficio:   String(recetaExistente.porcentaje_beneficio),
        });

        // Cargar ingredientes
        const ings = await getIngredientesByReceta(recetaExistente.id);
        const ingsData = ings.map((i) => ({
          material_id: i.material_id,
          nombre:      i.nombre,
          unidad:      i.unidad_receta || i.unidad_base,
          unidad_base: i.unidad_base,
          precio:      i.precio,
          contenido:   i.contenido,
          cantidad:    i.cantidad,
        }));
        setIngredientes(ingsData);
      }
    };
    cargar();
  }, []);


  const seleccionarMaterial = (mat) => {
    if (ingredientes.find((i) => i.material_id === mat.id)) {
      Alert.alert('Ya agregado', 'Este material ya está en la receta.');
      return;
    }
    setMatSeleccionado(mat);
    setCantidadInput('');
    setUnidadSeleccionada(mat.unidad);
    setErrorUnidad(''); // limpiamos error previo
    setModalMat(false);
    setModalCant(true);
  };

  const confirmarCantidad = () => {
    if (!cantidadInput || isNaN(cantidadInput) || parseFloat(cantidadInput) <= 0) {
      Alert.alert('Cantidad inválida', 'Ingresa una cantidad mayor a 0.');
      return;
    }

    if (!sonCompatibles(matSeleccionado?.unidad, unidadSeleccionada)) {
      Alert.alert(
        'Unidades incompatibles',
        mensajeIncompatibilidad(matSeleccionado.unidad, unidadSeleccionada)
      );
      return;
    }

    setIngredientes([
      ...ingredientes,
      {
        material_id: matSeleccionado.id,
        nombre:      matSeleccionado.nombre,
        unidad:      unidadSeleccionada,
        unidad_base: matSeleccionado.unidad,
        precio:      matSeleccionado.precio,
        contenido:   matSeleccionado.contenido,
        cantidad:    parseFloat(cantidadInput),
      },
    ]);
    setErrorUnidad('');
    setModalCant(false);
  };

  const quitarIngrediente = (material_id) => {
    setIngredientes(ingredientes.filter((i) => i.material_id !== material_id));
  };


  const guardar = async () => {
    if (!form.nombre.trim()) {
      Alert.alert('Falta nombre', 'Escribe el nombre de la receta.');
      return;
    }
    if (!resultado) {
      Alert.alert('Incompleto', 'Agrega ingredientes y unidades para calcular el costo.');
      return;
    }

    const { nombre, unidades, pct_adicionales, pct_beneficio } = form;

    try {
      if (recetaExistente) {
        // Actualizar datos de la receta
        await updateReceta(
          recetaExistente.id,
          nombre.trim(),
          parseFloat(unidades),
          parseFloat(pct_adicionales) || 0,
          parseFloat(pct_beneficio) || 0
        );

        // Borrar ingredientes viejos
        await deleteIngredientesByReceta(recetaExistente.id);

        // Guardar ingredientes nuevos/actualizados
        for (const ing of ingredientes) {
          await addIngrediente(
            recetaExistente.id,
            ing.material_id,
            ing.cantidad,
            ing.unidad
          );
        }
      } else {
        // Crear receta nueva
        const newId = await addReceta(
          nombre.trim(),
          parseFloat(unidades),
          parseFloat(pct_adicionales) || 0,
          parseFloat(pct_beneficio) || 0
        );

        // Guardar sus ingredientes
        for (const ing of ingredientes) {
          await addIngrediente(
            newId,
            ing.material_id,
            ing.cantidad,
            ing.unidad
          );
        }
      }

      Alert.alert(
        'Éxito',
        `Receta ${recetaExistente ? 'actualizada' : 'guardada'} correctamente.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Error al guardar receta:', error);
      Alert.alert('Error', 'No se pudo guardar la receta. Intenta de nuevo.');
    }
  };

  const costoIngrediente = (ing) => calcularCostoIngrediente(ing);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {recetaExistente ? 'Editar receta' : 'Nueva receta'}
        </Text>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

              <Text style={styles.label}>Nombre de la receta</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: Torta de chocolate"
                placeholderTextColor="#555"
                value={form.nombre}
                onChangeText={(v) => { setForm({ ...form, nombre: v }); }}
              />

              <Text style={styles.label}>Unidades que rinde</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: 12"
                placeholderTextColor="#555"
                keyboardType="decimal-pad"
                value={form.unidades}
                onChangeText={(v) => { setForm({ ...form, unidades: v }); }}
              />

              <View style={styles.seccionHeader}>
                <Text style={styles.seccionTitulo}>Materiales (Desliza para eliminar)</Text>
                <TouchableOpacity style={styles.btnAgregarMat} onPress={() => setModalMat(true)}>
                  <Ionicons name="add" size={18} color="#000" />
                  <Text style={styles.btnAgregarMatTxt}>Agregar</Text>
                </TouchableOpacity>
              </View>

              {ingredientes.length === 0 ? (
                <View style={styles.emptyIng}>
                  <Text style={styles.emptyIngTxt}>Sin materiales agregados</Text>
                </View>
              ) : (
                ingredientes.map((ing) => (
                  <Swipeable
                    key={ing.material_id}
                    renderRightActions={() => (
                      <TouchableOpacity 
                        style={styles.deleteAction} 
                        onPress={() => quitarIngrediente(ing.material_id)}
                      >
                        <Ionicons name="trash-outline" size={24} color="#fff" />
                      </TouchableOpacity>
                    )}
                  >
                    <View style={styles.ingCard}>
                      <View style={styles.ingInfo}>
                        <Text style={styles.ingNombre}>{ing.nombre}</Text>
                        <Text style={styles.ingDetalle}>
                          {ing.cantidad} {ing.unidad}  ·  ${costoIngrediente(ing).toFixed(4)}
                        </Text>
                      </View>
                      <Ionicons name="reorder-two-outline" size={20} color="#333" />
                    </View>
                  </Swipeable>
                ))
              )}

              <Text style={styles.label}>% Costos adicionales (mano de obra, electricidad, gas…)</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: 20"
                placeholderTextColor="#555"
                keyboardType="decimal-pad"
                value={form.pct_adicionales}
                onChangeText={(v) => { setForm({ ...form, pct_adicionales: v }); }}
              />

              <Text style={styles.label}>% Beneficio esperado</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: 30"
                placeholderTextColor="#555"
                keyboardType="decimal-pad"
                value={form.pct_beneficio}
                onChangeText={(v) => { setForm({ ...form, pct_beneficio: v }); }}
              />

              {resultado && (
                <View style={styles.liveResultBox}>
                  <View style={styles.liveResultHeader}>
                    <Ionicons name="trending-up" size={18} color="#10B981" />
                    <Text style={styles.liveResultTitle}>Resumen de Costos</Text>
                  </View>
                  <View style={styles.liveResultGrid}>
                    <View style={styles.liveResItem}>
                      <Text style={styles.liveResLabel}>Costo Unitario</Text>
                      <Text style={styles.liveResValue}>${resultado.costoUnitario.toFixed(2)}</Text>
                    </View>
                    <View style={styles.liveResItem}>
                      <Text style={styles.liveResLabel}>Venta Sugerida</Text>
                      <Text style={[styles.liveResValue, { color: '#10B981' }]}>${resultado.valorVentaUnit.toFixed(2)}</Text>
                    </View>
                    <View style={styles.liveResItem}>
                      <Text style={styles.liveResLabel}>Ganancia / un.</Text>
                      <Text style={styles.liveResValue}>+${resultado.gananciaUnitario.toFixed(2)}</Text>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.btnVerDetalle} onPress={() => setModalResult(true)}>
                    <Text style={styles.btnVerDetalleTxt}>Ver análisis detallado</Text>
                    <Ionicons name="chevron-forward" size={14} color="#F59E0B" />
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity style={styles.btnGuardarMain} onPress={guardar}>
                <Ionicons name="save" size={22} color="#000" />
                <Text style={styles.btnGuardarMainTxt}>{recetaExistente ? 'Actualizar' : 'Guardar'} Receta</Text>
              </TouchableOpacity>

              <View style={{ height: 40 }} />
            </ScrollView>
          </TouchableWithoutFeedback>
        </GestureHandlerRootView>
      </KeyboardAvoidingView>

      <Modal visible={modalResult} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="stats-chart" size={20} color="#F59E0B" />
                <Text style={styles.modalTitulo}>Análisis de la Receta</Text>
              </View>
              <TouchableOpacity onPress={() => setModalResult(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.resultadoGrid}>
                <View style={styles.resCard}>
                  <Text style={styles.resLabel}>Costo Materiales</Text>
                  <Text style={styles.resValue}>${resultado?.costoMateriales.toFixed(2)}</Text>
                </View>
                <View style={styles.resCard}>
                  <Text style={styles.resLabel}>Costos Adic. ({resultado?.pctAd}%)</Text>
                  <Text style={styles.resValue}>${resultado?.costoAdicionales.toFixed(2)}</Text>
                </View>
              </View>

              <View style={[styles.resCardLarge, { borderLeftColor: '#F59E0B' }]}>
                <View style={styles.resRow}>
                  <Text style={styles.resLabelLarge}>COSTO TOTAL RECETA</Text>
                  <Text style={styles.resValueLarge}>${resultado?.costoTotal.toFixed(2)}</Text>
                </View>
                <View style={styles.resRow}>
                  <Text style={styles.resLabelSmall}>Costo unitario ({form.unidades} un.)</Text>
                  <Text style={styles.resValueSmall}>${resultado?.costoUnitario.toFixed(2)}</Text>
                </View>
              </View>

              <View style={[styles.resCardLarge, { borderLeftColor: '#10B981', marginTop: 12 }]}>
                <View style={styles.resRow}>
                  <Text style={[styles.resLabelLarge, { color: '#10B981' }]}>VENTA UNITARIA RECOM.</Text>
                  <Text style={[styles.resValueLarge, { color: '#10B981' }]}>${resultado?.valorVentaUnit.toFixed(2)}</Text>
                </View>
                <View style={styles.resRow}>
                  <Text style={styles.resLabelSmall}>Ingresos totales proyectados</Text>
                  <Text style={styles.resValueSmall}>${resultado?.ingresosTotales.toFixed(2)}</Text>
                </View>
              </View>

              <View style={styles.gananciaBox}>
                <View style={styles.gananciaRow}>
                  <View style={styles.gananciaItem}>
                    <Text style={styles.gananciaLabel}>Ganancia por unidad</Text>
                    <Text style={styles.gananciaValue}>+ ${resultado?.gananciaUnitario.toFixed(2)}</Text>
                  </View>
                  <View style={styles.gananciaItem}>
                    <Text style={styles.gananciaLabel}>Ganancia total</Text>
                    <Text style={[styles.gananciaValue, { fontSize: 18 }]}>+ ${resultado?.gananciaTotal.toFixed(2)}</Text>
                  </View>
                </View>
                <View style={styles.margenBadge}>
                  <Text style={styles.margenText}>Margen de beneficio: {resultado?.pctBen}%</Text>
                </View>
              </View>

              <TouchableOpacity style={styles.btnGuardar} onPress={guardar}>
                <Ionicons name="save" size={20} color="#000" />
                <Text style={styles.btnGuardarTxt}>
                  {recetaExistente ? 'Actualizar receta' : 'Guardar receta'}
                </Text>
              </TouchableOpacity>
              
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal seleccionar material */}
      <Modal visible={modalMat} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitulo}>Seleccionar material</Text>
              <TouchableOpacity onPress={() => setModalMat(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            {todosMateriales.length === 0 ? (
              <Text style={styles.emptyIngTxt}>
                No tienes materiales. Agrega primero en el módulo Materiales.
              </Text>
            ) : (
              <FlatList
                data={todosMateriales}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => {
                  const yaAgregado = ingredientes.find((i) => i.material_id === item.id);
                  return (
                    <TouchableOpacity
                      style={[styles.matItem, yaAgregado && styles.matItemUsado]}
                      onPress={() => seleccionarMaterial(item)}
                      disabled={!!yaAgregado}
                    >
                      <Text style={[styles.matItemNombre, yaAgregado && { color: '#555' }]}>
                        {item.nombre}
                      </Text>
                      <Text style={styles.matItemDetalle}>
                        {item.contenido} {item.unidad}  ·  ${item.precio}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Modal cantidad */}
      <Modal visible={modalCant} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { paddingBottom: 24 }]}>
            <Text style={styles.modalTitulo}>
              Cantidad de {matSeleccionado?.nombre}
            </Text>
            <View style={styles.unidadInfoBox}>
              <Ionicons name="information-circle-outline" size={16} color="#F59E0B" />
              <Text style={styles.unidadInfoTxt}>
                Material registrado en <Text style={styles.unidadInfoDestacado}>{matSeleccionado?.unidad}</Text>. 
                Puedes usar otra unidad y el costo se calculará automáticamente.
              </Text>
            </View>

            <Text style={styles.label}>Cantidad a usar</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: 500"
              placeholderTextColor="#555"
              keyboardType="decimal-pad"
              value={cantidadInput}
              onChangeText={setCantidadInput}
              autoFocus
            />

            <Text style={styles.label}>Unidad de medida en la receta</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
              {UNIDADES.map((u) => {
                const compatible = sonCompatibles(matSeleccionado?.unidad, u);
                return (
                  <TouchableOpacity
                    key={u}
                    style={[
                      styles.unidadBadge,
                      unidadSeleccionada === u
                        ? styles.unidadBadgeActive
                        : styles.unidadBadgeInactive,
                      !compatible && styles.unidadBadgeIncompatible, // estilo rojo si incompatible
                    ]}
                    onPress={() => {
                      setUnidadSeleccionada(u);
                      if (!compatible) {
                        setErrorUnidad(mensajeIncompatibilidad(matSeleccionado.unidad, u));
                      } else {
                        setErrorUnidad('');
                      }
                    }}
                  >
                    <Text style={[
                      styles.unidadBadgeTxt,
                      unidadSeleccionada === u && { color: '#000' },
                      !compatible && { color: '#EF4444' },
                    ]}>
                      {u}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Mensaje de error de compatibilidad */}
            {errorUnidad ? (
              <View style={styles.errorBox}>
                <Ionicons name="warning-outline" size={16} color="#EF4444" />
                <Text style={styles.errorTxt}>{errorUnidad}</Text>
              </View>
            ) : null}

            {cantidadInput && !isNaN(cantidadInput) && parseFloat(cantidadInput) > 0 && matSeleccionado && (
              <View style={styles.previewCosto}>
                <Text style={styles.previewLbl}>Costo para {cantidadInput} {unidadSeleccionada}:</Text>
                <Text style={styles.previewVal}>
                  ${costoIngrediente({
                    ...matSeleccionado,
                    cantidad: parseFloat(cantidadInput),
                    unidad: unidadSeleccionada,
                    unidad_base: matSeleccionado.unidad
                  }).toFixed(4)}
                </Text>
              </View>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnCancelar} onPress={() => setModalCant(false)}>
                <Text style={styles.btnCancelarTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnConfirmar} onPress={confirmarCantidad}>
                <Text style={styles.btnConfirmarTxt}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:                { flex: 1, backgroundColor: '#1a1a2e' },
  header:              { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  backBtn:             { padding: 4, marginRight: 8 },
  headerTitle:         { flex: 1, fontSize: 22, fontWeight: '700', color: '#fff' },
  scroll:              { paddingHorizontal: 16, paddingTop: 8 },
  label:               { fontSize: 13, color: '#aaa', marginBottom: 6, marginTop: 16 },
  input:               { backgroundColor: '#16213e', borderRadius: 10, padding: 12, color: '#fff', fontSize: 15 },
  seccionHeader:       { flexDirection: 'row', alignItems: 'center', marginTop: 20, marginBottom: 10 },
  seccionTitulo:       { flex: 1, fontSize: 15, fontWeight: '700', color: '#fff' },
  btnAgregarMat:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B981', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, gap: 4 },
  btnAgregarMatTxt:    { color: '#000', fontWeight: '700', fontSize: 13 },
  emptyIng:            { backgroundColor: '#16213e', borderRadius: 10, padding: 16, alignItems: 'center' },
  emptyIngTxt:         { color: '#555', fontSize: 14 },
  ingCard:             { flexDirection: 'row', alignItems: 'center', backgroundColor: '#16213e', borderRadius: 10, padding: 12, marginBottom: 8 },
  ingInfo:             { flex: 1 },
  ingNombre:           { color: '#fff', fontWeight: '600', fontSize: 14 },
  ingDetalle:          { color: '#aaa', fontSize: 12, marginTop: 2 },
  btnCalcular:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F59E0B', borderRadius: 14, padding: 16, marginTop: 24, gap: 8 },
  btnCalcularTxt:      { color: '#000', fontWeight: '800', fontSize: 16 },
  resultadoBox:        { backgroundColor: '#16213e', borderRadius: 20, padding: 20, marginTop: 24, borderWidth: 1, borderColor: '#0f3460' },
  resultadoHeader:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  resultadoTitulo:     { fontSize: 18, fontWeight: '800', color: '#fff' },
  resultadoGrid:       { flexDirection: 'row', gap: 12, marginBottom: 12 },
  resCard:             { flex: 1, backgroundColor: '#0f3460', padding: 12, borderRadius: 12 },
  resLabel:            { fontSize: 11, color: '#aaa', marginBottom: 4, textTransform: 'uppercase' },
  resValue:            { fontSize: 15, fontWeight: '700', color: '#fff' },
  resCardLarge:        { backgroundColor: '#0f3460', padding: 16, borderRadius: 12, borderLeftWidth: 4 },
  resRow:              { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resLabelLarge:       { fontSize: 13, fontWeight: '700', color: '#aaa' },
  resValueLarge:       { fontSize: 20, fontWeight: '800', color: '#fff' },
  resLabelSmall:       { fontSize: 12, color: '#888', marginTop: 4 },
  resValueSmall:       { fontSize: 13, fontWeight: '600', color: '#ccc' },
  gananciaBox:         { backgroundColor: '#10B98115', borderRadius: 14, padding: 16, marginTop: 16, borderStyle: 'dashed', borderWidth: 1, borderColor: '#10B98155' },
  gananciaRow:         { flexDirection: 'row', justifyContent: 'space-between' },
  gananciaItem:        { flex: 1 },
  gananciaLabel:       { fontSize: 12, color: '#10B981', fontWeight: '600' },
  gananciaValue:       { fontSize: 16, fontWeight: '800', color: '#10B981', marginTop: 2 },
  margenBadge:         { alignSelf: 'flex-start', backgroundColor: '#10B981', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginTop: 10 },
  margenText:          { fontSize: 10, fontWeight: '800', color: '#000' },
  btnGuardar:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#10B981', borderRadius: 14, padding: 16, marginTop: 20, gap: 8 },
  btnGuardarTxt:       { color: '#000', fontWeight: '800', fontSize: 16 },
  modalOverlay:        { flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end' },
  modalBox:            { backgroundColor: '#16213e', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '75%' },
  modalHeader:         { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  modalTitulo:         { flex: 1, fontSize: 18, fontWeight: '700', color: '#fff' },
  matItem:             { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#0f3460' },
  matItemUsado:        { opacity: 0.4 },
  matItemNombre:       { color: '#fff', fontSize: 15, fontWeight: '600' },
  matItemDetalle:      { color: '#888', fontSize: 12, marginTop: 2 },
  modalActions:        { flexDirection: 'row', gap: 12, marginTop: 16 },
  btnCancelar:         { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#0f3460', alignItems: 'center' },
  btnCancelarTxt:      { color: '#aaa', fontWeight: '600' },
  btnConfirmar:        { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#10B981', alignItems: 'center' },
  btnConfirmarTxt:     { color: '#000', fontWeight: '700' },
  unidadInfoBox:       { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#F59E0B18', borderRadius: 10, padding: 10, marginTop: 10, gap: 8 },
  unidadInfoTxt:       { flex: 1, color: '#aaa', fontSize: 13, lineHeight: 18 },
  unidadInfoDestacado: { color: '#F59E0B', fontWeight: '700' },
  inputUnidadRow:      { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  unidadBadge:         { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginRight: 8 },
  unidadBadgeActive:   { backgroundColor: '#F59E0B' },
  unidadBadgeInactive: { backgroundColor: '#0f3460' },
  unidadBadgeTxt:      { color: '#aaa', fontWeight: '800', fontSize: 13 },
  previewCosto:        { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#0f3460', borderRadius: 10, padding: 12, marginTop: 12 },
  previewLbl:          { color: '#aaa', fontSize: 13 },
  previewVal:          { color: '#10B981', fontWeight: '700', fontSize: 13 },
  unidadBadgeIncompatible: { borderWidth: 1, borderColor: '#EF4444', opacity: 0.6, },
  errorBox:            { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#EF444415', borderRadius: 10, padding: 10, marginTop: 10, },
  errorTxt:            { flex: 1, color: '#EF4444', fontSize: 12, lineHeight: 18, },
  deleteAction:        { backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', width: 70, borderRadius: 10, marginBottom: 8, marginLeft: 8 },
  liveResultBox:       { backgroundColor: '#16213e', borderRadius: 20, padding: 16, marginTop: 24, borderWidth: 1, borderColor: '#10B98133', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  liveResultHeader:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  liveResultTitle:     { color: '#fff', fontSize: 14, fontWeight: '700' },
  liveResultGrid:      { flexDirection: 'row', justifyContent: 'space-between' },
  liveResItem:         { alignItems: 'center' },
  liveResLabel:        { color: '#888', fontSize: 11, marginBottom: 4 },
  liveResValue:        { color: '#fff', fontSize: 16, fontWeight: '800' },
  btnVerDetalle:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12, borderTopWidth: 1, borderTopColor: '#ffffff05', paddingTop: 10, gap: 4 },
  btnVerDetalleTxt:    { color: '#F59E0B', fontSize: 12, fontWeight: '600' },
  btnGuardarMain:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F59E0B', borderRadius: 16, padding: 18, marginTop: 24, gap: 10 },
  btnGuardarMainTxt:   { color: '#000', fontWeight: '800', fontSize: 18 },
});