import { useState } from 'react'
import { useMissions, useBlockTree, useBodies, createMission, createContribution } from '../api'
import {
  Card, CardContent, Typography, List, ListItem, ListItemText, Button,
  TextField, Dialog, DialogTitle, DialogContent, DialogActions, Box, Rating,
  Select, MenuItem, FormControl, InputLabel, Chip, IconButton
} from '@mui/material'
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { deleteContribution } from '../api'

export default function MissionMapper() {
  const { data: bodies } = useBodies()
  const [selectedBody, setSelectedBody] = useState<number | null>(null)
  const { data: missions, refetch } = useMissions(selectedBody || undefined)
  const { data: tree } = useBlockTree(selectedBody)

  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [importance, setImportance] = useState(3)

  // Flatten tree to get all blocks for the selector
  const flatBlocks = (nodes: any[]): any[] => {
    if (!nodes) return []
    return nodes.reduce((acc: any[], n) => [...acc, n, ...flatBlocks(n.children)], [])
  }
  const allBlocks = flatBlocks(tree || [])

  const handleCreate = async () => {
    await createMission({ name, body_id: selectedBody!, importance })
    setName('')
    setImportance(3)
    setOpen(false)
    refetch()
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Select Body</InputLabel>
          <Select
            value={selectedBody || ''}
            label="Select Body"
            onChange={(e) => setSelectedBody(Number(e.target.value))}
          >
            {bodies?.map((b) => (
              <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        {selectedBody && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
            Add Mission
          </Button>
        )}
      </Box>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>Missions</Typography>
          {!selectedBody && <Typography color="text.secondary">Select a body to see its missions</Typography>}
          {missions?.map((m) => (
            <MissionCard key={m.id} mission={m} allBlocks={allBlocks} onUpdate={refetch} />
          ))}
        </CardContent>
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>New Mission</DialogTitle>
        <DialogContent>
          <TextField autoFocus label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth sx={{ mt: 1 }} />
          <Box sx={{ mt: 2 }}>
            <Typography>Importance</Typography>
            <Rating value={importance} onChange={(_, v) => setImportance(v || 3)} max={5} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate} variant="contained">Create</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

function MissionCard({ mission, allBlocks, onUpdate }: { mission: any; allBlocks: any[]; onUpdate: () => void }) {
  const [showBlocks, setShowBlocks] = useState(false)
  const [selectedBlock, setSelectedBlock] = useState('')
  const [strength, setStrength] = useState(3)

  const handleAddBlock = async () => {
    if (!selectedBlock) return
    await createContribution({ block_id: Number(selectedBlock), mission_id: mission.id, strength })
    setSelectedBlock('')
    setStrength(3)
    onUpdate()
  }

  return (
    <Box sx={{ mb: 2, p: 1, border: '1px solid #eee', borderRadius: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <ListItemText
          primary={mission.name}
          secondary={`Importance: ${mission.importance}/5`}
        />
        <Rating value={mission.importance} readOnly max={5} size="small" />
        <Button size="small" onClick={() => setShowBlocks(!showBlocks)}>
          {showBlocks ? 'Hide' : 'Manage'} Blocks
        </Button>
      </Box>
      {showBlocks && (
        <Box sx={{ mt: 1, pl: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Contributing blocks:
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Block</InputLabel>
              <Select value={selectedBlock} label="Block" onChange={(e) => setSelectedBlock(e.target.value)}>
                {allBlocks.map((b) => (
                  <MenuItem key={b.id} value={String(b.id)}>{b.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 80 }}>
              <InputLabel>Strength</InputLabel>
              <Select value={String(strength)} label="Strength" onChange={(e) => setStrength(Number(e.target.value))}>
                {[1, 2, 3, 4, 5].map(s => <MenuItem key={s} value={String(s)}>{s}</MenuItem>)}
              </Select>
            </FormControl>
            <Button size="small" variant="outlined" onClick={handleAddBlock}>Add</Button>
          </Box>
        </Box>
      )}
    </Box>
  )
}