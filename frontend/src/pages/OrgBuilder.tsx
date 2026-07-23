import { useState } from 'react'
import { useBodies, useBlockTree, createBlock, deleteBlock, reparentBlock, createBody } from '../api'
import {
  Box, Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions,
  Card, CardContent, Typography, IconButton, MenuItem, Select, Tooltip,
  Collapse, Chip
} from '@mui/material'
import {
  Add as AddIcon, Delete as DeleteIcon, Folder as FolderIcon,
  Description as FileIcon, Business as BusinessIcon,
  ChevronRight, ChevronDown, DragIndicator
} from '@mui/icons-material'

// ── Tree node rendering ─────────────────────────────────────
interface TreeNodeProps {
  node: BlockTreeNode
  depth: number
  selectedId: number | null
  onSelect: (id: number) => void
  onAddChild: (parentId: number) => void
  onDelete: (id: number, name: string) => void
}

function TreeNode({ node, depth, selectedId, onSelect, onAddChild, onDelete }: TreeNodeProps) {
  const [open, setOpen] = useState(true)
  const hasChildren = node.children && node.children.length > 0
  const isSelected = selectedId === node.id

  return (
    <Box>
      <Box
        sx={{
          display: 'flex', alignItems: 'center', gap: 0.5,
          pl: depth * 2, py: 0.25,
          bgcolor: isSelected ? 'primary.light' : 'transparent',
          borderRadius: 1, cursor: 'pointer',
          '&:hover': { bgcolor: 'action.hover' },
        }}
        onClick={() => onSelect(node.id)}
      >
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); setOpen(!open) }}>
          {hasChildren ? (open ? <ChevronDown fontSize="small" /> : <ChevronRight fontSize="small" />) : null}
        </IconButton>
        {hasChildren ? <FolderIcon fontSize="small" color="action" /> : <FileIcon fontSize="small" color="disabled" />}
        <Typography variant="body2" sx={{ flex: 1, fontWeight: isSelected ? 600 : 400 }}>
          {node.name}
        </Typography>
        {node.block_type && (
          <Chip label={node.block_type} size="small" sx={{ height: 18, fontSize: 10 }} />
        )}
        {hasChildren && (
          <Typography variant="caption" color="text.secondary">
            {node.children.length}
          </Typography>
        )}
        <Tooltip title="Add child block">
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onAddChild(node.id) }}>
            <AddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete">
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDelete(node.id, node.name) }}>
            <DeleteIcon fontSize="small" color="error" />
          </IconButton>
        </Tooltip>
      </Box>
      <Collapse in={open}>
        {hasChildren && node.children.map((child) => (
          <TreeNode
            key={child.id}
            node={child}
            depth={depth + 1}
            selectedId={selectedId}
            onSelect={onSelect}
            onAddChild={onAddChild}
            onDelete={onDelete}
          />
        ))}
      </Collapse>
    </Box>
  )
}

