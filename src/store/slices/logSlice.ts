import type { LogSlice } from '../../types/store';

let logSequence = 0;

export const createLogSlice = (set: any, get: any) => ({
  packetLogs: [],
  addPacketLog: (log: any) => set((state: any) => {
    const logs = state.packetLogs || [];
    
    // Deduplication check
    const isDuplicate = logs.slice(0, 5).some(
      (l: any) => l.packetId === log.id && l.info === log.info && l.status === log.status
    );
    if (isDuplicate) return state;

    logSequence++;
    const newLog = { 
      ...log, 
      packetId: log.id, 
      id: `log_${Date.now()}_${logSequence}`,
      sequence: logSequence,
      time: log.time || new Date().toLocaleTimeString()
    };
    
    // Always put the newest log with highest sequence at the top
    return { packetLogs: [newLog, ...logs].slice(0, 50) };
  }),
  clearPacketLogs: () => {
    logSequence = 0;
    set({ packetLogs: [] });
  },
});
