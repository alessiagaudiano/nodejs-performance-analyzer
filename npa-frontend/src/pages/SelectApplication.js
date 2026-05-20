import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelection } from '../state/SelectionContext';
import { apiFetch } from "../api/apiClient";
import ApplicationCard from '../components/Cards/ApplicationCard';

const SelectApplication = () => {
  const navigate = useNavigate();
  const { setSelectedApp, setSelectedConfig, setSelectedRun } = useSelection();
  
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const perPage = 2;

  useEffect(() => {
    const fetchApps = async () => {
      try {
        setLoading(true);
        const data = await apiFetch(`/apps?page=${currentPage}&per_page=${perPage}`);
        setApps(data.items || []);
        setHasNext(data.has_next || false);
        setError(null);
      } catch (err) {
        setError('Failed to load applications');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchApps();
  }, [currentPage]);

  const filteredApps = query
    ? apps.filter(app => app.app_name.toLowerCase().includes(query.toLowerCase()))
    : apps;

  const handleSelectApp = (appName) => {
    setSelectedApp(appName);
    setSelectedConfig(null);
    setSelectedRun(null);
    navigate(`/apps/${appName}/configs`);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (hasNext) {
      setCurrentPage(prev => prev + 1);
    }
  };

  if (loading) {
    return (
      <div className="p-6 min-h-screen">
        <div className="container">
          <p className="text-center" style={{ color: 'var(--muted)' }}>Loading applications...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 min-h-screen">
        <div className="container">
          <p className="text-center text-red-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen">
      <div className="container">
        <h1 className="text-3xl font-medium mb-2" style={{ color: 'var(--text)' }}>Applications</h1>
        <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>Pick an application to analyze.</p>

        <div className="flex gap-3 items-center mb-6">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search apps..."
            aria-label="Search applications"
            className="input text-sm"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {filteredApps.map(app => (
            <ApplicationCard
              key={app.app_name}
              appName={app.app_name}
              appData={app}
              onSelect={() => handleSelectApp(app.app_name)}
            />
          ))}
        </div>

        {filteredApps.length === 0 && (
          <p className="text-center mt-8" style={{ color: 'var(--muted)' }}>
            No applications found.
          </p>
        )}

        {/* Pagination Controls */}
        {filteredApps.length > 0 && (
          <div className="flex justify-center items-center gap-4 mt-8">
            <button
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
              className="px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: currentPage === 1 ? 'var(--muted)' : 'var(--primary)',
                color: 'var(--background)'
              }}
            >
              Previous
            </button>
            
            <span className="text-sm" style={{ color: 'var(--text)' }}>
              Page {currentPage}
            </span>
            
            <button
              onClick={handleNextPage}
              disabled={!hasNext}
              className="px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: !hasNext ? 'var(--muted)' : 'var(--primary)',
                color: 'var(--background)'
              }}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SelectApplication;