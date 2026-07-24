import { useState } from 'react'
import { useScenarios, useCompute, useBodies, useBlockTree, type ScenarioOut, type BlockTreeNode } from '../api'
import {
  Card, CardContent, Typography, Select, MenuItem, Box, Table,
  TableBody, TableCell, TableHead, TableRow, LinearProgress, FormControl, InputLabel
} from '@mui/material'

const colorForSensitivity = (s: number, max: number) => {
  const ratio = s / max
  if (ratio < 0.2) return '#4caf50'
  if (ratio < 0.5) return '#ff9800'
  return '#f44336'
}

export default function Results() {
  const { data: scenarios } = useScenarios()
  const [selected, setSelected] = useState<number | null>(null)
  const { data: result, isLoading } = useCompute(selected)
  const { data: bodies } = useBodies()
  const [selectedBody, setSelectedBody] = useState<number | null>(null)
  const { data: tree } = useBlockTree(selectedBody)

  // Flatten tree for block name lookup
  const flatBlocks = (nodes: BlockTreeNode[]): BlockTreeNode[] => {
    if (!nodes) return []
    return nodes.reduce((acc: BlockTreeNode[], n: BlockTreeNode) => [...acc, n, ...flatBlocks(n.children)], [])
  }
  const allBlocks = flatBlocks(tree || [])
  const maxSensitivity = result ? Math.max(...result.missions.map(m => m.sensitivity), 1) : 1

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Scenario</InputLabel>
          <Select
            value={selected || ''}
            label="Scenario"
            onChange={(e) => setSelected(e.target.value as number)}
          >
            <MenuItem value="" disabled>Select Scenario</MenuItem>
            {scenarios?.map((s: ScenarioOut) => (
              <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Body (for block details)</InputLabel>
          <Select
            value={selectedBody || ''}
            label="Body (for block details)"
            onChange={(e) => setSelectedBody(Number(e.target.value))}
          >
            <MenuItem value="">All Bodies</MenuItem>
            {bodies?.map((b: { id: number; name: string }) => (
              <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {isLoading && <LinearProgress />}

      {result && (
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Card sx={{ flex: 1, minWidth: 400 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>Mission Sensitivity</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Mission</TableCell>
                    <TableCell>Importance</TableCell>
                    <TableCell>Capacity %</TableCell>
                    <TableCell>Sensitivity</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {result.missions.map((m: { mission_id: number; mission_name: string; importance: number; capacity_pct: number; sensitivity: number }) => (
                    <TableRow key={m.mission_id}>
                      <TableCell>{m.mission_name}</TableCell>
                      <TableCell>{m.importance}/5</TableCell>
                      <TableCell>{m.capacity_pct.toFixed(1)}%</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{
                            width: 100, height: 20, borderRadius: 1,
                            bgcolor: colorForSensitivity(m.sensitivity, maxSensitivity)
                          }} />
                          {m.sensitivity.toFixed(1)}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card sx={{ flex: 1, minWidth: 400 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>Block Effective Capacity</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Block</TableCell>
                    <TableCell>Direct Damage</TableCell>
                    <TableCell>Effective Capacity</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {result.blocks.map((b: { block_id: number; block_name: string; direct_damage_pct: number; effective_capacity_pct: number }) => (
                    <TableRow key={b.block_id}>
                      <TableCell>{b.block_name}</TableCell>
                      <TableCell>{b.direct_damage_pct.toFixed(1)}%</TableCell>
                      <TableCell>{b.effective_capacity_pct.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Box>
      )}
    </Box>
  )
}