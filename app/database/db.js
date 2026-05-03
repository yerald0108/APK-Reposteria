import * as SQLite from 'expo-sqlite';
import { calcularCostoIngrediente } from '../utils/conversions';

let db = null;

export const initDatabase = async () => {
  db = await SQLite.openDatabaseAsync('reposteria.db');

  await db.execAsync('PRAGMA foreign_keys = ON;');

  // MATERIALES
  await db.execAsync(`CREATE TABLE IF NOT EXISTS materiales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    precio REAL NOT NULL,
    contenido REAL NOT NULL,
    unidad TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // RECETAS
  await db.execAsync(`CREATE TABLE IF NOT EXISTS recetas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    unidades INTEGER NOT NULL DEFAULT 1,
    porcentaje_costos_adicionales REAL NOT NULL DEFAULT 0,
    porcentaje_beneficio REAL NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // RECETA_MATERIALES
  await db.execAsync(`CREATE TABLE IF NOT EXISTS receta_materiales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    receta_id INTEGER NOT NULL,
    material_id INTEGER NOT NULL,
    cantidad REAL NOT NULL,
    unidad TEXT,
    FOREIGN KEY (receta_id) REFERENCES recetas(id) ON DELETE CASCADE,
    FOREIGN KEY (material_id) REFERENCES materiales(id) ON DELETE RESTRICT
  )`);

  // Migración para 'unidad' en receta_materiales
  const tableInfo = await db.getAllAsync("PRAGMA table_info(receta_materiales)");
  if (!tableInfo.some(col => col.name === 'unidad')) {
    await db.execAsync("ALTER TABLE receta_materiales ADD COLUMN unidad TEXT");
  }

  // PEDIDOS
  await db.execAsync(`CREATE TABLE IF NOT EXISTS pedidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_nombre TEXT NOT NULL,
    cliente_telefono TEXT,
    domicilio INTEGER DEFAULT 0,
    direccion TEXT,
    fecha_entrega TEXT,
    hora_entrega TEXT,
    costo_total REAL DEFAULT 0,
    estado TEXT DEFAULT 'pendiente',
    color TEXT,
    relleno TEXT,
    decoracion TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Migración para nuevas columnas de pedidos
  const pedidosInfo = await db.getAllAsync("PRAGMA table_info(pedidos)");
  if (!pedidosInfo.some(col => col.name === 'color')) {
    try {
      await db.execAsync("ALTER TABLE pedidos ADD COLUMN color TEXT");
      await db.execAsync("ALTER TABLE pedidos ADD COLUMN relleno TEXT");
      await db.execAsync("ALTER TABLE pedidos ADD COLUMN decoracion TEXT");
    } catch (e) {
      console.log("Columnas ya existen o error en migración", e);
    }
  }

  // PEDIDO_PRODUCTOS
  await db.execAsync(`CREATE TABLE IF NOT EXISTS pedido_productos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id INTEGER NOT NULL,
    receta_id INTEGER NOT NULL,
    cantidad INTEGER DEFAULT 1,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
    FOREIGN KEY (receta_id) REFERENCES recetas(id) ON DELETE RESTRICT
  )`);

  // CONFIG
  const configTableInfo = await db.getAllAsync("PRAGMA table_info(config)");
  if (configTableInfo.length > 0 && !configTableInfo.some(col => col.name === 'clave')) {
    // Si la tabla existe pero no tiene la columna 'clave', la borramos para recrearla correctamente
    await db.execAsync("DROP TABLE config");
  }

  await db.execAsync(`CREATE TABLE IF NOT EXISTS config (
    clave TEXT PRIMARY KEY,
    valor TEXT
  )`);

  // Valores por defecto si no existen
  const configCount = await db.getFirstAsync('SELECT COUNT(*) as count FROM config');
  if (configCount.count === 0) {
    await db.runAsync("INSERT INTO config (clave, valor) VALUES ('nombre_usuario', 'Pastelero')");
    await db.runAsync("INSERT INTO config (clave, valor) VALUES ('nombre_negocio', 'Mi Repostería')");
  }

  // HISTORIAL PRECIOS
  await db.execAsync(`CREATE TABLE IF NOT EXISTS historial_precios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    material_id INTEGER NOT NULL,
    precio REAL NOT NULL,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (material_id) REFERENCES materiales(id) ON DELETE CASCADE
  )`);
};

export const getDb = () => db;

// ─── MATERIALES ────────────────────────────────────────────────

export const getMateriales = async () => {
  try {
    const currentDb = getDb();
    return await currentDb.getAllAsync(
      'SELECT * FROM materiales ORDER BY nombre ASC'
    );
  } catch (error) {
    console.error('getMateriales:', error);
    throw new Error('No se pudieron cargar los materiales.');
  }
};

export const getMaterialById = async (id) => {
  try {
    const currentDb = getDb();
    return await currentDb.getFirstAsync(
      'SELECT * FROM materiales WHERE id = ?', [id]
    );
  } catch (error) {
    console.error('getMaterialById:', error);
    throw new Error('No se pudo cargar el material.');
  }
};

export const addMaterial = async (nombre, precio, contenido, unidad) => {
  try {
    const currentDb = getDb();
    const result = await currentDb.runAsync(
      'INSERT INTO materiales (nombre, precio, contenido, unidad) VALUES (?, ?, ?, ?)',
      [nombre, precio, contenido, unidad]
    );
    // Guardamos el primer precio en el historial
    await currentDb.runAsync(
      'INSERT INTO historial_precios (material_id, precio) VALUES (?, ?)',
      [result.lastInsertRowId, precio]
    );
    return result;
  } catch (error) {
    console.error('addMaterial:', error);
    throw new Error('No se pudo guardar el material.');
  }
};

export const updateMaterial = async (id, nombre, precio, contenido, unidad) => {
  try {
    const currentDb = getDb();
    const materialPrevio = await currentDb.getFirstAsync('SELECT precio FROM materiales WHERE id = ?', [id]);
    
    const result = await currentDb.runAsync(
      'UPDATE materiales SET nombre = ?, precio = ?, contenido = ?, unidad = ? WHERE id = ?',
      [nombre, precio, contenido, unidad, id]
    );

    // Si el precio cambió, lo registramos en el historial
    if (materialPrevio && materialPrevio.precio !== precio) {
      await currentDb.runAsync(
        'INSERT INTO historial_precios (material_id, precio) VALUES (?, ?)',
        [id, precio]
      );
    }
    return result;
  } catch (error) {
    console.error('updateMaterial:', error);
    throw new Error('No se pudo actualizar el material.');
  }
};

export const getHistorialPrecios = async (materialId) => {
  try {
    const currentDb = getDb();
    return await currentDb.getAllAsync(
      'SELECT * FROM historial_precios WHERE material_id = ? ORDER BY fecha DESC',
      [materialId]
    );
  } catch (error) {
    console.error('getHistorialPrecios:', error);
    throw new Error('No se pudo cargar el historial de precios.');
  }
};

export const deleteMaterial = async (id) => {
  try {
    const currentDb = getDb();
    return await currentDb.runAsync(
      'DELETE FROM materiales WHERE id = ?', [id]
    );
  } catch (error) {
    console.error('deleteMaterial:', error);
    throw new Error('No se pudo eliminar el material.');
  }
};

export const searchMateriales = async (query) => {
  try {
    const currentDb = getDb();
    return await currentDb.getAllAsync(
      'SELECT * FROM materiales WHERE nombre LIKE ? ORDER BY nombre ASC',
      [`%${query}%`]
    );
  } catch (error) {
    console.error('searchMateriales:', error);
    throw new Error('Error al buscar materiales.');
  }
};

// ─── RECETAS ───────────────────────────────────────────────────

export const getRecetas = async () => {
  try {
    const currentDb = getDb();
    return await currentDb.getAllAsync(
      'SELECT * FROM recetas ORDER BY nombre ASC'
    );
  } catch (error) {
    console.error('getRecetas:', error);
    throw new Error('No se pudieron cargar las recetas.');
  }
};

export const getRecetaById = async (id) => {
  try {
    const currentDb = getDb();
    return await currentDb.getFirstAsync(
      'SELECT * FROM recetas WHERE id = ?', [id]
    );
  } catch (error) {
    console.error('getRecetaById:', error);
    throw new Error('No se pudo cargar la receta.');
  }
};

export const addReceta = async (nombre, unidades, pct_adicionales, pct_beneficio) => {
  try {
    const currentDb = getDb();
    const result = await currentDb.runAsync(
      'INSERT INTO recetas (nombre, unidades, porcentaje_costos_adicionales, porcentaje_beneficio) VALUES (?, ?, ?, ?)',
      [nombre, unidades, pct_adicionales, pct_beneficio]
    );
    return result.lastInsertRowId;
  } catch (error) {
    console.error('addReceta:', error);
    throw new Error('No se pudo guardar la receta.');
  }
};

export const updateReceta = async (id, nombre, unidades, pct_adicionales, pct_beneficio) => {
  try {
    const currentDb = getDb();
    return await currentDb.runAsync(
      'UPDATE recetas SET nombre = ?, unidades = ?, porcentaje_costos_adicionales = ?, porcentaje_beneficio = ? WHERE id = ?',
      [nombre, unidades, pct_adicionales, pct_beneficio, id]
    );
  } catch (error) {
    console.error('updateReceta:', error);
    throw new Error('No se pudo actualizar la receta.');
  }
};

export const deleteReceta = async (id) => {
  try {
    const currentDb = getDb();
    
    // Verificar si la receta está siendo usada en algún pedido
    const resultado = await currentDb.getFirstAsync(
      'SELECT COUNT(*) as total FROM pedido_productos WHERE receta_id = ?',
      [id]
    );
    
    // Si hay pedidos que usan esta receta, no permitir eliminarla
    if (resultado.total > 0) {
      throw new Error(
        `Esta receta está siendo utilizada en ${resultado.total} pedido(s). ` +
        'Elimina primero los pedidos que la contienen antes de borrar la receta.'
      );
    }
    
    // Si no hay pedidos, eliminar ingredientes primero
    await currentDb.runAsync(
      'DELETE FROM receta_materiales WHERE receta_id = ?', [id]
    );
    
    // Luego eliminar la receta
    return await currentDb.runAsync(
      'DELETE FROM recetas WHERE id = ?', [id]
    );
  } catch (error) {
    console.error('deleteReceta:', error);
    throw new Error(error.message || 'No se pudo eliminar la receta.');
  }
};

// ─── RECETA MATERIALES ─────────────────────────────────────────

export const getIngredientesByReceta = async (receta_id) => {
  try {
    const currentDb = getDb();
    return await currentDb.getAllAsync(`
      SELECT rm.id, rm.cantidad, rm.unidad as unidad_receta, m.id as material_id,
             m.nombre, m.precio, m.contenido, m.unidad as unidad_base
      FROM receta_materiales rm
      JOIN materiales m ON m.id = rm.material_id
      WHERE rm.receta_id = ?
      ORDER BY m.nombre ASC
    `, [receta_id]);
  } catch (error) {
    console.error('getIngredientesByReceta:', error);
    throw new Error('No se pudieron cargar los ingredientes.');
  }
};

export const addIngrediente = async (receta_id, material_id, cantidad, unidad) => {
  try {
    const currentDb = getDb();
    return await currentDb.runAsync(
      'INSERT INTO receta_materiales (receta_id, material_id, cantidad, unidad) VALUES (?, ?, ?, ?)',
      [receta_id, material_id, cantidad, unidad]
    );
  } catch (error) {
    console.error('addIngrediente:', error);
    throw new Error('No se pudo agregar el ingrediente.');
  }
};

export const deleteIngredientesByReceta = async (receta_id) => {
  try {
    const currentDb = getDb();
    return await currentDb.runAsync(
      'DELETE FROM receta_materiales WHERE receta_id = ?', [receta_id]
    );
  } catch (error) {
    console.error('deleteIngredientesByReceta:', error);
    throw new Error('No se pudieron eliminar los ingredientes.');
  }
};

// ─── PEDIDOS ───────────────────────────────────────────────────

export const getPedidos = async () => {
  try {
    const currentDb = getDb();
    return await currentDb.getAllAsync(
      'SELECT * FROM pedidos ORDER BY fecha_entrega ASC, hora_entrega ASC'
    );
  } catch (error) {
    console.error('getPedidos:', error);
    throw new Error('No se pudieron cargar los pedidos.');
  }
};

export const getPedidosConDetalles = async () => {
  try {
    const currentDb = getDb();
    return await currentDb.getAllAsync(`
      SELECT p.*, GROUP_CONCAT(r.nombre || ' (x' || pp.cantidad || ')', ', ') as productos_resumen
      FROM pedidos p
      LEFT JOIN pedido_productos pp ON pp.pedido_id = p.id
      LEFT JOIN recetas r ON r.id = pp.receta_id
      GROUP BY p.id
      ORDER BY p.fecha_entrega ASC, p.hora_entrega ASC
    `);
  } catch (error) {
    console.error('getPedidosConDetalles:', error);
    throw new Error('No se pudieron cargar los pedidos.');
  }
};

export const addPedido = async (
  nombre, tel, domicilio, direccion,
  fecha, hora, costo, estado = 'pendiente',
  color = '', relleno = '', decoracion = ''
) => {
  try {
    const currentDb = getDb();
    const result = await currentDb.runAsync(
      'INSERT INTO pedidos (cliente_nombre, cliente_telefono, domicilio, direccion, fecha_entrega, hora_entrega, costo_total, estado, color, relleno, decoracion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [nombre, tel, domicilio, direccion, fecha, hora, costo, estado, color, relleno, decoracion]
    );
    return result.lastInsertRowId;
  } catch (error) {
    console.error('addPedido:', error);
    throw new Error('No se pudo guardar el pedido.');
  }
};

export const addProductoAPedido = async (pedido_id, receta_id, cantidad) => {
  try {
    const currentDb = getDb();
    return await currentDb.runAsync(
      'INSERT INTO pedido_productos (pedido_id, receta_id, cantidad) VALUES (?, ?, ?)',
      [pedido_id, receta_id, cantidad]
    );
  } catch (error) {
    console.error('addProductoAPedido:', error);
    throw new Error('No se pudo agregar el producto al pedido.');
  }
};

export const deletePedido = async (id) => {
  try {
    const currentDb = getDb();
    await currentDb.runAsync(
      'DELETE FROM pedido_productos WHERE pedido_id = ?', [id]
    );
    return await currentDb.runAsync(
      'DELETE FROM pedidos WHERE id = ?', [id]
    );
  } catch (error) {
    console.error('deletePedido:', error);
    throw new Error('No se pudo eliminar el pedido.');
  }
};

export const updatePedido = async (
  id, nombre, tel, domicilio, direccion,
  fecha, hora, costo, estado,
  color, relleno, decoracion
) => {
  try {
    const currentDb = getDb();
    return await currentDb.runAsync(
      'UPDATE pedidos SET cliente_nombre = ?, cliente_telefono = ?, domicilio = ?, direccion = ?, fecha_entrega = ?, hora_entrega = ?, costo_total = ?, estado = ?, color = ?, relleno = ?, decoracion = ? WHERE id = ?',
      [nombre, tel, domicilio, direccion, fecha, hora, costo, estado, color, relleno, decoracion, id]
    );
  } catch (error) {
    console.error('updatePedido:', error);
    throw new Error('No se pudo actualizar el pedido.');
  }
};

export const deleteProductosByPedido = async (pedido_id) => {
  try {
    const currentDb = getDb();
    return await currentDb.runAsync(
      'DELETE FROM pedido_productos WHERE pedido_id = ?', [pedido_id]
    );
  } catch (error) {
    console.error('deleteProductosByPedido:', error);
    throw new Error('No se pudieron eliminar los productos del pedido.');
  }
};

export const getProductosByPedido = async (pedido_id) => {
  try {
    const currentDb = getDb();
    return await currentDb.getAllAsync(`
      SELECT pp.*, r.nombre as receta_nombre
      FROM pedido_productos pp
      JOIN recetas r ON r.id = pp.receta_id
      WHERE pp.pedido_id = ?
    `, [pedido_id]);
  } catch (error) {
    console.error('getProductosByPedido:', error);
    throw new Error('No se pudieron cargar los productos del pedido.');
  }
};

// Todo en una sola query con JOINs
export const getCostoTotalBasePedido = async (pedido_id) => {
  try {
    const currentDb = getDb();

    // Una sola query trae todo lo necesario
    const rows = await currentDb.getAllAsync(`
      SELECT
        pp.cantidad as cantidad_pedida,
        r.unidades as unidades_receta,
        r.porcentaje_costos_adicionales,
        rm.cantidad as cantidad_ingrediente,
        rm.unidad as unidad_receta,
        m.precio,
        m.contenido,
        m.unidad as unidad_base
      FROM pedido_productos pp
      JOIN recetas r ON r.id = pp.receta_id
      JOIN receta_materiales rm ON rm.receta_id = r.id
      JOIN materiales m ON m.id = rm.material_id
      WHERE pp.pedido_id = ?
    `, [pedido_id]);

    if (rows.length === 0) return 0;

    // Agrupamos por receta para calcular correctamente
    const recetasMap = {};

    for (const row of rows) {
      const key = `${row.cantidad_pedida}_${row.unidades_receta}_${row.porcentaje_costos_adicionales}`;

      if (!recetasMap[key]) {
        recetasMap[key] = {
          cantidad_pedida: row.cantidad_pedida,
          unidades_receta: row.unidades_receta,
          porcentaje_costos_adicionales: row.porcentaje_costos_adicionales,
          ingredientes: [],
        };
      }

      recetasMap[key].ingredientes.push({
        cantidad: row.cantidad_ingrediente,
        unidad: row.unidad_receta,
        unidad_base: row.unidad_base,
        precio: row.precio,
        contenido: row.contenido,
      });
    }

    // Calculamos el costo total
    let costoTotalReal = 0;

    for (const receta of Object.values(recetasMap)) {
      const costoMat = receta.ingredientes.reduce((sum, ing) => {
        return sum + calcularCostoIngrediente(ing);
      }, 0);

      const costoMatUnidad = costoMat / receta.unidades_receta;
      const costosAdicionales = costoMatUnidad * (receta.porcentaje_costos_adicionales / 100);
      const costoRealUnidad = costoMatUnidad + costosAdicionales;

      costoTotalReal += costoRealUnidad * receta.cantidad_pedida;
    }

    return costoTotalReal;
  } catch (error) {
    console.error('getCostoTotalBasePedido:', error);
    throw new Error('No se pudo calcular el costo del pedido.');
  }
};

// Máximo 3 queries para todo
export const getEstadisticasData = async () => {
  try {
    const currentDb = getDb();

    // Query 1: todos los pedidos entregados
    const pedidos = await currentDb.getAllAsync(`
      SELECT * FROM pedidos
      WHERE estado = 'entregado'
      ORDER BY fecha_entrega DESC
    `);

    if (pedidos.length === 0) return [];

    // Sacamos los IDs de esos pedidos
    const pedidoIds = pedidos.map(p => p.id);
    const placeholders = pedidoIds.map(() => '?').join(', ');

    // Query 2: todos los productos de esos pedidos de una vez
    const productos = await currentDb.getAllAsync(`
      SELECT pp.pedido_id, pp.receta_id, pp.cantidad, r.nombre as receta_nombre
      FROM pedido_productos pp
      JOIN recetas r ON r.id = pp.receta_id
      WHERE pp.pedido_id IN (${placeholders})
    `, pedidoIds);

    // Query 3: todos los ingredientes de todas las recetas involucradas
    const recetaIds = [...new Set(productos.map(p => p.receta_id))];
    const recetaPlaceholders = recetaIds.map(() => '?').join(', ');

    const ingredientesData = await currentDb.getAllAsync(`
      SELECT
        rm.receta_id,
        rm.cantidad,
        rm.unidad as unidad_receta,
        m.precio,
        m.contenido,
        m.unidad as unidad_base,
        r.unidades as unidades_receta,
        r.porcentaje_costos_adicionales
      FROM receta_materiales rm
      JOIN materiales m ON m.id = rm.material_id
      JOIN recetas r ON r.id = rm.receta_id
      WHERE rm.receta_id IN (${recetaPlaceholders})
    `, recetaIds);

    // Calculamos el costo por receta (en memoria, sin más queries)
    const costoPorReceta = {};

    for (const recetaId of recetaIds) {
      const ings = ingredientesData.filter(i => i.receta_id === recetaId);

      if (ings.length === 0) {
        costoPorReceta[recetaId] = 0;
        continue;
      }

      const unidades = ings[0].unidades_receta;
      const pctAdicional = ings[0].porcentaje_costos_adicionales;

      const costoMat = ings.reduce((sum, ing) => {
        return sum + calcularCostoIngrediente(ing);
      }, 0);

      const costoMatUnidad = costoMat / unidades;
      const adicionales = costoMatUnidad * (pctAdicional / 100);
      costoPorReceta[recetaId] = costoMatUnidad + adicionales;
    }

    // Agrupamos productos por pedido (en memoria)
    const productosPorPedido = {};

    for (const prod of productos) {
      if (!productosPorPedido[prod.pedido_id]) {
        productosPorPedido[prod.pedido_id] = [];
      }
      productosPorPedido[prod.pedido_id].push(prod);
    }

    // Armamos el resultado final
    const dataCompleta = pedidos.map(pedido => {
      const prods = productosPorPedido[pedido.id] || [];

      const inversion = prods.reduce((sum, prod) => {
        const costoPorUnidad = costoPorReceta[prod.receta_id] || 0;
        return sum + costoPorUnidad * prod.cantidad;
      }, 0);

      const ganancia = pedido.costo_total - inversion;

      return {
        ...pedido,
        inversion,
        ganancia,
        productos: prods,
      };
    });

    return dataCompleta;
  } catch (error) {
    console.error('getEstadisticasData:', error);
    throw new Error('No se pudieron cargar las estadísticas.');
  }
};

export const getConfig = async () => {
  try {
    const currentDb = getDb();
    const rows = await currentDb.getAllAsync('SELECT * FROM config');
    const config = {};
    rows.forEach(row => {
      config[row.clave] = row.valor;
    });
    return config;
  } catch (error) {
    console.error('getConfig:', error);
    return { nombre_usuario: 'Pastelero', nombre_negocio: 'Mi Repostería' };
  }
};

export const updateConfig = async (clave, valor) => {
  try {
    const currentDb = getDb();
    return await currentDb.runAsync(
      'INSERT OR REPLACE INTO config (clave, valor) VALUES (?, ?)',
      [clave, valor]
    );
  } catch (error) {
    console.error('updateConfig:', error);
    throw new Error('No se pudo actualizar la configuración.');
  }
};

export default getDb;
