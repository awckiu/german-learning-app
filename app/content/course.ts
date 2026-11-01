// The course, adapted from Palteca's 45 levels (plan/course-outline.md).
// Each lesson lists audio bank ranks (pipeline/data/word_list.tsv): ranks
// with an example sentence play as sentences, the rest as single words.
// A lesson with no items shows "coming soon". Every level ends in a
// Breakthrough Lesson, built from that level's other lessons.

export type CourseLesson = { id: string; title: string; items: number[] };
export type CourseLevel = { level: number; theme: string; lessons: CourseLesson[] };

type LevelDef = [theme: string, lessons: [title: string, items?: number[]][]];

const levels: LevelDef[] = [
  ['Your first conversation', [
    ['Greetings and farewells', [136, 117, 188, 218, 186, 428, 780, 311, 129, 1514]],
    ['Having a basic conversation', [22, 43, 283, 90, 204, 236, 256, 142]],
    ['Asking about mood', [24, 131, 221, 5, 385, 264, 524, 664, 564, 27]],
    ['Introducing yourself', [4, 491, 648, 233, 220, 20, 483, 773]],
  ]],
  ['Sharing personal information', [
    ['Your name and age', [233, 299, 4, 220, 140, 122, 249, 151]],
    ['Your home country', [356, 61, 7, 732, 94, 19, 74, 31, 1368, 450]],
    ['Your job', [176, 14, 143, 357, 772, 677, 1133, 333, 922, 636]],
  ]],
  ['Asking general questions', [
    ['Asking for a German word', [70, 309, 405, 213, 82, 302, 314, 139, 1179]],
    ['Asking for clarification', [107, 447, 1132, 216, 390, 1096, 146, 236]],
  ]],
  ['Daily habits', [
    ['Morning and midday routines', [429, 498, 1300, 479, 541, 938, 1069, 173, 1244]],
    ['Afternoon and evening routines', [1197, 988, 1027, 1509, 877, 230, 186]],
    ['Your first half of the week', [114, 1568, 1996, 2305, 370, 260, 1383]],
    ['Getting closer to the weekend', [2027, 1411, 1545, 1487, 377, 393, 698]],
    ['Your weekend plans', [39, 964, 992, 662, 148, 913, 877]],
  ]],
  ['Time and schedules', [
    ['Asking about time', [291, 427, 494, 527, 1474, 128, 336, 192]],
    ['Sharing your daily agenda', [381, 181, 62, 154, 938, 677, 251, 1151]],
    ['Discussing your schedule', [109, 59, 516, 8, 265, 305, 1147, 704, 1072]],
  ]],
  ['Sharing what you like', [
    ['An activity you like', [67, 273, 495, 699, 846, 159, 1025]],
    ['One thing you like', [96, 623, 668, 1046, 815, 1343, 1234]],
    ['Several things you like (gefällt / gefallen)', [360, 909, 1266, 1460, 100, 45]],
  ]],
  ['Talking about preferences', [
    ['General preferences', [66, 101, 177, 1234, 96, 846]],
    ['Specific preferences', [212, 91, 99, 1082, 661, 1438]],
    ['Things you dislike', [370, 558, 1116, 1180, 363, 285]],
    ['Agreeing', [142, 178, 318, 255, 564, 350, 1081]],
    ['Disagreeing', [172, 240, 294, 234, 1177, 1470, 637]],
  ]],
  ['Talking about desires', [
    ['What you want to do', [28, 75, 509, 925, 903, 690, 1440]],
    ['Disagreeing with others’ wants', [1180, 516, 869, 43, 1353, 649]],
    ['Agreeing with others’ wants', [22, 318, 1402, 1122, 64, 999, 79]],
  ]],
  ['Talking about plans', [
    ['Your week plans', [260, 826, 338, 424, 148, 1219, 1383]],
    ['Reasons to do something', [110, 389, 1072, 84, 346, 879]],
    ['Reasons and goals', [118, 302, 579, 1065, 392, 202]],
  ]],
  ['Nationalities and jobs', [
    ['Nationalities, male and female forms', [61, 7, 2648, 2651, 2652, 2653, 2654, 1209, 1131, 679]],
    ['Jobs, -er / -erin forms', [143, 2026, 2437, 2438, 2577, 2578, 2579, 2580, 2575, 2576, 1932, 2591]],
  ]],
  ['Describing people and things', [['The way you look'], ['Hair and face'], ['Personality'], ['Describing things'], ['Comparing things']]],
  ['Describing your family', [['Parents and siblings'], ['Relationship status'], ['Grandparents and children']]],
  ['Expressing emotions', [['Basic moods'], ['Physical needs']]],
  ['Talking about food', [['Food preferences'], ['Ordering in a restaurant'], ['Ordering in a café'], ['Details for your coffee order']]],
  ['Skills and hobbies', [['Actions in progress'], ['What you can do (können)'], ['What you know (wissen / kennen)'], ['Your hobbies']]],
  ['Doing sports', [['Physical activity'], ['Weekly frequency']]],
  ['Feelings and thoughts', [['Something hurts'], ['How you feel'], ['Your thoughts'], ['Going to the doctor'], ['Healthy tips']]],
  ['Talking about clothes', [['Naming clothing items'], ['Going shopping'], ['Talking about size'], ['Talking about colours']]],
  ['Packing for the seasons', [['Summer'], ['Winter'], ['Spring and autumn']]],
  ['Your next big trip', [['Moving around the airport'], ['Booking a room'], ['Reporting an issue at the airport'], ['Solving it'], ['Reporting an issue at the hotel'], ['Solving it at the hotel']]],
  ['Talking about the weather', [['The weather forecast'], ['Getting ready for the weather']]],
  ['Planning a trip', [['Discussing a destination'], ['Deciding on dates and transport']]],
  ['Getting around the city', [['Places in a city'], ['General directions'], ['Specific directions']]],
  ['Making plans', [['Buying tickets for an event'], ['Proposing a plan'], ['Making a restaurant reservation']]],
  ['Going on a date', [['Getting ready for a date'], ['A date in a bar'], ['A date in a restaurant']]],
  ['Future actions', [['Wishes'], ['Intentions with werden'], ['Intentions with vorhaben / wollen'], ['Things you have to do (müssen)']]],
  ['Describing your place', [['Owning or renting a flat'], ['Locating your place'], ['Describing a location'], ['The rooms in your place']]],
  ['Explaining the use of things', [['Purpose with um … zu'], ['Explaining the use of something'], ['Use with mit'], ['Use with in / für']]],
  ['Talking about furniture', [['Living room'], ['Bedroom'], ['Kitchen'], ['Bathroom']]],
  ['Discussing quantity', [['Asking about quantity'], ['Vague quantities'], ['The lack of things (kein)']]],
  ['Making comparisons', [['Size'], ['Price'], ['Quality'], ['Quantity'], ['Actions']]],
  ['Making plans in your area', [['Familiar places'], ['What’s around you'], ['Agreeing to meet nearby'], ['Changing a plan']]],
  ['Managing your finances', [['Going to the bank'], ['A lost card']]],
  ['Going to new places', [['Going to a bakery'], ['Ordering in a bakery'], ['Information at the gym'], ['Gym amenities']]],
  ['Shopping for the essentials', [['Describing purchases'], ['At the pharmacy'], ['At the supermarket']]],
  ['Issues when you’re out', [['Finding a toilet'], ['Issues at the checkout']]],
  ['The farmers’ market', [['Describing a market'], ['Shopping at the market']]],
  ['Exploring the city', [['Recommending places'], ['Public transport'], ['Meeting at the station'], ['Getting a ticket'], ['Asking for help at the U-Bahn']]],
  ['Using your phone', [['Phone issues'], ['Getting a SIM card'], ['Messaging a group chat']]],
  ['Settling into a new city', [['Your first friend'], ['Things you’d like to do'], ['Job offers'], ['Job applications']]],
  ['Past and present actions', [['Your current routine'], ['Recent activities'], ['Perfekt or Präteritum'], ['Asking about an event'], ['Sharing news of an event']]],
  ['Before an interview', [['Expressing your feelings'], ['Asking for and giving advice']]],
  ['Hosting a dinner party', [['Following a recipe'], ['Hosting a dinner']]],
  ['Having a house party', [['Introducing a friend'], ['Comparing two cultures'], ['Life experiences'], ['Asking people not to do things']]],
  ['Giving an interview', [['What you just did'], ['How long something lasted'], ['When actions began and ended'], ['Placing events on a timeline'], ['Time since an action (seit)']]],
];

export const BREAKTHROUGH_TITLE = 'Breakthrough Lesson';

export const course: CourseLevel[] = levels.map(([theme, lessons], i) => {
  const level = i + 1;
  const regular = lessons.map(([title, items = []], j) => ({ id: `L${level}.${j + 1}`, title, items }));
  // The Breakthrough Lesson mixes every item from the level's other lessons.
  const breakthrough = {
    id: `L${level}.${regular.length + 1}`,
    title: BREAKTHROUGH_TITLE,
    items: [...new Set(regular.flatMap((l) => l.items))],
  };
  return { level, theme, lessons: [...regular, breakthrough] };
});

export function isBreakthrough(lesson: CourseLesson) {
  return lesson.title === BREAKTHROUGH_TITLE;
}

export function findLesson(id: string) {
  for (const level of course) {
    const lesson = level.lessons.find((l) => l.id === id);
    if (lesson) return { level, lesson };
  }
  return null;
}
