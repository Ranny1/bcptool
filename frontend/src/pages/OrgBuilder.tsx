import { useState, useRef, useMemo, useCallback } from 'react'
import {
  useBodies, useBlockTree, useDependencies, useMissions, useContributions, useAllMissions,
  createBlock, deleteBlock, reparentBlock, createBody, updateBlock,
  createDependency, deleteDependency, createContribution, deleteContribution,
  type BlockTreeNode, type BodyOut, type MissionOut, type DependencyOut, type ContributionOut,
} from '../api'
import { useQueryClient } from '@tanstack/react-query'
import {
  Box, Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions,
  Card, CardContent, Typography, IconButton, Tooltip, Collapse, Chip,
  Tabs, Tab, Autocomplete, Slider, Rating, Divider, Paper, InputAdornment,
  Select, MenuItem, FormControl, InputLabel, ToggleButtonGroup, ToggleButton,
} from '@mui/material'
import {
  Add as AddIcon, Delete as DeleteIcon, Folder as FolderIcon,
  Description as FileIcon, Business as BusinessIcon,
  ChevronRight, ExpandMore, DragIndicator, Search as SearchIcon,
  UnfoldMore as ExpandAllIcon, ZoomIn, ZoomOut,
} from '@mui/icons-material'

// ── Helpers ──────────────────────────────────────────────────

/** Build a map of blockId → breadcrumb path (e.g. "Data Center > Server Room A > Compute Cluster") */
function buildPathMap(nodes: BlockTreeNode[] | undefined, prefix = ''): Record<number, string> {
  const map: Record<number, string> = {}
  if (!nodes) return map
  for (const n of nodes) {
    const path = prefix ? `${prefix} > ${n.name}` : n.name
    map[n.id] = path
    Object.assign(map, buildPathMap(n.children, path))
  }
  return map
}

/** Flatten tree to a list of all blocks with paths */
function flattenWithPaths(nodes: BlockTreeNode[] | undefined, prefix = ''): { node: BlockTreeNode; path: string }[] {
  if (!nodes) return []
  const result: { node: BlockTreeNode; path: string }[] = []
  for (const n of nodes) {
    const path = prefix ? `${prefix} > ${n.name}` : n.name
    result.push({ node: n, path })
    result.push(...flattenWithPaths(n.children, path))
  }
  return result
}

// ── Tree Node with drag-and-drop ─────────────────────────────
interface TreeNodeProps {
  node: BlockTreeNode
  depth: number
  zoom: number
  selectedId: number | null
  dragOverId: number | null
  onSelect: (id: number) => void
  onAddChild: (parentId: number) => void
  onDelete: (id: number, name: string) => void
  onDragStart: (id: number) => void
  onDragOver: (id: number | null) => void
  onDrop: (targetId: number) => void
  searchMatch: boolean
  searchQuery: string
}

