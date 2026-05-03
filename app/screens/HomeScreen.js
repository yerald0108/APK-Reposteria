import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, Animated, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const menuItems = [
  { label: 'Materiales', icon: 'cube', screen: 'Materiales', color: '#F59E0B', desc: 'Gestiona tu inventario' },
  { label: 'Recetas', icon: 'book', screen: 'Recetas', color: '#10B981', desc: 'Tus creaciones y costos' },
  { label: 'Pedidos', icon: 'cart', screen: 'Pedidos', color: '#3B82F6', desc: 'Control de ventas' },
  { label: 'Entregas', icon: 'bicycle', screen: 'Entregas', color: '#8B5CF6', desc: 'Rutas y logística' },
  { label: 'Estadísticas', icon: 'bar-chart', screen: 'Estadisticas', color: '#EF4444', desc: 'Análisis de rendimiento' },
];

export default function HomeScreen({ navigation }) {
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

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0f0f1a" />

      <ScrollView showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.headerGreeting}>¡Hola, Pastelero! 👋</Text>
              <Text style={styles.headerTitle}>Mi Repostería</Text>
            </View>
            <TouchableOpacity style={styles.profileBtn}>
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
});
