import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';

// Custom plugin for superscript, subscript, and highlight
import { visit } from 'unist-util-visit';
function customMarkdownPlugins() {
  return (tree) => {
    visit(tree, 'text', (node, index, parent) => {
      let value = node.value;
      let nodes = [];
      let lastIndex = 0;
      // Regex for highlight ==text==
      const highlightRegex = /==([^=]+)==/g;
      // Regex for superscript ^text^
      const supRegex = /\^([^^]+)\^/g;
      // Regex for subscript ~text~
      const subRegex = /~([^~]+)~/g;
      while (true) {
        let h = highlightRegex.exec(value);
        let s = supRegex.exec(value);
        let sub = subRegex.exec(value);
        let matches = [h, s, sub].filter(Boolean);
        if (matches.length === 0) break;
        // Find the earliest match
        let first = matches.reduce((a, b) => (a.index < b.index ? a : b));
        if (first.index > lastIndex) {
          nodes.push({ type: 'text', value: value.slice(lastIndex, first.index) });
        }
        if (first === h) {
          nodes.push({ type: 'element', tagName: 'mark', children: [{ type: 'text', value: h[1] }] });
          lastIndex = h.index + h[0].length;
        } else if (first === s) {
          nodes.push({ type: 'element', tagName: 'sup', children: [{ type: 'text', value: s[1] }] });
          lastIndex = s.index + s[0].length;
        } else if (first === sub) {
          nodes.push({ type: 'element', tagName: 'sub', children: [{ type: 'text', value: sub[1] }] });
          lastIndex = sub.index + sub[0].length;
        }
        // Reset regex lastIndex for next search
        highlightRegex.lastIndex = lastIndex;
        supRegex.lastIndex = lastIndex;
        subRegex.lastIndex = lastIndex;
      }
      if (lastIndex < value.length) {
        nodes.push({ type: 'text', value: value.slice(lastIndex) });
      }
      if (nodes.length > 0) {
        parent.children.splice(index, 1, ...nodes);
        return [visit.SKIP, index + nodes.length];
      }
    });
  };
}
import './App.css';
import { diffLines } from './diffUtils';
import { useRef } from 'react';

const STORAGE_KEY = 'markdown-files';

function getFiles() {
  const files = localStorage.getItem(STORAGE_KEY);
  return files ? JSON.parse(files) : {};
}

function saveFiles(files) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
}

