import React, { useState } from 'react'
import { AppBar, Toolbar, Typography, Button, Container, Box } from '@mui/material'
import OrgBuilder from './pages/OrgBuilder'
import DependencyMap from './pages/DependencyMap'
import MissionMapper from './pages/MissionMapper'
import ScenarioEditor from './pages/ScenarioEditor'
import Results from './pages/Results'

type Page = 'org' | 'deps' | 'missions' | 'scenarios' | 'results'

const pageNames: Record<Page, string> = {
  org: 'Organization',
  deps: 'Dependencies',
  missions: 'Missions',
  scenarios: 'Scenarios',
  results: 'Results',
}

export default function App() {
  const [page, setPage] = useState<Page>('org')

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 0, mr: 3 }}>
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
        {page === 'org' && <OrgBuilder />}
        {page === 'deps' && <DependencyMap />}
        {page === 'missions' && <MissionMapper />}
        {page === 'scenarios' && <ScenarioEditor />}
        {page === 'results' && <Results />}
      </Container>
    </>
  )
}