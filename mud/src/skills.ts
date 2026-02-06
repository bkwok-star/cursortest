import { ClassType, type ClassStats, type Skill } from './types';

/** Starting stats per class. Warrior: high HP/Stamina, low Energy. Mage: low HP/Stamina, high Energy. Rogue: balanced. */
export const CLASS_STATS: Record<ClassType, ClassStats> = {
  [ClassType.WARRIOR]: {
    maxHp: 120,
    maxStamina: 120,
    maxEnergy: 30,
    attack: 12,
  },
  [ClassType.MAGE]: {
    maxHp: 70,
    maxStamina: 50,
    maxEnergy: 100,
    attack: 8,
  },
  [ClassType.ROGUE]: {
    maxHp: 90,
    maxStamina: 100,
    maxEnergy: 60,
    attack: 14,
  },
};

/** All skills; levelUnlock = level at which this skill is learned (1, 3, or 5) */
export const SKILLS: (Skill & { levelUnlock: number })[] = [
  {
    id: 'heavy-strike',
    name: 'Heavy Strike',
    costType: 'stamina',
    cost: 30,
    damageMultiplier: 1.5,
    cooldownMs: 5000,
    description: 'A powerful blow dealing 150% damage.',
    class: ClassType.WARRIOR,
    levelUnlock: 1,
  },
  {
    id: 'shield-bash',
    name: 'Shield Bash',
    costType: 'stamina',
    cost: 25,
    damageMultiplier: 1.2,
    flatDamage: 5,
    cooldownMs: 6000,
    description: 'Bash with your shield for 120% damage + 5.',
    class: ClassType.WARRIOR,
    levelUnlock: 3,
  },
  {
    id: 'whirlwind',
    name: 'Whirlwind',
    costType: 'stamina',
    cost: 50,
    damageMultiplier: 1.8,
    cooldownMs: 10000,
    description: 'Spin attack dealing 180% damage.',
    class: ClassType.WARRIOR,
    levelUnlock: 5,
  },
  {
    id: 'fireball',
    name: 'Fireball',
    costType: 'energy',
    cost: 20,
    damageMultiplier: 2,
    flatDamage: 10,
    cooldownMs: 4000,
    description: 'Hurl a fireball for high damage. Has cooldown.',
    class: ClassType.MAGE,
    levelUnlock: 1,
  },
  {
    id: 'heal',
    name: 'Heal',
    costType: 'energy',
    cost: 40,
    healAmount: 35,
    cooldownMs: 8000,
    description: 'Restore 35 HP.',
    class: ClassType.MAGE,
    levelUnlock: 3,
  },
  {
    id: 'ice-bolt',
    name: 'Ice Bolt',
    costType: 'energy',
    cost: 25,
    damageMultiplier: 1.6,
    flatDamage: 15,
    cooldownMs: 5000,
    description: 'Frost bolt dealing 160% + 15 damage.',
    class: ClassType.MAGE,
    levelUnlock: 5,
  },
  {
    id: 'backstab',
    name: 'Backstab',
    costType: 'stamina',
    cost: 20,
    damageMultiplier: 1.6,
    cooldownMs: 4000,
    description: 'Strike from the shadows for 160% damage.',
    class: ClassType.ROGUE,
    levelUnlock: 1,
  },
  {
    id: 'poison-blade',
    name: 'Poison Blade',
    costType: 'stamina',
    cost: 35,
    damageMultiplier: 1.3,
    flatDamage: 12,
    cooldownMs: 7000,
    description: 'Poisoned strike: 130% + 12 damage.',
    class: ClassType.ROGUE,
    levelUnlock: 3,
  },
  {
    id: 'evasion',
    name: 'Evasion',
    costType: 'energy',
    cost: 30,
    damageMultiplier: 1.4,
    cooldownMs: 6000,
    description: 'Quick strike dealing 140% damage.',
    class: ClassType.ROGUE,
    levelUnlock: 5,
  },
];

const SKILLS_BY_ID = new Map<string, Skill>();
const SKILLS_BY_NAME_LOWER = new Map<string, Skill>();
for (const s of SKILLS) {
  const { levelUnlock: _, ...skill } = s;
  SKILLS_BY_ID.set(s.id, skill);
  SKILLS_BY_NAME_LOWER.set(s.name.toLowerCase(), skill);
}

export function getClassStats(classType: ClassType): ClassStats {
  return CLASS_STATS[classType];
}

export function getSkillById(id: string): Skill | undefined {
  return SKILLS_BY_ID.get(id);
}

export function getSkillByName(name: string): Skill | undefined {
  return SKILLS_BY_NAME_LOWER.get(name.toLowerCase().trim());
}

/** Returns the skill ID learned when reaching this level for the given class, or undefined */
export function getSkillLearnedAtLevel(level: number, classType: ClassType): string | undefined {
  const entry = SKILLS.find((s) => s.class === classType && s.levelUnlock === level);
  return entry?.id;
}

/** All skill IDs that should be granted at level 1 for a class (starting skill) */
export function getStartingSkillId(classType: ClassType): string | undefined {
  return getSkillLearnedAtLevel(1, classType);
}
