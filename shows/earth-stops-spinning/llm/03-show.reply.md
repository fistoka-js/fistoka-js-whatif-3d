{
  "format": 1,
  "title": "What if Earth suddenly stopped spinning?",
  "voice": {"audio": "voice.mp3", "words": "words.json"},
  "dials": {
    "air": {"start": 0.6, "keys": [
      {"at": "suddenly", "to": 0.2, "over": 0.9},
      {"at": "picture", "to": 0.05, "over": 1.5},
      {"at": "That's the", "to": 1.0, "over": 1.0},
      {"at": "Here is", "to": 1.4, "over": 1.0},
      {"at": "Right now", "to": 0.5, "over": 1.2},
      {"at": "The air", "to": 0.6, "over": 1.5},
      {"at": "If the rock", "to": 0.85, "over": 1.5},
      {"at": "racing", "to": 1.0, "over": 1.2},
      {"at": "winds would", "to": 1.5, "over": 1.5},
      {"at": "Oceans would", "to": 0.9, "over": 1.0},
      {"at": "flooding", "to": 1.3, "over": 1.0}
    ]},
    "heat": {"start": 0.2, "keys": [
      {"at": "One day", "to": 0.45, "over": 1.1},
      {"at": "For roughly", "to": 0.6, "over": 1.0},
      {"at": "sunny", "to": 1.0, "over": 0.9},
      {"at": "dark side", "to": 0.0, "over": 1.2}
    ]},
    "gap": {"start": 0.5, "keys": [
      {"at": "Spinning is", "to": 0, "over": 1.5},
      {"at": "Without it", "to": 0.3, "over": 0.7},
      {"at": "temperature gap", "to": 1.0, "over": 1.5},
      {"at": "most life", "to": 0.85, "over": 1.0},
      {"at": "Which side", "to": 0.7, "over": 1.0},
      {"at": "Comment below", "to": 1.0, "over": 0.5}
    ]}
  },
  "shots": [
    {
      "id": "hook",
      "env": {"type": "space", "nebula": "blue"},
      "camera": {"focus": ["hero"], "framing": "close", "fill": 1.1, "angle": "front", "move": "push_in", "amount": 0.3},
      "props": [
        {"id": "hero", "type": "planet", "look": "earth", "at": "center", "size": 1.4, "turn": 0.4, "atmosphere": {"dial": "air", "from": [0, 1.5], "to": [0, 1.5]}},
        {"id": "air", "type": "particles", "at": "center", "size": 2.3, "shape": "sphere", "count": 300, "look": "dots", "dot": 0.07, "speed": {"dial": "air", "from": [0, 1.5], "to": [0.1, 4]}, "color": {"dial": "air", "colors": ["#8fd3ff", "#ffffff", "#ffb347"]}}
      ],
      "actions": [
        {"at": "stopped", "do": "spin", "prop": "hero", "speed": 0},
        {"at": "stopped", "do": "pulse", "prop": "hero", "strength": 0.15}
      ]
    },
    {
      "id": "rate",
      "start": "Right now",
      "continue": true,
      "camera": {"focus": ["hero"], "framing": "close", "fill": 1.0, "angle": "front", "move": "drift", "amount": 0.3, "glide": 1.2},
      "props": [
        {"id": "ground", "type": "arrow", "from": [-0.9, 0, 0.8], "to": [0.9, 0, 0.8], "color": "#ffffff", "length": 0.3},
        {"id": "wind", "type": "arrow", "from": [-0.9, 0.5, 0.8], "to": [0.9, 0.5, 0.8], "color": "#ffe14d", "length": 0.5},
        {"id": "sea", "type": "arrow", "from": [-0.8, -0.4, 0.8], "to": [0.8, -0.4, 0.8], "color": "#4aa8ff", "length": 0.5}
      ],
      "actions": [
        {"at": "Right now", "do": "spin", "prop": "hero", "speed": 0.4},
        {"at": "ground at", "do": "appear", "prop": "ground", "style": "grow"},
        {"at": "about one", "do": "set", "prop": "ground", "param": "length", "to": 1, "over": 2},
        {"at": "about one", "do": "count", "from": 0, "to": 1000, "unit": "mph", "until": {"phrase": "hour", "edge": "end"}},
        {"at": "The air", "do": "appear", "prop": "wind", "style": "grow"},
        {"at": "oceans", "do": "appear", "prop": "sea", "style": "grow"}
      ]
    },
    {
      "id": "inertia",
      "start": "If the rock",
      "continue": true,
      "camera": {"focus": ["hero"], "framing": "close", "fill": 1.0, "angle": "front", "move": "push_in", "amount": 0.3, "glide": 1.0},
      "actions": [
        {"at": "rock stopped", "do": "spin", "prop": "hero", "speed": 0},
        {"at": "rock stopped", "do": "set", "prop": "ground", "param": "length", "to": 0.05, "over": 0.5},
        {"at": "would not", "do": "set", "prop": "wind", "param": "length", "to": 0.9, "over": 0.6},
        {"at": "racing", "do": "color", "prop": "wind", "to": "#ff5533", "over": 0.8},
        {"at": "scour", "do": "shake", "prop": "hero", "strength": 0.15, "for": 2}
      ]
    },
    {
      "id": "surge",
      "start": "Oceans would",
      "continue": true,
      "camera": {"focus": ["hero"], "framing": "close", "fill": 1.0, "angle": "front", "move": "drift", "amount": 0.3, "glide": 0.8},
      "actions": [
        {"at": "surge", "do": "set", "prop": "sea", "param": "length", "to": 1, "over": 1.0},
        {"at": "flooding", "do": "shake", "prop": "hero", "strength": 0.2, "for": 1}
      ]
    },
    {
      "id": "day",
      "start": "One day would",
      "transition": "dip",
      "env": {"type": "space", "nebula": "purple"},
      "camera": {"focus": ["hero", "sun", "temp"], "framing": "medium", "fill": 1.0, "angle": "front", "move": "drift", "amount": 0.3},
      "props": [
        {"id": "hero", "type": "planet", "look": "earth", "at": [0.2, 0, 0], "size": 1.3, "turn": 0, "color": {"dial": "heat", "colors": ["#5aa0ff", "#ffb347", "#ff4a1a"]}},
        {"id": "sun", "type": "sun", "at": [-1.6, 0.7, 0], "size": 1.0},
        {"id": "temp", "type": "thermometer", "at": [1.5, 0, 0], "size": 1.0, "level": {"dial": "heat", "from": [0, 1], "to": [0.1, 1]}}
      ],
      "actions": [
        {"at": "about a year", "do": "pulse", "prop": "sun", "strength": 0.3},
        {"at": "bake", "do": "pulse", "prop": "hero", "strength": 0.15}
      ]
    },
    {
      "id": "kebab",
      "start": "It's like",
      "continue": true,
      "camera": {"focus": ["hero", "fire"], "framing": "medium", "fill": 1.0, "angle": "front", "move": "drift", "amount": 0.3, "glide": 1.2},
      "props": [
        {"id": "fire", "type": "fire", "at": [0.9, -0.2, 0], "size": 0.9}
      ],
      "actions": [
        {"at": "It's like", "do": "disappear", "prop": "sun", "style": "fade"},
        {"at": "It's like", "do": "disappear", "prop": "temp", "style": "fade"},
        {"at": "It's like", "do": "move", "prop": "hero", "to": [-0.6, 0.2, 0], "over": 1.0},
        {"at": "kebab", "do": "appear", "prop": "fire", "style": "grow"},
        {"at": "stops turning", "do": "set", "prop": "fire", "param": "size", "to": 1.7, "over": 1.0},
        {"at": "burns", "do": "color", "prop": "fire", "to": "#ff3b1a", "over": 0.5},
        {"at": "stays raw", "do": "set", "prop": "fire", "param": "size", "to": 0.3, "over": 0.8}
      ]
    },
    {
      "id": "even",
      "start": "Spinning is",
      "transition": "dip",
      "env": {"type": "space", "nebula": "teal"},
      "camera": {"focus": ["hero", "hot", "cold"], "framing": "medium", "fill": 1.05, "angle": "front", "move": "drift", "amount": 0.3},
      "props": [
        {"id": "hero", "type": "planet", "look": "earth", "at": [0, 0.1, 0], "size": 1.2, "turn": 0.4, "color": {"dial": "gap", "colors": ["#ffffff", "#ff7a3a"]}},
        {"id": "hot", "type": "thermometer", "at": [-1.3, 0, 0], "size": 0.9, "level": {"dial": "gap", "from": [0, 1], "to": [0.5, 1.0]}},
        {"id": "cold", "type": "thermometer", "at": [1.3, 0, 0], "size": 0.9, "level": {"dial": "gap", "from": [0, 1], "to": [0.5, 0.0]}}
      ],
      "actions": [
        {"at": "Without it", "do": "spin", "prop": "hero", "speed": 0}
      ]
    },
    {
      "id": "ask",
      "start": "Which side",
      "continue": true,
      "camera": {"focus": ["hero", "hot", "cold"], "framing": "medium", "fill": 1.1, "angle": "front", "move": "push_in", "amount": 0.3, "glide": 1.0},
      "actions": [
        {"at": "bright", "do": "pulse", "prop": "hero", "strength": 0.2},
        {"at": "Comment below", "do": "pulse", "prop": "hero", "strength": 0.25}
      ]
    }
  ]
}
