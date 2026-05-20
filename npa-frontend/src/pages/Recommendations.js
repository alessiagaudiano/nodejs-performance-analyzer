import React from 'react';
import { useNavigate, useParams, Link, useSearchParams } from 'react-router-dom';
import { generateMockData } from '../utils/mockData';
import { useSelection } from '../state/SelectionContext';

const Recommendations = () => {
  const navigate = useNavigate();
  const { appId, runId } = useParams();
  const { setSelectedApp, setSelectedRun } = useSelection();
  const mockData = generateMockData();
  if (appId) setSelectedApp(appId);
  if (runId) setSelectedRun(runId);

  const currentData = mockData.configurations[runId];
  if (!currentData || !currentData.analysis) {
    navigate('/apps');
    return null;
  }
  const { recommendations } = currentData.analysis;

  const getImpactClass = (impact) => {
    switch (impact) {
      case 'critical':
        return 'bg-red-800 text-red-100';
      case 'high':
        return 'bg-orange-800 text-orange-100';
      default:
        return 'bg-yellow-800 text-yellow-100';
    }
  };

  return (
    <div className="p-6 min-h-screen">
      <div className="container">
      <h1 className="text-2xl font-medium mb-4" style={{ color: 'var(--text)' }}>Performance Optimization Recommendations</h1>

      <div className="max-w-3xl">
        <div className="space-y-4">
          {recommendations.map(rec => (
            <div key={rec.id} 
              className="card border-l-4"
              style={{ borderLeftColor: 'var(--accent)' }}
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>{rec.title}</h3>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getImpactClass(rec.impact)}`}>
                  {rec.impact.toUpperCase()} IMPACT
                </span>
              </div>
              <p className="mb-4" style={{ color: 'var(--muted)' }}>{rec.description}</p>
              <div className="flex justify-between items-center text-sm">
                <span style={{ color: 'var(--muted)' }}>Implementation Effort: {rec.effort}</span>
                <button
                  onClick={() => navigate(`/compare?leftRun=${encodeURIComponent(runId)}`)}
                  className="btn btn-ghost"
                >
                  Go to compare
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-between">
          <Link to={`/apps/${appId}/run/${runId}/metrics`} className="btn btn-muted">← Back to metrics</Link>
          <button
            onClick={() => navigate('/')}
            className="btn btn-primary"
          >
            Start New Analysis
          </button>
        </div>
      </div>
      </div>
    </div>
  );
};

export default Recommendations;
