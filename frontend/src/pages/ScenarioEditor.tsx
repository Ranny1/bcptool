import { useState } from 'react'
import { useScenarios, useBlockTree, useBodies, createScenario, updateScenarioDamages, applyDamageToDescendants, type ScenarioOut, type BodyOut, type BlockTreeNode } from '../api'
import {
  Card, CardContent, Typography, Button, TextField, Dialog, DialogTitle,
  DialogContent, DialogActions, Box, Table, TableBody, TableCell, TableHead,
  TableRow, Slider, Select, MenuItem, FormControl, InputLabel, IconButton,
  Tooltip, Collapse
} from '@mui/material'
import { Add as AddIcon, ChevronRight, ExpandMore } from '@mui/icons-material'

export default function ScenarioEditor() {
  const { data: scenarios, refetch } = useScenarios()
  const { data: bodies } = useBodies()
  const [selectedBody, setSelectedBody] = useState<number | null>(null)
  const { data: tree } = useBlockTree(selectedBody)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [selectedScenario, setSelectedScenario] = useState<number | null>(null)
  const [damages, setDamages] = useState<Record<number, number>>({})

  // Flatten tree preserving depth for display
  const flatBlocks = (nodes: BlockTreeNode[], depth = 0): { block: BlockTreeNode; depth: number }[] => {
    if (!nodes) return []
    return nodes.reduce((acc: { block: BlockTreeNode; depth: number }[], n: BlockTreeNode) => [
      ...acc,
      { block: n, depth },
      ...flatBlocks(n.children, depth + 1),
    ], [])
  }
  const allBlocks = flatBlocks(tree || [])

  const handleCreate = async () => {
    const res = await createScenario({ name })
    setName('')
    setOpen(false)
    refetch()
    setSelectedScenario(res.data.id)
  }

  const handleSaveDamages = async () => {
    if (!selectedScenario) return
    const damageList = Object.entries(damages)
      .filter(([_, pct]) => pct > 0)
      .map(([blockId, pct]) => ({ block_id: Number(blockId), damage_pct: pct }))
    await updateScenarioDamages(selectedScenario, damageList)
  }

  const handleApplyToDescendants = async (blockId: number, damagePct: number) => {
    if (!selectedScenario || damagePct === 0) return
    await applyDamageToDescendants(blockId, selectedScenario, damagePct)
    // Also update local state for visible blocks
    const descendants = allBlocks.filter(b => b.block.parent_block_id === blockId)
    // TODO: recursively find all descendants and update local state
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
          Add Scenario
        </Button>
        {scenarios?.map((s: ScenarioOut) => (
          <Button
            key={s.id}
            variant={selectedScenario === s.id ? 'outlined' : 'text'}
            onClick={() => { setSelectedScenario(s.id); setDamages({}) }}
          >
            {s.name}
          </Button>
        ))}
      </Box>

      {selectedScenario && (
        <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Select Body for Damage Assignment</InputLabel>
            <Select
              value={selectedBody || ''}
              label="Select Body for Damage Assignment"
              onChange={(e) => setSelectedBody(Number(e.target.value))}
            >
              {bodies?.map((b: BodyOut) => (
                <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      )}

      {selectedScenario && selectedBody && tree && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Damage Assignment</Typography>
              <Button variant="contained" size="small" onClick={handleSaveDamages}>Save Damages</Button>
            </Box>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Block</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Damage %</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {allBlocks.map(({ block, depth }) => (
                  <TableRow key={block.id}>
                    <TableCell sx={{ pl: depth * 2 + 1 }}>
                      {block.name}
                    </TableCell>
                    <TableCell>{block.block_type || '—'}</TableCell>
                    <TableCell>
                      <Slider
                        value={damages[block.id] || 0}
                        onChange={(_, v) => setDamages({ ...damages, [block.id]: v as number })}
                        min={0} max={100} step={5}
                        valueLabelDisplay="auto"
                        sx={{ width: 150 }}
                      />
                    </TableCell>
                    <TableCell>
                      {(damages[block.id] || 0) > 0 && block.children?.length > 0 && (
                        <Tooltip title="Apply same damage to all descendants">
                          <Button
                            size="small"
                            onClick={() => handleApplyToDescendants(block.id, damages[block.id])}
                          >
                            → Descendants
                          </Button>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>New Scenario</DialogTitle>
        <DialogContent>
          <TextField autoFocus label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate} variant="contained">Create</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}