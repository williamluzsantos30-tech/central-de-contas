/**
 * Estado da conexão/sincronização de criativos Meta Ads (Funil Tráfego),
 * re-lido quando o Business Manager ou a sincronização mudam na mesma aba.
 */
import { useEffect, useState } from 'react'
import { EVENTO_AGENCIA_ADS } from '@/components/ads/adsPlatform'
import { EVENTO_SYNC_CRIATIVOS, estadoCriativosMeta, type EstadoCriativosMeta } from './mockMetaAdsData'

export function useEstadoCriativosMeta(): EstadoCriativosMeta {
  const [estado, setEstado] = useState<EstadoCriativosMeta>(() => estadoCriativosMeta())
  useEffect(() => {
    const reler = () => setEstado(estadoCriativosMeta())
    window.addEventListener(EVENTO_SYNC_CRIATIVOS, reler)
    window.addEventListener(EVENTO_AGENCIA_ADS, reler)
    return () => {
      window.removeEventListener(EVENTO_SYNC_CRIATIVOS, reler)
      window.removeEventListener(EVENTO_AGENCIA_ADS, reler)
    }
  }, [])
  return estado
}
