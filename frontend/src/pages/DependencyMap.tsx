import { useMemo } from 'react'
import ReactFlow, { Background, Controls, MiniMap, Node, Edge } from 'reactflow'
import 'reactflow/dist/style.css'
import { useBlocks, useDependencies } from '../api'

export default function DependencyMap() {
  const { data: blocks } = useBlocks()
  const { data: deps } = useDependencies()

  const nodes: Node[] = useMemo(() => {
    if (!blocks) return []
    // Simple circular layout
    const n = blocks.length
    return blocks.map((b, i) => ({
      id: String(b.id),
      data: { label: b.name },
      position: {
        x: 300 + 250 * Math.cos((2 * Math.PI * i) / Math.max(n, 1)),
        y: 250 + 250 * Math.sin((2 * Math.PI * i) / Math.max(n, 1)),
      },
      style: b.is_external ? { border: '2px dashed orange' } : {},
    }))
  }, [blocks])

  const edges: Edge[] = useMemo(() => {
    if (!deps) return []
    return deps.map((d) => ({
      id: String(d.id),
      source: String(d.dependent_block_id),
      target: String(d.dependency_block_id),
      label: `${d.strength}/5`,
      animated: d.strength >= 4,
      style: { strokeWidth: d.strength },
    }))
  }, [deps])

  return (
    <div style={{ height: '70vh', border: '1px solid #ccc', borderRadius: 8 }}>
      <ReactFlow nodes={nodes} edges={edges}>
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  )
}