import {Game as BaseGame} from './game.mjs';
export * from './game.mjs';
// Explicit touch selection only affects eligible targets; proximity rules stay intact.
export class Game extends BaseGame{
 selectTarget(id){this.target=this.enemies.some(e=>e.id===id&&e.hp>0)?id:null;}
 nearestEnemy(range=Infinity){const chosen=this.enemies.find(e=>e.id===this.target&&e.hp>0&&Math.hypot(e.x-this.player.x,e.z-this.player.z)<=range);return chosen||super.nearestEnemy(range);}
}
