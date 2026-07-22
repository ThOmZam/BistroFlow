// Audio synthesizer for interactive sound effects using the Web Audio API

function isSoundEnabled(): boolean {
  return localStorage.getItem('notif_sound_enabled') !== 'false';
}

export function playNotificationSound() {
  if (!isSoundEnabled()) return;
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = audioCtx.currentTime;
    
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now); // A5
    gain1.gain.setValueAtTime(0.08, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1320, now + 0.08); // E6
    gain2.gain.setValueAtTime(0.05, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    
    osc1.start(now);
    osc1.stop(now + 0.6);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.8);
  } catch (err) {
    console.warn('Audio synthesis not supported or blocked by user gesture:', err);
  }
}

export function playSuccessSound() {
  if (!isSoundEnabled()) return;
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = audioCtx.currentTime;
    
    // Ascending major chord (C5 -> E5 -> G5)
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      
      gain.gain.setValueAtTime(0.06, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.4);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.4);
    });
  } catch (err) {
    console.warn('Audio synthesis failed:', err);
  }
}

export function playErrorSound() {
  if (!isSoundEnabled()) return;
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = audioCtx.currentTime;
    
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(150, now);
    gain1.gain.setValueAtTime(0.05, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);

    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(145, now + 0.05);
    gain2.gain.setValueAtTime(0.05, now + 0.05);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    
    osc1.start(now);
    osc1.stop(now + 0.3);
    osc2.start(now + 0.05);
    osc2.stop(now + 0.35);
  } catch (err) {
    console.warn('Audio synthesis failed:', err);
  }
}

export function playClickSound() {
  if (!isSoundEnabled()) return;
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = audioCtx.currentTime;
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);
    
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start(now);
    osc.stop(now + 0.05);
  } catch (err) {
    console.warn('Audio synthesis failed:', err);
  }
}

export function playCashSound() {
  if (!isSoundEnabled()) return;
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = audioCtx.currentTime;
    
    // Coin Clink sound (Short high-frequency pulses)
    const frequencies = [1500, 2200, 3100];
    frequencies.forEach((freq, idx) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.03);
      
      gain.gain.setValueAtTime(0.04, now + idx * 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.03 + 0.15);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start(now + idx * 0.03);
      osc.stop(now + idx * 0.03 + 0.15);
    });

    // Retro cash drawer ring (Ding)
    const oscDrawer = audioCtx.createOscillator();
    const gainDrawer = audioCtx.createGain();
    oscDrawer.type = 'sine';
    oscDrawer.frequency.setValueAtTime(987.77, now + 0.1); // B5
    gainDrawer.gain.setValueAtTime(0.05, now + 0.1);
    gainDrawer.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    oscDrawer.connect(gainDrawer);
    gainDrawer.connect(audioCtx.destination);

    oscDrawer.start(now + 0.1);
    oscDrawer.stop(now + 0.6);
  } catch (err) {
    console.warn('Audio synthesis failed:', err);
  }
}

