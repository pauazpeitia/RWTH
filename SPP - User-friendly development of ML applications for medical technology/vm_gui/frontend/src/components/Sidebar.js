import React, { useState, useEffect } from 'react';

const styles = {
  container: {
    width: '250px',
    backgroundColor: '#f8f9fa',
    borderRight: '1px solid #ddd',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    height: '100%', // <--- WICHTIG: Damit die Sidebar die volle Höhe nutzt
    boxSizing: 'border-box' // Verhindert, dass Padding die Breite/Höhe verfälscht
  },
  title: {
    fontSize: '1.2rem',
    marginBottom: '15px',
    color: '#2c3e50',
    fontWeight: 'bold',
    flexShrink: 0 // <--- WICHTIG: Titel darf nicht schrumpfen
  },
  searchBar: {
    width: '100%', 
    padding: '8px', 
    marginBottom: '10px',
    boxSizing: 'border-box',
    border: '1px solid #ccc',
    borderRadius: '4px'
  },
  // --- NEU: Der Container für die scrollbare Liste ---
  scrollArea: {
    flex: 1,           // Nimmt den restlichen Platz ein
    overflowY: 'auto', // Zeigt Scrollbalken bei Bedarf
    minHeight: 0,      // Wichtiger Fix für Flexbox-Scrolling
    paddingRight: '5px' // Etwas Platz für den Scrollbalken
  },
  item: {
    backgroundColor: 'white',
    padding: '10px',
    marginBottom: '10px',
    borderRadius: '5px',
    border: '1px solid #ccc',
    cursor: 'grab', 
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
  },
  statusMsg: {
    fontSize: '0.9rem',
    color: '#666',
    fontStyle: 'italic',
    marginTop: '10px'
  }
};

const Sidebar = () => {
  const [templates, setTemplates] = useState([]);     //Aufruf setTemplates(data): speichert React Daten in var "templates"
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');   //Filter Name

  // 1. VOM BACKEND EMPFANGEN
  useEffect(() => {
    fetch('/api/templates/')     //GET HTTP Request
      .then(response => {
        if (!response.ok) {
          throw new Error('Netzwerk-Fehler: ' + response.status);
        }
        return response.json();                       
      })
      .then(data => {
        setTemplates(data);                           //Speichern im Speicher von React
        setLoading(false);
      })
      .catch(err => {
        console.error("Fetch Fehler:", err);
        setError("Verbindung fehlgeschlagen.");
        setLoading(false);
      });
  }, []);

  // 2. Drag-Start Funktion
  const onDragStart = (event, template) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify(template));
    event.dataTransfer.effectAllowed = 'move';
  };

  // 3. Filter funktion (Frontend Intelligent, evt in Backend implementieren)
  const filteredTemplates = templates.filter((tpl) =>         //tpl als "vollständige Objekt"
    tpl.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={styles.container}>
      {/* Header Bereich */}
      <div style={styles.title}>Templates</div>

      <input 
        type="text" 
        placeholder="Template suchen..." 
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={styles.searchBar}
      />

      {/* Scrollbarer Listen Bereich */}
      <div style={styles.scrollArea}>
        
        {loading && <p style={styles.statusMsg}>Lade...</p>}
        {error && <p style={{color: 'red', fontSize: '0.9rem'}}>{error}</p>}

        {!loading && !error && filteredTemplates.length === 0 && (
          <p style={styles.statusMsg}>Keine Templates gefunden.</p>
        )}

        {filteredTemplates.map((tpl, index) => (
          <div 
            key={index} 
            style={styles.item} 
            draggable 
            onDragStart={(event) => onDragStart(event, tpl)} 
          >
            <strong>{tpl.name || "Unbenannt"}</strong>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Sidebar;