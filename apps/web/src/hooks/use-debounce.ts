"use client";

import { useEffect, useState } from "react";

/**
 * Devuelve el valor solo cuando deja de cambiar durante `espera`.
 *
 * Existe por el buscador de destinos. Sin esto, escribir «angelópolis» son
 * once consultas al geocodificador —diez de ellas a prefijos que a nadie le
 * importan—, y detrás hay un servicio gratuito ajeno al que no se le puede
 * hacer eso. También ahorra datos del teléfono de quien busca.
 *
 * Lo que el usuario escribe se ve al instante: lo que espera es la consulta,
 * no el campo.
 */
export function useDebounce<T>(valor: T, espera = 350): T {
  const [retrasado, setRetrasado] = useState(valor);

  useEffect(() => {
    const reloj = setTimeout(() => setRetrasado(valor), espera);
    return () => clearTimeout(reloj);
  }, [valor, espera]);

  return retrasado;
}
