import type { Room, Item, Monster } from './types';
import { ItemType, EquipmentSlot } from './types';

/** Hardcoded room data */
const ROOMS: Room[] = [
  {
    id: 'town-square',
    name: 'Town Square',
    description: 'A cobblestone square with a worn fountain. Streets lead north to the market, east to the forest, and south to the inn. A shimmering portal leads to the Arena.',
    exits: {
      north: 'market',
      east: 'forest-edge',
      south: 'inn',
      portal: 'arena',
    },
  },
  {
    id: 'arena',
    name: 'The Arena',
    description: 'A sandy pit surrounded by stone seats. A lever on the wall spawns combat dummies for training. The portal returns to Town Square.',
    exits: {
      portal: 'town-square',
    },
    monsters: [],
  },
  {
    id: 'market',
    name: 'Market',
    description: 'Stalls sell food, cloth, and tools. The crowd is busy. You can go south back to the square or west to the blacksmith.',
    exits: {
      south: 'town-square',
      west: 'blacksmith',
    },
  },
  {
    id: 'blacksmith',
    name: 'Blacksmith',
    description: 'The forge is hot and the anvil rings. Weapons and horseshoes line the walls. The door east leads back to the market.',
    exits: {
      east: 'market',
    },
  },
  {
    id: 'forest-edge',
    name: 'Forest Edge',
    description: 'Tall trees block the sun. A path leads west to town or deeper east into the woods. A narrow trail runs north toward a cave.',
    exits: {
      west: 'town-square',
      east: 'forest-deep',
      north: 'cave-entrance',
    },
  },
  {
    id: 'forest-deep',
    name: 'Deep Forest',
    description: 'Ancient oaks and ferns. It is easy to get lost. You can head west back toward the edge or south to a dim cave entrance.',
    exits: {
      west: 'forest-edge',
      south: 'cave-entrance',
    },
  },
  {
    id: 'cave-entrance',
    name: 'Cave Entrance',
    description: 'A cold draft blows from the mouth of the cave. Torchlight flickers inside. Paths lead south into the cave or back to the forest.',
    exits: {
      south: 'cave-interior',
      north: 'forest-edge',
      west: 'forest-deep',
    },
  },
  {
    id: 'cave-interior',
    name: 'Cave Interior',
    description: 'Damp walls and the sound of water. A rough stair descends into darkness. The tunnel north leads back to the entrance.',
    exits: {
      north: 'cave-entrance',
      down: 'dungeon-gate',
    },
    monsters: [
      {
        id: 'grumpy-goblin',
        name: 'Grumpy Goblin',
        description: 'A small, green-skinned creature clutching a rusty dagger. It glares at you.',
        hp: 20,
        maxHp: 20,
        attack: 3,
        isAlive: true,
        lootTable: ['goblin-dagger'],
        xpReward: 15,
      },
    ],
  },
  // ---------- Dark Dungeon ----------
  {
    id: 'dungeon-gate',
    name: 'Dungeon Gate',
    description: 'A rusted portcullis hangs half-open. Torch sconces line the walls but most have long gone out. The air is cold and still. Stone steps lead up to the cave; passages run east and south.',
    exits: {
      up: 'cave-interior',
      east: 'torture-chamber',
      south: 'guard-post',
    },
  },
  {
    id: 'torture-chamber',
    name: 'Torture Chamber',
    description: 'Iron racks and manacles line the walls. Something dark has dried on the flagstones. A single brazier casts flickering shadows. A corridor leads south; the gate lies west.',
    exits: {
      west: 'dungeon-gate',
      south: 'flooded-corridor',
    },
  },
  {
    id: 'guard-post',
    name: 'Abandoned Guard Post',
    description: 'A wooden desk has collapsed; old papers and a broken lantern litter the floor. Arrow slits look out into blackness. You hear water dripping somewhere. Exits east and north.',
    exits: {
      north: 'dungeon-gate',
      east: 'flooded-corridor',
    },
  },
  {
    id: 'flooded-corridor',
    name: 'Flooded Corridor',
    description: 'Ankle-deep water reflects the dim light. The walls are slick with moss. Something glows faintly in a corner. Passages lead west to a crypt, north to the torture chamber, and east back to the guard post.',
    exits: {
      north: 'torture-chamber',
      east: 'guard-post',
      west: 'crypt',
    },
    monsters: [
      {
        id: 'drowned-skeleton',
        name: 'Drowned Skeleton',
        description: 'A skeletal figure rises from the water, bones clacking. It reaches for you.',
        hp: 15,
        maxHp: 15,
        attack: 2,
        isAlive: true,
        lootTable: ['rotten-bone'],
        xpReward: 10,
      },
    ],
  },
  {
    id: 'crypt',
    name: 'The Crypt',
    description: 'Stone sarcophagi line the walls; several lids have been pushed aside. The air smells of old dust and rot. Faint scratches mark the floor. A passage leads north; the flooded corridor lies east.',
    exits: {
      east: 'flooded-corridor',
      north: 'spider-nest',
    },
  },
  {
    id: 'spider-nest',
    name: 'Spider Nest',
    description: 'Thick webs hang from the ceiling. Egg sacs pulse in the shadows. You tread carefully. A narrow opening leads east; the crypt is south.',
    exits: {
      south: 'crypt',
      east: 'collapsed-hall',
    },
    monsters: [
      {
        id: 'cave-spider',
        name: 'Cave Spider',
        description: 'A large spider with glossy black legs. It hisses from the shadows.',
        hp: 12,
        maxHp: 12,
        attack: 4,
        isAlive: true,
        lootTable: ['spider-fang'],
        xpReward: 12,
      },
    ],
  },
  {
    id: 'collapsed-hall',
    name: 'Collapsed Hall',
    description: 'Part of the ceiling has given way; rubble blocks the far end. A single pillar still holds. Debris crunches underfoot. The way south leads to a faint glow; the spider nest lies west.',
    exits: {
      west: 'spider-nest',
      south: 'ancient-shrine',
    },
  },
  {
    id: 'ancient-shrine',
    name: 'Ancient Shrine',
    description: 'A worn altar stands against the wall. Faded runes circle the floor. The air feels heavy, almost sacred. A steep stair descends into a deeper darkness. The collapsed hall is north.',
    exits: {
      north: 'collapsed-hall',
      down: 'treasure-vault',
    },
  },
  {
    id: 'treasure-vault',
    name: 'Treasure Vault',
    description: 'Empty chests and broken crates fill the room. Whatever was here is long gone. A rusted gate stands open to the west. The shrine stair is up.',
    exits: {
      up: 'ancient-shrine',
      west: 'oubliette',
    },
  },
  {
    id: 'oubliette',
    name: 'The Oubliette',
    description: 'A circular pit, once used to leave prisoners to be forgotten. A single rope ladder leads up to the dungeon gate. The vault lies east.',
    exits: {
      east: 'treasure-vault',
      up: 'dungeon-gate',
    },
  },
  // ----------
  {
    id: 'inn',
    name: 'The Rusty Nail Inn',
    description: 'Warm fire and the smell of stew. Travelers drink and talk. The door north leads back to the town square.',
    exits: {
      north: 'town-square',
    },
  },
];

