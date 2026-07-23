import { useState } from 'react'
import { AppBar, Toolbar, Typography, Button, Container } from '@mui/material'
import TreeBuilder from './pages/OrgBuilder'
import DependencyMap from './pages/DependencyMap'
import MissionMapper from './pages/MissionMapper'
import ScenarioEditor from './pages/ScenarioEditor'
import Results from './pages/Results'

type Page = 'tree' | 'deps' | 'missions' | 'scenarios' | 'results'

const pageNames: Record<Page, string> = {
  tree: 'Tree Builder',
  deps: 'Dependencies',
  missions: 'Missions',
  scenarios: 'Scenarios',
  results: 'Results',
}

export default function App() {
  const [page, setPage] = useState<Page>('tree')

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ mr: 3 }}>
            BCPTool
          </Typography>
          {(Object.keys(pageNames) as Page[]).map((p) => (
            <Button
              key={p}
              color="inherit"
              onClick={() => setPage(p)}
              variant={page === p ? 'outlined' : 'text'}
            >
              {pageNames[p]}
            </Button>
          ))}
        </Toolbar>
      </AppBar>
      <Container maxWidth="xl" sx={{ mt: 2 }}>
        {page === 'tree' && <TreeBuilder />}
        {page === 'deps' && <DependencyMap />}
        {page === 'missions' && <MissionMapper />}
        {page === 'scenarios' && <ScenarioEditor />}
        {page === 'results' && <Results />}
      </Container>
    </>
  )
}