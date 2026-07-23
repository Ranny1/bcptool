import { useState } from 'react'
import { useScenarios, useBlocks, createScenario, updateScenarioDamages } from '../api'
import { Card, CardContent, Typography, Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions, Box, Table, TableBody, TableCell, TableHead, TableRow, Slider } from '@mui/material'

export default function ScenarioEditor() {
  const { data: scenarios, refetch } = useScenarios()
  const { data: blocks } = useBlocks()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [selectedScenario, setSelectedScenario] = useState<number | null>(null)
  const [damages, setDamages] = useState<Record<number, number>>({})

  const handleCreate = async () => {
    const res = await createScenario({ name })
    setName('')
    setOpen(false)
    refetch()
    setSelectedScenario(res.data.id)
  }

  const handleSaveDamages = async () => {
    if (!selectedScenario) return
    const damageList = Object.entries(damages).map(([blockId, pct]) => ({
      block_id: Number(blockId),
      damage_pct: pct,
    }))
    await updateScenarioDamages(selectedScenario, damageList)
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <Button variant="contained" onClick={() => setOpen(true)}>Add Scenario</Button>
        {scenarios && (
          <Box>
            {scenarios.map((s) => (
              <Button
                key={s.id}
                variant={selectedScenario === s.id ? 'outlined' : 'text'}
                onClick={() => { setSelectedScenario(s.id); setDamages({}) }}
              >
                {s.name}
              </Button>
            ))}
          </Box>
        )}
      </Box>

      {selectedScenario && blocks && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>Damage Assignment</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Block</TableCell>
                  <TableCell>Damage %</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {blocks.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>{b.name}</TableCell>
                    <TableCell>
                      <Slider
                        value={damages[b.id] || 0}
                        onChange={(_, v) => setDamages({ ...damages, [b.id]: v as number })}
                        min={0} max={100} step={5}
                        valueLabelDisplay="auto"
                        sx={{ width: 200 }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Button variant="contained" sx={{ mt: 2 }} onClick={handleSaveDamages}>Save Damages</Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>New Scenario</DialogTitle>
        <DialogContent>
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate} variant="contained">Create</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}