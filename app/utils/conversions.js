export const UNIDADES = ['g', 'kg', 'ml', 'L', 'unidad'];

// Qué tipo es cada unidad
export const TIPO_UNIDAD = {
  g:      'masa',
  kg:     'masa',
  ml:     'volumen',
  L:      'volumen',
  unidad: 'unidad',
};

export const getFactor = (unit) => {
  switch (unit) {
    case 'kg':   return 1000;
    case 'g':    return 1;
    case 'L':    return 1000;
    case 'ml':   return 1;
    default:     return 1;
  }
};

// Devuelve true si las dos unidades son compatibles entre sí
export const sonCompatibles = (unidadA, unidadB) => {
  if (!unidadA || !unidadB) return true;
  if (unidadA === unidadB) return true;

  const tipoA = TIPO_UNIDAD[unidadA];
  const tipoB = TIPO_UNIDAD[unidadB];

  if (!tipoA || !tipoB) return true; // si no conocemos la unidad, no bloqueamos

  return tipoA === tipoB;
};

// Mensaje de error para mostrar al usuario
export const mensajeIncompatibilidad = (unidadMaterial, unidadReceta) => {
  const tipoMat = TIPO_UNIDAD[unidadMaterial];
  const tipoRec = TIPO_UNIDAD[unidadReceta];

  return (
    `No se puede convertir ${unidadReceta} (${tipoRec}) ` +
    `a ${unidadMaterial} (${tipoMat}).\n\n` +
    `Usa una unidad de tipo ${tipoMat}.`
  );
};

export const convertir = (cantidad, de, a) => {
  if (!de || !a || de === a) return cantidad;

  const masa    = ['kg', 'g'];
  const volumen = ['L', 'ml',];

  if (masa.includes(de) && masa.includes(a)) {
    return cantidad * (getFactor(de) / getFactor(a));
  }

  if (volumen.includes(de) && volumen.includes(a)) {
    return cantidad * (getFactor(de) / getFactor(a));
  }

  // Incompatible — devuelve 0 para no contaminar el cálculo
  return 0;
};

export const calcularCostoIngrediente = (ing) => {
  const cantBase = convertir(
    ing.cantidad,
    ing.unidad_receta || ing.unidad,
    ing.unidad_base   || ing.unidad
  );

  // Si cantBase es 0, hubo incompatibilidad — el costo es 0 en vez de incorrecto
  if (cantBase === 0 && ing.cantidad > 0) return 0;

  return (ing.precio / ing.contenido) * cantBase;
};