import WebSfx from '../lib/web-sfx';

// Use static paths for Next.js public folder
const sfDie = '/game-assets/audio/die.ogg';
const sfHit = '/game-assets/audio/hit.ogg';
const sfPoint = '/game-assets/audio/point.ogg';
const sfSwoosh = '/game-assets/audio/swooshing.ogg';
// Mega pets jump sound keys (7 fart sounds)
const jumpSounds = ['jump1', 'jump2', 'jump3', 'jump4', 'jump5', 'jump6', 'jump7'];

export default class Sfx {
  public static currentVolume = 1;

  public static async init() {
    await WebSfx.init();
  }

  public static volume(num: number): void {
    Sfx.currentVolume = num;
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
    WebSfx.volume(Sfx.currentVolume);
    WebSfx.play(sfHit, cb);
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
