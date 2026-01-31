import WebSfx from '../lib/web-sfx';

// Use static paths for Next.js public folder
const sfDie = '/game-assets/audio/die.ogg';
const sfPoint = '/game-assets/audio/point.ogg';
const sfSwoosh = '/game-assets/audio/swooshing.ogg';
const sfMainTheme = '/game-assets/audio/main_theme.ogg';

// Death sound paths (direct Audio API - more reliable)
const deathSoundPaths = [
  '/game-assets/audio/death/death-1.ogg',
  '/game-assets/audio/death/death-2.ogg',
  '/game-assets/audio/death/death-3.ogg',
  '/game-assets/audio/death/death-4.ogg',
  '/game-assets/audio/death/death-7.ogg',
  '/game-assets/audio/death/death-8.ogg',
  '/game-assets/audio/death/death-9.ogg'
];

// Preload death sounds using HTML5 Audio API
const deathAudios: HTMLAudioElement[] = [];

// Main theme audio
let mainThemeAudio: HTMLAudioElement | null = null;

// Mega pets jump sound keys (7 fart sounds) - for WebSfx
const jumpSounds = ['jump1', 'jump2', 'jump3', 'jump4', 'jump5', 'jump6', 'jump7'];

export default class Sfx {
  public static currentVolume = 1;
  public static musicVolume = 0.5; // Music is usually quieter
  private static deathSoundsLoaded = false;
  private static mainThemeLoaded = false;

  public static async init() {
    await WebSfx.init();
    
    // Preload death sounds with HTML5 Audio API
    if (!Sfx.deathSoundsLoaded) {
      deathSoundPaths.forEach(path => {
        const audio = new Audio(path);
        audio.preload = 'auto';
        audio.volume = Sfx.currentVolume;
        deathAudios.push(audio);
      });
      Sfx.deathSoundsLoaded = true;
      console.log('[Sfx] Death sounds preloaded:', deathAudios.length);
    }
    
    // Preload main theme
    if (!Sfx.mainThemeLoaded) {
      mainThemeAudio = new Audio(sfMainTheme);
      mainThemeAudio.preload = 'auto';
      mainThemeAudio.loop = true;
      mainThemeAudio.volume = Sfx.musicVolume;
      Sfx.mainThemeLoaded = true;
      console.log('[Sfx] Main theme preloaded');
    }
  }

  public static volume(num: number): void {
    Sfx.currentVolume = num;
    // Update volume on preloaded death sounds
    deathAudios.forEach(audio => audio.volume = num);
  }

  public static setMusicVolume(num: number): void {
    Sfx.musicVolume = num;
    if (mainThemeAudio) {
      mainThemeAudio.volume = num;
    }
  }

  public static playMainTheme(): void {
    if (mainThemeAudio) {
      mainThemeAudio.currentTime = 0;
      mainThemeAudio.volume = Sfx.musicVolume;
      const playPromise = mainThemeAudio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => console.log('[Sfx] 🎵 Main theme playing!'))
          .catch(err => console.warn('[Sfx] Main theme autoplay blocked:', err));
      }
    }
  }

  public static stopMainTheme(): void {
    if (mainThemeAudio) {
      mainThemeAudio.pause();
      mainThemeAudio.currentTime = 0;
      console.log('[Sfx] 🎵 Main theme stopped');
    }
  }

  public static pauseMainTheme(): void {
    if (mainThemeAudio) {
      mainThemeAudio.pause();
    }
  }

  public static resumeMainTheme(): void {
    if (mainThemeAudio) {
      mainThemeAudio.play().catch(() => {});
    }
  }

  public static die(): void {
    WebSfx.volume(Sfx.currentVolume);
    WebSfx.play(sfDie);
  }

  public static point(): void {
    WebSfx.volume(Sfx.currentVolume);
    WebSfx.play(sfPoint);
  }

  public static hit(cb: IEmptyFunction): void {
    console.log('[Sfx.hit] Called! Playing death sound with HTML5 Audio API');
    
    // Use HTML5 Audio API directly - much more reliable than WebSfx
    if (deathAudios.length > 0) {
      const randomIndex = Math.floor(Math.random() * deathAudios.length);
      const audio = deathAudios[randomIndex];
      console.log('[Sfx.hit] Selected sound index:', randomIndex, 'path:', deathSoundPaths[randomIndex]);
      
      audio.currentTime = 0;
      audio.volume = Sfx.currentVolume;
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log('[Sfx.hit] ✅ Death sound playing!');
          })
          .catch(err => {
            console.error('[Sfx.hit] ❌ Failed to play:', err);
          });
      }
    } else {
      console.warn('[Sfx.hit] No death sounds loaded!');
    }
    
    // Call callback after a short delay (don't wait for sound to finish)
    setTimeout(cb, 100);
  }

  public static swoosh(): void {
    WebSfx.volume(Sfx.currentVolume);
    WebSfx.play(sfSwoosh);
  }

  public static wing(): void {
    WebSfx.volume(Sfx.currentVolume);
    // Play random jump sound
    const randomIndex = Math.floor(Math.random() * jumpSounds.length);
    WebSfx.play(jumpSounds[randomIndex]);
  }
}