// ── Main TreeBuilder component ──────────────────────────────
export default function TreeBuilder() {
  const { data: bodies, refetch: refetchBodies } = useBodies()
  const [selectedBody, setSelectedBody] = useState<number | null>(null)
  const { data: tree, refetch: refetchTree } = useBlockTree(selectedBody)

  const [selectedBlock, setSelectedBlock] = useState<number | null>(null)
  const [openAddBlock, setOpenAddBlock] = useState(false)
  const [openAddBody, setOpenAddBody] = useState(false)
  const [openAddChild, setOpenAddChild] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null)

  const [newBlockName, setNewBlockName] = useState('')
  const [newBlockType, setNewBlockType] = useState('')
  const [newBodyName, setNewBodyName] = useState('')

  const handleAddBody = async () => {
    await createBody({ name: newBodyName, organization_id: 1 })
    setNewBodyName('')
    setOpenAddBody(false)
    refetchBodies()
  }

  const handleAddRootBlock = async () => {
    if (!selectedBody) return
    await createBlock({ name: newBlockName, body_id: selectedBody, block_type: newBlockType || undefined })
    setNewBlockName('')
    setNewBlockType('')
    setOpenAddBlock(false)
    refetchTree()
  }

  const handleAddChild = async () => {
    if (openAddChild === null) return
    await createBlock({ name: newBlockName, body_id: selectedBody!, parent_block_id: openAddChild, block_type: newBlockType || undefined })
    setNewBlockName('')
    setNewBlockType('')
    setOpenAddChild(null)
    refetchTree()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await deleteBlock(deleteTarget.id)
    setDeleteTarget(null)
    refetchTree()
  }

  // Find selected block details from flattened tree
  const flatBlocks = (nodes: BlockTreeNode[] | undefined): BlockTreeNode[] => {
    if (!nodes) return []
    return nodes.reduce((acc: BlockTreeNode[], n) => [...acc, n, ...flatBlocks(n.children)], [])
  }
  const selectedBlockData = flatBlocks(tree).find(b => b.id === selectedBlock)

  return (
    <Box sx={{ display: 'flex', gap: 2 }}>
      {/* Left: Body list */}
      <Card sx={{ minWidth: 200, maxWidth: 250 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="h6">Bodies</Typography>
            <IconButton size="small" onClick={() => setOpenAddBody(true)}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Box>
          {bodies?.map((b) => (
            <Box
              key={b.id}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1,
                p: 0.5, borderRadius: 1, cursor: 'pointer',
                bgcolor: selectedBody === b.id ? 'primary.light' : 'transparent',
                '&:hover': { bgcolor: 'action.hover' },
              }}
              onClick={() => { setSelectedBody(b.id); setSelectedBlock(null) }}
            >
              <BusinessIcon fontSize="small" />
              <Typography variant="body2">{b.name}</Typography>
            </Box>
          ))}
        </CardContent>
      </Card>

      {/* Center: Block tree */}
      <Card sx={{ flex: 1, minWidth: 400 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              {selectedBody ? 'Block Tree' : 'Select a body'}
            </Typography>
            {selectedBody && (
              <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => setOpenAddBlock(true)}>
                Add Root Block
              </Button>
            )}
          </Box>
          {tree && tree.length > 0 && (
            <Box sx={{ maxHeight: '70vh', overflow: 'auto' }}>
              {tree.map((node) => (
                <TreeNode
                  key={node.id}
                  node={node}
                  depth={0}
                  selectedId={selectedBlock}
                  onSelect={setSelectedBlock}
                  onAddChild={(pid) => { setOpenAddChild(pid); setNewBlockName(''); setNewBlockType('') }}
                  onDelete={(id, name) => setDeleteTarget({ id, name })}
                />
              ))}
            </Box>
          )}
          {tree && tree.length === 0 && (
            <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              No blocks yet. Click "Add Root Block" to start.
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Right: Block details */}
      <Card sx={{ minWidth: 250, maxWidth: 300 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>Details</Typography>
          {selectedBlockData ? (
            <Box>
              <Typography variant="body2"><strong>Name:</strong> {selectedBlockData.name}</Typography>
              {selectedBlockData.description && (
                <Typography variant="body2"><strong>Description:</strong> {selectedBlockData.description}</Typography>
              )}
              <Typography variant="body2"><strong>Type:</strong> {selectedBlockData.block_type || 'untyped'}</Typography>
              <Typography variant="body2"><strong>External:</strong> {selectedBlockData.is_external ? 'Yes' : 'No'}</Typography>
              <Typography variant="body2"><strong>Children:</strong> {selectedBlockData.children.length}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                ID: {selectedBlockData.id}
              </Typography>
            </Box>
          ) : (
            <Typography color="text.secondary">Select a block to see details</Typography>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <Dialog open={openAddBody} onClose={() => setOpenAddBody(false)}>
        <DialogTitle>New Body</DialogTitle>
        <DialogContent>
          <TextField autoFocus label="Name" value={newBodyName} onChange={(e) => setNewBodyName(e.target.value)} fullWidth sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAddBody(false)}>Cancel</Button>
          <Button onClick={handleAddBody} variant="contained">Create</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openAddBlock} onClose={() => setOpenAddBlock(false)}>
        <DialogTitle>Add Root Block</DialogTitle>
        <DialogContent>
          <TextField autoFocus label="Name" value={newBlockName} onChange={(e) => setNewBlockName(e.target.value)} fullWidth sx={{ mt: 1 }} />
          <TextField label="Type (facility, server, process...)" value={newBlockType} onChange={(e) => setNewBlockType(e.target.value)} fullWidth sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAddBlock(false)}>Cancel</Button>
          <Button onClick={handleAddRootBlock} variant="contained">Create</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openAddChild !== null} onClose={() => setOpenAddChild(null)}>
        <DialogTitle>Add Child Block</DialogTitle>
        <DialogContent>
          <TextField autoFocus label="Name" value={newBlockName} onChange={(e) => setNewBlockName(e.target.value)} fullWidth sx={{ mt: 1 }} />
          <TextField label="Type" value={newBlockType} onChange={(e) => setNewBlockType(e.target.value)} fullWidth sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAddChild(null)}>Cancel</Button>
          <Button onClick={handleAddChild} variant="contained">Create</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteTarget !== null} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete "{deleteTarget?.name}"?</DialogTitle>
        <DialogContent>
          <Typography>
            This will also delete all descendant blocks. This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button onClick={handleDelete} variant="contained" color="error">Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}