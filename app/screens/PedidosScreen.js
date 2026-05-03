import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, StatusBar,
  TouchableOpacity, FlatList, Alert, Animated, TextInput, Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { deletePedido } from '../database/db';
import { useApp } from '../contexts/AppContext';
import Skeleton from '../components/Skeleton';

export default function PedidosScreen({ navigation }) {
  const { pedidos, cargarPedidos, config, cargandoPedidos } = useApp();
  const [busqueda, setBusqueda] = useState('');
  const scrollY = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      cargarPedidos();
    }, [])
  );

  const filtrarPedidos = () => {
    if (!busqueda.trim()) return pedidos;
    return pedidos.filter(p => 
      p.cliente_nombre.toLowerCase().includes(busqueda.toLowerCase())
    );
  };

  const compartirWhatsApp = (item) => {
    let msgStr = `*${config.nombre_negocio?.toUpperCase() || 'MI REPOSTERÍA'}* 🍰✨%0A%0A` +
      `¡Hola! Soy *${config.nombre_usuario}*, aquí tienes el detalle de tu pedido:%0A%0A` +
      `👤 *Cliente:* ${item.cliente_nombre}%0A` +
      `📦 *Productos:* ${item.productos_resumen || 'Sin productos'}%0A`;

    if (item.color) msgStr += `🎨 *Color:* ${item.color}%0A`;
    if (item.relleno) msgStr += `🍓 *Relleno:* ${item.relleno}%0A`;
    if (item.decoracion) msgStr += `✨ *Decoración:* ${item.decoracion}%0A`;

    msgStr += `%0A📅 *Entrega:* ${item.fecha_entrega} ⏰ ${item.hora_entrega || ''}%0A` +
      `📍 *Tipo:* ${item.domicilio ? '🚀 Domicilio' : '🏠 Recogida'}%0A` +
      (item.domicilio ? `🗺️ *Dirección:* ${item.direccion}%0A` : '') +
      `%0A💰 *TOTAL A PAGAR: $${parseFloat(item.costo_total).toFixed(2)}*%0A%0A` +
      `¡Gracias por preferirnos! 👩‍🍳💖`;
    
    const url = `whatsapp://send?text=${msgStr}`;
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Alert.alert('Error', 'WhatsApp no está instalado en este dispositivo.');
      }
    });
  };

  const renderSkeleton = () => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Skeleton width="60%" height={20} style={{ marginBottom: 8 }} />
          <Skeleton width="40%" height={12} />
        </View>
        <Skeleton width="20%" height={20} borderRadius={10} />
      </View>
      <View style={styles.productsBox}>
        <Skeleton width="80%" height={14} />
      </View>
      <View style={styles.detailsBox}>
        <Skeleton width="25%" height={12} />
        <Skeleton width="25%" height={12} />
        <Skeleton width="25%" height={12} />
      </View>
      <View style={styles.cardFooter}>
        <Skeleton width="40%" height={25} />
      </View>
    </View>
  );

  const confirmarEliminar = (item) => {
    Alert.alert(
      'Eliminar pedido',
      `¿Eliminar pedido de "${item.cliente_nombre}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive',
          onPress: async () => {
            try {
              await deletePedido(item.id);
              cargarPedidos();
            } catch (error) {
              Alert.alert('Error', error.message || 'Ocurrió un error inesperado.');
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item, index }) => {
    const scale = scrollY.interpolate({
      inputRange: [-1, 0, (index * 150), (index + 2) * 150],
      outputRange: [1, 1, 1, 0],
    });

    const isEntregado = item.estado === 'entregado';

    return (
      <Animated.View style={[styles.card, { transform: [{ scale }], opacity: isEntregado ? 0.7 : 1 }]}>
        <TouchableOpacity 
          onPress={() => navigation.navigate('FormPedido', { pedido: item })}
          activeOpacity={0.7}
        >
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.clienteNombre}>{item.cliente_nombre}</Text>
              <View style={styles.phoneRow}>
                <Ionicons name="call-outline" size={12} color="#888" />
                <Text style={styles.clienteTelefono}>{item.cliente_telefono || 'Sin teléfono'}</Text>
              </View>
            </View>
            <View style={[styles.badge, { backgroundColor: isEntregado ? '#10B98120' : '#F59E0B20' }]}>
              <Text style={[styles.badgeTxt, { color: isEntregado ? '#10B981' : '#F59E0B' }]}>
                {item.estado.toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.productsBox}>
            <Text style={styles.productsTitle}>Resumen de pedido:</Text>
            <Text style={styles.productsText} numberOfLines={2}>
              {item.productos_resumen || 'Cargando productos...'}
            </Text>
          </View>

          <View style={styles.detailsBox}>
            <View style={styles.detailItem}>
              <Ionicons name="calendar-outline" size={14} color="#F59E0B" />
              <Text style={styles.detailText}>{item.fecha_entrega}</Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="time-outline" size={14} color="#F59E0B" />
              <Text style={styles.detailText}>{item.hora_entrega || '--:--'}</Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="bicycle-outline" size={14} color="#F59E0B" />
              <Text style={styles.detailText}>{item.domicilio ? 'Envío' : 'Local'}</Text>
            </View>
          </View>

          <View style={styles.cardFooter}>
            <View style={styles.priceBox}>
              <Text style={styles.totalLabel}>Total:</Text>
              <Text style={styles.totalValue}>${parseFloat(item.costo_total).toFixed(2)}</Text>
            </View>
            <View style={styles.footerActions}>
              <TouchableOpacity style={styles.shareBtn} onPress={() => compartirWhatsApp(item)}>
                <Ionicons name="logo-whatsapp" size={20} color="#10B981" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => confirmarEliminar(item)}>
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
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
        <Text style={styles.headerTitle}>Pedidos</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('FormPedido')}>
          <Ionicons name="add" size={26} color="#000" />
        </TouchableOpacity>
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
        data={
          cargandoPedidos
          ? [1, 2, 3]
          : filtrarPedidos()
        }
        keyExtractor={(item, index) => cargandoPedidos ? `sk-${index}` : String(item.id)}
        renderItem={cargandoPedidos ? renderSkeleton : renderItem}
        contentContainerStyle={styles.listContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="cart-outline" size={64} color="#16213e" />
            </View>
            <Text style={styles.emptyTitle}>No hay pedidos</Text>
            <Text style={styles.emptySubtitle}>Empieza a registrar los pedidos de tus clientes</Text>
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
  headerTitle: { flex: 1, fontSize: 24, fontWeight: '800', color: '#fff' },
  addBtn: { backgroundColor: '#F59E0B', borderRadius: 14, padding: 8 },
  
  searchContainer: { paddingHorizontal: 20, marginBottom: 16 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#16213e', borderRadius: 16, paddingHorizontal: 16, height: 50 },
  searchInput: { flex: 1, color: '#fff', fontSize: 16 },

  listContent: { paddingHorizontal: 20, paddingBottom: 40 },
  card: { backgroundColor: '#16213e', borderRadius: 24, marginBottom: 16, padding: 20, borderWidth: 1, borderColor: '#ffffff05' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  clienteNombre: { fontSize: 18, fontWeight: '800', color: '#fff' },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  clienteTelefono: { fontSize: 12, color: '#666', fontWeight: '600' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeTxt: { fontSize: 10, fontWeight: '800' },

  productsBox: { marginTop: 12, marginBottom: 12 },
  productsTitle: { fontSize: 11, color: '#444', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  productsText: { fontSize: 14, color: '#eee', marginTop: 2, fontWeight: '500', lineHeight: 20 },

  detailsBox: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, backgroundColor: '#ffffff03', borderRadius: 12, padding: 10, marginBottom: 16 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 12, color: '#888', fontWeight: '600' },

  cardFooter: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#ffffff05', paddingTop: 16, justifyContent: 'space-between' },
  priceBox: { flex: 1 },
  totalLabel: { fontSize: 12, color: '#555', fontWeight: '600' },
  totalValue: { fontSize: 22, fontWeight: '800', color: '#F59E0B' },
  
  footerActions: { flexDirection: 'row', gap: 10 },
  shareBtn: { backgroundColor: '#10B98115', padding: 10, borderRadius: 12 },
  deleteBtn: { backgroundColor: '#EF444415', padding: 10, borderRadius: 12 },

  emptyBox: { alignItems: 'center', marginTop: 100, paddingHorizontal: 40 },
  emptyIconBox: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#16213e33', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: '#fff', textAlign: 'center' },
  emptySubtitle: { fontSize: 15, color: '#666', textAlign: 'center', marginTop: 8, lineHeight: 22 },
});
