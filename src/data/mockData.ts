import dateSentosa from "@/assets/date-sentosa.jpg";
import dateCafe from "@/assets/date-cafe.jpg";
import dateBoardgame from "@/assets/date-boardgame.jpg";
import dateGardens from "@/assets/date-gardens.jpg";
import dateCooking from "@/assets/date-cooking.jpg";

export interface DateEntry {
  id: string;
  title: string;
  date: string;
  location: string;
  description: string;
  mood: string;
  photos: string[];
  coverImage?: string;
  journalEntry?: string;
}

export interface GameEntry {
  id: string;
  dateId?: string;
  gameName: string;
  gameCategory: "Card Game" | "Board Game" | "Mobile Game" | "Video Game" | "Sport" | "Other";
  winner: "Zul" | "Wendy" | "Draw";
  scoreZul?: number;
  scoreGf?: number;
  notes?: string;
  playedAt: string;
}

export const mockDates: DateEntry[] = [
  {
    id: "1",
    title: "Sentosa Day Out",
    date: "2026-02-14",
    location: "Sentosa Island",
    description: "Valentine's Day at the beach! We built sandcastles and watched the sunset together.",
    mood: "🥰",
    photos: [],
    coverImage: dateSentosa,
    journalEntry: "Today was perfect. The weather was just right and we laughed so much building that lopsided sandcastle.",
  },
  {
    id: "2",
    title: "Café Hopping in Tiong Bahru",
    date: "2026-02-08",
    location: "Tiong Bahru",
    description: "Explored three new cafés and found the best matcha latte in Singapore.",
    mood: "☕",
    photos: [],
    coverImage: dateCafe,
  },
  {
    id: "3",
    title: "Board Game Night",
    date: "2026-01-25",
    location: "Home",
    description: "Marathon Catan session that lasted until 3am. Worth every minute!",
    mood: "🎲",
    photos: [],
    coverImage: dateBoardgame,
    journalEntry: "She's getting so good at Catan now. I need to step up my strategy game 😅",
  },
  {
    id: "4",
    title: "Gardens by the Bay",
    date: "2026-01-18",
    location: "Gardens by the Bay",
    description: "Night walk through the Supertree Grove. The light show was magical.",
    mood: "✨",
    photos: [],
    coverImage: dateGardens,
  },
  {
    id: "5",
    title: "Cooking Challenge",
    date: "2026-01-10",
    location: "Home",
    description: "We challenged each other to make the best pasta dish. It was close but she won!",
    mood: "🍝",
    photos: [],
    coverImage: dateCooking,
  },
];

export const mockGames: GameEntry[] = [
  { id: "1", dateId: "3", gameName: "Catan", gameCategory: "Board Game", winner: "Wendy", scoreZul: 8, scoreGf: 10, playedAt: "2026-01-25" },
  { id: "2", dateId: "3", gameName: "Uno", gameCategory: "Card Game", winner: "Zul", playedAt: "2026-01-25" },
  { id: "3", gameName: "Mario Kart", gameCategory: "Video Game", winner: "Wendy", playedAt: "2026-02-01" },
  { id: "4", dateId: "1", gameName: "Beach Volleyball", gameCategory: "Sport", winner: "Zul", playedAt: "2026-02-14" },
  { id: "5", gameName: "Wordle Race", gameCategory: "Mobile Game", winner: "Wendy", playedAt: "2026-02-10" },
  { id: "6", gameName: "Chess", gameCategory: "Board Game", winner: "Zul", playedAt: "2026-02-12" },
  { id: "7", gameName: "Exploding Kittens", gameCategory: "Card Game", winner: "Draw", playedAt: "2026-01-30" },
  { id: "8", gameName: "Badminton", gameCategory: "Sport", winner: "Wendy", playedAt: "2026-02-20" },
  { id: "9", gameName: "Overcooked 2", gameCategory: "Video Game", winner: "Draw", playedAt: "2026-02-05" },
  { id: "10", gameName: "Scrabble", gameCategory: "Board Game", winner: "Wendy", scoreZul: 230, scoreGf: 285, playedAt: "2026-02-18" },
];
