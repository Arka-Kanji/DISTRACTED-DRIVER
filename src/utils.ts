export const VOCABULARY = [
  "many", "say", "those", "child", "another", "little", "any", "set", "system", "life",
  "world", "program", "about", "time", "would", "make", "think", "which", "could", "from",
  "some", "them", "people", "other", "into", "year", "your", "good", "they", "will",
  "when", "what", "where", "how", "why", "who", "just", "like", "know", "take",
  "data", "byte", "code", "logic", "port", "fast", "slow", "down", "left", "right"
];

export function generateParagraph(wordCount: number = 80) {
  let words = [];
  for(let i=0; i<wordCount; i++) {
    words.push(VOCABULARY[Math.floor(Math.random() * VOCABULARY.length)]);
  }
  return words.join(" ");
}
