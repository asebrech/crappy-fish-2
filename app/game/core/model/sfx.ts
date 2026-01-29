import WebSfx from '../lib/web-sfx';

// Use static paths for Next.js public folder
const sfDie = '/game-assets/audio/die.ogg';
const sfHit = '/game-assets/audio/hit.ogg';
const sfPoint = '/game-assets/audio/point.ogg';
const sfSwoosh = '/game-assets/audio/swooshing.ogg';
const sfWing = '/game-assets/audio/wing.ogg';

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
    WebSfx.play(sfWing);
  }
}
