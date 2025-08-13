

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import './App.css';

const STORAGE_KEY = 'markdown-files';

function getFiles() {
  const files = localStorage.getItem(STORAGE_KEY);
  return files ? JSON.parse(files) : {};
}

function saveFiles(files) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
}

function App() {
  const [markdown, setMarkdown] = useState('');
  const [files, setFiles] = useState({});
  const [currentFile, setCurrentFile] = useState('');
  const [filename, setFilename] = useState('');
  const [theme, setTheme] = useState('light');
  const [renaming, setRenaming] = useState(false);

  useEffect(() => {
    const stored = getFiles();
    setFiles(stored);
    const first = Object.keys(stored)[0];
    if (first) {
      setCurrentFile(first);
      setMarkdown(stored[first]);
      setFilename(first);
    } else {
      setMarkdown(`# Welcome to the Markdown Editor!\n\nType your *markdown* on the left.\n\n- Live preview on the right\n- **Enjoy!**`);
      setFilename('Untitled.md');
    }
  }, []);

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  const handleSave = () => {
    if (!filename.trim()) return;
    const updated = { ...files, [filename]: markdown };
    setFiles(updated);
    saveFiles(updated);
    setCurrentFile(filename);
    alert('File saved!');
  };

  const handleLoad = (name) => {
    setMarkdown(files[name]);
    setCurrentFile(name);
    setFilename(name);
  };

  const handleDelete = (name) => {
    if (!window.confirm(`Delete file '${name}'?`)) return;
    const updated = { ...files };
    delete updated[name];
    setFiles(updated);
    saveFiles(updated);
    if (currentFile === name) {
      const next = Object.keys(updated)[0];
      if (next) {
        setMarkdown(updated[next]);
        setCurrentFile(next);
        setFilename(next);
      } else {
        setMarkdown('');
        setCurrentFile('');
        setFilename('Untitled.md');
      }
    }
  };

  const handleRename = (oldName, newName) => {
    if (!newName.trim() || files[newName]) return alert('Invalid or duplicate filename!');
    const updated = { ...files };
    updated[newName] = updated[oldName];
    delete updated[oldName];
    setFiles(updated);
    saveFiles(updated);
    setCurrentFile(newName);
    setFilename(newName);
    setRenaming(false);
  };

  const handleExport = () => {
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleThemeSwitch = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <div className="markdown-editor-container">
      <div className="toolbar">
        <button onClick={handleSave}>💾 Save</button>
        <button onClick={handleExport}>⬇️ Export</button>
        <button onClick={handleThemeSwitch}>
          {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
        </button>
        <input
          value={filename}
          onChange={e => setFilename(e.target.value)}
          onBlur={() => setRenaming(false)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleRename(currentFile, filename);
          }}
          className="filename-input"
          style={{ width: Math.max(10, filename.length) + 'ch' }}
          disabled={!renaming && currentFile === filename}
        />
        {currentFile !== filename && (
          <button onClick={() => handleRename(currentFile, filename)}>Rename</button>
        )}
      </div>
      <div className="file-list">
        {Object.keys(files).map(name => (
          <div key={name} className={`file-item${name === currentFile ? ' active' : ''}`}>
            <span onClick={() => handleLoad(name)}>{name}</span>
            <button onClick={() => handleDelete(name)} title="Delete">🗑️</button>
          </div>
        ))}
      </div>
      <div className="editor-preview-wrapper">
        <textarea
          className="markdown-input"
          value={markdown}
          onChange={e => setMarkdown(e.target.value)}
          placeholder="Type your markdown here..."
        />
        <div className="markdown-preview">
          <ReactMarkdown>{markdown}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

export default App;
