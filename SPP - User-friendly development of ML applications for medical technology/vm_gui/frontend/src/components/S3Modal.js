import React, { useState, useEffect } from 'react';

const styles = {
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)', // Dunkler Hintergrund
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  modal: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    width: '400px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
  },
  title: { margin: '0 0 20px 0', fontSize: '1.2rem', color: '#2c3e50' },
  inputGroup: { marginBottom: '15px' },
  label: { display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.9rem' },
  input: { width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' },
  buttonSave: { padding: '8px 16px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  buttonCancel: { padding: '8px 16px', backgroundColor: '#95a5a6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }
};

const S3Modal = ({ isOpen, onClose, onSave, initialData }) => {
  // Lokaler State für die Eingabefelder
  const [endpoint, setEndpoint] = useState('');
  const [accessKey, setAccessKey] = useState('');
  const [secretKey, setSecretKey] = useState('');

  // Wenn das Modal aufgeht, laden wir evtl. schon vorhandene Daten
  useEffect(() => {
    if (isOpen && initialData) {
      setEndpoint(initialData.endpoint || 'https://s3.rwth-aachen.de'); // Standard-Wert
      setAccessKey(initialData.accessKey || '');
      setSecretKey(initialData.secretKey || '');
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({ endpoint, accessKey, secretKey });
    onClose();
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h2 style={styles.title}>🔒 S3 Konfiguration</h2>
        
        <div style={styles.inputGroup}>
          <label style={styles.label}>S3 Endpoint URL</label>
          <input 
            style={styles.input} 
            value={endpoint} 
            onChange={(e) => setEndpoint(e.target.value)} 
            placeholder="z.B. https://s3.rwth-aachen.de"
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Access Key ID</label>
          <input 
            style={styles.input} 
            value={accessKey} 
            onChange={(e) => setAccessKey(e.target.value)} 
            type="password" // Wichtig: Sternchen anzeigen
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Secret Access Key</label>
          <input 
            style={styles.input} 
            value={secretKey} 
            onChange={(e) => setSecretKey(e.target.value)} 
            type="password"
          />
        </div>

        <div style={styles.actions}>
          <button style={styles.buttonCancel} onClick={onClose}>Abbrechen</button>
          <button style={styles.buttonSave} onClick={handleSave}>Speichern</button>
        </div>
      </div>
    </div>
  );
};

export default S3Modal;