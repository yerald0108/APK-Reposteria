import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, StatusBar,
  TouchableOpacity, FlatList, Animated, TextInput, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { deletePedido } from '../database/db';
import { useApp } from '../contexts/AppContext';

export default function EntregasScreen({ navigation }) {
  const { entregas, cargarEntregas, cargandoEntregas } = useApp();
  const [entregas, setEntregas] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const scrollY = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      cargarEntregas();
    }, [])
  );

  const confirmarEliminar = (item) => {
    Alert.alert(
      'Eliminar registro',
      `¿Eliminar el registro de entrega de "${item.cliente_nombre}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Eliminar', 
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePedido(item.id);
              cargarEntregas();
            } catch (error) {
              Alert.alert('Error', error.message || 'Ocurrió un error inesperado.');
            }
          }
        }
      ]
    );
  };

  const filtrarEntregas = () => {
    if (!busqueda.trim()) return entregas;
    return entregas.filter(p => 
      p.cliente_nombre.toLowerCase().includes(busqueda.toLowerCase())
    );
  };

  const renderItem = ({ item, index }) => {
    const scale = scrollY.interpolate({
      inputRange: [-1, 0, (index * 160), (index + 2) * 160],
      outputRange: [1, 1, 1, 0],
    });

    return (
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.clienteNombre}>{item.cliente_nombre}</Text>
            <View style={styles.phoneRow}>
              <Ionicons name="call-outline" size={12} color="#888" />
              <Text style={styles.phoneText}>{item.cliente_telefono || 'Sin teléfono'}</Text>
            </View>
            <Text style={styles.fechaText}>{item.fecha_entrega} • {item.hora_entrega}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <View style={styles.badge}>
              <Ionicons name="checkmark-done-circle" size={16} color="#10B981" />
              <Text style={styles.badgeTxt}>ENTREGADO</Text>
            </View>
            <TouchableOpacity 
              style={styles.deleteBtn} 
              onPress={() => confirmarEliminar(item)}
              activeOpacity={0.6}
            >
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.resumenBox}>
          <Text style={styles.resumenTitle}>Pedido:</Text>
          <Text style={styles.resumenText} numberOfLines={2}>{item.productos_resumen}</Text>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Venta</Text>
            <Text style={styles.statValue}>${item.costo_total.toFixed(2)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Inversión</Text>
            <Text style={[styles.statValue, { color: '#F59E0B' }]}>${item.inversion.toFixed(2)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Ganancia</Text>
            <Text style={[styles.statValue, { color: '#10B981' }]}>+${item.ganancia.toFixed(2)}</Text>
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
        <Text style={styles.headerTitle}>Entregas Realizadas</Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color="#666" style={{ marginRight: 10 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por cliente..."
            placeholderTextColor="#666"
            value={busqueda}
            onChangeText={setBusqueda}
          />
        </View>
      </View>

      <Animated.FlatList
        data={filtrarEntregas()}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="bicycle-outline" size={64} color="#16213e" />
            <Text style={styles.emptyTitle}>No hay entregas</Text>
            <Text style={styles.emptySubtitle}>Aquí verás el historial de tus pedidos finalizados.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f0f1a' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  backBtn: { padding: 8, marginRight: 8, backgroundColor: '#ffffff10', borderRadius: 12 },
  headerTitle: { flex: 1, fontSize: 22, fontWeight: '800', color: '#fff' },
  
  searchContainer: { paddingHorizontal: 20, marginBottom: 16 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#16213e', borderRadius: 16, paddingHorizontal: 16, height: 50 },
  searchInput: { flex: 1, color: '#fff', fontSize: 16 },

  listContent: { paddingHorizontal: 20, paddingBottom: 40 },
  card: { backgroundColor: '#16213e', borderRadius: 24, marginBottom: 16, padding: 20, borderWidth: 1, borderColor: '#ffffff05' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  clienteNombre: { fontSize: 18, fontWeight: '800', color: '#fff' },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  phoneText: { fontSize: 12, color: '#888', fontWeight: '600' },
  fechaText: { fontSize: 11, color: '#555', marginTop: 4, fontWeight: '600' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#10B98115', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, marginBottom: 8 },
  badgeTxt: { fontSize: 9, fontWeight: '800', color: '#10B981' },
  deleteBtn: { backgroundColor: '#EF444410', padding: 8, borderRadius: 12 },

  resumenBox: { marginBottom: 16 },
  resumenTitle: { fontSize: 10, color: '#444', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  resumenText: { fontSize: 13, color: '#aaa', marginTop: 2, lineHeight: 18 },

  statsContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff03', borderRadius: 20, paddingVertical: 14, paddingHorizontal: 10 },
  statItem: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 9, color: '#555', fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  statValue: { fontSize: 15, fontWeight: '800', color: '#fff' },
  divider: { width: 1, height: 24, backgroundColor: '#ffffff08' },

  emptyBox: { alignItems: 'center', marginTop: 100, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#fff', textAlign: 'center', marginTop: 24 },
  emptySubtitle: { fontSize: 14, color: '#444', textAlign: 'center', marginTop: 8, lineHeight: 22 },
});
