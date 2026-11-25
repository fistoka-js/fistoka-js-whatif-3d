{
  "format": 1,
  "title": "Why do volcanoes really erupt?",
  "voice": {"audio": "voice.mp3", "words": "words.json"},
  "dials": {
    "fill": {"start": 0.2, "keys": [
      {"at": "Why do", "to": 0.3, "over": 1.0},
      {"at": "A volcano", "to": 0.4, "over": 3.4},
      {"at": "Deep below", "to": 0.55, "over": 3.4},
      {"at": "Melted rock", "to": 0.7, "over": 2.8},
      {"at": "As the chamber", "to": 0.85, "over": 2.8},
      {"at": "Higher up", "to": 1.0, "over": 4.4},
      {"at": "Once the gas", "to": 0.35, "over": 3.5},
      {"at": "These eruptions", "to": 0.3, "over": 3.0},
      {"at": "Which surprises", "to": 0.55, "over": 1.8},
      {"at": "Comment your", "to": 0.95, "over": 3.4}
    ]},
    "heat": {"start": 0.25, "keys": [
      {"at": "Why do", "to": 0.35, "over": 1.0},
      {"at": "A volcano", "to": 0.45, "over": 3.4},
      {"at": "Here is", "to": 0.55, "over": 1.2},
      {"at": "Down there", "to": 0.6, "over": 0.9},
      {"at": "one thousand", "to": 0.95, "over": 1.6},
      {"at": "As the chamber", "to": 1.0, "over": 2.5},
      {"at": "Once the gas", "to": 0.6, "over": 3.4},
      {"at": "These eruptions", "to": 0.25, "over": 3.4},
      {"at": "Which surprises", "to": 0.4, "over": 1.3},
      {"at": "the heat", "to": 0.85, "over": 1.4},
      {"at": "Comment your", "to": 1.0, "over": 3.4}
    ]},
    "pressure": {"start": 0.1, "keys": [
      {"at": "As the chamber", "to": 0.35, "over": 3.0},
      {"at": "Higher up", "to": 0.5, "over": 4.4},
      {"at": "Think of", "to": 0.55, "over": 1.0},
      {"at": "needle keeps", "to": 1.0, "over": 2.4},
      {"at": "Once the gas", "to": 0.2, "over": 3.0}
    ]},
    "erupt": {"start": 0, "keys": [
      {"at": "blows open", "to": 0.45, "over": 1.0},
      {"at": "burst out", "to": 1.0, "over": 1.5},
      {"at": "Once the", "to": 0.7, "over": 1.2},
      {"at": "slowly fades", "to": 0, "over": 1.8}
    ]}
  },
  "shots": [
    {
      "id": "hook",
      "env": {"type": "lab", "color": {"dial": "heat", "colors": ["#0e1b2b", "#2a1b26", "#3c1710"]}},
      "camera": {"focus": ["hero"], "framing": "close", "fill": 1.1, "angle": "front", "move": "push_in", "amount": 0.4},
      "props": [
        {"id": "hero", "type": "magma_chamber", "at": [0, 0, 0], "size": 2.0,
         "fill": {"dial": "fill", "from": [0, 1], "to": [0, 1]},
         "heat": {"dial": "heat", "from": [0, 1], "to": [0, 1]}},
        {"id": "rock", "type": "rock", "at": [-1.2, 0, 0.8], "size": 0.7, "count": 2, "seed": 3}
      ],
      "actions": [
        {"at": "rock above", "do": "appear", "prop": "rock", "style": "fade", "over": 0.5}
      ]
    },
    {
      "id": "chamber",
      "start": "Deep below",
      "continue": true,
      "camera": {"focus": ["hero", "rock"], "framing": "close", "fill": 1.1, "angle": "three-quarter", "move": "push_in", "amount": 0.4, "glide": 1.0},
      "actions": [
        {"at": "a chamber", "do": "label", "prop": "hero", "text": "MAGMA CHAMBER", "side": "left"}
      ]
    },
    {
      "id": "heat",
      "start": "Down there",
      "continue": true,
      "camera": {"focus": ["hero", "rock", "thermo"], "framing": "close", "fill": 1.1, "angle": "front", "move": "push_in", "amount": 0.4, "glide": 1.0},
      "props": [
        {"id": "thermo", "type": "thermometer", "at": [1.2, 0, 0.8], "size": 1.1,
         "level": {"dial": "heat", "from": [0, 1], "to": [0.15, 1.0]}}
      ],
      "actions": [
        {"at": "the heat", "do": "appear", "prop": "thermo", "style": "grow", "over": 0.6},
        {"at": "one thousand", "do": "text", "text": "1000 °C", "style": "number", "pos": "top"}
      ]
    },
    {
      "id": "gas",
      "start": "As the chamber",
      "continue": true,
      "camera": {"focus": ["hero", "rock", "thermo"], "framing": "close", "fill": 1.1, "angle": "three-quarter", "move": "push_in", "amount": 0.4, "glide": 1.0},
      "props": [
        {"id": "bubbles", "type": "particles", "at": [0, 0.32, 0], "size": 0.45, "shape": "sphere", "count": 30, "color": "#ffe9a0", "dot": 0.04, "spread": 0.3, "speed": 0.2}
      ],
      "actions": [
        {"at": "dissolved gas", "do": "appear", "prop": "bubbles", "style": "fade", "over": 0.5},
        {"at": "locked in", "do": "set", "prop": "bubbles", "param": "spread", "to": 1.0, "over": 1.5}
      ]
    },
    {
      "id": "pipe",
      "start": "Higher up",
      "continue": true,
      "camera": {"focus": ["hero", "rock", "thermo"], "framing": "close", "fill": 1.1, "angle": "low", "move": "push_in", "amount": 0.4, "glide": 1.0},
      "actions": [
        {"at": "that swell", "do": "set", "prop": "bubbles", "param": "spread", "to": 1.6, "over": 1.2},
        {"at": "shove the", "do": "set", "prop": "bubbles", "param": "speed", "to": 1.0, "over": 1.2}
      ]
    },
    {
      "id": "gauge",
      "start": "Think of",
      "transition": "dip",
      "env": {"type": "lab", "color": {"dial": "pressure", "colors": ["#0e1b2b", "#2c1d2a", "#4a1410"]}},
      "camera": {"focus": ["g", "hero"], "framing": "close", "fill": 1.1, "angle": "front", "move": "push_in", "amount": 0.4},
      "props": [
        {"id": "g", "type": "gauge", "at": [-0.3, 0, 0.3], "size": 1.7,
         "value": {"dial": "pressure", "from": [0, 1], "to": [0.05, 1.0]}},
        {"id": "hero", "type": "magma_chamber", "at": [0.9, 0, -0.8], "size": 1.0,
         "fill": {"dial": "fill", "from": [0, 1], "to": [0, 1]},
         "heat": {"dial": "heat", "from": [0, 1], "to": [0, 1]}}
      ],
      "actions": []
    },
    {
      "id": "blow",
      "start": "When pressure",
      "transition": "dip",
      "env": {"type": "sky", "time": "night", "ground": "grass", "clouds": 0.2},
      "camera": {"focus": ["hero", "ash"], "framing": "close", "fill": 1.1, "angle": "front", "move": "push_in", "amount": 0.4},
      "props": [
        {"id": "hero", "type": "magma_chamber", "at": [0, 0, 0], "size": 2.0,
         "fill": {"dial": "fill", "from": [0, 1], "to": [0, 1]},
         "heat": {"dial": "heat", "from": [0, 1], "to": [0, 1]},
         "eruption": {"dial": "erupt", "from": [0, 1], "to": [0, 1]}},
        {"id": "ash", "type": "cloud", "style": "storm", "at": [0.7, 2.4, -0.6], "size": 1.1}
      ],
      "actions": [
        {"at": "spray high", "do": "scale", "prop": "ash", "to": 1.4, "over": 1.5}
      ]
    },
    {
      "id": "fade",
      "start": "Once the",
      "continue": true,
      "camera": {"focus": ["hero", "ash"], "framing": "close", "fill": 1.1, "angle": "front", "move": "pull_out", "amount": 0.4, "glide": 1.0},
      "actions": [
        {"at": "eruption slowly", "do": "scale", "prop": "ash", "to": 0.7, "over": 1.5}
      ]
    },
    {
      "id": "island",
      "start": "These eruptions",
      "continue": true,
      "camera": {"focus": ["hero", "isl"], "framing": "close", "fill": 1.1, "angle": "front", "move": "push_in", "amount": 0.4, "glide": 1.0},
      "props": [
        {"id": "isl", "type": "island", "at": [1.3, 0, 0.9], "size": 0.7}
      ],
      "actions": [
        {"at": "These eruptions", "do": "appear", "prop": "isl", "style": "grow", "over": 1.0},
        {"at": "build new", "do": "scale", "prop": "isl", "to": 1.4, "over": 2.5}
      ]
    },
    {
      "id": "close",
      "start": "Which surprises",
      "continue": true,
      "camera": {"focus": ["hero", "th", "isl"], "framing": "close", "fill": 1.1, "angle": "front", "move": "push_in", "amount": 0.4, "glide": 1.0},
      "props": [
        {"id": "th", "type": "thermometer", "at": [-1.2, 0, 0.8], "size": 1.1,
         "level": {"dial": "heat", "from": [0, 1], "to": [0.15, 1.0]}},
        {"id": "gas2", "type": "particles", "at": [0, 0.32, 0], "size": 0.45, "shape": "sphere", "count": 30, "color": "#ffe9a0", "dot": 0.04, "spread": 1.0, "speed": 0.8}
      ],
      "actions": [
        {"at": "Which surprises", "do": "appear", "prop": "th", "style": "grow", "over": 0.6},
        {"at": "Which surprises", "do": "appear", "prop": "gas2", "style": "fade", "over": 0.6},
        {"at": "the heat", "do": "pulse", "prop": "th", "strength": 0.2},
        {"at": "the gas", "do": "pulse", "prop": "gas2", "strength": 0.2}
      ]
    }
  ]
}
