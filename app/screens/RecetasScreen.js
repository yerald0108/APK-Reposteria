import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, StatusBar,
  TouchableOpacity, FlatList, Alert, Animated, TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { deleteReceta, getIngredientesByReceta } from '../database/db';
import { useApp } from '../contexts/AppContext';
import { calcularCostosReceta } from '../utils/conversions';
import Skeleton from '../components/Skeleton';

export default function RecetasScreen({ navigation }) {
  const { recetas, cargarRecetas, cargandoRecetas } = useApp();
  const [busqueda, setBusqueda] = useState('');
  const scrollY = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      cargarRecetas();
    }, [])
  );

  const filtrarRecetas = () => {
    if (!busqueda.trim()) return recetas;
    return recetas.filter(r => r.nombre.toLowerCase().includes(busqueda.toLowerCase()));
  };

  const confirmarEliminar = (item) => {
    Alert.alert(
      'Eliminar receta',
      `¿Eliminar "${item.nombre}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive',
          onPress: async () => {
            try {
              await deleteReceta(item.id);
              cargarRecetas(); // recarga contexto global
            } catch (error) {
              Alert.alert('Error', error.message || 'Ocurrió un error inesperado.');
            }
          },
        },
      ]
    );
  };

  const calcularResumen = async (receta) => {
    const ingredientes = await getIngredientesByReceta(receta.id);
    const { costoTotal, precioVenta, gananciaTotal } = calcularCostosReceta(
      ingredientes,
      receta.unidades,
      receta.porcentaje_costos_adicionales,
      receta.porcentaje_beneficio
    );
    return { costoTotal, valorVentaUnit: precioVenta, gananciaTotal };
  };

  const renderSkeleton = () => (
    <View style={styles.card}>
      <View style={styles.cardMain}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleBox}>
            <Skeleton width="60%" height={22} style={{ marginBottom: 6 }} />
            <Skeleton width="30%" height={12} />
          </View>
        </View>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}><Skeleton width="40%" height={16} /></View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}><Skeleton width="40%" height={16} /></View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}><Skeleton width="40%" height={16} /></View>
        </View>
      </View>
    </View>
  );

  const renderItem = ({ item, index }) => (
    <RecetaItem 
      item={item} 
      index={index}
      scrollY={scrollY}
      navigation={navigation} 
      onEliminar={confirmarEliminar} 
      calcularResumen={calcularResumen} 
    />
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0f0f1a" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recetas</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('FormReceta')}>
          <Ionicons name="add" size={26} color="#000" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color="#666" style={{ marginRight: 10 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nombre..."
            placeholderTextColor="#666"
            value={busqueda}
            onChangeText={setBusqueda}
          />
        </View>
      </View>

      <Animated.FlatList
        data={
          cargandoRecetas 
          ? [1, 2, 3, 4] 
          : filtrarRecetas()
        }
        keyExtractor={(item, index) => cargandoRecetas ? `sk-${index}` : String(item.id)}
        renderItem={cargandoRecetas ? renderSkeleton : renderItem}
        contentContainerStyle={styles.listContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="book" size={64} color="#16213e" />
            </View>
            <Text style={styles.emptyTitle}>Sin recetas</Text>
            <Text style={styles.emptySubtitle}>Empieza a crear tus delicias y calcula sus costos</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function RecetaItem({ item, index, scrollY, navigation, onEliminar, calcularResumen }) {
  const [resumen, setResumen] = useState(null);

  useFocusEffect(
    useCallback(() => {
      calcularResumen(item).then(setResumen);
    }, [item])
  );

  const scale = scrollY.interpolate({
    inputRange: [-1, 0, (index * 120), (index + 2) * 120],
    outputRange: [1, 1, 1, 0],
  });

  return (
    <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
      <TouchableOpacity 
        style={styles.cardMain} 
        onPress={() => navigation.navigate('FormReceta', { receta: item })}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleBox}>
            <Text style={styles.cardNombre}>{item.nombre}</Text>
            <Text style={styles.cardDate}>
              {new Date(item.created_at).toLocaleDateString()}
            </Text>
          </View>
          <TouchableOpacity style={styles.deleteBtn} onPress={() => onEliminar(item)}>
            <Ionicons name="trash-outline" size={20} color="#EF4444" />
          </TouchableOpacity>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{item.unidades}</Text>
            <Text style={styles.statLabel}>Unidades</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#10B981' }]}>
              ${resumen ? resumen.gananciaTotal.toFixed(2) : '...'}
            </Text>
            <Text style={styles.statLabel}>Ganancia Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#3B82F6' }]}>
              ${resumen ? resumen.valorVentaUnit.toFixed(2) : '...'}
            </Text>
            <Text style={styles.statLabel}>Precio Venta</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: '#0f0f1a' },
  header:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  backBtn:         { padding: 8, marginRight: 8, backgroundColor: '#ffffff10', borderRadius: 12 },
  headerTitle:     { flex: 1, fontSize: 24, fontWeight: '800', color: '#fff' },
  addBtn:          { backgroundColor: '#10B981', borderRadius: 14, padding: 8 },
  
  searchContainer: { paddingHorizontal: 20, marginBottom: 16 },
  searchBox:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#16213e', borderRadius: 16, paddingHorizontal: 16, height: 50 },
  searchInput:     { flex: 1, color: '#fff', fontSize: 16 },

  listContent:     { paddingHorizontal: 20, paddingBottom: 40 },
  card:            { backgroundColor: '#16213e', borderRadius: 24, marginBottom: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#ffffff05' },
  cardMain:        { padding: 20 },
  cardHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  cardTitleBox:    { flex: 1 },
  cardNombre:      { fontSize: 19, fontWeight: '800', color: '#fff' },
  cardDate:        { fontSize: 12, color: '#555', marginTop: 4, fontWeight: '600' },
  deleteBtn:       { backgroundColor: '#EF444415', padding: 8, borderRadius: 12 },

  statsGrid:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff05', borderRadius: 18, paddingVertical: 14 },
  statItem:        { flex: 1, alignItems: 'center' },
  statValue:       { fontSize: 16, fontWeight: '800', color: '#fff' },
  statLabel:       { fontSize: 11, color: '#666', marginTop: 4, fontWeight: '600', textTransform: 'uppercase' },
  statDivider:     { width: 1, height: 24, backgroundColor: '#ffffff10' },

  emptyBox:        { alignItems: 'center', marginTop: 100, paddingHorizontal: 40 },
  emptyIconBox:    { width: 120, height: 120, borderRadius: 60, backgroundColor: '#16213e33', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  emptyTitle:      { fontSize: 22, fontWeight: '800', color: '#fff', textAlign: 'center' },
  emptySubtitle:   { fontSize: 15, color: '#666', textAlign: 'center', marginTop: 8, lineHeight: 22 },
});