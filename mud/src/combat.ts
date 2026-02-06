import type { Monster } from './types';

/** Mutable player stats used during combat */
export interface PlayerCombatState {
  hp: number;
  maxHp: number;
  attack: number;
  isAlive: boolean;
}

/** Options for starting combat */
export interface CombatOptions {
  /** Mutable player state (hp, maxHp, attack, isAlive) */
  playerState: PlayerCombatState;
  /** Mutable monster reference (hp, isAlive will be updated) */
  monster: Monster;
  /** Send a line of text to the player (e.g. socket.emit('message', text)) */
  emit: (message: string) => void;
  /** Optional: send "you dealt damage" messages (e.g. for yellow styling) */
  emitDeal?: (message: string) => void;
  /** Optional: send "you took damage" messages (e.g. for red styling) */
  emitTake?: (message: string) => void;
  /** Optional: called when player HP changes (for HP bar updates) */
  onHpChange?: (hp: number, maxHp: number) => void;
  /** If true, player HP never drops below 1 (god mode) */
  godMode?: boolean;
  /** Called when the monster is reduced to 0 HP; stop the loop and reward the player */
  onMonsterKilled: () => void;
  /** Called when the player is reduced to 0 HP; respawn them (e.g. Town Square, full health) */
  onPlayerDeath: () => void;
}

const COMBAT_INTERVAL_MS = 2000;

/** Random variance added to damage: between -1 and +2 (inclusive) */
function damageVariance(): number {
  return Math.floor(Math.random() * 4) - 1;
}

/** Compute damage: attacker.attack + random variance, minimum 1 */
function rollDamage(attack: number): number {
  const variance = damageVariance();
  const total = Math.max(1, attack + variance);
  return total;
}

/**
 * Start round-based combat. Every 2 seconds, the player and monster attack each other.
 * Damage = attacker.attack + random variance (min 1).
 * Returns a function to stop the combat loop (e.g. when player runs away).
 */
export function initiateCombat(options: CombatOptions): () => void {
  const {
    playerState,
    monster,
    emit,
    emitDeal,
    emitTake,
    onHpChange,
    godMode,
    onMonsterKilled,
    onPlayerDeath,
  } = options;

  const sendDeal = emitDeal ?? emit;
  const sendTake = emitTake ?? emit;
  const minHp = godMode ? 1 : 0;

  const intervalId = setInterval(() => {
    if (!playerState.isAlive || !monster.isAlive) {
      clearInterval(intervalId);
      return;
    }

    // Player attacks monster
    const playerDamage = rollDamage(playerState.attack);
    monster.hp = Math.max(0, monster.hp - playerDamage);
    sendDeal(`You hit ${monster.name} for ${playerDamage} damage!`);

    if (monster.hp <= 0) {
      monster.isAlive = false;
      clearInterval(intervalId);
      sendDeal(`You defeated ${monster.name}!`);
      onMonsterKilled();
      return;
    }

    // Monster attacks player
    const monsterDamage = rollDamage(monster.attack);
    playerState.hp = Math.max(minHp, playerState.hp - monsterDamage);
    onHpChange?.(playerState.hp, playerState.maxHp);
    sendTake(`${monster.name} hits you for ${monsterDamage} damage!`);

    if (playerState.hp <= 0) {
      playerState.isAlive = false;
      playerState.hp = 0;
      clearInterval(intervalId);
      onHpChange?.(0, playerState.maxHp);
      sendTake('You have been defeated...');
      onPlayerDeath();
      return;
    }
  }, COMBAT_INTERVAL_MS);

  return () => clearInterval(intervalId);
}