function TreeNode({ node, depth, zoom, selectedId, dragOverId, onSelect, onAddChild, onDelete, onDragStart, onDragOver, onDrop, searchMatch, searchQuery }: TreeNodeProps) {
  const [open, setOpen] = useState(true)
  const hasChildren = node.children && node.children.length > 0
  const isSelected = selectedId === node.id
  const isDragOver = dragOverId === node.id
  const highlight = searchQuery ? searchMatch : true

  return (
    <Box
      draggable
      onDragStart={(e) => { e.stopPropagation(); onDragStart(node.id) }}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); onDragOver(node.id) }}
      onDragLeave={() => onDragOver(null)}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDrop(node.id) }}
      sx={{
        opacity: highlight ? 1 : 0.3,
        transition: 'opacity 0.2s',
      }}
    >
      <Box
        sx={{
          display: 'flex', alignItems: 'center', gap: 0.5,
          pl: depth * 2 * zoom, py: 0.25 * zoom,
          bgcolor: isSelected ? 'primary.light' : isDragOver ? 'success.light' : 'transparent',
          borderRadius: 1, cursor: 'pointer',
          '&:hover': { bgcolor: isSelected ? 'primary.light' : 'action.hover' },
          border: isDragOver ? '2px dashed' : 'none',
          borderColor: isDragOver ? 'success.main' : 'transparent',
          transform: `scale(${zoom})`,
          transformOrigin: 'left center',
        }}
        onClick={() => onSelect(node.id)}
      >
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); setOpen(!open) }}>
          {hasChildren ? (open ? <ExpandMore fontSize="small" /> : <ChevronRight fontSize="small" />) : null}
        </IconButton>
        {hasChildren ? <FolderIcon fontSize="small" color="action" /> : <FileIcon fontSize="small" color="disabled" />}
        <Typography variant="body2" sx={{ flex: 1, fontWeight: isSelected ? 600 : 400 }}>
          {node.name}
        </Typography>
        {node.block_type && (
          <Chip label={node.block_type} size="small" sx={{ height: 18, fontSize: 10 }} />
        )}
        {node.is_external && (
          <Chip label="ext" size="small" color="warning" sx={{ height: 18, fontSize: 10 }} />
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
        {hasChildren && node.children.map((child: BlockTreeNode) => (
          <TreeNode
            key={child.id}
            node={child}
            depth={depth + 1}
            zoom={zoom}
            selectedId={selectedId}
            dragOverId={dragOverId}
            onSelect={onSelect}
            onAddChild={onAddChild}
            onDelete={onDelete}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            searchMatch={searchQuery ? child.name.toLowerCase().includes(searchQuery.toLowerCase()) : false}
            searchQuery={searchQuery}
          />
        ))}
      </Collapse>
    </Box>
  )
}

// ── Detail Panel ─────────────────────────────────────────────
interface DetailPanelProps {
  block: BlockTreeNode
  bodyId: number
  allBlocks: { node: BlockTreeNode; path: string }[]
  allMissions: MissionOut[]
  onRefresh: () => void
}

