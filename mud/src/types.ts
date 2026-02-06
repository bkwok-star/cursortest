/**
 * MUD World Engine - Type definitions
 */

/** Direction key for exits (e.g. 'north', 'south', 'up') */
export type Direction = string;

/** Map of direction -> target room ID */
export type Exits = Partial<Record<Direction, string>>;

/** A single exit: direction and target room ID */
export interface Exit {
  direction: Direction;
  roomId: string;
}

/** A monster (mob) in the world */
export interface Monster {
  id: string;
  name: string;
  description: string;
  hp: number;
  maxHp: number;
  attack: number;
  isAlive: boolean;
  /** Optional: item IDs that may drop when the monster dies (e.g. from a loot pool) */
  lootTable?: string[];
  /** Optional: XP granted when killed; if omitted, derived from maxHp + attack */
  xpReward?: number;
}

/** A room in the world */
export interface Room {
  id: string;
  name: string;
  description: string;
  /** Directions (e.g. 'north', 'south') mapped to room IDs */
  exits: Exits;
  /** Monsters present in this room (optional) */
  monsters?: Monster[];
}

/** Kind of item (quest, gear, junk, key) */
export enum ItemType {
  CONSUMABLE = 'CONSUMABLE',
  EQUIPMENT = 'EQUIPMENT',
  TRASH = 'TRASH',
  KEY = 'KEY',
}

/** Slot for equippable gear */
export enum EquipmentSlot {
  HEAD = 'HEAD',
  BODY = 'BODY',
  WEAPON = 'WEAPON',
  SHIELD = 'SHIELD',
}

/** Stats that an item can grant when equipped */
export interface ItemStats {
  attack?: number;
  defense?: number;
  healthBonus?: number;
}

/** An item that can be in a room or in a player's inventory */
export interface Item {
  id: string;
  name: string;
  description: string;
  /** Optional: which room this item is in (if not held by a player) */
  roomId?: string;
  /** Optional: which player is holding this item */
  holderId?: string;
  /** Optional: type of item (quest, gear, etc.) */
  type?: ItemType;
  /** Optional: stat bonuses when equipped */
  stats?: ItemStats;
  /** Optional: which slot this equipment goes in */
  slot?: EquipmentSlot;
  /** Optional: price in gold (shop sell/buy, or sell-back value) */
  price?: number;
}

/** Quest goal type for completion check */
export type QuestGoalType = 'kill' | 'collect';

/** Structured quest goal (monster id or item name + count) */
export interface QuestGoal {
  type: QuestGoalType;
  /** Monster id (for kill) or item name match (for collect) */
  target: string;
  count: number;
}

/** A quest offered by an NPC */
export interface Quest {
  id: string;
  title: string;
  description: string;
  /** Human-readable goal (e.g. 'kill 3 goblins', 'bring iron ore') */
  goal: string;
  /** Structured goal for completion check */
  goalStructured: QuestGoal;
  rewardGold: number;
  /** Optional: item id from reward-pool to give on completion */
  rewardItem?: string;
}

/** Shop entry: item name (matched to world items in shop-pool) and price */
export interface ShopEntry {
  itemName: string;
  price: number;
}

/** An NPC in a room */
export interface NPC {
  id: string;
  name: string;
  /** Dialogue lines; cycling through when player talks */
  dialogue: string[];
  /** Optional: items for sale (name + price) */
  shopInventory?: ShopEntry[];
  /** Optional: quest this NPC offers */
  quest?: Quest;
}

/** Player class (determines starting stats and which skills can be learned) */
export enum ClassType {
  WARRIOR = 'WARRIOR',
  MAGE = 'MAGE',
  ROGUE = 'ROGUE',
}

/** Cost type for skills */
export type SkillCostType = 'stamina' | 'energy';

/** A skill that can be used in combat */
export interface Skill {
  id: string;
  name: string;
  /** stamina or energy */
  costType: SkillCostType;
  cost: number;
  /** Damage multiplier vs base attack (e.g. 1.5 = 150%) */
  damageMultiplier?: number;
  /** Flat bonus damage added to (attack * multiplier) */
  flatDamage?: number;
  /** If set, skill heals instead of dealing damage */
  healAmount?: number;
  /** Cooldown in milliseconds */
  cooldownMs: number;
  description: string;
  /** Which class can learn this skill */
  class: ClassType;
}

/** Starting stats per class (used for new characters and level scaling) */
export interface ClassStats {
  maxHp: number;
  maxStamina: number;
  maxEnergy: number;
  attack: number;
}

/** A player in the world */
export interface Player {
  id: string;
  name: string;
  /** ID of the room the player is currently in */
  currentRoomId: string;
  /** Items the player is carrying */
  inventory: Item[];
  /** Equipped items by slot (only EQUIPMENT with a slot) */
  equipment: Partial<Record<EquipmentSlot, Item | null>>;
  /** Gold currency */
  gold: number;
  /** Quest IDs the player has completed (no repeat rewards) */
  completedQuests: string[];
  /** Current health points */
  hp: number;
  /** Maximum health points */
  maxHp: number;
  /** Stamina (fuel for special moves); starts 100 */
  stamina: number;
  /** Max stamina; starts 100 */
  maxStamina: number;
  /** Energy (fuel for special moves); starts 50 */
  energy: number;
  /** Max energy; starts 50 */
  maxEnergy: number;
  /** Per-tick regen amount for HP, Stamina, Energy; default 5 */
  regenRate: number;
  /** Level (for /xp and level-up); starts 1 */
  level: number;
  /** Experience points; level-up at level * 100 */
  xp: number;
  /** Admin/debug cheat access; first player gets true */
  isAdmin: boolean;
  /** God mode: HP never drops below 1 */
  godMode: boolean;
  /** Player class (WARRIOR default); affects starting stats and skills */
  class: ClassType;
  /** Skill IDs the player has learned (from level-up) */
  skills: string[];
  /** Attack power (base + equipment) */
  attack: number;
  /** Whether the player is still alive */
  isAlive: boolean;
}
