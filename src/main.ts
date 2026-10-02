import '@fontsource/nunito/400.css';
import '@fontsource/nunito/700.css';
import './styles.css';
import Phaser from 'phaser';
import { App } from './app/app';
import { LEVELS } from './levels';
import { DioramaScene } from './render/scene/DioramaScene';
import { safeStorage } from './save/save';

const scene = new DioramaScene();
const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'stage',
  backgroundColor: '#23251f',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  scene: [scene],
});

const app = new App(document.getElementById('ui')!, { show: (ctrl, opts) => scene.attach(ctrl, opts) }, safeStorage(), LEVELS, {
  demoIntervalMs: 900,
  prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
});

const onError = (err: unknown) => {
  console.error('[Afterlife]', err);
  app.showError();
};
window.addEventListener('error', (e) => onError(e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => onError(e.reason));

if (import.meta.env.DEV) Object.assign(window as object, { afterlife: app, afterlifeGame: game });
