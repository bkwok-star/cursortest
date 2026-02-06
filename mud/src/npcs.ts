import type { NPC, Quest } from './types';

/** NPCs by room ID */
const NPC_BY_ROOM: Record<string, NPC[]> = {
  'town-square': [
    {
      id: 'merchant',
      name: 'Merchant',
      dialogue: [
        'Welcome, traveler. I sell potions and gear. Say "list" to see my wares.',
        'Need supplies? Check my list. Gold talks.',
        'Come back when you have more gold.',
      ],
      shopInventory: [
        { itemName: 'steel sword', price: 25 },
        { itemName: 'health potion', price: 8 },
        { itemName: 'bread', price: 2 },
      ],
      quest: {
        id: 'quest-mushroom',
        title: 'Glowing Mushroom',
        description: 'The Merchant wants a glowing mushroom from the flooded corridor for his alchemy.',
        goal: 'bring a glowing mushroom',
        goalStructured: { type: 'collect', target: 'glowing mushroom', count: 1 },
        rewardGold: 15,
      },
    },
  ],
  'dungeon-gate': [
    {
      id: 'guard',
      name: 'Guard',
      dialogue: [
        'Halt! The cave above is dangerous. Clear out the goblin and I\'ll see you rewarded.',
        'That goblin in the cave has been a nuisance. Deal with it and report back.',
        'You look like you can handle yourself. There\'s a goblin in the cave interior—kill it and I\'ll pay you.',
      ],
      quest: {
        id: 'quest-goblin',
        title: 'Slay the Goblin',
        description: 'The Guard wants you to kill the Grumpy Goblin in the Cave Interior.',
        goal: 'kill the Grumpy Goblin',
        goalStructured: { type: 'kill', target: 'grumpy-goblin', count: 1 },
        rewardGold: 20,
      },
    },
  ],
};

export function getNPCsInRoom(roomId: string): NPC[] {
  return NPC_BY_ROOM[roomId] ?? [];
}

export function getNPCByName(roomId: string, name: string): NPC | undefined {
  const npcs = getNPCsInRoom(roomId);
  const lower = name.toLowerCase().trim();
  return npcs.find((n) => n.name.toLowerCase().includes(lower) || lower.includes(n.name.toLowerCase()));
}

export function getQuestById(questId: string): Quest | undefined {
  for (const npcs of Object.values(NPC_BY_ROOM)) {
    for (const n of npcs) {
      if (n.quest?.id === questId) return n.quest;
    }
  }
  return undefined;
}
