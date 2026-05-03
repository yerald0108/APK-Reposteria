import 'react-native-gesture-handler';
import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initDatabase } from './app/database/db';
import { AppProvider } from './app/contexts/AppContext';

import HomeScreen        from './app/screens/HomeScreen';
import MaterialesScreen  from './app/screens/MaterialesScreen';
import RecetasScreen     from './app/screens/RecetasScreen';
import FormRecetaScreen  from './app/screens/FormRecetaScreen';
import PedidosScreen     from './app/screens/PedidosScreen';
import FormPedidoScreen  from './app/screens/FormPedidoScreen';
import EntregasScreen    from './app/screens/EntregasScreen';
import EstadisticasScreen from './app/screens/EstadisticasScreen';

const Stack = createStackNavigator();

export default function App() {
  const [dbLista, setDbLista] = useState(false);
  const [dbError, setDbError] = useState(null);

  useEffect(() => {
    initDatabase()
      .then(() => setDbLista(true))
      .catch((err) => {
        console.error('Error al iniciar la base de datos:', err);
        setDbError(err.message || 'Error desconocido');
      });
  }, []);

  if (dbError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>No se pudo iniciar la app</Text>
        <Text style={styles.errorMessage}>{dbError}</Text>
        <Text style={styles.errorHint}>
          Intenta cerrar la app completamente y volver a abrirla.
          {'\n'}Si el problema persiste, reinstala la aplicación.
        </Text>
      </View>
    );
  }

  if (!dbLista) {
    return (
      <View style={styles.errorContainer}>
        <ActivityIndicator size="large" color="#F59E0B" />
        <Text style={styles.loadingText}>Iniciando...</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProvider>
        <NavigationContainer theme={DarkTheme}>
          <Stack.Navigator initialRouteName="Home">
            <Stack.Screen name="Home"         component={HomeScreen}         options={{ headerShown: false }} />
            <Stack.Screen name="Materiales"   component={MaterialesScreen}   options={{ headerShown: false }} />
            <Stack.Screen name="Recetas"      component={RecetasScreen}      options={{ headerShown: false }} />
            <Stack.Screen name="FormReceta"   component={FormRecetaScreen}   options={{ headerShown: false }} />
            <Stack.Screen name="Pedidos"      component={PedidosScreen}      options={{ headerShown: false }} />
            <Stack.Screen name="FormPedido"   component={FormPedidoScreen}   options={{ headerShown: false }} />
            <Stack.Screen name="Entregas"     component={EntregasScreen}     options={{ headerShown: false }} />
            <Stack.Screen name="Estadisticas" component={EstadisticasScreen} options={{ headerShown: false }} />
          </Stack.Navigator>
        </NavigationContainer>
      </AppProvider>
    </GestureHandlerRootView>
  );
}
const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    backgroundColor: '#0f0f1a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  errorIcon: {
    fontSize: 48,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 13,
    color: '#EF4444',
    textAlign: 'center',
    fontFamily: 'monospace',
    backgroundColor: '#EF444415',
    padding: 12,
    borderRadius: 10,
    width: '100%',
  },
  errorHint: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingText: {
    color: '#888',
    marginTop: 16,
    fontSize: 14,
  },
});