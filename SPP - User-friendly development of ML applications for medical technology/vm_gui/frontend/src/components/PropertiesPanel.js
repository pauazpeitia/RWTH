import React, { useState, useEffect } from 'react';

// --- STYLES ---
const styles = {
  panel: {
    width: '320px', 
    backgroundColor: '#f8f9fa',
    borderLeft: '1px solid #ddd',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto', 
    height: '100%',
    boxSizing: 'border-box'
  },
  header: {
    borderBottom: '1px solid #ccc',
    paddingBottom: '15px',
    marginBottom: '15px'
  },
  title: {
    fontSize: '1.1rem',
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: '5px'
  },
  subTitle: {
    fontSize: '0.8rem',
    color: '#666',
    marginBottom: '10px'
  },
  label: {
    fontSize: '0.85rem', 
    fontWeight: '600',
    marginBottom: '4px',
    color: '#333',
    display: 'block'
  },
  labelRequired: {
    color: '#e74c3c',
    marginLeft: '3px'
  },
  select: {
    width: '100%',
    padding: '6px',
    marginBottom: '10px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    backgroundColor: '#fff'
  },
  input: {
    width: '100%',
    padding: '6px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    boxSizing: 'border-box',
    fontSize: '0.9rem'
  },
  inputError: {
    borderColor: '#e74c3c',
    backgroundColor: '#fff5f5'
  },
  helperText: {
    fontSize: '0.75rem',
    color: '#e74c3c',
    marginTop: '2px'
  },
  paramsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  toggleButton: {
    background: 'none',
    border: 'none',
    color: '#007bff',
    cursor: 'pointer',
    fontSize: '0.9rem',
    padding: '10px 0 0 0',
    textAlign: 'left',
    textDecoration: 'underline',
    display: 'flex',
    alignItems: 'center',
    gap: '5px'
  },
  sectionTitle: {
    fontSize: '0.8rem',
    fontWeight: 'bold',
    color: '#888',
    textTransform: 'uppercase',
    marginTop: '10px',
    marginBottom: '5px'
  }
};

