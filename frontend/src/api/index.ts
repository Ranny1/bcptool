import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

const API = axios.create({ baseURL: '/api' })

// ── Types ────────────────────────────────────────────────────
export interface BodyOut {
  id: number
  name: string
  description?: string
  parent_body_id?: number
  organization_id: number
}

export interface BlockOut {
  id: number
  name: string
  description?: string
  parent_block_id?: number | null
  body_id?: number | null
  is_external: boolean
  block_type?: string
}

export interface BlockTreeNode {
  id: number
  name: string
  description?: string
  parent_block_id?: number | null
  body_id?: number | null
  is_external: boolean
  block_type?: string
  children: BlockTreeNode[]
}

export interface MissionOut {
  id: number
  name: string
  description?: string
  importance: number
  organization_id?: number | null
  body_id?: number | null
}

export interface DependencyOut {
  id: number
  dependent_block_id: number
  dependency_block_id: number
  strength: number
  description?: string
}

export interface ScenarioOut {
  id: number
  name: string
  description?: string
}

export interface ComputeResult {
  blocks: { block_id: number; block_name: string; direct_damage_pct: number; effective_capacity_pct: number }[]
  missions: { mission_id: number; mission_name: string; importance: number; capacity_pct: number; sensitivity: number }[]
}

// ── Body hooks ───────────────────────────────────────────────
export function useBodies() {
  return useQuery<BodyOut[]>({ queryKey: ['bodies'], queryFn: async () => (await API.get<BodyOut[]>('/bodies/')).data })
}

export async function createBody(data: { name: string; organization_id: number; description?: string }) {
  return API.post('/bodies/', data)
}

export async function updateBody(id: number, data: Partial<BodyOut>) {
  return API.put(`/bodies/${id}/`, data)
}

export async function deleteBody(id: number) {
  return API.delete(`/bodies/${id}/`)
}

// ── Block hooks ──────────────────────────────────────────────
export function useBlocks(bodyId?: number) {
  return useQuery<BlockOut[]>({
    queryKey: ['blocks', bodyId],
    queryFn: async () => (await API.get<BlockOut[]>('/blocks/', { params: bodyId ? { body_id: bodyId } : {} })).data,
  })
}

export function useBlockTree(bodyId: number | null) {
  return useQuery<BlockTreeNode[]>({
    enabled: bodyId !== null,
    queryKey: ['block-tree', bodyId],
    queryFn: async () => (await API.get<BlockTreeNode[]>(`/blocks/tree/${bodyId}`)).data,
  })
}

export async function createBlock(data: {
  name: string
  body_id?: number
  parent_block_id?: number
  description?: string
  block_type?: string
  is_external?: boolean
}) {
  return API.post('/blocks/', data)
}

export async function updateBlock(id: number, data: Partial<BlockOut>) {
  return API.put(`/blocks/${id}/`, data)
}

export async function deleteBlock(id: number) {
  return API.delete(`/blocks/${id}/`)
}

export async function reparentBlock(blockId: number, newParentId: number | null) {
  return API.post(`/blocks/${blockId}/reparent`, { new_parent_id: newParentId })
}

export async function getBlockDescendants(blockId: number) {
  return API.get<BlockOut[]>(`/blocks/${blockId}/descendants`).then(r => r.data)
}

export async function applyDamageToDescendants(blockId: number, scenarioId: number, damagePct: number) {
  return API.post(`/blocks/${blockId}/apply-damage-to-descendants?scenario_id=${scenarioId}`, {
    damage_pct: damagePct,
  })
}

// ── Mission hooks ────────────────────────────────────────────
export function useMissions(bodyId?: number) {
  return useQuery<MissionOut[]>({
    queryKey: ['missions', bodyId],
    queryFn: async () => (await API.get<MissionOut[]>('/missions/', { params: bodyId ? { body_id: bodyId } : {} })).data,
  })
}

export async function createMission(data: { name: string; body_id?: number; organization_id?: number; importance?: number }) {
  return API.post('/missions/', data)
}

export async function updateMission(id: number, data: Partial<MissionOut>) {
  return API.put(`/missions/${id}/`, data)
}

export async function deleteMission(id: number) {
  return API.delete(`/missions/${id}/`)
}

// ── Dependency hooks ─────────────────────────────────────────
export function useDependencies(blockId?: number) {
  return useQuery<DependencyOut[]>({
    queryKey: ['dependencies', blockId],
    queryFn: async () => (await API.get<DependencyOut[]>('/dependencies/', { params: blockId ? { block_id: blockId } : {} })).data,
  })
}

export async function createDependency(data: { dependent_block_id: number; dependency_block_id: number; strength: number }) {
  return API.post('/dependencies/', data)
}

export async function deleteDependency(id: number) {
  return API.delete(`/dependencies/${id}/`)
}

// ── Contribution hooks ───────────────────────────────────────
export interface ContributionOut {
  id: number
  block_id: number
  mission_id: number
  strength: number
}

export function useContributions(blockId: number | null) {
  return useQuery<ContributionOut[]>({
    enabled: blockId !== null,
    queryKey: ['contributions', blockId],
    queryFn: async () => (await API.get<ContributionOut[]>('/contributions/', { params: blockId ? { block_id: blockId } : {} })).data,
  })
}

export function useAllMissions() {
  return useQuery<MissionOut[]>({ queryKey: ['all-missions'], queryFn: async () => (await API.get<MissionOut[]>('/missions/')).data })
}

export async function createContribution(data: { block_id: number; mission_id: number; strength: number }) {
  return API.post('/contributions/', data)
}

export async function deleteContribution(id: number) {
  return API.delete(`/contributions/${id}/`)
}

// ── Scenario hooks ───────────────────────────────────────────
export function useScenarios() {
  return useQuery<ScenarioOut[]>({ queryKey: ['scenarios'], queryFn: async () => (await API.get<ScenarioOut[]>('/scenarios/')).data })
}

export async function createScenario(data: { name: string; description?: string }) {
  return API.post<ScenarioOut>('/scenarios/', data)
}

export async function updateScenarioDamages(scenarioId: number, damages: { block_id: number; damage_pct: number }[]) {
  return API.put(`/scenarios/${scenarioId}/damages`, { damages })
}

// ── Compute hooks ────────────────────────────────────────────
export function useCompute(scenarioId: number | null) {
  return useQuery<ComputeResult>({
    enabled: scenarioId !== null,
    queryKey: ['compute', scenarioId],
    queryFn: async () => (await API.post<ComputeResult>('/compute/', { scenario_id: scenarioId, mitigations_enabled: false })).data,
  })
}

export { API }