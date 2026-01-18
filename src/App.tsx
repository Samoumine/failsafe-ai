import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { PlayPage } from './routes/PlayPage';
import { ComparePage } from './routes/ComparePage';
import './styles.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <nav className="nav">
          <div className="nav-brand">Failsafe AI</div>
          <div className="nav-links">
            <NavLink 
              to="/play" 
              className={({ isActive }: { isActive: boolean }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              Play
            </NavLink>
            <NavLink 
              to="/compare" 
              className={({ isActive }: { isActive: boolean }) => `nav-link compare-link ${isActive ? 'active' : ''}`}
            >
              Compare
            </NavLink>
          </div>
        </nav>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to="/play" replace />} />
            <Route path="/play" element={<PlayPage />} />
            <Route path="/compare" element={<ComparePage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
