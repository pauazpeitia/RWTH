import React, { useState, useRef, useCallback } from 'react';
import ReactFlow, { 
  ReactFlowProvider, 
  addEdge, 
  useNodesState, 
  useEdgesState, 
  Controls, 
  Background 
} from 'reactflow';

// Styles
import 'reactflow/dist/style.css'; 

// Components
import Sidebar from './components/Sidebar';
import PropertiesPanel from './components/PropertiesPanel';
import S3Modal from './components/S3Modal'; 

// --- HILFSFUNKTIONEN ---
let id = 0;
const getId = () => `dndnode_${id++}`;

// --- STYLING ---
const styles = {
  appContainer: {
    display: 'flex',
    height: '100vh',
    fontFamily: 'Arial, sans-serif'
  },
  mainContent: {
    flex: 1,
    height: '100%', 
    position: 'relative'
  },
  // Container für die Buttons oben rechts
  buttonGroup: {
    position: 'absolute', 
    top: 10, 
    right: 10, 
    zIndex: 5,
    display: 'flex',
    gap: '10px' // Abstand zwischen den Buttons
  },
  // Einheitliches Button-Design
  actionButton: {
    padding: '10px 15px', 
    color: 'white', 
    border: 'none', 
    borderRadius: '5px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    fontWeight: 'bold',
    boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
  }
};

const DnDFlow = () => {
  // --- 1. STATE MANAGEMENT ---
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);

  // State: Welcher Node ist angeklickt? (Task 4.4)
  const [selectedNodeId, setSelectedNodeId] = useState(null);

  // State: S3 Konfiguration (Task 4.5)
  const [isS3ModalOpen, setIsS3ModalOpen] = useState(false);
  const [s3Config, setS3Config] = useState({ 
      endpoint: 'https://s3.rwth-aachen.de', 
      accessKey: '', 
      secretKey: '' 
  });


  // --- 2. GRAPH LOGIK (DRAG & DROP / VERBINDEN) + NODE-ERZEUGUNG ---

  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow');
      if (typeof type === 'undefined' || !type) return;

      //Wir holen hier vom Sidebar: {name, entrypoints, default_entrypoint}
      const templateData = JSON.parse(type);

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      //Node erzeugen mit alle wichtigen informationen
      const newNode = {
        id: getId(),
        type: 'default',
        position,
        data: { 
            //ids
            label: templateData.name, 
            templateId: templateData.name,
            //Entrypoints
            entrypoints: templateData.entrypoints || [],
            selectedEntrypoint: templateData.default_entrypoint,  //Init mit default

            //Hier definition alle inputs speichern
            schema: null,

            //Speichern was den User geschrieben hat
            params: {} 
        }, 
        style: { background: '#fff', border: '1px solid #777', borderRadius: '5px', padding: '10px', minWidth: '150px' }
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );


  // --- 3. SELEKTION & DATEN UPDATE (Task 4.4) ---

  const onNodeClick = useCallback((event, node) => {  //Selector (leftClick)
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {     //Deselector
    setSelectedNodeId(null);
  }, []);

  //Update
  const onNodeDataChange = (nodeId, newData) => {
    setNodes((nds) =>
      nds.map((node) => {             //sucht alle Nodes
        if (node.id === nodeId) {     //gefunden
          return {
            ...node,
            data: {
              ...node.data,
              ...newData,             //ueberschreiben mit Neuen (z.B. neue Entrypoint)
              
              params: newData.params 
                ? { ...node.data.params, ...newData.params }
                : node.data.params
            },
          };
        }
        return node;
      })
    );
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  // Wer ist source Node? (schnittstelle task)
  const incomingEdges = edges.filter(e => e.target === selectedNodeId); //mehrere: filter

  const sourceNodes = incomingEdges.map(edge => nodes.find(n => n.id === edge.source)
  ).filter(n => n !== undefined); 

  // --- 4. SERVER INTERAKTION (Task 4.6) ---
  
  // Workflow starten, am Backend senden oder dowload
  const onRunWorkflow = useCallback((mode = 'submit') => {
      const payload = {
        nodes: nodes.map(n => ({
          id: n.id,
          template_name: n.data.label, 
          entrypoint: n.data.selectedEntrypoint,
          arguments: n.data.params || {}
        })),
        edges: edges.map(e => ({
          source: e.source,
          target: e.target
        })),
        s3_config: s3Config,
        action: mode
      };
    
      fetch('/api/workflows/', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Fehler bei der Anfrage");

          if (mode === 'download') {
              // Dowload .yaml 
              const blob = new Blob([data.yaml], { type: 'text/yaml' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `workflow-${new Date().getTime()}.yaml`;
              a.click();
              window.URL.revokeObjectURL(url);
          } else {
              alert(`Workflow generiert!\nName: ${data.workflow_name || 'Unbekannt'}`);
          }
      })
      .catch(err => {
          console.error(err); 
          alert("Error: " + err.message);
      });
    }, [nodes, edges, s3Config]);

  // --- 5. RENDER (UI) ---
  return (
    <div style={styles.appContainer}>
      <ReactFlowProvider>
        
        {/* LINKS: Sidebar */}
        <Sidebar />
        
        {/* MITTE: Canvas */}
        <div style={styles.mainContent} ref={reactFlowWrapper}>
          
          {/* HEADER BUTTONS (S3 & RUN & DOWNLOAD) */}
          <div style={styles.buttonGroup}>
            
            {/* Button 1: S3 Config */}
            <button 
                onClick={() => setIsS3ModalOpen(true)}
                style={{...styles.actionButton, backgroundColor: '#2c3e50'}}
            >
                ⚙️ S3 Config
                {s3Config.accessKey && <span style={{color: '#27ae60', fontSize: '1.2em'}}>●</span>}
            </button>

            {/* Button 2: YAML download */}
            <button 
                onClick={() => onRunWorkflow('download')}
                style={{...styles.actionButton, backgroundColor: '#3498db'}}
            >
                💾 Export YAML
            </button>

            {/* Button 3: Run in argo*/}
            <button 
                onClick={() => onRunWorkflow('submit')}
                style={{...styles.actionButton, backgroundColor: '#28a745'}}
            >
                ▶ Run Workflow
            </button>

          </div>

          {/* Der Graph Editor  */}
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            fitView
          >
            <Controls />
            <Background color="#aaa" gap={16} />
          </ReactFlow>
        </div>

        {/* RECHTS: Properties Panel */}
        <PropertiesPanel 
            selectedNode={selectedNode} 
            sourceNodes={sourceNodes}   //Source nodes fuer schnittstelle
            onNodeDataChange ={onNodeDataChange} 
        />

        {/* MODAL: S3 Settings */}
        <S3Modal 
            isOpen={isS3ModalOpen} 
            onClose={() => setIsS3ModalOpen(false)}
            initialData={s3Config}
            onSave={(newData) => setS3Config(newData)}
        />

      </ReactFlowProvider>
    </div>
  );
};

export default DnDFlow;