import '@fontsource/nunito/400.css';
import '@fontsource/nunito/700.css';
import './styles.css';
import Phaser from 'phaser';
import { PlayController } from './game/controller';
import { LEVELS } from './levels';
import { DioramaScene } from './render/scene/DioramaScene';

const scene = new DioramaScene();
const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'stage',
  backgroundColor: '#23251f',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  scene: [scene],
});
const params = new URLSearchParams(location.search);
const ctrl = new PlayController(LEVELS[Number(params.get('level') ?? 0)]!);
scene.attach(ctrl, { reducedMotion: false, interactive: true });
(window as unknown as { ctrl: PlayController; game: Phaser.Game }).ctrl = ctrl;
(window as unknown as { game: Phaser.Game }).game = game;
