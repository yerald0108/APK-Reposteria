import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, StatusBar,
  TouchableOpacity, FlatList, TextInput, Alert,
  Modal, KeyboardAvoidingView, Platform, ScrollView,
  Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { addMaterial, updateMaterial, deleteMaterial, getHistorialPrecios } from '../database/db';
import { useApp } from '../contexts/AppContext';
import { UNIDADES } from '../utils/conversions';
import { validarMaterial } from '../utils/validaciones';
import Skeleton from '../components/Skeleton';

const EMPTY_FORM = { nombre: '', precio: '', contenido: '', unidad: 'g' };

export default function MaterialesScreen({ navigation }) {
  const { materiales, cargarMateriales, cargandoMateriales } = useApp();
  const [busqueda, setBusqueda] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [historialModal, setHistorialModal] = useState(false);
  const [historialData, setHistorialData] = useState([]);
  const [materialSeleccionado, setMaterialSeleccionado] = useState(null);

  const scrollY = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      cargarMateriales();
    }, [])
  );

  const onBuscar = (texto) => {
    setBusqueda(texto);
  };

  const abrirAgregar = () => {
    setEditando(null);
    setForm(EMPTY_FORM);
    setModalVisible(true);
  };

  const abrirEditar = (item) => {
    setEditando(item);
    setForm({
      nombre: item.nombre,
      precio: parseFloat(item.precio).toString(),
      contenido: parseFloat(item.contenido).toString(),
      unidad: item.unidad,
    });
    setModalVisible(true);
  };

  const abrirHistorial = async (item) => {
    setMaterialSeleccionado(item);
    try {
      const history = await getHistorialPrecios(item.id);
      setHistorialData(history);
      setHistorialModal(true);
    } catch (error) {
      Alert.alert('Error', 'No se pudo cargar el historial.');
    }
  };

  const guardar = async () => {
    const error = validarMaterial(form);
    if (error) {
      Alert.alert('Datos inválidos', error);
      return;
    }

    const { nombre, precio, contenido, unidad } = form;
    try {
      if (editando) {
        await updateMaterial(
          editando.id,
          nombre.trim(),
          parseFloat(precio),
          parseFloat(contenido),
          unidad
        );
      } else {
        await addMaterial(
          nombre.trim(),
          parseFloat(precio),
          parseFloat(contenido),
          unidad
        );
      }
      setModalVisible(false);
      cargarMateriales();
    } catch (error) {
      Alert.alert('Error', error.message || 'Ocurrió un error inesperado.');
    }
  };

  const confirmarEliminar = (item) => {
    Alert.alert(
      'Eliminar material',
      `¿Eliminar "${item.nombre}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive',
          onPress: async () => {
            try {
              await deleteMaterial(item.id);
              cargarMateriales(); // recarga el contexto global
            } catch (error) {
              Alert.alert('Error', error.message || 'Ocurrió un error inesperado.');
            }
          }
        },
      ]
    );
  };

  const renderSkeleton = () => (
    <View style={styles.card}>
      <View style={[styles.cardColorBar, { backgroundColor: '#16213e' }]} />
      <View style={styles.cardContent}>
        <View style={styles.cardInfo}>
          <Skeleton width="70%" height={20} style={{ marginBottom: 8 }} />
          <View style={styles.cardDetailRow}>
            <Skeleton width="20%" height={12} />
            <Skeleton width="20%" height={12} />
          </View>
          <Skeleton width="30%" height={14} style={{ marginTop: 10 }} />
        </View>
      </View>
    </View>
  );

  const renderItem = ({ item, index }) => {
    const scale = scrollY.interpolate({
      inputRange: [-1, 0, (index * 100), (index + 2) * 100],
      outputRange: [1, 1, 1, 0],
    });
    const opacity = scrollY.interpolate({
      inputRange: [-1, 0, (index * 100), (index + 2) * 100],
      outputRange: [1, 1, 1, 0],
    });

    return (
      <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
        <View style={[styles.cardColorBar, { backgroundColor: '#F59E0B' }]} />
        <View style={styles.cardContent}>
          <View style={styles.cardInfo}>
            <Text style={styles.cardNombre}>{item.nombre}</Text>
            <View style={styles.cardDetailRow}>
              <Ionicons name="cube-outline" size={12} color="#888" />
              <Text style={styles.cardDetalle}>
                {parseFloat(item.contenido)} {item.unidad}
              </Text>
              <View style={styles.dot} />
              <Ionicons name="pricetag-outline" size={12} color="#888" />
              <Text style={styles.cardDetalle}>${parseFloat(item.precio).toFixed(2)}</Text>
            </View>
            <Text style={styles.cardPrecioUnit}>
              ${(item.precio / item.contenido).toFixed(2)} / {item.unidad}
            </Text>
          </View>
          <View style={styles.cardActions}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => abrirHistorial(item)}>
              <Ionicons name="time-outline" size={18} color="#10B981" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => abrirEditar(item)}>
              <Ionicons name="pencil" size={18} color="#F59E0B" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={() => confirmarEliminar(item)}>
              <Ionicons name="trash" size={18} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0f0f1a" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Materiales</Text>
        <TouchableOpacity style={styles.addBtn} onPress={abrirAgregar}>
          <Ionicons name="add" size={26} color="#000" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color="#666" style={{ marginRight: 10 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar material..."
            placeholderTextColor="#666"
            value={busqueda}
            onChangeText={onBuscar}
          />
          {busqueda.length > 0 && (
            <TouchableOpacity onPress={() => onBuscar('')}>
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Animated.FlatList
        data={
          cargandoMateriales
          ? [1, 2, 3, 4, 5, 6] // Dummy data for skeletons
          : (busqueda.trim()
            ? materiales.filter(m =>
                m.nombre.toLowerCase().includes(busqueda.toLowerCase())
              )
            : materiales)
        }
        keyExtractor={(item, index) => cargandoMateriales ? `sk-${index}` : String(item.id)}
        renderItem={cargandoMateriales ? renderSkeleton : renderItem}
        contentContainerStyle={styles.listContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="cube" size={64} color="#16213e" />
            </View>
            <Text style={styles.emptyTitle}>
              {busqueda ? 'No hay resultados' : 'Sin materiales'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {busqueda ? 'Prueba con otra palabra clave' : 'Comienza agregando los ingredientes de tu repostería'}
            </Text>
          </View>
        }
      />

      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editando ? 'Editar Material' : 'Nuevo Material'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeModalBtn}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Nombre del material</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: Harina de trigo"
                placeholderTextColor="#444"
                value={form.nombre}
                onChangeText={(v) => setForm({ ...form, nombre: v })}
              />

              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={styles.label}>Precio ($)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0.00"
                    placeholderTextColor="#444"
                    keyboardType="decimal-pad"
                    value={form.precio}
                    onChangeText={(v) => setForm({ ...form, precio: v })}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Contenido</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="1000"
                    placeholderTextColor="#444"
                    keyboardType="decimal-pad"
                    value={form.contenido}
                    onChangeText={(v) => setForm({ ...form, contenido: v })}
                  />
                </View>
              </View>

              <Text style={styles.label}>Unidad de medida</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                {UNIDADES.map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={[styles.unidadBtn, form.unidad === u && styles.unidadBtnActive]}
                    onPress={() => setForm({ ...form, unidad: u })}
                  >
                    <Text style={[styles.unidadTxt, form.unidad === u && styles.unidadTxtActive]}>
                      {u}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity style={styles.btnGuardar} onPress={guardar}>
                <Text style={styles.btnGuardarTxt}>
                  {editando ? 'Actualizar Material' : 'Guardar Material'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={historialModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Historial de Precios</Text>
                <Text style={{ color: '#F59E0B', fontWeight: '700' }}>{materialSeleccionado?.nombre}</Text>
              </View>
              <TouchableOpacity onPress={() => setHistorialModal(false)} style={styles.closeModalBtn}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={historialData}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item, index }) => {
                const previo = historialData[index + 1];
                const subio = previo ? item.precio > previo.precio : null;
                return (
                  <View style={styles.historyItem}>
                    <View style={styles.historyDateBox}>
                      <Text style={styles.historyDate}>{new Date(item.fecha).toLocaleDateString()}</Text>
                      <Text style={styles.historyTime}>{new Date(item.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                    </View>
                    <Text style={styles.historyPrice}>${item.precio.toFixed(2)}</Text>
                    {subio !== null && (
                      <Ionicons 
                        name={subio ? "trending-up" : "trending-down"} 
                        size={16} 
                        color={subio ? "#EF4444" : "#10B981"} 
                      />
                    )}
                  </View>
                );
              }}
              ListEmptyComponent={<Text style={styles.emptyText}>No hay cambios registrados.</Text>}
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
  headerTitle: { flex: 1, fontSize: 24, fontWeight: '800', color: '#fff' },
  addBtn: { backgroundColor: '#F59E0B', borderRadius: 14, padding: 8 },

  searchContainer: { paddingHorizontal: 20, marginBottom: 16 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#16213e', borderRadius: 16, paddingHorizontal: 16, height: 50 },
  searchInput: { flex: 1, color: '#fff', fontSize: 16 },

  listContent: { paddingHorizontal: 20, paddingBottom: 40 },
  card: { backgroundColor: '#16213e', borderRadius: 20, marginBottom: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#ffffff05' },
  cardColorBar: { width: '100%', height: 4 },
  cardContent: { flexDirection: 'row', padding: 16, alignItems: 'center' },
  cardInfo: { flex: 1 },
  cardNombre: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 6 },
  cardDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardDetalle: { fontSize: 13, color: '#aaa' },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#444', marginHorizontal: 4 },
  cardPrecioUnit: { fontSize: 13, color: '#F59E0B', fontWeight: '700', marginTop: 8 },
  cardActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { backgroundColor: '#ffffff08', padding: 10, borderRadius: 12 },
  deleteBtn: { backgroundColor: '#EF444410' },

  emptyBox: { alignItems: 'center', marginTop: 100, paddingHorizontal: 40 },
  emptyIconBox: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#16213e33', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: '#fff', textAlign: 'center' },
  emptySubtitle: { fontSize: 15, color: '#666', textAlign: 'center', marginTop: 8, lineHeight: 22 },

  modalOverlay: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#0f0f1a', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: '85%', borderWidth: 1, borderColor: '#ffffff10' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  closeModalBtn: { backgroundColor: '#ffffff10', borderRadius: 12, padding: 4 },
  label: { fontSize: 13, color: '#888', fontWeight: '700', marginBottom: 8, marginTop: 16, textTransform: 'uppercase', letterSpacing: 1 },
  input: { backgroundColor: '#16213e', borderRadius: 16, padding: 16, color: '#fff', fontSize: 16, borderWidth: 1, borderColor: '#ffffff05' },
  row: { flexDirection: 'row' },
  unidadBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, backgroundColor: '#16213e', marginRight: 8, borderWidth: 1, borderColor: '#ffffff05' },
  unidadBtnActive: { backgroundColor: '#F59E0B' },
  unidadTxt: { color: '#888', fontSize: 14, fontWeight: '700' },
  unidadTxtActive: { color: '#000' },
  btnGuardar: { backgroundColor: '#F59E0B', borderRadius: 18, padding: 18, alignItems: 'center', marginTop: 32 },
  btnGuardarTxt: { color: '#000', fontWeight: '800', fontSize: 16 },

  // Historial
  historyItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#ffffff05' },
  historyDateBox: { flex: 1 },
  historyDate: { color: '#fff', fontSize: 14, fontWeight: '600' },
  historyTime: { color: '#555', fontSize: 11, marginTop: 2 },
  historyPrice: { color: '#fff', fontSize: 16, fontWeight: '800', marginRight: 10 },
  emptyText: { color: '#666', textAlign: 'center', marginTop: 20, fontSize: 14 },
});