function App() {
  const versionPanelRef = useRef(null);
  const [versionPanelWidth, setVersionPanelWidth] = useState(380);
  // Drag state for resizing
  const dragState = useRef({ dragging: false, startX: 0, startWidth: 0 });

  // Mouse event handlers for resizing
  const handleResizeMouseDown = (e) => {
    dragState.current = {
      dragging: true,
      startX: e.clientX,
      startWidth: versionPanelWidth,
    };
    document.addEventListener('mousemove', handleResizeMouseMove);
    document.addEventListener('mouseup', handleResizeMouseUp);
  };
  const handleResizeMouseMove = (e) => {
    if (!dragState.current.dragging) return;
    const delta = e.clientX - dragState.current.startX;
    setVersionPanelWidth(Math.max(220, dragState.current.startWidth + delta));
  };
  const handleResizeMouseUp = () => {
    dragState.current.dragging = false;
    document.removeEventListener('mousemove', handleResizeMouseMove);
    document.removeEventListener('mouseup', handleResizeMouseUp);
  };
  const [markdown, setMarkdown] = useState('');
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  // Undo/Redo stacks for current note
  const [history, setHistory] = useState([]); // undo stack
  const [redoStack, setRedoStack] = useState([]); // redo stack
  // Version history for each file
  const [fileHistories, setFileHistories] = useState({});
  const [files, setFiles] = useState({});
  const [currentFile, setCurrentFile] = useState('');
  const [filename, setFilename] = useState('');
  const [theme, setTheme] = useState('light');
  const [renaming, setRenaming] = useState(false);
  const [showNoteList, setShowNoteList] = useState(true);
  const [showNewFileInput, setShowNewFileInput] = useState(false);
  const [newFileName, setNewFileName] = useState('Untitled.md');
  const [folders, setFolders] = useState({}); // {folderName: [file1, file2]}
  const [draggedFile, setDraggedFile] = useState(null);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('New Folder');
  const [folderRenaming, setFolderRenaming] = useState(''); // folder name being renamed
  const [folderRenameValue, setFolderRenameValue] = useState('');
  const [collapsedFolders, setCollapsedFolders] = useState({}); // {folderName: true/false}
  const handleRenameFolder = (oldName, newName) => {
    if (!newName.trim() || folders[newName]) return alert('Invalid or duplicate folder name!');
    const updated = { ...folders };
    updated[newName] = updated[oldName];
    delete updated[oldName];
    setFolders(updated);
    setFolderRenaming('');
    setFolderRenameValue('');
    // Also update collapsed state
    setCollapsedFolders(prev => {
      const c = { ...prev };
      c[newName] = c[oldName];
      delete c[oldName];
      return c;
    });
  };

  const handleDeleteFolder = (folder) => {
    if (!window.confirm(`Delete folder '${folder}' and all its files?`)) return;
    const updated = { ...folders };
    delete updated[folder];
    setFolders(updated);
    setCollapsedFolders(prev => {
      const c = { ...prev }; // Create a copy of the previous state
      delete c[folder];
      return c;
    });
  };

  const handleToggleCollapse = (folder) => {
    setCollapsedFolders(prev => ({ ...prev, [folder]: !prev[folder] }));
  };
  const handleCreateNewFolder = () => {
    let name = newFolderName.trim() || 'New Folder';
    if (folders[name]) {
      alert('Folder already exists!');
      return;
    }
    setFolders({ ...folders, [name]: [] });
    setShowNewFolderInput(false);
    setNewFolderName('New Folder');
  };

  const handleDropFileToFolder = (folder, file) => {
    // Remove from root
    const newFiles = { ...files };
    delete newFiles[file];
    setFiles(newFiles);
    // Add to folder
    setFolders({
      ...folders,
      [folder]: [...(folders[folder] || []), file],
    });
  };
  const handleCreateNewFile = () => {
    let name = newFileName.trim() || 'Untitled.md';
    if (files[name]) {
      alert('File already exists!');
      return;
    }
    const updated = { ...files, [name]: '' };
    setFiles(updated);
    saveFiles(updated);
    setCurrentFile(name);
    setFilename(name);
    setMarkdown('');
    setShowNewFileInput(false);
    setNewFileName('Untitled.md');
  };

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

  // Save current version to file history
  const handleSave = () => {
    if (!filename.trim()) return;
    const updated = { ...files, [filename]: markdown };
    setFiles(updated);
    saveFiles(updated);
    setCurrentFile(filename);
    // Only add to version history if content changed from last version
    setFileHistories(fh => {
      const prevVersions = fh[filename] || [];
      const lastVersion = prevVersions.length > 0 ? prevVersions[prevVersions.length - 1] : undefined;
      if (lastVersion === markdown) {
        alert('No changes to save!');
        return fh;
      }
      alert('File saved!');
      return {
        ...fh,
        [filename]: [...prevVersions, markdown]
      };
    });
  };

  // Custom onChange for editor with undo/redo
  const handleMarkdownChange = (value) => {
    setHistory(prev => [...prev, markdown]);
    setRedoStack([]); // Clear redo stack on new edit
    setMarkdown(value);
  };

  // Undo/Redo handlers
  const handleUndo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setRedoStack(r => [markdown, ...r]);
    setHistory(h => h.slice(0, -1));
    setMarkdown(prev);
  };
  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    setHistory(h => [...h, markdown]);
    setRedoStack(r => r.slice(1));
    setMarkdown(next);
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
        <button onClick={() => setShowVersionHistory(v => !v)}>
          {showVersionHistory ? 'Hide Version History' : 'Show Version History'}
        </button>
        <button className="save-btn" onClick={handleSave}>💾 Save</button>
        <button onClick={handleUndo} disabled={history.length === 0}>↩️ Undo</button>
        <button onClick={handleRedo} disabled={redoStack.length === 0}>↪️ Redo</button>
        <button onClick={handleExport}>⬇️ Export</button>
        <button onClick={handleThemeSwitch}>
          {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
        </button>
        <button onClick={() => setShowNewFileInput(v => !v)}>
          ➕ New File
        </button>
        <button onClick={() => setShowNoteList(v => !v)}>
          {showNoteList ? 'Hide Notes' : 'Show Notes'}
        </button>
        <button onClick={() => setShowNewFolderInput(v => !v)}>
          📁 New Folder
        </button>
        {showNewFileInput && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <input
              value={newFileName}
              onChange={e => setNewFileName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateNewFile();
              }}
              className="filename-input"
              style={{ width: Math.max(10, newFileName.length) + 'ch' }}
              autoFocus
            />
            <button onClick={handleCreateNewFile}>Create</button>
          </span>
        )}
        {showNewFolderInput && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <input
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateNewFolder();
              }}
              className="filename-input"
              style={{ width: Math.max(10, newFolderName.length) + 'ch' }}
              autoFocus
            />
            <button onClick={handleCreateNewFolder}>Create</button>
          </span>
        )}
      </div>
      <div className="main-content-layout">
        <div className="editor-preview-wrapper">
          <textarea
            className="markdown-input"
            value={markdown}
            onChange={e => handleMarkdownChange(e.target.value)}
            placeholder="Type your markdown here..."
          />
      {/* Version History Panel */}
      {showVersionHistory && fileHistories[filename] && fileHistories[filename].length > 0 && (
        <div
          ref={versionPanelRef}
          style={{
            margin: '1em 0',
            padding: '1em',
            border: '1px solid #eee',
            borderRadius: 8,
            width: versionPanelWidth,
            minWidth: 220,
            maxWidth: 700,
            resize: 'none',
            position: 'relative',
            display: 'inline-block',
            verticalAlign: 'top',
            background: '#fafbfc',
          }}
        >
          <b>Version History for {filename}:</b>
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: 8,
              height: '100%',
              cursor: 'ew-resize',
              zIndex: 2,
              background: 'transparent',
              userSelect: 'none',
            }}
            onMouseDown={handleResizeMouseDown}
            title="Drag to resize"
          />
          <ul style={{maxHeight:400,overflowY:'auto',overflowX:'hidden',marginRight:12}}>
            {fileHistories[filename].map((ver, i) => {
              // Compare with previous version (or empty string for v1)
              const prev = i === 0 ? '' : fileHistories[filename][i-1];
              const diff = diffLines(prev, ver);
              return (
                <li key={i} style={{marginBottom:4}}>
                  <button onClick={() => setMarkdown(ver)} style={{fontSize:'0.9em'}}>Restore v{i+1}</button>
                  <span style={{marginLeft:8, fontFamily:'monospace', fontSize:'0.92em'}}>
                    {diff.map((part, idx) =>
                      part.type === 'unchanged' ? null : (
                        <span
                          key={idx}
                          style={{
                            background: part.type === 'added' ? '#d4f8e8' : '#ffd6d6',
                            color: part.type === 'added' ? '#228b22' : '#b22222',
                            textDecoration: part.type === 'removed' ? 'line-through' : 'none',
                            marginRight: 2,
                            borderRadius: 2,
                            padding: '0 2px',
                          }}
                        >
                          {part.text}
                        </span>
                      )
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
          <div className="markdown-preview">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, customMarkdownPlugins]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                // Checklist rendering
                li({ children, checked, ...props }) {
                  if (typeof checked === 'boolean') {
                    return (
                      <li {...props} className="checklist-item">
                        <input type="checkbox" checked={checked} readOnly />{' '}
                        {children}
                      </li>
                    );
                  }
                  return <li {...props}>{children}</li>;
                },
              }}
            >
              {markdown}
            </ReactMarkdown>
          </div>
        </div>
        {showNoteList && (
          <div className="file-list note-list-column">
            <div style={{fontWeight:'bold',marginBottom:8}}>Saved Notes</div>
            {/* Root files */}
            {Object.keys(files).length === 0 && Object.keys(folders).length === 0 && <div style={{color:'#888'}}>No notes yet.</div>}
            {Object.keys(files).map(name => (
              <div
                key={name}
                className={`file-item${name === currentFile ? ' active' : ''}`}
                draggable
                onDragStart={() => setDraggedFile(name)}
                onDragEnd={() => setDraggedFile(null)}
              >
                {renaming && currentFile === name ? (
                  <>
                    <input
                      value={filename}
                      onChange={e => setFilename(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRename(currentFile, filename);
                      }}
                      className="filename-input"
                      style={{ width: Math.max(10, filename.length) + 'ch' }}
                      autoFocus
                    />
                    <button className="save-btn" onClick={() => handleRename(currentFile, filename)}>Save</button>
                    <button onClick={() => setRenaming(false)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <span onClick={() => handleLoad(name)}>{name}</span>
                    <button onClick={() => { setRenaming(true); setFilename(name); }}>Rename</button>
                    <button onClick={() => handleDelete(name)} title="Delete">🗑️</button>
                  </>
                )}
              </div>
            ))}
            {/* Folders */}
            {Object.keys(folders).map(folder => (
              <div
                key={folder}
                className="folder-item"
                onDragOver={e => e.preventDefault()}
                onDrop={() => draggedFile && handleDropFileToFolder(folder, draggedFile)}
              >
                <div style={{display:'flex',alignItems:'center',fontWeight:'bold',margin:'6px 0',gap:6}}>
                  <span
                    onClick={() => handleToggleCollapse(folder)}
                    style={{fontSize:'1.1em',cursor:'pointer',userSelect:'none',marginRight:2}}
                    title={collapsedFolders[folder] ? 'Expand' : 'Collapse'}
                  >
                    {collapsedFolders[folder] ? '▶' : '▼'}
                  </span>
                  <span
                    onClick={() => handleToggleCollapse(folder)}
                    style={{cursor:'pointer',userSelect:'none'}}
                    title={collapsedFolders[folder] ? 'Expand' : 'Collapse'}
                  >
                    
                  </span>
                  {folderRenaming === folder ? (
                    <>
                      <input
                        value={folderRenameValue}
                        onChange={e => setFolderRenameValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleRenameFolder(folder, folderRenameValue);
                        }}
                        className="filename-input"
                        style={{ width: Math.max(10, folderRenameValue.length) + 'ch' }}
                        autoFocus
                      />
                      <button className="save-btn" onClick={() => handleRenameFolder(folder, folderRenameValue)}>Save</button>
                      <button className="cancel-btn" onClick={() => setFolderRenaming('')}>Cancel</button>
                    </>
                  ) : (
                    <>
                       {folder}
                      <button className="rename-btn" onClick={() => { setFolderRenaming(folder); setFolderRenameValue(folder); }}>Rename</button>
                      <button onClick={() => handleDeleteFolder(folder)} title="Delete">🗑️</button>
                    </>
                  )}
                </div>
                {!collapsedFolders[folder] && (
                  <>
                    {(folders[folder] || []).length === 0 && <div style={{color:'#aaa',fontSize:'0.95em',marginLeft:16}}>Empty</div>}
                    {(folders[folder] || []).map(name => (
                      <div
                        key={name}
                        className={`file-item${name === currentFile ? ' active' : ''}`}
                      >
                        <span onClick={() => handleLoad(name)}>{name}</span>
                        <button onClick={() => { setRenaming(true); setFilename(name); }}>Rename</button>
                        <button onClick={() => handleDelete(name)} title="Delete">🗑️</button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