/** Items placed in the world (roomId = which room they are in; 'loot-pool' = monster drops) */
const ITEMS: Item[] = [
  {
    id: 'rusty-key',
    name: 'rusty key',
    description: 'An old iron key, crusted with rust. It might still turn a lock.',
    roomId: 'guard-post',
    type: ItemType.KEY,
  },
  {
    id: 'glowing-mushroom',
    name: 'glowing mushroom',
    description: 'A pale fungus that gives off a soft blue light. It grows in the damp.',
    roomId: 'flooded-corridor',
    type: ItemType.CONSUMABLE,
  },
  {
    id: 'bone',
    name: 'bone',
    description: 'A human finger bone, yellowed with age. It lies among the dust.',
    roomId: 'crypt',
    type: ItemType.TRASH,
  },
  {
    id: 'ancient-coin',
    name: 'ancient coin',
    description: 'A tarnished coin with a forgotten king\'s face. Worth more to collectors than to merchants.',
    roomId: 'treasure-vault',
    type: ItemType.TRASH,
  },
  {
    id: 'faded-torch',
    name: 'faded torch',
    description: 'A half-burnt torch, still faintly warm to the touch. It could be lit again.',
    roomId: 'dungeon-gate',
    type: ItemType.TRASH,
  },
  {
    id: 'rune-stone',
    name: 'rune stone',
    description: 'A small stone carved with a single rune. The shrine\'s magic lingers on it.',
    roomId: 'ancient-shrine',
    type: ItemType.KEY,
  },
  // Loot pool (dropped by monsters when killed)
  {
    id: 'goblin-dagger',
    name: 'goblin dagger',
    description: 'A rusty dagger that once belonged to a goblin. Still sharp enough to hurt.',
    roomId: 'loot-pool',
    type: ItemType.EQUIPMENT,
    slot: EquipmentSlot.WEAPON,
    stats: { attack: 2 },
  },
  {
    id: 'rotten-bone',
    name: 'rotten bone',
    description: 'A waterlogged bone from the drowned. It smells of decay.',
    roomId: 'loot-pool',
    type: ItemType.TRASH,
  },
  {
    id: 'spider-fang',
    name: 'spider fang',
    description: 'A venomous fang. Could be used as a crude blade.',
    roomId: 'loot-pool',
    type: ItemType.EQUIPMENT,
    slot: EquipmentSlot.WEAPON,
    stats: { attack: 1 },
  },
  // Shop pool (Merchant inventory; buying moves one to player)
  { id: 'steel-sword-1', name: 'steel sword', description: 'A sturdy steel blade.', roomId: 'shop-pool', type: ItemType.EQUIPMENT, slot: EquipmentSlot.WEAPON, stats: { attack: 5 }, price: 25 },
  { id: 'steel-sword-2', name: 'steel sword', description: 'A sturdy steel blade.', roomId: 'shop-pool', type: ItemType.EQUIPMENT, slot: EquipmentSlot.WEAPON, stats: { attack: 5 }, price: 25 },
  { id: 'steel-sword-3', name: 'steel sword', description: 'A sturdy steel blade.', roomId: 'shop-pool', type: ItemType.EQUIPMENT, slot: EquipmentSlot.WEAPON, stats: { attack: 5 }, price: 25 },
  { id: 'health-potion-1', name: 'health potion', description: 'Restores some health when used.', roomId: 'shop-pool', type: ItemType.CONSUMABLE, price: 8 },
  { id: 'health-potion-2', name: 'health potion', description: 'Restores some health when used.', roomId: 'shop-pool', type: ItemType.CONSUMABLE, price: 8 },
  { id: 'health-potion-3', name: 'health potion', description: 'Restores some health when used.', roomId: 'shop-pool', type: ItemType.CONSUMABLE, price: 8 },
  { id: 'health-potion-4', name: 'health potion', description: 'Restores some health when used.', roomId: 'shop-pool', type: ItemType.CONSUMABLE, price: 8 },
  { id: 'health-potion-5', name: 'health potion', description: 'Restores some health when used.', roomId: 'shop-pool', type: ItemType.CONSUMABLE, price: 8 },
  { id: 'bread-1', name: 'bread', description: 'A loaf of bread. Fills the belly.', roomId: 'shop-pool', type: ItemType.CONSUMABLE, price: 2 },
  { id: 'bread-2', name: 'bread', description: 'A loaf of bread. Fills the belly.', roomId: 'shop-pool', type: ItemType.CONSUMABLE, price: 2 },
  { id: 'bread-3', name: 'bread', description: 'A loaf of bread. Fills the belly.', roomId: 'shop-pool', type: ItemType.CONSUMABLE, price: 2 },
];

