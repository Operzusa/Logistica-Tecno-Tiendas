
import { supabaseService } from './supabaseService';
import { SoundSetting } from '../types';

class AudioService {
  private playWithRepeats(setting: SoundSetting) {
    let count = 0;
    const play = () => {
      if (count < (setting.repeats || 1)) {
        const audio = new Audio(setting.url);
        audio.volume = 0.7;
        audio.onended = () => {
          count++;
          if (count < setting.repeats) {
            setTimeout(play, 500); // Pequeña pausa entre repeticiones
          }
        };
        audio.play().catch(e => console.debug("Audio play blocked by browser"));
      }
    };
    play();
  }

  playMessage() {
    const settings = supabaseService.getSettings();
    this.playWithRepeats(settings.audio.message);
  }

  playNewService() {
    const settings = supabaseService.getSettings();
    this.playWithRepeats(settings.audio.newService);
  }

  playUpdate() {
    const settings = supabaseService.getSettings();
    this.playWithRepeats(settings.audio.update);
  }

  // Specific high-priority alert for payment requests
  playPaymentRequest() {
    // Cash register sound
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3');
    audio.volume = 1.0;
    audio.play().catch(e => console.debug("Audio play blocked by browser"));
  }

  // Success sound for when a payment is completed
  playPaymentCompleted() {
    // Success chime / Coins sound
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3');
    audio.volume = 1.0;
    audio.play().catch(e => console.debug("Audio play blocked by browser"));
  }

  // Specific high-priority alert for fuel
  playFuelAlert() {
    // High pitched alarm sound
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/995/995-preview.mp3');
    audio.volume = 1.0;
    audio.play().catch(e => console.debug("Audio play blocked by browser"));
  }

  // Método para previsualizar un sonido sin afectar las configuraciones
  previewSound(url: string) {
    const audio = new Audio(url);
    audio.volume = 0.5;
    audio.play().catch(e => console.debug("Preview blocked"));
  }
}

export const audioService = new AudioService();
