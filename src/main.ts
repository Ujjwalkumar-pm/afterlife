import '@fontsource/nunito/400.css';
import '@fontsource/nunito/700.css';
import './styles.css';
import Phaser from 'phaser';

class Smoke extends Phaser.Scene {
  create(): void {
    this.add.text(this.scale.width / 2, this.scale.height / 2, 'Afterlife', { fontFamily: 'Nunito', fontSize: '48px', color: '#f1ede2' }).setOrigin(0.5);
  }
}

new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'stage',
  backgroundColor: '#23251f',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  scene: [Smoke],
});