export class World {
  private rooms: Map<string, Room> = new Map();
  private items: Map<string, Item> = new Map();

  constructor() {
    this.loadMap();
  }

  private loadMap(): void {
    for (const room of ROOMS) {
      this.rooms.set(room.id, { ...room });
    }
    for (const item of ITEMS) {
      this.items.set(item.id, { ...item });
    }
  }

  /**
   * Fetch room data by ID.
   * @returns The room if found, otherwise undefined
   */
  getRoom(id: string): Room | undefined {
    return this.rooms.get(id);
  }

  /**
   * Get all room IDs (e.g. for validation or listing).
   */
  getRoomIds(): string[] {
    return Array.from(this.rooms.keys());
  }

  /**
   * Fetch item by ID.
   */
  getItem(id: string): Item | undefined {
    return this.items.get(id);
  }

  /**
   * Get all items in a room (by roomId). Does not include items held by players.
   */
  getItemsInRoom(roomId: string): Item[] {
    return Array.from(this.items.values()).filter((i) => i.roomId === roomId);
  }

  /**
   * Get all items held by a player (holderId = socket.id or player id).
   */
  getItemsHeldBy(holderId: string): Item[] {
    return Array.from(this.items.values()).filter((i) => i.holderId === holderId);
  }

  /**
   * Move an item from the world (room or pool) into a holder's inventory.
   * Returns true if the item was found and moved.
   */
  moveItemToHolder(itemId: string, holderId: string): boolean {
    const item = this.items.get(itemId);
    if (!item) return false;
    item.roomId = undefined;
    item.holderId = holderId;
    return true;
  }

