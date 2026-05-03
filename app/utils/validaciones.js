// ─── VALIDACIONES CENTRALIZADAS ───────────────────────────────
// Cada función devuelve null si todo está bien,
// o un string con el mensaje de error si algo falla.

// ─── MATERIALES ───────────────────────────────────────────────

export const validarMaterial = ({ nombre, precio, contenido, unidad }) => {
  if (!nombre || !nombre.trim()) {
    return 'El nombre del material es obligatorio.';
  }

  if (nombre.trim().length < 2) {
    return 'El nombre debe tener al menos 2 caracteres.';
  }

  const precioNum = parseFloat(precio);
  if (isNaN(precioNum) || precioNum <= 0) {
    return 'El precio debe ser un número mayor a 0.';
  }

  const contenidoNum = parseFloat(contenido);
  if (isNaN(contenidoNum) || contenidoNum <= 0) {
    return 'El contenido debe ser un número mayor a 0.';
  }

  if (!unidad || !unidad.trim()) {
    return 'Debes seleccionar una unidad de medida.';
  }

  return null; // ✅ todo bien
};

// ─── RECETAS ──────────────────────────────────────────────────

export const validarReceta = ({ nombre, unidades, pct_adicionales, pct_beneficio, ingredientes }) => {
  if (!nombre || !nombre.trim()) {
    return 'El nombre de la receta es obligatorio.';
  }

  if (nombre.trim().length < 2) {
    return 'El nombre debe tener al menos 2 caracteres.';
  }

  const unidadesNum = parseFloat(unidades);
  if (isNaN(unidadesNum) || unidadesNum <= 0) {
    return 'Las unidades deben ser un número mayor a 0.';
  }

  if (!Number.isInteger(unidadesNum)) {
    return 'Las unidades deben ser un número entero (sin decimales).';
  }

  const pctAd = parseFloat(pct_adicionales);
  if (isNaN(pctAd) || pctAd < 0) {
    return 'El % de costos adicionales no puede ser negativo.';
  }

  if (pctAd > 100) {
    return 'El % de costos adicionales no puede superar el 100%.';
  }

  const pctBen = parseFloat(pct_beneficio);
  if (isNaN(pctBen) || pctBen < 0) {
    return 'El % de beneficio no puede ser negativo.';
  }

  if (!ingredientes || ingredientes.length === 0) {
    return 'La receta debe tener al menos un ingrediente.';
  }

  return null; // ✅ todo bien
};

// ─── INGREDIENTES ─────────────────────────────────────────────

export const validarIngrediente = ({ cantidad, unidad, material }) => {
  const cantidadNum = parseFloat(cantidad);
  if (isNaN(cantidadNum) || cantidadNum <= 0) {
    return 'La cantidad debe ser un número mayor a 0.';
  }

  if (!unidad || !unidad.trim()) {
    return 'Debes seleccionar una unidad de medida.';
  }

  if (!material) {
    return 'Debes seleccionar un material.';
  }

  return null; // ✅ todo bien
};

// ─── PEDIDOS ──────────────────────────────────────────────────

export const validarPedido = ({ nombre, productos, costoTotal }) => {
  if (!nombre || !nombre.trim()) {
    return 'El nombre del cliente es obligatorio.';
  }

  if (nombre.trim().length < 2) {
    return 'El nombre debe tener al menos 2 caracteres.';
  }

  if (!productos || productos.length === 0) {
    return 'El pedido debe tener al menos un producto.';
  }

  const costoNum = parseFloat(costoTotal);
  if (isNaN(costoNum) || costoNum < 0) {
    return 'El costo total no puede ser negativo.';
  }

  return null; // ✅ todo bien
};