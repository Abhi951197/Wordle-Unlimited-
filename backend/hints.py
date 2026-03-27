# Riddle-based hints for every word in the game.
# No direct letter reveals — hints are category, riddle, and structural clues only.

WORD_HINTS: dict = {

    # ── EASY WORDS ────────────────────────────────────────────────────────────
    "APPLE": {
        "category": "Food / Fruit",
        "riddle":   "An old proverb says eating one every day keeps the doctor away 🍎",
        "structure": "Starts with a vowel, contains a double letter",
    },
    "TRAIN": {
        "category": "Transport",
        "riddle":   "It travels on rails and makes a choo-choo sound 🚂",
        "structure": "5 letters, ends in N, no repeated letters",
    },
    "HOUSE": {
        "category": "Building / Place",
        "riddle":   "A place you call home and hang your keys 🏠",
        "structure": "Starts with a consonant, ends with a silent E",
    },
    "MOUSE": {
        "category": "Animal / Tech",
        "riddle":   "Either a tiny squeaky creature or the thing next to your keyboard 🖱️",
        "structure": "Rhymes with HOUSE, ends with a silent E",
    },
    "WATER": {
        "category": "Nature / Element",
        "riddle":   "H₂O — you cannot live without it for more than three days 💧",
        "structure": "5 letters, no repeated letters, ends in R",
    },
    "PLANT": {
        "category": "Nature",
        "riddle":   "It grows in soil, needs sunlight, and quietly produces oxygen 🌱",
        "structure": "Ends in T, consonant cluster at the end",
    },
    "SMILE": {
        "category": "Expression / Emotion",
        "riddle":   "The universal sign of happiness — it uses fewer muscles than a frown 😊",
        "structure": "Starts with SM, ends with a silent E",
    },
    "BREAD": {
        "category": "Food",
        "riddle":   "Sliced, toasted, or baked fresh — the staple of sandwiches 🍞",
        "structure": "5 letters, contains EA, ends in D",
    },
    "GRASS": {
        "category": "Nature",
        "riddle":   "The green carpet covering lawns and football pitches 🌿",
        "structure": "Contains a double letter at the end",
    },
    "RIVER": {
        "category": "Nature / Geography",
        "riddle":   "It flows from mountains to the sea, carving valleys along the way 🏞️",
        "structure": "5 letters, ends in R, contains IV",
    },
    "CHAIR": {
        "category": "Furniture",
        "riddle":   "You sit on it — it has four legs but cannot walk 🪑",
        "structure": "5 letters, ends in R, starts with CH",
    },
    "TABLE": {
        "category": "Furniture",
        "riddle":   "Meals are served on it and meetings happen around it 🪵",
        "structure": "Ends with a silent E, starts with T",
    },
    "LIGHT": {
        "category": "Physics / Sensation",
        "riddle":   "The fastest thing in the universe — flick the switch and it appears instantly 💡",
        "structure": "5 letters, ends in T, contains IGH",
    },
    "HEART": {
        "category": "Body / Emotion",
        "riddle":   "It beats about 100,000 times a day and is the symbol of love ❤️",
        "structure": "5 letters, contains EAR, ends in T",
    },
    "MUSIC": {
        "category": "Art / Sound",
        "riddle":   "The universal language — organised sound that moves the soul 🎵",
        "structure": "5 letters, ends in C, starts with M",
    },
    "NIGHT": {
        "category": "Time / Nature",
        "riddle":   "When the sun sets and the stars come out to play 🌙",
        "structure": "5 letters, contains IGH, ends in T",
    },
    "DREAM": {
        "category": "Mind / Sleep",
        "riddle":   "It happens while you sleep and sometimes you wish it never ended 💭",
        "structure": "5 letters, ends in M, contains EA",
    },
    "WORLD": {
        "category": "Geography / Concept",
        "riddle":   "Seven continents, eight billion people — the whole thing 🌍",
        "structure": "5 letters, ends in D, contains OR",
    },
    "PEACE": {
        "category": "Concept / Virtue",
        "riddle":   "The opposite of war — what doves symbolise ☮️",
        "structure": "Ends with a silent E, contains EA, starts with P",
    },
    "TRUTH": {
        "category": "Concept / Virtue",
        "riddle":   "The opposite of a lie — what every good story is built on ⚖️",
        "structure": "5 letters, ends in H, contains TH",
    },

    # ── MEDIUM WORDS ──────────────────────────────────────────────────────────
    "YACHT": {
        "category": "Transport / Leisure",
        "riddle":   "A sleek vessel favoured by the wealthy on open water ⛵",
        "structure": "5 letters, ends in T, contains Y and CH",
    },
    "ZEBRA": {
        "category": "Animal",
        "riddle":   "An African horse that never lost its pyjamas 🦓",
        "structure": "Starts with Z, ends in A, 5 letters",
    },
    "VAGUE": {
        "category": "Adjective / Concept",
        "riddle":   "Not clear, not specific — somewhere between here and there 🌫️",
        "structure": "Ends with a silent E, starts with V, contains GU",
    },
    "QUICK": {
        "category": "Adjective",
        "riddle":   "Faster than fast — the brown fox famously was this ⚡",
        "structure": "5 letters, starts with QU, ends in K",
    },
    "JUMBO": {
        "category": "Size / Adjective",
        "riddle":   "Extra large — the size of a famous circus elephant and a certain jet ✈️",
        "structure": "5 letters, starts with J, ends in O",
    },
    "KNACK": {
        "category": "Skill / Ability",
        "riddle":   "A natural talent or special skill that comes effortlessly 🎯",
        "structure": "Starts with KN (silent K), ends in CK",
    },
    "FLOCK": {
        "category": "Group / Nature",
        "riddle":   "A group of birds moving together as one coordinated cloud 🐦",
        "structure": "5 letters, ends in CK, starts with FL",
    },
    "GLOVE": {
        "category": "Clothing / Accessory",
        "riddle":   "It covers your hand in winter or in the boxing ring 🥊",
        "structure": "Ends with a silent E, starts with GL",
    },
    "THICK": {
        "category": "Adjective",
        "riddle":   "The opposite of thin — a hearty soup or a dense book 📚",
        "structure": "5 letters, ends in K, contains TH",
    },
    "SPARK": {
        "category": "Fire / Energy",
        "riddle":   "A tiny flash of fire that can start a raging blaze ✨",
        "structure": "5 letters, ends in K, contains AR",
    },
    "BLINK": {
        "category": "Action / Reflex",
        "riddle":   "Your eyes do this involuntarily about 15 to 20 times per minute 👁️",
        "structure": "5 letters, ends in K, starts with BL",
    },
    "CLERK": {
        "category": "Profession",
        "riddle":   "The person behind the counter handling paperwork and records 📋",
        "structure": "5 letters, ends in K, contains ER",
    },
    "DRAFT": {
        "category": "Writing / Concept",
        "riddle":   "The first rough version of a document — before it is polished ✍️",
        "structure": "5 letters, ends in T, contains AFT",
    },
    "GHOST": {
        "category": "Supernatural",
        "riddle":   "A spooky spirit that haunts old houses and goes boo 👻",
        "structure": "5 letters, contains silent GH, ends in T",
    },
    "KNIFE": {
        "category": "Tool / Utensil",
        "riddle":   "A sharp blade used in the kitchen — the K is silent 🔪",
        "structure": "Starts with silent K, ends with a silent E",
    },
    "MAGIC": {
        "category": "Performance / Concept",
        "riddle":   "What a magician performs — rabbits from hats and disappearing acts 🎩",
        "structure": "5 letters, ends in C, contains AG",
    },
    "ONION": {
        "category": "Food / Vegetable",
        "riddle":   "The vegetable that makes you cry while chopping 🧅",
        "structure": "Starts and ends with the same letter",
    },
    "PIZZA": {
        "category": "Food",
        "riddle":   "Italy's greatest gift to the world — round, cheesy, universally loved 🍕",
        "structure": "5 letters, contains a double Z",
    },
    "QUOTE": {
        "category": "Language / Writing",
        "riddle":   "Famous words borrowed from someone else — placed inside quotation marks 💬",
        "structure": "Starts with QU, ends with a silent E",
    },
    "ROBOT": {
        "category": "Technology",
        "riddle":   "A machine programmed to do human tasks — beloved in science fiction 🤖",
        "structure": "5 letters, ends in T, starts with R",
    },

    # ── HARD WORDS ────────────────────────────────────────────────────────────
    "QUEUE": {
        "category": "Concept / British English",
        "riddle":   "An orderly line of waiting people — the British are famously good at it 🧍‍♂️",
        "structure": "5 letters — four of them are vowels",
    },
    "FLUFF": {
        "category": "Texture",
        "riddle":   "The soft, light material found inside pillows and on kittens 🐱",
        "structure": "5 letters, contains two sets of double letters (LL and FF)",
    },
    "MUMMY": {
        "category": "History / Supernatural",
        "riddle":   "An ancient Egyptian preserved in bandages — or what British children call mum 🏺",
        "structure": "5 letters, double M in the middle, ends in Y",
    },
    "PUPPY": {
        "category": "Animal",
        "riddle":   "A baby dog whose existence makes everything better 🐶",
        "structure": "5 letters, double P in the middle, ends in Y",
    },
    "KAYAK": {
        "category": "Sport / Transport",
        "riddle":   "A narrow watercraft paddled with a double-bladed oar 🛶",
        "structure": "Reads the same forwards and backwards — a palindrome",
    },
    "CIVIC": {
        "category": "Adjective / Concept",
        "riddle":   "Relating to the duties and rights of citizens in a city 🏛️",
        "structure": "Palindrome — reads the same both ways, 5 letters",
    },
    "RADAR": {
        "category": "Technology",
        "riddle":   "A system detecting objects using radio waves — used by airports and navies 📡",
        "structure": "Palindrome — reads the same both ways",
    },
    "LEVEL": {
        "category": "Adjective / Tool",
        "riddle":   "Perfectly flat — or a floor in a building — or a stage in a video game 🎮",
        "structure": "Palindrome — reads the same both ways",
    },
    "ROTOR": {
        "category": "Mechanics",
        "riddle":   "The spinning component of a helicopter or a motor engine 🚁",
        "structure": "Palindrome — reads the same both ways",
    },
    "MADAM": {
        "category": "Title / Address",
        "riddle":   "A formal address for a woman — Napoleon supposedly said it first 👑",
        "structure": "Palindrome — reads the same both ways",
    },
    "REFER": {
        "category": "Action / Language",
        "riddle":   "To direct someone toward another source, person, or document 📎",
        "structure": "Palindrome — reads the same both ways",
    },
    "STATS": {
        "category": "Mathematics / Data",
        "riddle":   "Numbers that describe performance — athletes and analysts love these 📊",
        "structure": "Palindrome — reads the same both ways",
    },
    "TENET": {
        "category": "Concept / Belief",
        "riddle":   "A core principle or belief — also a mind-bending Christopher Nolan film 🎬",
        "structure": "Palindrome — reads the same both ways",
    },
    "WOWED": {
        "category": "Reaction / Emotion",
        "riddle":   "The past tense of being completely amazed and left speechless 😮",
        "structure": "Palindrome — reads the same both ways",
    },
    "ZILCH": {
        "category": "Quantity / Slang",
        "riddle":   "Absolutely nothing — zero, nada, not a single thing 🚫",
        "structure": "5 letters, starts with Z, ends in CH",
    },
    "CRYPT": {
        "category": "Architecture / Dark",
        "riddle":   "A vault beneath a church where the dead are laid to rest ⚰️",
        "structure": "5 letters, no standard vowels, heavily consonant",
    },
    "GLYPH": {
        "category": "Language / Art",
        "riddle":   "A carved or written symbol — like Egyptian hieroglyphics 🗿",
        "structure": "5 letters, no standard vowels, contains PH",
    },
    "NYMPH": {
        "category": "Mythology",
        "riddle":   "A beautiful nature spirit from Greek mythology — tied to forests and water 🧚",
        "structure": "5 letters, only one vowel, ends in PH",
    },
    "TRYST": {
        "category": "Romance",
        "riddle":   "A secret romantic meeting arranged between two people 💌",
        "structure": "5 letters, no standard vowels except Y, heavy consonants",
    },
    "WALTZ": {
        "category": "Dance / Music",
        "riddle":   "An elegant 3/4 time ballroom dance that originated in Vienna 💃",
        "structure": "5 letters, ends in Z, contains AL",
    },
}