  /**
   * Move an item from a holder's inventory into a room.
   * Returns true if the item was found and moved.
   */
  moveItemToRoom(itemId: string, roomId: string): boolean {
    const item = this.items.get(itemId);
    if (!item) return false;
    item.holderId = undefined;
    item.roomId = roomId;
    return true;
  }

  /**
   * When a monster dies, with 50% chance drop a random item from its loot table
   * (from the loot-pool) into the given room.
   */
  tryDropLoot(roomId: string, monster: Monster): void {
    const table = monster.lootTable;
    if (!table || table.length === 0) return;
    if (Math.random() >= 0.5) return;
    const itemId = table[Math.floor(Math.random() * table.length)]!;
    const item = this.items.get(itemId);
    if (!item || item.roomId !== 'loot-pool') return;
    item.holderId = undefined;
    item.roomId = roomId;
  }

  /**
   * Remove a monster from a room (e.g. when killed). Mutates the room's monsters array.
   */
  removeMonsterFromRoom(roomId: string, monsterId: string): void {
    const room = this.rooms.get(roomId);
    if (!room || !room.monsters) return;
    room.monsters = room.monsters.filter((m) => m.id !== monsterId);
  }

  /**
   * Add a monster to a room (e.g. admin spawn or arena lever).
   */
  addMonsterToRoom(roomId: string, monster: Monster): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    if (!room.monsters) room.monsters = [];
    room.monsters.push(monster);
  }

  /**
   * Remove an item from the world (e.g. quest turn-in consumes the item).
   */
  removeItem(itemId: string): boolean {
    return this.items.delete(itemId);
  }

  /**
   * Get one item from shop-pool by name (for buy). Returns the first match.
   */
  getOneItemInShopPoolByName(name: string): Item | undefined {
    const pool = this.getItemsInRoom('shop-pool');
    const lower = name.toLowerCase();
    return pool.find((i) => i.name.toLowerCase().includes(lower) || lower.includes(i.name.toLowerCase()));
  }
}
