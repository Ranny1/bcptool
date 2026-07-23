import { useState } from 'react'
import { useBodies, useBlocks, createBody, createBlock } from '../api'
import { Card, CardContent, Typography, List, ListItem, ListItemText, Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions, Box, Chip } from '@mui/material'

export default function OrgBuilder() {
  const { data: bodies, refetch: refetchBodies } = useBodies()
  const [selectedBody, setSelectedBody] = useState<number | null>(null)
  const { data: blocks } = useBlocks(selectedBody || undefined)
  const [openBody, setOpenBody] = useState(false)
  const [openBlock, setOpenBlock] = useState(false)
  const [newBodyName, setNewBodyName] = useState('')
  const [newBlockName, setNewBlockName] = useState('')
  const [newBlockType, setNewBlockType] = useState('')

  const handleCreateBody = async () => {
    await createBody({ name: newBodyName, organization_id: 1 })
    setNewBodyName('')
    setOpenBody(false)
    refetchBodies()
  }

  const handleCreateBlock = async () => {
    if (!selectedBody) return
    await createBlock({ name: newBlockName, body_id: selectedBody, block_type: newBlockType })
    setNewBlockName('')
    setNewBlockType('')
    setOpenBlock(false)
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <Button variant="contained" onClick={() => setOpenBody(true)}>Add Body</Button>
        {selectedBody && <Button variant="contained" onClick={() => setOpenBlock(true)}>Add Block</Button>}
      </Box>

      <Box sx={{ display: 'flex', gap: 2 }}>
        <Card sx={{ minWidth: 300 }}>
          <CardContent>
            <Typography variant="h6">Bodies</Typography>
            <List>
              {bodies?.map((b) => (
                <ListItem
                  key={b.id}
                  button
                  selected={selectedBody === b.id}
                  onClick={() => setSelectedBody(b.id)}
                >
                  <ListItemText primary={b.name} secondary={b.description} />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>

        {selectedBody && (
          <Card sx={{ minWidth: 300, flex: 1 }}>
            <CardContent>
              <Typography variant="h6">Blocks</Typography>
              <List>
                {blocks?.map((bl) => (
                  <ListItem key={bl.id}>
                    <ListItemText
                      primary={bl.name}
                      secondary={`${bl.block_type || 'untyped'}${bl.is_external ? ' · External' : ''}`}
                    />
                    {bl.is_external && <Chip size="small" label="EXT" color="warning" />}
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        )}
      </Box>

      <Dialog open={openBody} onClose={() => setOpenBody(false)}>
        <DialogTitle>New Body</DialogTitle>
        <DialogContent>
          <TextField label="Name" value={newBodyName} onChange={(e) => setNewBodyName(e.target.value)} fullWidth sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenBody(false)}>Cancel</Button>
          <Button onClick={handleCreateBody} variant="contained">Create</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openBlock} onClose={() => setOpenBlock(false)}>
        <DialogTitle>New Block</DialogTitle>
        <DialogContent>
          <TextField label="Name" value={newBlockName} onChange={(e) => setNewBlockName(e.target.value)} fullWidth sx={{ mt: 1 }} />
          <TextField label="Type (facility, server, process...)" value={newBlockType} onChange={(e) => setNewBlockType(e.target.value)} fullWidth sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenBlock(false)}>Cancel</Button>
          <Button onClick={handleCreateBlock} variant="contained">Create</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}