function DetailPanel({ block, bodyId, allBlocks, allMissions, onRefresh }: DetailPanelProps) {
  const [tab, setTab] = useState(0)
  const queryClient = useQueryClient()
  
  // Fetch deps and contributions for this block
  const { data: deps } = useDependencies(block.id)
  const { data: contributions } = useContributions(block.id)
  
  // Editing state
  const [editName, setEditName] = useState(block.name)
  const [editDesc, setEditDesc] = useState(block.description || '')
  const [editType, setEditType] = useState(block.block_type || '')
  const [editExternal, setEditExternal] = useState(block.is_external)
  const [saving, setSaving] = useState(false)

  // Sync editing state when block changes
  useMemo(() => {
    setEditName(block.name)
    setEditDesc(block.description || '')
    setEditType(block.block_type || '')
    setEditExternal(block.is_external)
  }, [block.id])

  // ── Info tab handlers ──
  const handleSaveInfo = async () => {
    setSaving(true)
    await updateBlock(block.id, {
      name: editName,
      description: editDesc || undefined,
      block_type: editType || undefined,
      is_external: editExternal,
    })
    setSaving(false)
    onRefresh()
  }

  // ── Dependency tab handlers ──
  const [newDepTarget, setNewDepTarget] = useState<{ node: BlockTreeNode; path: string } | null>(null)
  const [newDepStrength, setNewDepStrength] = useState(3)
  const [newDepDirection, setNewDepDirection] = useState<'outgoing' | 'incoming'>('outgoing')

  const outgoingDeps = deps?.filter(d => d.dependent_block_id === block.id) || []
  const incomingDeps = deps?.filter(d => d.dependency_block_id === block.id) || []

  const handleAddDep = async () => {
    if (!newDepTarget) return
    if (newDepDirection === 'outgoing') {
      // This block depends on newDepTarget
      await createDependency({
        dependent_block_id: block.id,
        dependency_block_id: newDepTarget.node.id,
        strength: newDepStrength,
      })
    } else {
      // newDepTarget depends on this block
      await createDependency({
        dependent_block_id: newDepTarget.node.id,
        dependency_block_id: block.id,
        strength: newDepStrength,
      })
    }
    setNewDepTarget(null)
    setNewDepStrength(3)
    queryClient.invalidateQueries({ queryKey: ['dependencies', block.id] })
  }

  const handleDeleteDep = async (depId: number) => {
    await deleteDependency(depId)
    queryClient.invalidateQueries({ queryKey: ['dependencies', block.id] })
  }

  // ── Mission tab handlers ──
  const [newMission, setNewMission] = useState<MissionOut | null>(null)
  const [newContribStrength, setNewContribStrength] = useState(3)

  const handleAddContrib = async () => {
    if (!newMission) return
    await createContribution({
      block_id: block.id,
      mission_id: newMission.id,
      strength: newContribStrength,
    })
    setNewMission(null)
    setNewContribStrength(3)
    queryClient.invalidateQueries({ queryKey: ['contributions', block.id] })
  }

  const handleDeleteContrib = async (contribId: number) => {
    await deleteContribution(contribId)
    queryClient.invalidateQueries({ queryKey: ['contributions', block.id] })
  }

  // Available blocks for dependency (exclude self and descendants to prevent cycles)
  const pathMap = useMemo(() => {
    const map: Record<number, string> = {}
    for (const b of allBlocks) map[b.node.id] = b.path
    return map
  }, [allBlocks])

  const availableBlocks = allBlocks.filter(b => b.node.id !== block.id)
  const availableMissions = allMissions.filter(m => !contributions?.some(c => c.mission_id === m.id))

  const blockNameById = (id: number) => pathMap[id] || `#${id}`

  return (
    <Card sx={{ width: 360, flexShrink: 0, display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}>
      <CardContent sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          {block.name}
          <Chip label={`#${block.id}`} size="small" sx={{ ml: 1, height: 18, fontSize: 10 }} />
        </Typography>
        
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label="Info" />
          <Tab label={`Deps (${outgoingDeps.length + incomingDeps.length})`} />
          <Tab label={`Missions (${contributions?.length || 0})`} />
        </Tabs>

        {/* ── Info Tab ── */}
        {tab === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <TextField
              label="Name" size="small" fullWidth
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
            <TextField
              label="Description" size="small" fullWidth multiline rows={2}
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
            />
            <TextField
              label="Type" size="small" fullWidth
              value={editType}
              onChange={(e) => setEditType(e.target.value)}
              placeholder="facility, server, process..."
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2">External:</Typography>
              <ToggleButtonGroup
                size="small" exclusive
                value={editExternal ? 'yes' : 'no'}
                onChange={(_, v) => setEditExternal(v === 'yes')}
              >
                <ToggleButton value="no">Internal</ToggleButton>
                <ToggleButton value="yes">External</ToggleButton>
              </ToggleButtonGroup>
            </Box>
            <Button variant="contained" size="small" onClick={handleSaveInfo} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Divider sx={{ my: 1 }} />
            <Typography variant="caption" color="text.secondary">
              Children: {block.children.length} | Body: {bodyId}
            </Typography>
          </Box>
        )}

        {/* ── Dependencies Tab ── */}
        {tab === 1 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {/* Outgoing: this block depends on... */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>This block depends on:</Typography>
              {outgoingDeps.length === 0 && (
                <Typography variant="caption" color="text.secondary">None</Typography>
              )}
              {outgoingDeps.map((d: DependencyOut) => (
                <Box key={d.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                  <Chip label={blockNameById(d.dependency_block_id)} size="small" sx={{ maxWidth: 200 }} />
                  <Chip label={`${d.strength}/5`} size="small" variant="outlined" />
                  <IconButton size="small" onClick={() => handleDeleteDep(d.id)}>
                    <DeleteIcon fontSize="small" color="error" />
                  </IconButton>
                </Box>
              ))}
            </Box>
            
            {/* Incoming: blocks that depend on this */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Blocks that depend on this:</Typography>
              {incomingDeps.length === 0 && (
                <Typography variant="caption" color="text.secondary">None</Typography>
              )}
              {incomingDeps.map((d: DependencyOut) => (
                <Box key={d.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                  <Chip label={blockNameById(d.dependent_block_id)} size="small" sx={{ maxWidth: 200 }} />
                  <Chip label={`${d.strength}/5`} size="small" variant="outlined" />
                  <IconButton size="small" onClick={() => handleDeleteDep(d.id)}>
                    <DeleteIcon fontSize="small" color="error" />
                  </IconButton>
                </Box>
              ))}
            </Box>

            <Divider sx={{ my: 1 }} />
            
            {/* Add new dependency */}
            <Typography variant="subtitle2">Add dependency:</Typography>
            <ToggleButtonGroup
              size="small" exclusive
              value={newDepDirection}
              onChange={(_, v) => v && setNewDepDirection(v)}
            >
              <ToggleButton value="outgoing">This depends on →</ToggleButton>
              <ToggleButton value="incoming">→ Depends on this</ToggleButton>
            </ToggleButtonGroup>
            <Autocomplete
              size="small"
              options={availableBlocks}
              getOptionLabel={(opt) => opt.path}
              value={newDepTarget}
              onChange={(_, v) => setNewDepTarget(v)}
              renderInput={(params) => <TextField {...params} label="Search block by name..." />}
              isOptionEqualToValue={(opt, val) => opt.node.id === val.node.id}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2">Strength:</Typography>
              <Slider
                value={newDepStrength} onChange={(_, v) => setNewDepStrength(v as number)}
                min={1} max={5} step={1} sx={{ flex: 1 }}
                valueLabelDisplay="auto"
              />
            </Box>
            <Button variant="outlined" size="small" onClick={handleAddDep} disabled={!newDepTarget}>
              Add Dependency
            </Button>
          </Box>
        )}

        {/* ── Missions Tab ── */}
        {tab === 2 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Contributing to missions:</Typography>
            {(!contributions || contributions.length === 0) && (
              <Typography variant="caption" color="text.secondary">None</Typography>
            )}
            {contributions?.map((c: ContributionOut) => {
              const mission = allMissions.find(m => m.id === c.mission_id)
              return (
                <Box key={c.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                  <Chip label={mission?.name || `#${c.mission_id}`} size="small" sx={{ maxWidth: 180 }} />
                  <Chip label={`${c.strength}/5`} size="small" variant="outlined" />
                  {mission && <Rating value={mission.importance} readOnly size="small" />}
                  <IconButton size="small" onClick={() => handleDeleteContrib(c.id)}>
                    <DeleteIcon fontSize="small" color="error" />
                  </IconButton>
                </Box>
              )
            })}
            
            <Divider sx={{ my: 1 }} />
            
            <Typography variant="subtitle2">Add contribution:</Typography>
            <Autocomplete
              size="small"
              options={availableMissions}
              getOptionLabel={(opt) => opt.name}
              value={newMission}
              onChange={(_, v) => setNewMission(v)}
              renderInput={(params) => <TextField {...params} label="Search mission..." />}
              isOptionEqualToValue={(opt, val) => opt.id === val.id}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2">Strength:</Typography>
              <Slider
                value={newContribStrength} onChange={(_, v) => setNewContribStrength(v as number)}
                min={1} max={5} step={1} sx={{ flex: 1 }}
                valueLabelDisplay="auto"
              />
            </Box>
            <Button variant="outlined" size="small" onClick={handleAddContrib} disabled={!newMission}>
              Add Contribution
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}

// ── Main TreeBuilder component ──────────────────────────────
export default function TreeBuilder() {
  const queryClient = useQueryClient()
  const { data: bodies, refetch: refetchBodies } = useBodies()
  const [selectedBody, setSelectedBody] = useState<number | null>(null)
  const { data: tree, refetch: refetchTree } = useBlockTree(selectedBody)
  const { data: allMissions } = useAllMissions()

  const [selectedBlock, setSelectedBlock] = useState<number | null>(null)
  const [openAddBlock, setOpenAddBlock] = useState(false)
  const [openAddBody, setOpenAddBody] = useState(false)
  const [openAddChild, setOpenAddChild] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null)

  const [newBlockName, setNewBlockName] = useState('')
  const [newBlockType, setNewBlockType] = useState('')
  const [newBodyName, setNewBodyName] = useState('')

  // Zoom & search
  const [zoom, setZoom] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')

  // Drag-and-drop state
  const [dragBlockId, setDragBlockId] = useState<number | null>(null)
  const [dragOverId, setDragOverId] = useState<number | null>(null)

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
    if (selectedBlock === deleteTarget.id) setSelectedBlock(null)
    refetchTree()
  }

  // Drag-and-drop handlers
  const handleDragStart = useCallback((id: number) => {
    setDragBlockId(id)
  }, [])

  const handleDragOver = useCallback((id: number | null) => {
    setDragOverId(id)
  }, [])

  const handleDrop = useCallback(async (targetId: number) => {
    if (dragBlockId !== null && dragBlockId !== targetId) {
      try {
        await reparentBlock(dragBlockId, targetId)
        refetchTree()
      } catch (e) {
        console.error('Reparent failed:', e)
      }
    }
    setDragBlockId(null)
    setDragOverId(null)
  }, [dragBlockId, refetchTree])

  // Expand/collapse all
  const [allExpanded, setAllExpanded] = useState(true)
  // This is a simplification — for real expand/collapse all we'd need to lift the open state up
  // For now, just a visual toggle indicator

  // Find selected block and build helper structures
  const flatList = useMemo(() => flattenWithPaths(tree), [tree])
  const pathMap = useMemo(() => {
    const map: Record<number, string> = {}
    for (const b of flatList) map[b.node.id] = b.path
    return map
  }, [flatList])
  const selectedBlockData = flatList.find(b => b.node.id === selectedBlock)

  return (
    <Box sx={{ display: 'flex', gap: 2 }}>
      {/* Left: Body list */}
      <Card sx={{ minWidth: 180, maxWidth: 200, flexShrink: 0 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="h6">Bodies</Typography>
            <IconButton size="small" onClick={() => setOpenAddBody(true)}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Box>
          {bodies?.map((b: BodyOut) => (
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

      {/* Center: Block tree with toolbar */}
      <Card sx={{ flex: 1, minWidth: 400, display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Toolbar */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="h6">
              {selectedBody ? 'Block Tree' : 'Select a body'}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField
                size="small" placeholder="Search blocks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                sx={{ width: 180 }}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                }}
              />
              <Tooltip title="Zoom out">
                <IconButton size="small" onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}>
                  <ZoomOut fontSize="small" />
                </IconButton>
              </Tooltip>
              <Typography variant="caption" sx={{ minWidth: 35, textAlign: 'center' }}>
                {Math.round(zoom * 100)}%
              </Typography>
              <Tooltip title="Zoom in">
                <IconButton size="small" onClick={() => setZoom(Math.min(2, zoom + 0.1))}>
                  <ZoomIn fontSize="small" />
                </IconButton>
              </Tooltip>
              {selectedBody && (
                <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => setOpenAddBlock(true)}>
                  Add Root Block
                </Button>
              )}
            </Box>
          </Box>

          {/* Tree */}
          {tree && tree.length > 0 && (
            <Box sx={{ flex: 1, overflow: 'auto', maxHeight: '75vh' }}>
              {tree.map((node) => (
                <TreeNode
                  key={node.id}
                  node={node}
                  depth={0}
                  zoom={zoom}
                  selectedId={selectedBlock}
                  dragOverId={dragOverId}
                  onSelect={setSelectedBlock}
                  onAddChild={(pid) => { setOpenAddChild(pid); setNewBlockName(''); setNewBlockType('') }}
                  onDelete={(id, name) => setDeleteTarget({ id, name })}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  searchMatch={searchQuery ? node.name.toLowerCase().includes(searchQuery.toLowerCase()) : false}
                  searchQuery={searchQuery}
                />
              ))}
            </Box>
          )}
          {tree && tree.length === 0 && (
            <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              No blocks yet. Click "Add Root Block" to start.
            </Typography>
          )}
          {!tree && (
            <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              Select a body to see its block tree.
            </Typography>
          )}
          
          {/* Drag hint */}
          {tree && tree.length > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
              💡 Drag blocks to reparent | Click to select and edit details
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Right: Rich detail panel */}
      {selectedBlockData ? (
        <DetailPanel
          block={selectedBlockData.node}
          bodyId={selectedBody!}
          allBlocks={flatList}
          allMissions={allMissions || []}
          onRefresh={refetchTree}
        />
      ) : (
        <Card sx={{ width: 360, flexShrink: 0 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>Details</Typography>
            <Typography color="text.secondary">
              Select a block to view and edit its details, dependencies, and missions.
            </Typography>
          </CardContent>
        </Card>
      )}

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