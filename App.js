import React, { useState, useEffect } from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
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

  useEffect(() => {
    initDatabase().then(() => setDbLista(true));
  }, []);

  if (!dbLista) return null;

  return (
    // AppProvider envuelve todo — todos los datos están disponibles
    // en cualquier pantalla sin volver a pedir a la DB
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
  );
}