const PropertiesPanel = ({ selectedNode, sourceNodes, onNodeDataChange }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const [sourceOutputs, setSourceOutputs] = useState([]);

  useEffect(() => {
    setShowAdvanced(false);
  }, [selectedNode?.id]);

  // --- DETAILS (LAZY LOADING) ---
  useEffect(() => {
    if (!selectedNode) return;
    const { templateId, selectedEntrypoint, schema } = selectedNode.data;

    // Wenn wir bereits ein Schema geladen haben und es dem aktuellen Einstiegspunkt entspricht, laden wir es nicht erneut
    if (schema && schema.entrypointLoaded === selectedEntrypoint) {
      return; 
    }

    // Backend anfragen
    setLoading(true);
    setError(null);

    fetch(`/api/templates/details/?name=${templateId}&entrypoint=${selectedEntrypoint}`)
      .then(res => {
        if (!res.ok) throw new Error("Fehler beim Laden der Template details");
        return res.json();
      })
      .then(data => {
        // data = { parameters: [...], artifacts: [...], outputs: [...] }
        
        // 4. DEFAULTS
        const currentParams = selectedNode.data.params || {};
        const newParams = { ...currentParams };
        
        data.parameters.forEach(p => {
          // default falls actual value undefined
          if (p.default !== null && newParams[p.name] === undefined) {
             newParams[p.name] = String(p.default);
          }
        });

        // 5. NODE Aktualisieren
        onNodeDataChange(selectedNode.id, {
          schema: {
            parameters: data.parameters, // List {name, required, default}
            artifacts: data.artifacts,
            entrypointLoaded: selectedEntrypoint
          },
          params: newParams
        });
        
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError("Die Konfiguration konnte nicht geladen werden.");
        setLoading(false);
      });

  }, [selectedNode?.id, selectedNode?.data?.selectedEntrypoint]); // Wird ausgefuhrt als wir node oder entrypoint aendern

  // --- EFFECT: SCHNITSTELLE ---
  useEffect(() => {
    //Falls keine source nodes
    if (!sourceNodes || sourceNodes.length === 0) {
      setSourceOutputs([]);
      return;
    }

    // Liste promesies (details von each Source)
    const fetchPromises = sourceNodes.map(node => {
        const { templateId, selectedEntrypoint } = node.data;
        return fetch(`/api/templates/details/?name=${templateId}&entrypoint=${selectedEntrypoint}`)
            .then(res => res.json())
            .then(details => ({
                sourceId: node.id,      // Wer ist vater
                outputs: details.outputs || []
            }));
    });

    // warte bis alle antworten
    Promise.all(fetchPromises)
      .then(results => {
        // Neues array: Name von ARTIFACT und sourceId von SOURCENODE
        const allOutputs = [];
        results.forEach(res => {
            res.outputs.forEach(out => {
                allOutputs.push({
                    name: out.name,
                    sourceId: res.sourceId,
                    label: `${out.name} (aus ${res.sourceId})` 
                });
            });
        });
        setSourceOutputs(allOutputs);
      })
      .catch(err => console.error("Error loading source nodes", err));
      
  }, [sourceNodes]);

  // --- HANDLERS ---

  const handleEntrypointChange = (e) => {
    const newEntrypoint = e.target.value;
    onNodeDataChange(selectedNode.id, {
      selectedEntrypoint: newEntrypoint,
      schema: null 
    });
  };

  const handleParamChange = (key, value) => {
    onNodeDataChange(selectedNode.id, {
      params: { [key]: value }
    });
  };

  // --- INPUT RENDER ---
  const renderInputField = (param) => {
    const isRequired = param.required;
    const currentValue = selectedNode.data.params?.[param.name] || '';
    
    // Rot falls needed
    const isEmpty = String(currentValue).trim() === '';
    const hasError = isRequired && isEmpty;

    return (
      <div key={param.name}>
        <label style={styles.label}>
          {param.name}
          {isRequired && <span style={styles.labelRequired}>*</span>}
        </label>
        
        <input
          type="text"
          style={{
            ...styles.input,
            ...(hasError ? styles.inputError : {})
          }}
          value={currentValue}
          onChange={(e) => handleParamChange(param.name, e.target.value)}
          placeholder={param.default ? `Default: ${param.default}` : ''}
        />
        
        {hasError && <div style={styles.helperText}>Pflichtfeld</div>}
      </div>
    );
  };


  // --- RENDER MAIN ---
  
  if (!selectedNode) {
    return (
      <div style={styles.panel}>
        <p style={{color: '#666', fontStyle: 'italic', marginTop: '20px'}}>
          Wählen Sie einen Block aus, um dessen Eigenschaften anzuzeigen
        </p>
      </div>
    );
  }

  // --- RENDER: SCHNITTSTELLE ---
  const renderSchnittstelle = () => {
    if (!selectedNode.data.schema?.artifacts?.length) return null;

    return (
      <div style={{marginTop: '20px', borderTop: '1px solid #ccc', paddingTop: '10px'}}>
        <div style={styles.sectionTitle}>🔗 SCHNITTSTELLE</div>
        
        {(!sourceNodes || sourceNodes.length === 0) && (
             <p style={{fontSize: '0.8rem', color: '#e67e22'}}>
               Verbinde diesen Node mit Vorgängern, um Outputs zu erben.
             </p>
        )}

        {selectedNode.data.schema.artifacts.map((inputArtifact) => {
           const currentVal = selectedNode.data.params?.[inputArtifact.name] || "";

           return (
             <div key={inputArtifact.name} style={{marginBottom: '10px'}}>
               <label style={styles.label}>
                 Input: {inputArtifact.name} 
                 {inputArtifact.required && <span style={styles.labelRequired}>*</span>}
               </label>
               
              <select
                 style={styles.select}
                 value={currentVal}
                 onChange={(e) => handleParamChange(inputArtifact.name, e.target.value)}
                 disabled={sourceNodes.length === 0}
               >
                 <option value="">-- Leer --</option>
                 
                 {/* Liste von Nodes */}
                 {sourceOutputs.map((out, idx) => {
                    const uniqueValue = `${out.sourceId}::${out.name}`; 
                    
                    return (
                      <option key={`${out.sourceId}-${out.name}-${idx}`} value={uniqueValue}>
                        {out.label} 
                      </option>
                    );
                })}
               </select>
             </div>
           );
        })}
      </div>
    );
  };

  const { label, entrypoints, selectedEntrypoint, schema } = selectedNode.data;

  // Parameter Clasisification
  const requiredParams = schema?.parameters.filter(p => p.required) || [];
  const optionalParams = schema?.parameters.filter(p => !p.required) || [];

  return (
    <div style={styles.panel}>
      
      {/* 1. HEADER & ENTRYPOINT SELECTOR */}
      <div style={styles.header}>
        <div style={styles.title}>{label}</div>
        <div style={styles.subTitle}>ID: {selectedNode.id}</div>
        
        <label style={styles.label}>Funktion (Entrypoint):</label>
        <select 
          style={styles.select} 
          value={selectedEntrypoint} 
          onChange={handleEntrypointChange}
          disabled={loading}
        >
          {entrypoints && entrypoints.map(ep => (
            <option key={ep} value={ep}>{ep}</option>
          ))}
        </select>
      </div>

      {/* 2. LOADING / ERROR STATES */}
      {loading && <p style={{color: '#666'}}>Lade Parameter...</p>}
      {error && <p style={{color: 'red', fontSize: '0.9rem'}}>{error}</p>}

      {/* 3. Dynamisches Formular */}
      {!loading && !error && schema && (
        <div style={styles.paramsContainer}>
          
          {/* Keinen input */}
          {schema.parameters.length === 0 && (
            <p style={{fontStyle: 'italic', color: '#666', fontSize: '0.9rem'}}>
              Diese Funktion benötigt keine Parameter.
            </p>
          )}

          {/* PART A: REQUIRED */}
          {requiredParams.length > 0 && (
            <div>
              {requiredParams.map(renderInputField)}
            </div>
          )}

          {/* PART B: OPTIONAL  */}
          {optionalParams.length > 0 && (
            <>
              <button 
                  style={styles.toggleButton} 
                  onClick={() => setShowAdvanced(!showAdvanced)}
              >
                  {showAdvanced ? '▲ Weniger Optionen' : '▼ Erweiterte Optionen'} 
                  <span style={{color: '#999', fontSize: '0.8em', marginLeft: '5px'}}>
                    ({optionalParams.length})
                  </span>
              </button>

              {showAdvanced && (
                <div style={{
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '12px',
                  marginTop: '10px',
                  paddingTop: '10px',
                  borderTop: '1px dashed #ccc'
                }}>
                  {optionalParams.map(renderInputField)}
                </div>
              )}
            </>
          )}

        </div>
      )}

      {/* Schnittstelle */}
        {renderSchnittstelle()}

    </div>
  );
};

export default PropertiesPanel;