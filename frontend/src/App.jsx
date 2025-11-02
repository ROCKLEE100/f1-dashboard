import { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Trophy, Upload, FileText, TrendingUp, Flag, Users, RefreshCw, Calendar, Info, BarChart3, Eye, Trash2, Loader } from 'lucide-react';

export default function F1Dashboard() {
  const [activeTab, setActiveTab] = useState('standings');
  const [f1Data, setF1Data] = useState(null);
  const [insights, setInsights] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [selectedYear, setSelectedYear] = useState(2024);
  const [historicalData, setHistoricalData] = useState(null);
  const [selectedFileAnalysis, setSelectedFileAnalysis] = useState(null);
  const [analyzingFileId, setAnalyzingFileId] = useState(null);

  const API_BASE = import.meta.env.VITE_API_BASE || '/api';

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchF1Data = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/f1/fetch-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: 'demo' })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.success) {
        setF1Data(data.data);
        fetchInsights();
      } else {
        setError(data.message || 'Failed to fetch data');
      }
    } catch (err) {
      setError('Backend connection failed: ' + err.message + '. Make sure your backend server is running on port 8000.');
    } finally {
      setLoading(false);
    }
  };

  const fetchInsights = async () => {
    try {
      const response = await fetch(`${API_BASE}/f1/insights`);
      const data = await response.json();
      setInsights(data.insights);
    } catch (err) {
      console.error('Failed to fetch insights:', err);
    }
  };

  const fetchHistoricalData = async (year) => {
    setLoading(true);
    setError(null);
    setHistoricalData(null);
    try {
      const response = await fetch(`${API_BASE}/f1/historical/${year}`);
      const data = await response.json();
      
      if (data.success) {
        setHistoricalData(data);
      } else {
        setError(data.message || `No data available for ${year}`);
      }
    } catch (err) {
      setError('Failed to fetch historical data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchFiles = async () => {
    try {
      const response = await fetch(`${API_BASE}/files`);
      const data = await response.json();
      setFiles(data.files);
    } catch (err) {
      console.error('Failed to fetch files:', err);
    }
  };

  const analyzeFile = async (fileId) => {
    setAnalyzingFileId(fileId);
    try {
      const response = await fetch(`${API_BASE}/files/${fileId}/analyze`);
      const data = await response.json();
      
      if (data.success) {
        setSelectedFileAnalysis(data);
        setActiveTab('file-analysis');
      } else {
        alert(data.message || 'Failed to analyze file');
      }
    } catch (err) {
      alert('Error analyzing file: ' + err.message);
    } finally {
      setAnalyzingFileId(null);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploadStatus('Uploading...');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE}/files/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      if (data.success) {
        setUploadStatus('Upload successful!');
        fetchFiles();
        setTimeout(() => setUploadStatus(''), 3000);
      }
    } catch (err) {
      setUploadStatus('Upload failed: ' + err.message);
    }
  };

  const deleteFile = async (fileId) => {
    if (!confirm('Are you sure you want to delete this file?')) return;
    
    try {
      await fetch(`${API_BASE}/files/${fileId}`, { method: 'DELETE' });
      if (selectedFileAnalysis?.analysis && selectedFileAnalysis.filename === files.find(f => f.id === fileId)?.filename) {
        setSelectedFileAnalysis(null);
        setActiveTab('files');
      }
      fetchFiles();
    } catch (err) {
      console.error('Failed to delete file:', err);
    }
  };

  const getDriverStandings = () => {
    if (!f1Data?.driver_standings) return [];
    return f1Data.driver_standings.slice(0, 10);
  };

  const getConstructorStandings = () => {
    if (!f1Data?.constructor_standings) return [];
    return f1Data.constructor_standings.slice(0, 10);
  };

  const getLatestRace = () => {
    if (!f1Data?.latest_race) return null;
    return f1Data.latest_race;
  };

  const generateYearOptions = () => {
    const currentYear = 2024;
    const years = [];
    for (let year = currentYear; year >= 1950; year--) {
      years.push(year);
    }
    return years;
  };

  const styles = {
    container: {
      minHeight: '100vh',
      width: '100%',
      background: 'linear-gradient(to bottom right, #111827, #7f1d1d, #111827)',
      color: 'white',
      padding: '2rem 1rem'
    },
    innerContainer: {
      maxWidth: '1280px',
      margin: '0 auto',
      width: '100%'
    },
    header: {
      marginBottom: '2rem'
    },
    title: {
      fontSize: '3rem',
      fontWeight: 'bold',
      marginBottom: '0.5rem',
      background: 'linear-gradient(to right, #ef4444, white)',
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      color: 'transparent'
    },
    button: {
      backgroundColor: '#dc2626',
      padding: '0.75rem 1.5rem',
      borderRadius: '0.5rem',
      fontWeight: '600',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
      border: 'none',
      color: 'white',
      cursor: 'pointer',
      marginBottom: '1rem',
      marginRight: '1rem'
    },
    buttonDisabled: {
      backgroundColor: '#991b1b',
      cursor: 'not-allowed'
    },
    card: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(10px)',
      borderRadius: '1rem',
      padding: '1.5rem',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      marginBottom: '1.5rem',
      width: '100%'
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse'
    },
    th: {
      textAlign: 'left',
      padding: '0.75rem 1rem',
      borderBottom: '1px solid rgba(255, 255, 255, 0.2)'
    },
    td: {
      padding: '0.75rem 1rem',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
    },
    tabContainer: {
      display: 'flex',
      gap: '0.5rem',
      marginBottom: '1.5rem',
      flexWrap: 'wrap'
    },
    tab: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.5rem 1rem',
      borderRadius: '0.5rem',
      fontWeight: '500',
      border: 'none',
      cursor: 'pointer',
      transition: 'all 0.2s'
    },
    tabActive: {
      backgroundColor: '#dc2626',
      color: 'white'
    },
    tabInactive: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      color: '#d1d5db'
    },
    select: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      color: 'white',
      padding: '0.5rem 1rem',
      borderRadius: '0.5rem',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      cursor: 'pointer',
      marginLeft: '1rem'
    },
    analyzeButton: {
      backgroundColor: '#7c3aed',
      padding: '0.5rem 1rem',
      borderRadius: '0.5rem',
      fontSize: '0.875rem',
      border: 'none',
      color: 'white',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
      marginRight: '0.5rem'
    },
    deleteButton: {
      backgroundColor: '#dc2626',
      padding: '0.5rem 1rem',
      borderRadius: '0.5rem',
      fontSize: '0.875rem',
      border: 'none',
      color: 'white',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem'
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.innerContainer}>
        <div style={styles.header}>
          <h1 style={styles.title}>F1 Data Dashboard</h1>
          <p style={{ color: '#d1d5db' }}>Comprehensive Formula 1 analytics from 1950-present powered by Jolpica API</p>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <button
            onClick={fetchF1Data}
            disabled={loading}
            style={{
              ...styles.button,
              ...(loading ? styles.buttonDisabled : {})
            }}
          >
            <RefreshCw className={loading ? 'animate-spin' : ''} size={20} />
            {loading ? 'Fetching Data...' : 'Fetch Latest F1 Data'}
          </button>
          {error && (
            <div style={{ 
              marginTop: '0.75rem', 
              padding: '1rem', 
              backgroundColor: 'rgba(127, 29, 29, 0.5)',
              border: '1px solid #dc2626',
              borderRadius: '0.5rem'
            }}>
              <p style={{ color: '#fecaca', fontSize: '0.875rem' }}>{error}</p>
            </div>
          )}
        </div>

        {insights.length > 0 && (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1rem',
            marginBottom: '1.5rem'
          }}>
            {insights.map((insight, idx) => (
              <div key={idx} style={styles.card}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <TrendingUp style={{ color: '#f87171', flexShrink: 0, marginTop: '0.25rem' }} size={20} />
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontWeight: '600', fontSize: '0.875rem', color: '#fbbf24', marginBottom: '0.5rem' }}>
                      {insight.type}
                    </h3>
                    <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem', lineHeight: '1.5' }}>
                      {insight.insight}
                    </p>
                    {insight.explanation && (
                      <div style={{ 
                        marginTop: '0.75rem', 
                        paddingTop: '0.75rem', 
                        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        gap: '0.5rem'
                      }}>
                        <Info size={14} style={{ color: '#9ca3af', flexShrink: 0, marginTop: '0.15rem' }} />
                        <p style={{ fontSize: '0.75rem', color: '#9ca3af', lineHeight: '1.4' }}>
                          {insight.explanation}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={styles.tabContainer}>
          {[
            { id: 'standings', label: 'Driver Standings', icon: Trophy },
            { id: 'constructors', label: 'Constructors', icon: Users },
            { id: 'race', label: 'Latest Race', icon: Flag },
            { id: 'historical', label: 'Historical Data', icon: Calendar },
            { id: 'files', label: 'File Manager', icon: FileText },
            ...(selectedFileAnalysis ? [{ id: 'file-analysis', label: 'File Analysis', icon: BarChart3 }] : [])
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                ...styles.tab,
                ...(activeTab === tab.id ? styles.tabActive : styles.tabInactive)
              }}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        <div style={styles.card}>
          {activeTab === 'standings' && (
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Trophy style={{ color: '#fbbf24' }} />
                Driver Standings
              </h2>
              <p style={{ color: '#9ca3af', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                Current season driver championship rankings. Points are awarded based on finishing positions, with 25 points for a win.
              </p>
              {getDriverStandings().length > 0 ? (
                <div>
                  <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Position</th>
                          <th style={styles.th}>Driver</th>
                          <th style={styles.th}>Team</th>
                          <th style={styles.th}>Points</th>
                          <th style={styles.th}>Wins</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getDriverStandings().map((driver) => (
                          <tr key={driver.position}>
                            <td style={{...styles.td, fontWeight: 'bold', color: driver.position === 1 ? '#fbbf24' : 'white'}}>{driver.position}</td>
                            <td style={styles.td}>{driver.full_name}</td>
                            <td style={styles.td}>{driver.team_name}</td>
                            <td style={{...styles.td, fontWeight: '600'}}>{driver.points}</td>
                            <td style={styles.td}>{driver.wins}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ width: '100%', height: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={getDriverStandings()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
                        <XAxis 
                          dataKey="full_name"
                          stroke="#fff"
                          angle={-45}
                          textAnchor="end"
                          height={100}
                        />
                        <YAxis stroke="#fff" />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                        />
                        <Bar dataKey="points" fill="#ef4444" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '3rem 0', textAlign: 'center' }}>
                  <p style={{ color: '#9ca3af', fontSize: '1.125rem' }}>
                    No data available. Please fetch F1 data first.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'constructors' && (
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users style={{ color: '#60a5fa' }} />
                Constructor Standings
              </h2>
              <p style={{ color: '#9ca3af', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                Team championship rankings. Each team's score is the sum of points earned by both of their drivers throughout the season.
              </p>
              {getConstructorStandings().length > 0 ? (
                <div>
                  <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Position</th>
                          <th style={styles.th}>Constructor</th>
                          <th style={styles.th}>Points</th>
                          <th style={styles.th}>Wins</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getConstructorStandings().map((constructor) => (
                          <tr key={constructor.position}>
                            <td style={{...styles.td, fontWeight: 'bold', color: constructor.position === 1 ? '#fbbf24' : 'white'}}>{constructor.position}</td>
                            <td style={styles.td}>{constructor.team_name}</td>
                            <td style={{...styles.td, fontWeight: '600'}}>{constructor.points}</td>
                            <td style={styles.td}>{constructor.wins}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ width: '100%', height: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={getConstructorStandings()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
                        <XAxis 
                          dataKey="team_name"
                          stroke="#fff"
                          angle={-45}
                          textAnchor="end"
                          height={100}
                        />
                        <YAxis stroke="#fff" />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                        />
                        <Bar dataKey="points" fill="#3b82f6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '3rem 0', textAlign: 'center' }}>
                  <p style={{ color: '#9ca3af', fontSize: '1.125rem' }}>
                    No data available. Please fetch F1 data first.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'race' && (
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Flag style={{ color: '#4ade80' }} />
                Latest Race Information
              </h2>
              <p style={{ color: '#9ca3af', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                Results from the most recently completed Grand Prix. These results are already reflected in the championship standings above.
              </p>
              {getLatestRace() ? (
                <div>
                  <div style={{ ...styles.card, marginBottom: '1.5rem', backgroundColor: 'rgba(74, 222, 128, 0.1)' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '600' }}>
                      {getLatestRace().meeting_name || 'Race Name'}
                    </h3>
                    <p style={{ color: '#d1d5db', marginTop: '0.5rem' }}>
                      <strong>Circuit:</strong> {getLatestRace().circuit_short_name || 'Circuit'}
                    </p>
                    <p style={{ color: '#d1d5db' }}>
                      <strong>Date:</strong> {getLatestRace().date_start ? new Date(getLatestRace().date_start).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Date'}
                    </p>
                    <p style={{ color: '#d1d5db' }}>
                      <strong>Location:</strong> {getLatestRace().location || 'Unknown'}
                    </p>
                    <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                      Round {getLatestRace().round} of the {getLatestRace().season} season
                    </p>
                  </div>
                  {f1Data?.race_results && f1Data.race_results.length > 0 && (
                    <div style={{ overflowX: 'auto' }}>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>
                        Race Results - Top 10
                      </h3>
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={styles.th}>Position</th>
                            <th style={styles.th}>Driver</th>
                            <th style={styles.th}>Team</th>
                            <th style={styles.th}>Points</th>
                            <th style={styles.th}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {f1Data.race_results.map((result, idx) => (
                            <tr key={idx}>
                              <td style={{...styles.td, fontWeight: 'bold', color: result.position === 1 ? '#fbbf24' : result.position <= 3 ? '#4ade80' : 'white'}}>
                                {result.position}
                              </td>
                              <td style={styles.td}>{result.driver_name}</td>
                              <td style={styles.td}>{result.team}</td>
                              <td style={{...styles.td, fontWeight: '600'}}>{result.points}</td>
                              <td style={{...styles.td, fontSize: '0.875rem', color: result.status === 'Finished' ? '#4ade80' : '#fbbf24'}}>
                                {result.status}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: '3rem 0', textAlign: 'center' }}>
                  <p style={{ color: '#9ca3af', fontSize: '1.125rem' }}>
                    No race data available. Please fetch F1 data first.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'historical' && (
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar style={{ color: '#a78bfa' }} />
                Historical Data (1950-Present)
              </h2>
              <p style={{ color: '#9ca3af', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                Explore the complete history of Formula 1. Select any year from 1950 onwards to view the race calendar and championship details for that season.
              </p>
              
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ color: '#d1d5db', marginRight: '1rem' }}>Select Year:</label>
                <select 
                  value={selectedYear} 
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  style={styles.select}
                >
                  {generateYearOptions().map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
                <button
                  onClick={() => fetchHistoricalData(selectedYear)}
                  disabled={loading}
                  style={{
                    ...styles.button,
                    ...(loading ? styles.buttonDisabled : {})
                  }}
                >
                  <RefreshCw className={loading ? 'animate-spin' : ''} size={20} />
                  Load Data
                </button>
              </div>

              {historicalData ? (
                <div>
                  {historicalData.champion && (
                    <div style={{ ...styles.card, marginBottom: '1.5rem', backgroundColor: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.3)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                        <Trophy size={24} style={{ color: '#fbbf24' }} />
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#fbbf24' }}>
                          {historicalData.year} World Champion
                        </h3>
                      </div>
                      <p style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                        {historicalData.champion.name}
                      </p>
                      <p style={{ color: '#d1d5db' }}>
                        <strong>Team:</strong> {historicalData.champion.team}
                      </p>
                      <p style={{ color: '#d1d5db' }}>
                        <strong>Points:</strong> {historicalData.champion.points} | <strong>Wins:</strong> {historicalData.champion.wins}
                      </p>
                    </div>
                  )}
                  
                  {historicalData.insights && (
                    <div style={{ ...styles.card, marginBottom: '1.5rem', backgroundColor: 'rgba(168, 139, 250, 0.1)' }}>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.75rem', color: '#a78bfa' }}>
                        Season Overview
                      </h3>
                      <p style={{ color: '#d1d5db', marginBottom: '0.5rem', lineHeight: '1.6' }}>
                        {historicalData.insights.season_summary}
                      </p>
                      {historicalData.insights.champion_info && (
                        <p style={{ color: '#d1d5db', lineHeight: '1.6' }}>
                          {historicalData.insights.champion_info}
                        </p>
                      )}
                    </div>
                  )}

                  <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>
                    Race Calendar ({historicalData.race_count} Races)
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                    {historicalData.races.map((race, idx) => (
                      <div key={idx} style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        borderRadius: '0.5rem',
                        padding: '1rem',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        transition: 'transform 0.2s, border-color 0.2s',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                          <span style={{ 
                            fontSize: '0.75rem', 
                            fontWeight: '600', 
                            color: '#ef4444',
                            backgroundColor: 'rgba(239, 68, 68, 0.2)',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '0.25rem'
                          }}>
                            Round {race.round}
                          </span>
                        </div>
                        <h4 style={{ fontWeight: '600', marginBottom: '0.5rem', fontSize: '0.95rem' }}>
                          {race.meeting_name}
                        </h4>
                        <p style={{ fontSize: '0.875rem', color: '#9ca3af', marginBottom: '0.25rem' }}>
                          <strong>Circuit:</strong> {race.circuit_short_name}
                        </p>
                        <p style={{ fontSize: '0.875rem', color: '#9ca3af', marginBottom: '0.25rem' }}>
                          <strong>Location:</strong> {race.location}
                        </p>
                        <p style={{ fontSize: '0.875rem', color: '#d1d5db', marginTop: '0.5rem' }}>
                          <strong>Date:</strong> {new Date(race.date_start).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ padding: '3rem 0', textAlign: 'center' }}>
                  <Calendar size={48} style={{ color: '#4b5563', margin: '0 auto 1rem' }} />
                  <p style={{ color: '#9ca3af', fontSize: '1.125rem' }}>
                    Select a year from the dropdown above and click "Load Data"
                  </p>
                  <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                    Available data: 1950 to present
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'files' && (
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText style={{ color: '#a78bfa' }} />
                File Manager
              </h2>
              <p style={{ color: '#9ca3af', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                Upload CSV or JSON files for analysis. Analyze your racing data to get comprehensive insights and visualizations.
              </p>

              <div style={{ marginBottom: '1.5rem' }}>
                <label htmlFor="file-upload" style={{
                  ...styles.button,
                  cursor: 'pointer'
                }}>
                  <Upload size={20} />
                  Upload File
                </label>
                <input
                  id="file-upload"
                  type="file"
                  accept=".csv,.json"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
                {uploadStatus && (
                  <span style={{ 
                    marginLeft: '1rem', 
                    color: uploadStatus.includes('successful') ? '#4ade80' : uploadStatus.includes('failed') ? '#ef4444' : '#fbbf24',
                    fontSize: '0.875rem'
                  }}>
                    {uploadStatus}
                  </span>
                )}
              </div>

              {files.length > 0 ? (
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {files.map((file) => (
                    <div key={file.id} style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '0.5rem',
                      padding: '1rem',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      transition: 'border-color 0.2s'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                        <div style={{ flex: 1 }}>
                          <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <FileText size={18} style={{ color: '#a78bfa' }} />
                            {file.filename}
                          </h3>
                          <p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                            Uploaded: {new Date(file.upload_date).toLocaleDateString('en-US', { 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                          <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                            Type: <span style={{ color: '#a78bfa', fontWeight: '500' }}>{file.file_type.toUpperCase()}</span>
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            onClick={() => analyzeFile(file.id)}
                            disabled={analyzingFileId === file.id}
                            style={{
                              ...styles.analyzeButton,
                              ...(analyzingFileId === file.id ? { opacity: 0.6, cursor: 'not-allowed' } : {})
                            }}
                          >
                            {analyzingFileId === file.id ? (
                              <>
                                <Loader className="animate-spin" size={16} />
                                Analyzing...
                              </>
                            ) : (
                              <>
                                <Eye size={16} />
                                Analyze
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => deleteFile(file.id)}
                            style={styles.deleteButton}
                          >
                            <Trash2 size={16} />
                            Delete
                          </button>
                        </div>
                      </div>

                      {file.insights && (
                        <div style={{
                          marginTop: '0.75rem',
                          paddingTop: '0.75rem',
                          borderTop: '1px solid rgba(255, 255, 255, 0.1)'
                        }}>
                          <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fbbf24', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <TrendingUp size={14} />
                            Quick Insights
                          </h4>
                          <div style={{ fontSize: '0.75rem', color: '#d1d5db', lineHeight: '1.5' }}>
                            {JSON.parse(file.insights).map((insight, idx) => (
                              <div key={idx} style={{ 
                                marginBottom: '0.5rem',
                                padding: '0.5rem',
                                backgroundColor: 'rgba(124, 58, 237, 0.1)',
                                borderRadius: '0.25rem',
                                borderLeft: '2px solid #7c3aed'
                              }}>
                                <p style={{ fontWeight: '600', color: '#a78bfa', marginBottom: '0.25rem' }}>
                                  {insight.type}
                                </p>
                                <p>{insight.insight}</p>
                                {insight.details && (
                                  <p style={{ color: '#9ca3af', fontSize: '0.7rem', marginTop: '0.25rem' }}>
                                    {insight.details}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '3rem 0', textAlign: 'center' }}>
                  <FileText size={48} style={{ color: '#4b5563', margin: '0 auto 1rem' }} />
                  <p style={{ color: '#9ca3af', fontSize: '1.125rem' }}>
                    No files uploaded yet
                  </p>
                  <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                    Upload a CSV or JSON file to get started
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'file-analysis' && selectedFileAnalysis && (
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BarChart3 style={{ color: '#7c3aed' }} />
                File Analysis: {selectedFileAnalysis.filename}
              </h2>
              <p style={{ color: '#9ca3af', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                Comprehensive analysis and insights from your uploaded data file.
              </p>

              {selectedFileAnalysis.analysis && (
                <div>
                  {/* Summary Card */}
                  {selectedFileAnalysis.analysis.summary && (
                    <div style={{ ...styles.card, marginBottom: '1.5rem', backgroundColor: 'rgba(124, 58, 237, 0.1)' }}>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.75rem', color: '#a78bfa' }}>
                        Dataset Summary
                      </h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        <div>
                          <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.25rem' }}>Total Rows</p>
                          <p style={{ fontSize: '1.5rem', fontWeight: '600', color: '#fff' }}>
                            {selectedFileAnalysis.analysis.summary.total_rows}
                          </p>
                        </div>
                        <div>
                          <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.25rem' }}>Total Columns</p>
                          <p style={{ fontSize: '1.5rem', fontWeight: '600', color: '#fff' }}>
                            {selectedFileAnalysis.analysis.summary.total_columns}
                          </p>
                        </div>
                      </div>
                      <div style={{ marginTop: '1rem' }}>
                        <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.5rem' }}>Columns:</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                          {selectedFileAnalysis.analysis.summary.columns.map((col, idx) => (
                            <span key={idx} style={{
                              backgroundColor: 'rgba(168, 139, 250, 0.2)',
                              color: '#c4b5fd',
                              padding: '0.25rem 0.75rem',
                              borderRadius: '9999px',
                              fontSize: '0.75rem',
                              fontWeight: '500'
                            }}>
                              {col}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Insights */}
                  {selectedFileAnalysis.analysis.insights && selectedFileAnalysis.analysis.insights.length > 0 && (
                    <div style={{ marginBottom: '1.5rem' }}>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <TrendingUp style={{ color: '#f87171' }} size={20} />
                        Detailed Insights
                      </h3>
                      <div style={{ display: 'grid', gap: '1rem' }}>
                        {selectedFileAnalysis.analysis.insights.map((insight, idx) => (
                          <div key={idx} style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            borderRadius: '0.5rem',
                            padding: '1rem',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderLeft: '3px solid #7c3aed'
                          }}>
                            <h4 style={{ fontWeight: '600', color: '#fbbf24', marginBottom: '0.5rem', fontSize: '0.95rem' }}>
                              {insight.type}
                            </h4>
                            <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem', lineHeight: '1.5' }}>
                              {insight.insight}
                            </p>
                            {insight.details && (
                              <p style={{ fontSize: '0.75rem', color: '#9ca3af', lineHeight: '1.4' }}>
                                {insight.details}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Charts */}
                  {selectedFileAnalysis.analysis.charts && Object.keys(selectedFileAnalysis.analysis.charts).length > 0 && (
                    <div>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <BarChart3 style={{ color: '#60a5fa' }} size={20} />
                        Visualizations
                      </h3>

                      {/* Driver Performance Chart */}
                      {selectedFileAnalysis.analysis.charts.driver_performance && (
                        <div style={{ ...styles.card, marginBottom: '1.5rem' }}>
                          <h4 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: '#60a5fa' }}>
                            Driver Performance - Average Lap Times
                          </h4>
                          <div style={{ width: '100%', height: '350px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={selectedFileAnalysis.analysis.charts.driver_performance}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
                                <XAxis 
                                  dataKey="driver"
                                  stroke="#fff"
                                  angle={-45}
                                  textAnchor="end"
                                  height={100}
                                />
                                <YAxis stroke="#fff" />
                                <Tooltip 
                                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                                  formatter={(value) => [`${value.toFixed(3)}s`, 'Avg Lap Time']}
                                />
                                <Bar dataKey="avg_lap_time" fill="#60a5fa" />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}

                      {/* Team Performance Chart */}
                      {selectedFileAnalysis.analysis.charts.team_performance && (
                        <div style={{ ...styles.card, marginBottom: '1.5rem' }}>
                          <h4 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: '#4ade80' }}>
                            Team Performance - Average Lap Times
                          </h4>
                          <div style={{ width: '100%', height: '350px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={selectedFileAnalysis.analysis.charts.team_performance}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
                                <XAxis 
                                  dataKey="team"
                                  stroke="#fff"
                                  angle={-45}
                                  textAnchor="end"
                                  height={100}
                                />
                                <YAxis stroke="#fff" />
                                <Tooltip 
                                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                                  formatter={(value) => [`${value.toFixed(3)}s`, 'Avg Lap Time']}
                                />
                                <Bar dataKey="avg_lap_time" fill="#4ade80" />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}

                      {/* Circuit Comparison Chart */}
                      {selectedFileAnalysis.analysis.charts.circuit_comparison && (
                        <div style={{ ...styles.card, marginBottom: '1.5rem' }}>
                          <h4 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: '#fbbf24' }}>
                            Circuit Comparison
                          </h4>
                          <div style={{ width: '100%', height: '350px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={selectedFileAnalysis.analysis.charts.circuit_comparison}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
                                <XAxis 
                                  dataKey="circuit"
                                  stroke="#fff"
                                  angle={-45}
                                  textAnchor="end"
                                  height={100}
                                />
                                <YAxis stroke="#fff" />
                                <Tooltip 
                                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                                  formatter={(value, name) => {
                                    if (name === 'avg_lap_time') return [`${value.toFixed(3)}s`, 'Avg Lap Time'];
                                    return [value, name];
                                  }}
                                />
                                <Bar dataKey="avg_lap_time" fill="#fbbf24" />
                                <Bar dataKey="laps" fill="#a78bfa" />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}