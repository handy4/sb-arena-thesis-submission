
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import { Bot, Cpu, LayoutDashboard, Trophy, BookOpen } from 'lucide-react';

import Home from './pages/Home';
import EvaluationFramework from './pages/EvaluationFramework';
import Visualization from './pages/Visualization';
import LeaderboardPage from './pages/LeaderboardPage';
import ModelOverview from './pages/ModelOverview';
import { EvaluationDataProvider } from './services/EvaluationDataContext';
import { useEvaluationData } from './services/EvaluationDataContext';
import { modelPath } from './services/modelRoutes';

const NavLink: React.FC<{ to: string; children: React.ReactNode; icon: React.ReactNode }> = ({ to, children, icon }) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link 
      to={to} 
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
        isActive 
        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      {icon}
      <span>{children}</span>
    </Link>
  );
};

const ModelsNav: React.FC = () => {
  const location = useLocation();
  const { modelFiles, isLoading } = useEvaluationData();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isActive = location.pathname.startsWith('/models');

  const modelsByRegion = modelFiles.reduce<Record<string, typeof modelFiles>>((groups, model) => {
    const region = model.raw.model?.metadata?.region || 'Unknown Region';
    groups[region] = groups[region] ?? [];
    groups[region].push(model);
    return groups;
  }, {});

  const regionGroups = Object.entries(modelsByRegion).sort(([a], [b]) => a.localeCompare(b));

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsMenuOpen(true)}
      onMouseLeave={() => setIsMenuOpen(false)}
      onFocus={() => setIsMenuOpen(true)}
    >
      <Link
        to={modelFiles[0] ? modelPath(modelFiles[0]) : '/models'}
        onClick={() => setIsMenuOpen(false)}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
          isActive
            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
            : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
        }`}
      >
        <Bot size={16} />
        <span>Models</span>
      </Link>

      <div className={`absolute right-0 top-full pt-3 transition-all z-50 ${isMenuOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-1 pointer-events-none'}`}>
        <div className="w-[720px] max-w-[calc(100vw-3rem)] bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/60">
            <p className="text-[10px] uppercase tracking-widest font-black text-gray-400">Select Model</p>
          </div>

          {isLoading ? (
            <div className="p-6 text-sm font-bold text-gray-400">Loading models...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-0 p-3">
              {regionGroups.map(([region, models]) => (
                <div key={region} className="p-3 min-w-0">
                  <p className="text-[10px] uppercase tracking-widest font-black text-indigo-500 mb-3 px-2">{region}</p>
                  <div className="space-y-1">
                    {models
                      .sort((a, b) => a.dataPoint.category.localeCompare(b.dataPoint.category))
                      .map(model => (
                        <Link
                          key={model.dataPoint.id}
                          to={modelPath(model)}
                          onClick={() => setIsMenuOpen(false)}
                          className="block px-3 py-2.5 rounded-xl text-[11px] font-black text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors truncate"
                        >
                          {model.dataPoint.category}
                        </Link>
                      ))}
                  </div>
                </div>
              ))}
              {regionGroups.length === 0 && (
                <div className="p-6 text-sm font-bold text-gray-400 col-span-full">No models available</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Header: React.FC = () => {
  return (
    <header className="bg-white/80 border-b border-gray-200 px-8 py-4 sticky top-0 z-50 shadow-sm backdrop-blur-md">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <Link to="/" className="flex items-center space-x-4 group">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 group-hover:rotate-6 transition-transform">
            <Cpu size={20} />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900 tracking-tight">LLM Social Bias Arena</h1>
            <p className="text-[8px] text-indigo-500 font-black uppercase tracking-[0.3em]">Website Prototype</p>
          </div>
        </Link>

        <nav className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
          <NavLink to="/evaluation-framework" icon={<BookOpen size={16} />}>Framework</NavLink>
          <ModelsNav />
          <NavLink to="/visualization" icon={<LayoutDashboard size={16} />}>Visualization</NavLink>
          <NavLink to="/leaderboard" icon={<Trophy size={16} />}>Leaderboard</NavLink>
        </nav>
      </div>
    </header>
  );
};

const App: React.FC = () => {
  return (
    <EvaluationDataProvider>
    <Router>
      <div className="min-h-screen bg-gray-50 font-sans selection:bg-indigo-100 flex flex-col">
        <Header />
        <main className="flex-1">
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/evaluation-framework" element={<EvaluationFramework />} />
              <Route path="/models" element={<ModelOverview />} />
              <Route path="/models/:modelId" element={<ModelOverview />} />
              <Route path="/visualization" element={<Visualization />} />
              <Route path="/leaderboard" element={<LeaderboardPage />} />
            </Routes>
          </AnimatePresence>
        </main>
        
        <footer className="bg-white border-t border-gray-200 py-12">
          <div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                <Cpu size={16} />
              </div>
              <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">© 2026 LLM Social Bias Arena</span>
            </div>
            <div className="flex gap-8">
              <a
                href="https://github.com/handy4/sb-arena-thesis-submission"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold text-gray-400 hover:text-indigo-600 transition-colors uppercase tracking-widest"
              >
                GitHub
              </a>
            </div>
          </div>
        </footer>
      </div>
    </Router>
    </EvaluationDataProvider>
  );
};

export default App;
