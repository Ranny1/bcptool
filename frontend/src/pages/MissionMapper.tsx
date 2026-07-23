import { useState } from 'react'
import { useMissions, useBlocks, createMission } from '../api'
import { Card, CardContent, Typography, List, ListItem, ListItemText, Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions, Box, Rating } from '@mui/material'

export default function MissionMapper() {
  const { data: missions, refetch } = useMissions()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [importance, setImportance] = useState(3)

  const handleCreate = async () => {
    await createMission({ name, body_id: 1, importance }) // TODO: body selector
    setName('')
    setImportance(3)
    setOpen(false)
    refetch()
  }

  return (
    <Box>
      <Button variant="contained" sx={{ mb: 2 }} onClick={() => setOpen(true)}>Add Mission</Button>
      <Card>
        <CardContent>
          <Typography variant="h6">Missions</Typography>
          <List>
            {missions?.map((m) => (
              <ListItem key={m.id}>
                <ListItemText
                  primary={m.name}
                  secondary={`Importance: ${m.importance}/5 ${m.body_id ? '· Body mission' : '· Org mission'}`}
                />
                <Rating value={m.importance} readOnly max={5} />
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>New Mission</DialogTitle>
        <DialogContent>
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth sx={{ mt: 1 }} />
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