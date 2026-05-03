import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, StatusBar,
  TouchableOpacity, ScrollView, Dimensions, FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { getEstadisticasData } from '../database/db';

const screenWidth = Dimensions.get('window').width;

export default function EstadisticasScreen({ navigation }) {
  const [data, setData] = useState([]);
  const [filtro, setFiltro] = useState('mensual'); // diario, semanal, mensual, anual

  useFocusEffect(
    useCallback(() => {
      cargarData();
    }, [])
  );

  const cargarData = async () => {
    const res = await getEstadisticasData();
    setData(res);
  };

  const stats = useMemo(() => {
    if (data.length === 0) return null;

    // Totales Generales
    const totalVentas = data.reduce((sum, p) => sum + p.costo_total, 0);
    const totalInversion = data.reduce((sum, p) => sum + p.inversion, 0);
    const totalGanancia = data.reduce((sum, p) => sum + p.ganancia, 0);
    const cantVentas = data.length;

    // Top Productos
    const prodCounts = {};
    data.forEach(pedido => {
      pedido.productos.forEach(prod => {
        prodCounts[prod.receta_nombre] = (prodCounts[prod.receta_nombre] || 0) + prod.cantidad;
      });
    });
    const topProductos = Object.entries(prodCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Agrupación para Gráficos
    // Para simplificar, haremos una agrupación básica según el filtro
    let labels = [];
    let ventasChart = [];
    let gananciasChart = [];

    const hoy = new Date();
    
    if (filtro === 'diario') {
      // Últimos 7 días
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(hoy.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        labels.push(d.getDate() + '/' + (d.getMonth() + 1));
        
        const pedidosDia = data.filter(p => p.fecha_entrega === dateStr);
        ventasChart.push(pedidosDia.reduce((s, p) => s + p.costo_total, 0));
        gananciasChart.push(pedidosDia.reduce((s, p) => s + p.ganancia, 0));
      }
    } else if (filtro === 'mensual') {
      // Últimos 6 meses
      for (let i = 5; i >= 0; i--) {
        const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
        const mesStr = d.getMonth() + 1;
        const añoStr = d.getFullYear();
        labels.push(d.toLocaleString('default', { month: 'short' }));
        
        const pedidosMes = data.filter(p => {
          const pDate = new Date(p.fecha_entrega);
          return pDate.getMonth() + 1 === mesStr && pDate.getFullYear() === añoStr;
        });
        ventasChart.push(pedidosMes.reduce((s, p) => s + p.costo_total, 0));
        gananciasChart.push(pedidosMes.reduce((s, p) => s + p.ganancia, 0));
      }
    } else {
      // Default / Anual (Últimos 3 años)
      labels = ['2024', '2025', '2026']; // Simulado para el ejemplo
      ventasChart = [0, 0, totalVentas];
      gananciasChart = [0, 0, totalGanancia];
    }

    return {
      totalVentas, totalInversion, totalGanancia, cantVentas,
      topProductos, labels, ventasChart, gananciasChart
    };
  }, [data, filtro]);

  const chartConfig = {
    backgroundGradientFrom: '#1a1a2e',
    backgroundGradientTo: '#16213e',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(245, 158, 11, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
    style: { borderRadius: 16 },
    propsForDots: { r: '4', strokeWidth: '2', stroke: '#F59E0B' }
  };

  if (!stats) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Estadísticas</Text>
        </View>
        <View style={styles.emptyBox}>
          <Ionicons name="bar-chart-outline" size={64} color="#16213e" />
          <Text style={styles.emptyText}>No hay datos suficientes para generar estadísticas.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0f0f1a" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Estadísticas</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.filterRow}>
          {['diario', 'semanal', 'mensual', 'anual'].map(f => (
            <TouchableOpacity 
              key={f} 
              style={[styles.filterBtn, filtro === f && styles.filterBtnActive]}
              onPress={() => setFiltro(f)}
            >
              <Text style={[styles.filterBtnTxt, filtro === f && styles.filterBtnTxtActive]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Ventas Totales</Text>
            <Text style={styles.summaryValue}>${stats.totalVentas.toFixed(2)}</Text>
            <View style={[styles.miniBadge, { backgroundColor: '#3B82F620' }]}>
              <Text style={[styles.miniBadgeTxt, { color: '#3B82F6' }]}>{stats.cantVentas} pedidos</Text>
            </View>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Ganancia Neta</Text>
            <Text style={[styles.summaryValue, { color: '#10B981' }]}>${stats.totalGanancia.toFixed(2)}</Text>
            <View style={[styles.miniBadge, { backgroundColor: '#10B98120' }]}>
              <Text style={[styles.miniBadgeTxt, { color: '#10B981' }]}>Profit</Text>
            </View>
          </View>
        </View>

        <View style={styles.chartSection}>
          <Text style={styles.sectionTitle}>Evolución de Ventas</Text>
          <LineChart
            data={{
              labels: stats.labels,
              datasets: [{ data: stats.ventasChart.length > 0 ? stats.ventasChart : [0] }]
            }}
            width={screenWidth - 40}
            height={220}
            chartConfig={chartConfig}
            bezier
            style={styles.chart}
          />
        </View>

        <View style={styles.chartSection}>
          <Text style={styles.sectionTitle}>Inversión vs Ganancia</Text>
          <BarChart
            data={{
              labels: ['Inversión', 'Ganancia'],
              datasets: [{ data: [stats.totalInversion, stats.totalGanancia] }]
            }}
            width={screenWidth - 40}
            height={220}
            chartConfig={{
              ...chartConfig,
              color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
            }}
            style={styles.chart}
            showValuesOnTopOfBars
          />
        </View>

        <View style={styles.topSection}>
          <Text style={styles.sectionTitle}>Top 5 Productos</Text>
          {stats.topProductos.map(([name, count], index) => (
            <View key={name} style={styles.topItem}>
              <View style={styles.topRank}>
                <Text style={styles.topRankTxt}>{index + 1}</Text>
              </View>
              <Text style={styles.topName}>{name}</Text>
              <Text style={styles.topCount}>{count} vendidos</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f0f1a' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  backBtn: { padding: 8, marginRight: 8, backgroundColor: '#ffffff10', borderRadius: 12 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  
  scroll: { paddingHorizontal: 20 },
  
  filterRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#16213e', borderRadius: 16, padding: 6, marginBottom: 24 },
  filterBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12 },
  filterBtnActive: { backgroundColor: '#F59E0B' },
  filterBtnTxt: { color: '#888', fontSize: 12, fontWeight: '700' },
  filterBtnTxtActive: { color: '#000' },

  summaryGrid: { flexDirection: 'row', gap: 14, marginBottom: 24 },
  summaryCard: { flex: 1, backgroundColor: '#16213e', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#ffffff05' },
  summaryLabel: { color: '#888', fontSize: 12, fontWeight: '600', marginBottom: 8 },
  summaryValue: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 12 },
  miniBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  miniBadgeTxt: { fontSize: 10, fontWeight: '800' },

  chartSection: { marginBottom: 32 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 16 },
  chart: { borderRadius: 24, marginVertical: 8 },

  topSection: { backgroundColor: '#16213e', borderRadius: 24, padding: 20, marginBottom: 20 },
  topItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#ffffff05' },
  topRank: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F59E0B20', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  topRankTxt: { color: '#F59E0B', fontWeight: '800', fontSize: 14 },
  topName: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '600' },
  topCount: { color: '#888', fontSize: 13 },

  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyText: { color: '#444', textAlign: 'center', marginTop: 20, fontSize: 16, lineHeight: 24 },
});
