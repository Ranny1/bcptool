import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

const API = axios.create({ baseURL: '/api' })

// ── Types ────────────────────────────────────────────────────
export interface BodyOut { id: number; name: string; description?: string; parent_body_id?: number; organization_id: number }
export interface BlockOut { id: number; name: string; description?: string; parent_block_id?: number; is_external: boolean; block_type?: string; body_id?: number }
export interface MissionOut { id: number; name: string; description?: string; importance: number; organization_id?: number; body_id?: number }
export interface DependencyOut { id: number; dependent_block_id: number; dependency_block_id: number; strength: number; description?: string }
export interface ScenarioOut { id: number; name: string; description?: string }
export interface ComputeResult {
  blocks: { block_id: number; block_name: string; direct_damage_pct: number; effective_capacity_pct: number }[]
  missions: { mission_id: number; mission_name: string; importance: number; capacity_pct: number; sensitivity: number }[]
}

// ── Hooks ────────────────────────────────────────────────────
export function useBodies() {
  return useQuery({ queryKey: ['bodies'], queryFn: () => API.get<BodyOut[]>('/bodies/').then(r => r.data) })
}

export function useBlocks(bodyId?: number) {
  return useQuery({
    queryKey: ['blocks', bodyId],
    queryFn: () => API.get<BlockOut[]>('/blocks/', { params: bodyId ? { body_id: bodyId } : {} }).then(r => r.data),
  })
}

export function useMissions(bodyId?: number) {
  return useQuery({
    queryKey: ['missions', bodyId],
    queryFn: () => API.get<MissionOut[]>('/missions/', { params: bodyId ? { body_id: bodyId } : {} }).then(r => r.data),
  })
}

export function useDependencies(blockId?: number) {
  return useQuery({
    queryKey: ['dependencies', blockId],
    queryFn: () => API.get<DependencyOut[]>('/dependencies/', { params: blockId ? { block_id: blockId } : {} }).then(r => r.data),
  })
}

export function useScenarios() {
  return useQuery({ queryKey: ['scenarios'], queryFn: () => API.get<ScenarioOut[]>('/scenarios/').then(r => r.data) })
}

export function useCompute(scenarioId: number | null) {
  return useQuery({
    enabled: scenarioId !== null,
    queryKey: ['compute', scenarioId],
    queryFn: () => API.post<ComputeResult>('/compute/', { scenario_id: scenarioId, mitigations_enabled: false }).then(r => r.data),
  })
}

// ── Mutations ─────────────────────────────────────────────────
export async function createBody(data: { name: string; organization_id: number; description?: string }) {
  return API.post('/bodies/', data)
}

export async function createBlock(data: { name: string; body_id: number; description?: string; block_type?: string; is_external?: boolean }) {
  return API.post('/blocks/', data)
}

export async function createDependency(data: { dependent_block_id: number; dependency_block_id: number; strength: number }) {
  return API.post('/dependencies/', data)
}

export async function createMission(data: { name: string; body_id?: number; organization_id?: number; importance?: number }) {
  return API.post('/missions/', data)
}

export async function createScenario(data: { name: string; description?: string }) {
  return API.post('/scenarios/', data)
}

export async function updateScenarioDamages(scenarioId: number, damages: { block_id: number; damage_pct: number }[]) {
  return API.put(`/scenarios/${scenarioId}/damages`, { damages })
}

export { API }