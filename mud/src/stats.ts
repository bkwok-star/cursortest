import type { Item } from './types';

export interface ResolvedStats {
  maxHp: number;
  attack: number;
}

/** Mutable regen state (hp, stamina, energy and their maxes + regenRate) */
export interface RegenState {
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  energy: number;
  maxEnergy: number;
  regenRate: number;
}

/** XP required to reach the next level from current level (level * 100) */
export function xpToNextLevel(level: number): number {
  return Math.max(100, level * 100);
}

/**
 * Regenerate HP, Stamina, and Energy by regenRate each tick (cap at max).
 * Mutates the state object.
 */
export function regenerateStats(state: RegenState): void {
  state.hp = Math.min(state.maxHp, state.hp + state.regenRate);
  state.stamina = Math.min(state.maxStamina, state.stamina + state.regenRate);
  state.energy = Math.min(state.maxEnergy, state.energy + state.regenRate);
}

/**
 * Compute effective player stats from base stats plus all bonuses from equipped items.
 * Used for combat damage and for the character sheet.
 * Caller should cap current HP to the returned maxHp when applying.
 */
export function calculatePlayerStats(
  baseMaxHp: number,
  baseAttack: number,
  equippedItems: Item[]
): ResolvedStats {
  let attack = baseAttack;
  let healthBonus = 0;

  for (const item of equippedItems) {
    if (item.stats) {
      if (item.stats.attack != null) attack += item.stats.attack;
      if (item.stats.healthBonus != null) healthBonus += item.stats.healthBonus;
    }
  }

  return {
    maxHp: Math.max(1, baseMaxHp + healthBonus),
    attack: Math.max(1, attack),
  };
}
