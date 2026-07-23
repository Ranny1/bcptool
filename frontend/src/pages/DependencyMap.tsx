import { useMemo } from 'react'
import ReactFlow, { Background, Controls, MiniMap, Node, Edge } from 'reactflow'
import 'reactflow/dist/style.css'
import { useBlocks, useDependencies, useBodies } from '../api'
import { Box, Typography, MenuItem, Select, FormControl, InputLabel } from '@mui/material'
import { useState } from 'react'

export default function DependencyMap() {
  const { data: bodies } = useBodies()
  const [bodyFilter, setBodyFilter] = useState<string>('')
  const { data: blocks } = useBlocks(bodyFilter ? Number(bodyFilter) : undefined)
  const { data: deps } = useDependencies()

  const nodes: Node[] = useMemo(() => {
    if (!blocks) return []
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
    return deps
      .filter(d => !bodyFilter || blocks?.some(b => b.id === d.dependent_block_id || b.id === d.dependency_block_id))
      .map((d) => ({
        id: String(d.id),
        source: String(d.dependent_block_id),
        target: String(d.dependency_block_id),
        label: `${d.strength}/5`,
        animated: d.strength >= 4,
        style: { strokeWidth: d.strength },
      }))
  }, [deps, blocks, bodyFilter])

  return (
    <Box>
      <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Filter by Body</InputLabel>
          <Select
            value={bodyFilter}
            label="Filter by Body"
            onChange={(e) => setBodyFilter(e.target.value as string)}
          >
            <MenuItem value="">All Bodies</MenuItem>
            {bodies?.map((b) => (
              <MenuItem key={b.id} value={String(b.id)}>{b.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Typography variant="body2" color="text.secondary">
          {nodes.length} blocks, {edges.length} dependencies
        </Typography>
      </Box>
      <div style={{ height: '65vh', border: '1px solid #ccc', borderRadius: 8 }}>
        <ReactFlow nodes={nodes} edges={edges}>
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
    </Box>
  )
}