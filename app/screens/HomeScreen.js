import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, Animated, ScrollView, Modal, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';

const menuItems = [
  { label: 'Materiales', icon: 'cube', screen: 'Materiales', color: '#F59E0B', desc: 'Gestiona tu inventario' },
  { label: 'Recetas', icon: 'book', screen: 'Recetas', color: '#10B981', desc: 'Tus creaciones y costos' },
  { label: 'Pedidos', icon: 'cart', screen: 'Pedidos', color: '#3B82F6', desc: 'Control de ventas' },
  { label: 'Entregas', icon: 'bicycle', screen: 'Entregas', color: '#8B5CF6', desc: 'Rutas y logística' },
  { label: 'Estadísticas', icon: 'bar-chart', screen: 'Estadisticas', color: '#EF4444', desc: 'Análisis de rendimiento' },
];

export default function HomeScreen({ navigation }) {
  const { config, actualizarPerfil } = useApp();
  const [modalPerfil, setModalPerfil] = React.useState(false);
  const [nombreTmp, setNombreTmp] = React.useState('');
  const [negocioTmp, setNegocioTmp] = React.useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  const abrirPerfil = () => {
    setNombreTmp(config.nombre_usuario);
    setNegocioTmp(config.nombre_negocio);
    setModalPerfil(true);
  };

  const guardarPerfil = async () => {
    if (!nombreTmp.trim() || !negocioTmp.trim()) {
      Alert.alert('Error', 'Todos los campos son obligatorios');
      return;
    }
    const ok = await actualizarPerfil(nombreTmp.trim(), negocioTmp.trim());
    if (ok) setModalPerfil(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0f0f1a" />

      <ScrollView showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.headerGreeting}>¡Hola, {config.nombre_usuario}! 👋</Text>
              <Text style={styles.headerTitle}>{config.nombre_negocio}</Text>
            </View>
            <TouchableOpacity style={styles.profileBtn} onPress={abrirPerfil}>
              <Ionicons name="person-circle-outline" size={36} color="#fff" />
            </TouchableOpacity>
          </View>
        </Animated.View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Menú Principal</Text>
          <View style={styles.grid}>
            {menuItems.map((item, index) => (
              <Animated.View
                key={item.screen}
                style={{ opacity: fadeAnim, transform: [{ translateY: Animated.multiply(slideAnim, index + 1) }] }}
              >
                <TouchableOpacity
                  style={[styles.card, { borderLeftColor: item.color }]}
                  onPress={() => navigation.navigate(item.screen)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.iconBox, { backgroundColor: item.color + '15' }]}>
                    <Ionicons name={item.icon} size={28} color={item.color} />
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardLabel}>{item.label}</Text>
                    <Text style={styles.cardDesc}>{item.desc}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#333" />
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={modalPerfil} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitulo}>Configurar Perfil</Text>
              <TouchableOpacity onPress={() => setModalPerfil(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Tu Nombre / Apodo</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Juan"
              placeholderTextColor="#555"
              value={nombreTmp}
              onChangeText={setNombreTmp}
            />

            <Text style={styles.label}>Nombre del Negocio</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Dulce Tentación"
              placeholderTextColor="#555"
              value={negocioTmp}
              onChangeText={setNegocioTmp}
            />

            <TouchableOpacity style={styles.btnGuardar} onPress={guardarPerfil}>
              <Ionicons name="save-outline" size={20} color="#000" />
              <Text style={styles.btnGuardarTxt}>Guardar Cambios</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f0f1a' },
  header: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 10 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  headerGreeting: { color: '#888', fontSize: 14, fontWeight: '600', letterSpacing: 0.5 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', marginTop: 2 },
  profileBtn: { backgroundColor: '#ffffff10', borderRadius: 20, padding: 2 },

  summaryCard: {
    flexDirection: 'row',
    backgroundColor: '#16213e',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#ffffff05'
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryVal: { color: '#fff', fontSize: 18, fontWeight: '800' },
  summaryLbl: { color: '#888', fontSize: 12, marginTop: 4, fontWeight: '600' },
  summaryDivider: { width: 1, height: 30, backgroundColor: '#ffffff10' },

  section: { paddingHorizontal: 24, marginTop: 32 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 16, letterSpacing: 0.5 },
  grid: { gap: 14 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 16,
    borderLeftWidth: 5,
    borderWidth: 1,
    borderColor: '#ffffff05',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3
  },
  iconBox: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, marginLeft: 16 },
  cardLabel: { fontSize: 17, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.3 },
  cardDesc: { fontSize: 13, color: '#666', marginTop: 2 },

  // Perfil Modal
  modalOverlay: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'center', padding: 24 },
  modalBox: { backgroundColor: '#16213e', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#ffffff10' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitulo: { fontSize: 20, fontWeight: '800', color: '#fff' },
  label: { fontSize: 12, color: '#888', fontWeight: '700', marginBottom: 8, marginTop: 12, textTransform: 'uppercase' },
  input: { backgroundColor: '#0f0f1a', borderRadius: 12, padding: 14, color: '#fff', fontSize: 16 },
  btnGuardar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F59E0B', borderRadius: 14, padding: 16, marginTop: 24, gap: 10 },
  btnGuardarTxt: { color: '#000', fontWeight: '800', fontSize: 16 },
});
