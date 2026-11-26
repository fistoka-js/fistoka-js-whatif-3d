{
  "format": 1,
  "title": "What If Earth Suddenly Stopped Spinning?",
  "voice": {"audio": "voice.mp3", "words": "words.json"},
  "dials": {
    "storm": {"start": 0.5, "keys": [
      {"at": "suddenly", "to": 0.1, "over": 0.9},
      {"at": "imagine", "to": 0.3, "over": 1.5},
      {"at": "Here is", "to": 0.8, "over": 1.2},
      {"at": "the equator", "to": 0.95, "over": 1.2},
      {"at": "keeps going", "to": 1, "over": 1.0},
      {"at": "equator bulge", "to": 0.5, "over": 1.2},
      {"at": "new seas", "to": 0.2, "over": 1.5}
    ]},
    "heat": {"start": 0.5, "keys": [
      {"at": "takes a", "to": 0.6, "over": 1.5},
      {"at": "So one", "to": 1, "over": 1.8},
      {"at": "The other", "to": 0.05, "over": 2.0},
      {"at": "holding", "to": 0.2, "over": 1.5},
      {"at": "over a", "to": 1, "over": 1.8},
      {"at": "Would you", "to": 0.5, "over": 0.8},
      {"at": "sunny", "to": 1, "over": 1.0},
      {"at": "or the dark", "to": 0.05, "over": 1.0}
    ]},
    "shield": {"start": 1, "keys": [
      {"at": "would probably", "to": 0.15, "over": 1.6},
      {"at": "gentle days", "to": 1, "over": 1.2}
    ]}
  },
  "shots": [
    {
      "id": "hook",
      "env": {"type": "studio", "floor": false, "haze": 0, "color": {"dial": "storm", "colors": ["#12306a", "#2a1a4a", "#5a1020"]}},
      "camera": {"focus": ["earth"], "framing": "close", "fill": 1.2, "angle": "front", "move": "push_in", "amount": 0.3},
      "props": [
        {"id": "earth", "type": "planet", "look": "earth", "turn": 0, "at": [0, 0, 0], "size": 1.5, "atmosphere": {"dial": "storm", "to": [0.1, 1.5]}}
      ],
      "actions": [
        {"at": "What if", "do": "spin", "prop": "earth", "speed": 0.15},
        {"at": "stopped", "do": "spin", "prop": "earth", "speed": 0},
        {"at": "stopped", "do": "pulse", "prop": "earth", "strength": 0.1}
      ]
    },
    {
      "id": "equator",
      "start": "Right now",
      "transition": "dip",
      "env": {"type": "studio", "floor": false, "haze": 0, "color": {"dial": "storm", "colors": ["#12306a", "#2a1a4a", "#5a1020"]}},
      "camera": {"focus": ["earth"], "framing": "close", "fill": 1.15, "angle": "front", "move": "drift", "amount": 0.3},
      "props": [
        {"id": "earth", "type": "planet", "look": "earth", "turn": 0, "at": [0, 0, 0], "size": 1.5, "atmosphere": {"dial": "storm", "to": [0.1, 1.5]}},
        {"id": "speed", "type": "arrow", "from": [-0.4, 0, 0.9], "to": [1.0, 0, 0.9], "color": "#ffe14d", "thickness": 0.1, "length": 0}
      ],
      "actions": [
        {"at": "Right now", "do": "spin", "prop": "earth", "speed": 0.12},
        {"at": "moves at", "do": "set", "prop": "speed", "param": "length", "to": 1, "over": 1.0},
        {"at": "about one", "do": "count", "from": 0, "to": 1000, "unit": "mph", "pos": "top", "until": {"phrase": "hour", "edge": "end"}}
      ]
    },
    {
      "id": "stop-air",
      "start": "Stop the",
      "continue": true,
      "camera": {"focus": ["earth"], "framing": "close", "fill": 1.1, "angle": "front", "move": "push_in", "amount": 0.3, "glide": 1.0},
      "props": [
        {"id": "air", "type": "particles", "shape": "stream", "count": 120, "look": "dots", "dot": 0.08, "color": "#cfe8ff", "size": 1.6, "at": [0, 0, 0.3], "speed": 0.3, "spread": 1}
      ],
      "actions": [
        {"at": "Stop the", "do": "spin", "prop": "earth", "speed": 0},
        {"at": "Stop the", "do": "shake", "strength": 0.5, "for": 0.6},
        {"at": "the air", "do": "appear", "prop": "air", "style": "fade", "over": 0.4},
        {"at": "keeps going", "do": "set", "prop": "air", "param": "speed", "to": 2.0, "over": 0.8}
      ]
    },
    {
      "id": "oceans",
      "start": "The oceans",
      "continue": true,
      "camera": {"focus": ["earth"], "framing": "medium", "fill": 0.95, "angle": "three-quarter", "move": "drift", "amount": 0.3, "glide": 1.2},
      "props": [
        {"id": "sea", "type": "water_drop", "color": "#2f8fe8", "at": [0.7, 0, 0.4], "size": 0.6}
      ],
      "actions": [
        {"at": "The oceans", "do": "appear", "prop": "sea", "style": "fade", "over": 0.4},
        {"at": "surge toward", "do": "move", "prop": "sea", "to": [0.05, 1.05, 0.3], "until": {"phrase": "poles", "edge": "end"}}
      ]
    },
    {
      "id": "dry-land",
      "start": "Dry land",
      "continue": true,
      "camera": {"focus": ["earth"], "framing": "medium", "fill": 0.95, "angle": "front", "move": "pull_out", "amount": 0.3, "glide": 1.2},
      "props": [
        {"id": "land", "type": "rock", "color": "#8a6a4a", "count": 1, "at": [0, -0.15, 0.95], "size": 0.6}
      ],
      "actions": [
        {"at": "Dry land", "do": "appear", "prop": "land", "style": "grow", "over": 1.2},
        {"at": "new seas", "do": "scale", "prop": "sea", "to": 1.6, "over": 1.0}
      ]
    },
    {
      "id": "sun-year",
      "start": "Now the Sun",
      "transition": "dip",
      "env": {"type": "studio", "floor": false, "haze": 0, "color": {"dial": "heat", "colors": ["#0c1a40", "#2a1a3a", "#5a1c0a"]}},
      "camera": {"framing": "medium", "fill": 1.0, "angle": "front", "move": "drift", "amount": 0.3},
      "props": [
        {"id": "sun", "type": "sun", "at": [-0.5, 1.3, 0], "size": 0.8, "brightness": {"dial": "heat", "to": [0.3, 1.8]}},
        {"id": "earth", "type": "planet", "look": "earth", "turn": 0, "at": [0, 0, 0], "size": 1.4, "atmosphere": {"dial": "heat", "to": [0.2, 1.2]}},
        {"id": "thermo", "type": "thermometer", "at": [1.0, 0.1, 0], "size": 0.9, "level": {"dial": "heat", "to": [0, 1]}}
      ]
    },
    {
      "id": "bakes",
      "start": "So one",
      "continue": true,
      "camera": {"framing": "medium", "fill": 1.05, "angle": "front", "move": "push_in", "amount": 0.3, "glide": 1.0},
      "actions": [
        {"at": "about six", "do": "count", "from": 0, "to": 6, "unit": "months", "pos": "top", "until": {"phrase": "months", "edge": "end"}}
      ]
    },
    {
      "id": "freezes",
      "start": "The other",
      "continue": true,
      "camera": {"framing": "medium", "fill": 1.05, "angle": "high", "move": "drift", "amount": 0.3, "glide": 1.0}
    },
    {
      "id": "marshmallow",
      "start": "It is like",
      "transition": "dip",
      "env": {"type": "studio", "floor": false, "haze": 0, "color": {"dial": "heat", "colors": ["#0c1a40", "#2a1a3a", "#5a1c0a"]}},
      "camera": {"focus": ["mallow", "fire"], "framing": "close", "fill": 1.1, "angle": "front", "move": "push_in", "amount": 0.3},
      "props": [
        {"id": "mallow", "type": "ball", "finish": "matte", "at": [0, 0.9, 0], "size": 0.6, "color": {"dial": "heat", "colors": ["#f4efe6", "#e0b878", "#3a2414"]}},
        {"id": "fire", "type": "fire", "at": [0, -0.35, 0], "size": 1.2}
      ],
      "actions": [
        {"at": "It is like", "do": "appear", "prop": "fire", "style": "grow", "over": 0.8},
        {"at": "a fire", "do": "set", "prop": "fire", "param": "size", "to": 1.6, "over": 0.8}
      ]
    },
    {
      "id": "core",
      "start": "The spin",
      "transition": "dip",
      "env": {"type": "space", "nebula": "none"},
      "camera": {"focus": ["core", "spinner"], "framing": "medium", "fill": 1.0, "angle": "front", "move": "drift", "amount": 0.3},
      "props": [
        {"id": "core", "type": "particles", "shape": "sphere", "count": 260, "look": "dots", "dot": 0.07, "color": "#ff9a2e", "color2": "#ffd24a", "mix": 0.5, "size": 1.4, "at": [0, -0.2, 0], "speed": 0.3, "spread": 1},
        {"id": "spinner", "type": "planet", "look": "earth", "turn": 0, "at": [0, 1.45, 0], "size": 0.7}
      ],
      "actions": [
        {"at": "The spin", "do": "spin", "prop": "spinner", "speed": 0.4},
        {"at": "stir", "do": "set", "prop": "core", "param": "speed", "to": 2.0, "until": {"phrase": "core", "edge": "end"}},
        {"at": "liquid metal", "do": "set", "prop": "core", "param": "spread", "to": 1.5, "over": 0.8}
      ]
    },
    {
      "id": "shield",
      "start": "That stirring",
      "continue": true,
      "camera": {"framing": "medium", "fill": 1.0, "angle": "front", "move": "drift", "amount": 0.3, "glide": 1.0},
      "props": [
        {"id": "dome", "type": "shield_dome", "shape": "bubble", "at": [0, -0.2, 0], "size": 2.0, "strength": {"dial": "shield", "to": [0.1, 1]}, "color": {"dial": "shield", "colors": ["#d04030", "#46c8ff"]}},
        {"id": "ray-a", "type": "beam", "from": [-1.0, 1.9, 0.2], "to": [-0.3, 0.1, 0.2], "color": "#ffe14d", "width": 0.08, "progress": 0},
        {"id": "ray-b", "type": "beam", "from": [1.0, 1.9, 0.2], "to": [0.4, 0.1, 0.2], "color": "#ffe14d", "width": 0.08, "progress": 0}
      ],
      "actions": [
        {"at": "That stirring", "do": "appear", "prop": "dome", "style": "fade", "over": 0.6},
        {"at": "Then more", "do": "appear", "prop": "ray-a", "style": "fade", "over": 0.3},
        {"at": "Then more", "do": "set", "prop": "ray-a", "param": "progress", "to": 1, "over": 0.8},
        {"at": "reach the", "do": "appear", "prop": "ray-b", "style": "fade", "over": 0.3},
        {"at": "reach the", "do": "set", "prop": "ray-b", "param": "progress", "to": 1, "over": 0.8}
      ]
    },
    {
      "id": "overhead",
      "start": "Our daily",
      "continue": true,
      "camera": {"framing": "medium", "fill": 1.0, "angle": "front", "move": "push_in", "amount": 0.3, "glide": 1.0},
      "actions": [
        {"at": "Our daily", "do": "disappear", "prop": "ray-a", "style": "fade", "over": 0.4},
        {"at": "Our daily", "do": "disappear", "prop": "ray-b", "style": "fade", "over": 0.4},
        {"at": "daily spin", "do": "scale", "prop": "spinner", "to": 1.35, "over": 0.8},
        {"at": "a shield", "do": "glow", "prop": "dome", "to": 1.2, "over": 0.6}
      ]
    },
    {
      "id": "close",
      "start": "Would you",
      "transition": "dip",
      "env": {"type": "studio", "floor": false, "haze": 0, "color": {"dial": "heat", "colors": ["#0c1a40", "#2a1a3a", "#5a1c0a"]}},
      "camera": {"framing": "medium", "fill": 1.0, "angle": "front", "move": "pull_out", "amount": 0.3},
      "props": [
        {"id": "sun", "type": "sun", "at": [-0.7, 1.2, 0], "size": 0.6, "brightness": {"dial": "heat", "to": [0.3, 1.8]}},
        {"id": "earth", "type": "planet", "look": "earth", "turn": 0, "at": [0, 0, 0], "size": 1.4, "atmosphere": {"dial": "heat", "to": [0.2, 1.2]}}
      ]
    }
  ]
}
