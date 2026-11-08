import React from 'react';
import { NetworkCanvas } from './components/NetworkCanvas';
import { Sidebar } from './components/Sidebar';
import { NodeSettings } from './components/NodeSettings';
import { useNetworkStore } from './store/useNetworkStore';

function App() {
  const selectedNodeId = useNetworkStore(state => state.selectedNodeId);
  const tick = useNetworkStore(state => state.tick);

  React.useEffect(() => {
    const timer = setInterval(() => {
      tick();
    }, 100);
    return () => clearInterval(timer);
  }, [tick]);

  return (
    <div className="app-container" style={{ 
      flexDirection: 'row', 
      background: 'var(--app-gradient)',
      padding: '24px'
    }}>
      <Sidebar />
      
      <main style={{ 
        flex: 1, 
        position: 'relative',
        display: 'flex',
        gap: '24px',
        height: '100%'
      }}>
        <div className="canvas-container" style={{ flex: 1 }}>
          <NetworkCanvas />
        </div>

        {selectedNodeId && (
          <aside style={{ width: '400px', height: '100%', animation: 'slideInRight 0.3s ease-out' }}>
            <NodeSettings />
          </aside>
        )}
      </main>

      {/* Global Toast / Notification placeholder if needed */}
    </div>
  );
}

export default App;
