import React, { useState, useRef, useEffect } from 'react';
import './App.css';
import { formatFileSize, formatDate, generateThumbnail } from './utils';

function App() {
  const [documents, setDocuments] = useState([]);
  const [selectedDocuments, setSelectedDocuments] = useState([]);
  const [editingDocId, setEditingDocId] = useState(null);
  const [newName, setNewName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState('name');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [bookmarks, setBookmarks] = useState({});
  const [editingBookmark, setEditingBookmark] = useState(null);
  const [bookmarkNote, setBookmarkNote] = useState('');
  const [bookmarkSearchTerm, setBookmarkSearchTerm] = useState('');
  const fileInputRef = useRef(null);
  const bookmarkFileInputRef = useRef(null);
  const nameInputRef = useRef(null);
  const noteInputRef = useRef(null);

  // Get the first selected document for display
  const selectedDocument = selectedDocuments.length > 0 ? selectedDocuments[0] : null;

  // Filter documents based on search term
  const filteredDocuments = documents.filter(doc => 
    doc.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sort documents based on sort option
  const sortedDocuments = [...filteredDocuments].sort((a, b) => {
    if (sortOption === 'name') {
      return a.name.localeCompare(b.name);
    } else if (sortOption === 'date') {
      return new Date(b.uploadDate) - new Date(a.uploadDate);
    }
    return 0;
  });

  // Filter bookmarks based on search term
  const filteredBookmarks = selectedDocument && bookmarks[selectedDocument.id] 
    ? bookmarks[selectedDocument.id].filter(bookmark => 
        bookmark.note.toLowerCase().includes(bookmarkSearchTerm.toLowerCase()) ||
        `Page ${bookmark.page}`.toLowerCase().includes(bookmarkSearchTerm.toLowerCase())
      )
    : [];

  useEffect(() => {
    if (editingDocId && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [editingDocId]);

  useEffect(() => {
    if (editingBookmark && noteInputRef.current) {
      noteInputRef.current.focus();
    }
  }, [editingBookmark]);

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    const pdfFiles = files.filter(file => file.type === 'application/pdf');
    
    if (pdfFiles.length === 0) {
      alert('Please upload at least one PDF file.');
      return;
    }
    
    // Generate thumbnails for all files
    const thumbnails = await Promise.all(pdfFiles.map(file => generateThumbnail(file)));
    
    const newDocuments = pdfFiles.map((file, index) => ({
      id: Date.now() + Math.random(),
      name: file.name,
      size: file.size,
      url: URL.createObjectURL(file),
      uploadDate: new Date().toISOString(),
      thumbnail: thumbnails[index],
      currentPage: 1,
      totalPages: 1
    }));
    
    setDocuments(prev => [...prev, ...newDocuments]);
    if (selectedDocuments.length === 0) {
      setSelectedDocuments([newDocuments[0]]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    const pdfFiles = files.filter(file => file.type === 'application/pdf');
    
    if (pdfFiles.length === 0) {
      alert('Please drop at least one PDF file.');
      return;
    }
    
    // Generate thumbnails for all files
    const thumbnails = await Promise.all(pdfFiles.map(file => generateThumbnail(file)));
    
    const newDocuments = pdfFiles.map((file, index) => ({
      id: Date.now() + Math.random(),
      name: file.name,
      size: file.size,
      url: URL.createObjectURL(file),
      uploadDate: new Date().toISOString(),
      thumbnail: thumbnails[index],
      currentPage: 1,
      totalPages: 1
    }));
    
    setDocuments(prev => [...prev, ...newDocuments]);
    if (selectedDocuments.length === 0) {
      setSelectedDocuments([newDocuments[0]]);
    }
  };

  const handleDeleteDocument = (id) => {
    const updatedDocuments = documents.filter(doc => doc.id !== id);
    setDocuments(updatedDocuments);
    
    const updatedSelectedDocuments = selectedDocuments.filter(doc => doc.id !== id);
    setSelectedDocuments(updatedSelectedDocuments);
    
    // Remove bookmarks for deleted document
    const updatedBookmarks = { ...bookmarks };
    delete updatedBookmarks[id];
    setBookmarks(updatedBookmarks);
    
    if (updatedSelectedDocuments.length === 0 && updatedDocuments.length > 0) {
      setSelectedDocuments([updatedDocuments[0]]);
    }
  };

  const handleDownloadDocument = () => {
    if (!selectedDocument) return;
    
    const link = document.createElement('a');
    link.href = selectedDocument.url;
    link.download = selectedDocument.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadSelectedDocuments = () => {
    if (selectedDocuments.length === 0) return;
    
    selectedDocuments.forEach(doc => {
      const link = document.createElement('a');
      link.href = doc.url;
      link.download = doc.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  };

  const startEditingName = (doc) => {
    setEditingDocId(doc.id);
    setNewName(doc.name);
  };

  const saveNewName = (id) => {
    if (newName.trim() !== '') {
      const updatedDocuments = documents.map(doc => 
        doc.id === id ? { ...doc, name: newName } : doc
      );
      setDocuments(updatedDocuments);
      
      const updatedSelectedDocuments = selectedDocuments.map(doc => 
        doc.id === id ? { ...doc, name: newName } : doc
      );
      setSelectedDocuments(updatedSelectedDocuments);
    }
    setEditingDocId(null);
    setNewName('');
  };

  const cancelEditing = () => {
    setEditingDocId(null);
    setNewName('');
  };

  const clearSearch = () => {
    setSearchTerm('');
  };

  const clearBookmarkSearch = () => {
    setBookmarkSearchTerm('');
  };

  const toggleDocumentSelection = (doc) => {
    if (isMultiSelect) {
      if (selectedDocuments.some(selected => selected.id === doc.id)) {
        setSelectedDocuments(prev => prev.filter(selected => selected.id !== doc.id));
      } else {
        setSelectedDocuments(prev => [...prev, doc]);
      }
    } else {
      setSelectedDocuments([doc]);
    }
  };

  const selectAllDocuments = () => {
    setSelectedDocuments([...sortedDocuments]);
  };

  const deselectAllDocuments = () => {
    setSelectedDocuments([]);
  };

  const rotatePdf = (degrees) => {
    setRotation(prev => (prev + degrees) % 360);
  };

  const resetRotation = () => {
    setRotation(0);
  };

  const zoomIn = () => {
    setZoom(prev => Math.min(prev + 0.1, 3));
  };

  const zoomOut = () => {
    setZoom(prev => Math.max(prev - 0.1, 0.5));
  };

  const resetZoom = () => {
    setZoom(1);
  };

  const goToPreviousPage = () => {
    if (selectedDocument && selectedDocument.currentPage > 1) {
      const updatedDocuments = documents.map(doc => 
        doc.id === selectedDocument.id 
          ? { ...doc, currentPage: doc.currentPage - 1 } 
          : doc
      );
      setDocuments(updatedDocuments);
      
      const updatedSelectedDocuments = selectedDocuments.map(doc => 
        doc.id === selectedDocument.id 
          ? { ...doc, currentPage: doc.currentPage - 1 } 
          : doc
      );
      setSelectedDocuments(updatedSelectedDocuments);
    }
  };

  const goToNextPage = () => {
    if (selectedDocument && selectedDocument.currentPage < (selectedDocument.totalPages || 1)) {
      const updatedDocuments = documents.map(doc => 
        doc.id === selectedDocument.id 
          ? { ...doc, currentPage: doc.currentPage + 1 } 
          : doc
      );
      setDocuments(updatedDocuments);
      
      const updatedSelectedDocuments = selectedDocuments.map(doc => 
        doc.id === selectedDocument.id 
          ? { ...doc, currentPage: doc.currentPage + 1 } 
          : doc
      );
      setSelectedDocuments(updatedSelectedDocuments);
    }
  };

  const goToPage = (page) => {
    if (selectedDocument && page >= 1 && page <= (selectedDocument.totalPages || 1)) {
      const updatedDocuments = documents.map(doc => 
        doc.id === selectedDocument.id 
          ? { ...doc, currentPage: page } 
          : doc
      );
      setDocuments(updatedDocuments);
      
      const updatedSelectedDocuments = selectedDocuments.map(doc => 
        doc.id === selectedDocument.id 
          ? { ...doc, currentPage: page } 
          : doc
      );
      setSelectedDocuments(updatedSelectedDocuments);
    }
  };

  const toggleBookmark = (docId, page) => {
    setBookmarks(prev => {
      const docBookmarks = prev[docId] || [];
      const bookmarkIndex = docBookmarks.findIndex(b => b.page === page);
      
      if (bookmarkIndex >= 0) {
        // Remove bookmark
        const updatedBookmarks = [...docBookmarks];
        updatedBookmarks.splice(bookmarkIndex, 1);
        return {
          ...prev,
          [docId]: updatedBookmarks
        };
      } else {
        // Add bookmark
        return {
          ...prev,
          [docId]: [...docBookmarks, { page, note: '' }]
        };
      }
    });
  };

  const isBookmarked = (docId, page) => {
    return bookmarks[docId] && bookmarks[docId].some(b => b.page === page);
  };

  const startEditingBookmarkNote = (docId, page) => {
    const docBookmarks = bookmarks[docId] || [];
    const bookmark = docBookmarks.find(b => b.page === page);
    if (bookmark) {
      setEditingBookmark({ docId, page });
      setBookmarkNote(bookmark.note || '');
    }
  };

  const saveBookmarkNote = () => {
    if (editingBookmark) {
      setBookmarks(prev => {
        const docBookmarks = prev[editingBookmark.docId] || [];
        const updatedBookmarks = docBookmarks.map(b => 
          b.page === editingBookmark.page ? { ...b, note: bookmarkNote } : b
        );
        return {
          ...prev,
          [editingBookmark.docId]: updatedBookmarks
        };
      });
      setEditingBookmark(null);
      setBookmarkNote('');
    }
  };

  const cancelEditingBookmarkNote = () => {
    setEditingBookmark(null);
    setBookmarkNote('');
  };

  const exportBookmarks = () => {
    if (!selectedDocument || !bookmarks[selectedDocument.id]) return;
    
    const bookmarkData = {
      documentName: selectedDocument.name,
      bookmarks: bookmarks[selectedDocument.id]
    };
    
    const dataStr = JSON.stringify(bookmarkData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `${selectedDocument.name}_bookmarks.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleBookmarkFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const bookmarkData = JSON.parse(e.target.result);
        if (bookmarkData.documentName === selectedDocument.name && bookmarkData.bookmarks) {
          setBookmarks(prev => ({
            ...prev,
            [selectedDocument.id]: bookmarkData.bookmarks
          }));
          alert('Bookmarks imported successfully!');
        } else {
          alert('Invalid bookmark file or document name mismatch.');
        }
      } catch (error) {
        alert('Error parsing bookmark file.');
      }
    };
    reader.readAsText(file);
  };

  const importBookmarks = () => {
    if (!selectedDocument) return;
    bookmarkFileInputRef.current.click();
  };

  // Update the URL to include page information
  const getPdfUrlWithPage = (doc) => {
    if (!doc) return '';
    // Note: This is a simplified approach. In a real implementation, you might need
    // to use a PDF viewer library that supports page navigation.
    return `${doc.url}#page=${doc.currentPage || 1}`;
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <h1>Modern Document Viewer</h1>
        <div className="header-actions">
          <button 
            className={`multi-select-toggle ${isMultiSelect ? 'active' : ''}`}
            onClick={() => setIsMultiSelect(!isMultiSelect)}
          >
            {isMultiSelect ? 'Multi-Select On' : 'Multi-Select Off'}
          </button>
          <button 
            className="view-toggle"
            onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
          >
            {viewMode === 'list' ? 'Grid View' : 'List View'}
          </button>
          <button 
            className="upload-btn" 
            onClick={() => fileInputRef.current.click()}
          >
            Upload PDF
          </button>
        </div>
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileUpload}
          accept=".pdf"
          multiple
        />
      </header>

      <div className="main-content">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-header">
            <h2>Documents ({documents.length})</h2>
            {isMultiSelect && (
              <div className="multi-select-actions">
                <span>{selectedDocuments.length} selected</span>
                <button onClick={selectAllDocuments}>Select All</button>
                <button onClick={deselectAllDocuments}>Deselect All</button>
                <button onClick={handleDownloadSelectedDocuments}>Download Selected</button>
              </div>
            )}
            <div className="search-container">
              <input
                type="text"
                placeholder="Search documents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              {searchTerm && (
                <button className="clear-search" onClick={clearSearch}>
                  ×
                </button>
              )}
            </div>
            <div className="sort-container">
              <label htmlFor="sort">Sort by: </label>
              <select 
                id="sort" 
                value={sortOption} 
                onChange={(e) => setSortOption(e.target.value)}
                className="sort-select"
              >
                <option value="name">Name</option>
                <option value="date">Date</option>
              </select>
            </div>
          </div>
          <ul className={`document-list ${viewMode}`}>
            {sortedDocuments.map(doc => (
              <li 
                key={doc.id} 
                className={selectedDocuments.some(selected => selected.id === doc.id) ? 'selected' : ''}
                onClick={() => toggleDocumentSelection(doc)}
              >
                {viewMode === 'grid' ? (
                  <div className="doc-grid-item">
                    <div className="doc-thumbnail">
                      <img src={doc.thumbnail} alt={doc.name} />
                    </div>
                    <div className="doc-grid-info">
                      <div className="doc-name">{doc.name}</div>
                      <div className="doc-meta">
                        <span className="doc-size">{formatFileSize(doc.size)}</span>
                        <span className="doc-date">{formatDate(doc.uploadDate)}</span>
                      </div>
                    </div>
                  </div>
                ) : editingDocId === doc.id ? (
                  <div className="doc-editing">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onBlur={() => saveNewName(doc.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveNewName(doc.id);
                        if (e.key === 'Escape') cancelEditing();
                      }}
                      ref={nameInputRef}
                      className="name-input"
                    />
                    <div className="edit-buttons">
                      <button className="save-btn" onClick={() => saveNewName(doc.id)}>Save</button>
                      <button className="cancel-btn" onClick={cancelEditing}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="doc-info">
                      <div className="doc-name">{doc.name}</div>
                      <div className="doc-meta">
                        <span className="doc-size">{formatFileSize(doc.size)}</span>
                        <span className="doc-date">{formatDate(doc.uploadDate)}</span>
                      </div>
                    </div>
                    <div className="doc-actions">
                      <button 
                        className="edit-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditingName(doc);
                        }}
                      >
                        ✎
                      </button>
                      <button 
                        className="delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDocument(doc.id);
                        }}
                      >
                        ×
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        </aside>

        {/* Main View */}
        <main 
          className="viewer"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {selectedDocument ? (
            <div className="pdf-viewer">
              <div className="pdf-header">
                <h2>{selectedDocument.name}</h2>
                <div className="pdf-actions">
                  <button className="nav-btn" onClick={goToPreviousPage} disabled={selectedDocument.currentPage <= 1}>‹</button>
                  <span className="page-info">
                    Page {selectedDocument.currentPage || 1} of {selectedDocument.totalPages || 1}
                  </span>
                  <button className="nav-btn" onClick={goToNextPage} disabled={selectedDocument.currentPage >= (selectedDocument.totalPages || 1)}>›</button>
                  <button 
                    className={`bookmark-btn ${isBookmarked(selectedDocument.id, selectedDocument.currentPage) ? 'bookmarked' : ''}`}
                    onClick={() => toggleBookmark(selectedDocument.id, selectedDocument.currentPage)}
                  >
                    {isBookmarked(selectedDocument.id, selectedDocument.currentPage) ? '★' : '☆'}
                  </button>
                  <button className="zoom-btn" onClick={zoomOut}>−</button>
                  <span className="zoom-level">{Math.round(zoom * 100)}%</span>
                  <button className="zoom-btn" onClick={zoomIn}>+</button>
                  <button className="reset-btn" onClick={resetZoom}>Reset Zoom</button>
                  <button className="rotate-btn" onClick={() => rotatePdf(-90)}>↺</button>
                  <button className="rotate-btn" onClick={() => rotatePdf(90)}>↻</button>
                  <button className="reset-btn" onClick={resetRotation}>Reset Rotation</button>
                  <button className="download-btn" onClick={handleDownloadDocument}>
                    Download
                  </button>
                </div>
                <div className="pdf-info">
                  <span>{formatFileSize(selectedDocument.size)}</span>
                  <span>{formatDate(selectedDocument.uploadDate)}</span>
                </div>
              </div>
              <div className="pdf-container">
                <iframe 
                  src={getPdfUrlWithPage(selectedDocument)} 
                  title={selectedDocument.name}
                  width="100%" 
                  height="100%"
                  style={{ 
                    transform: `rotate(${rotation}deg) scale(${zoom})`,
                    transformOrigin: 'center'
                  }}
                />
              </div>
              {bookmarks[selectedDocument.id] && bookmarks[selectedDocument.id].length > 0 && (
                <div className="bookmarks-panel">
                  <div className="bookmarks-header">
                    <h3>Bookmarks</h3>
                    <div className="bookmark-actions">
                      <button className="export-btn" onClick={exportBookmarks}>
                        Export
                      </button>
                      <button className="import-btn" onClick={importBookmarks}>
                        Import
                      </button>
                    </div>
                  </div>
                  <div className="bookmark-search-container">
                    <input
                      type="text"
                      placeholder="Search bookmarks..."
                      value={bookmarkSearchTerm}
                      onChange={(e) => setBookmarkSearchTerm(e.target.value)}
                      className="bookmark-search-input"
                    />
                    {bookmarkSearchTerm && (
                      <button className="clear-search" onClick={clearBookmarkSearch}>
                        ×
                      </button>
                    )}
                  </div>
                  <ul>
                    {(bookmarkSearchTerm ? filteredBookmarks : bookmarks[selectedDocument.id])
                      .sort((a, b) => a.page - b.page)
                      .map(bookmark => (
                        <li key={bookmark.page}>
                          {editingBookmark && editingBookmark.docId === selectedDocument.id && editingBookmark.page === bookmark.page ? (
                            <div className="bookmark-editing">
                              <input
                                type="text"
                                value={bookmarkNote}
                                onChange={(e) => setBookmarkNote(e.target.value)}
                                ref={noteInputRef}
                                className="note-input"
                                placeholder="Add a note..."
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveBookmarkNote();
                                  if (e.key === 'Escape') cancelEditingBookmarkNote();
                                }}
                              />
                              <div className="edit-buttons">
                                <button className="save-btn" onClick={saveBookmarkNote}>Save</button>
                                <button className="cancel-btn" onClick={cancelEditingBookmarkNote}>Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <div className="bookmark-item-container">
                              <button 
                                className={`bookmark-item ${selectedDocument.currentPage === bookmark.page ? 'current' : ''}`}
                                onClick={() => goToPage(bookmark.page)}
                              >
                                Page {bookmark.page}
                              </button>
                              {bookmark.note && (
                                <div className="bookmark-note">{bookmark.note}</div>
                              )}
                              <button 
                                className="edit-note-btn"
                                onClick={() => startEditingBookmarkNote(selectedDocument.id, bookmark.page)}
                              >
                                ✎
                              </button>
                            </div>
                          )}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="drop-zone">
              <p>Drag & drop PDF files here</p>
              <p>or</p>
              <button onClick={() => fileInputRef.current.click()}>
                Select PDF Files
              </button>
              <p className="drop-zone-info">Supports multiple file selection</p>
            </div>
          )}
          <input
            type="file"
            ref={bookmarkFileInputRef}
            style={{ display: 'none' }}
            onChange={handleBookmarkFileUpload}
            accept=".json"
          />
        </main>
      </div>
    </div>
  );
}

export default App;