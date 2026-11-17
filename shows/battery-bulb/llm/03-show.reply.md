{
  "format": 1,
  "title": "How does a battery really light a bulb?",
  "voice": {"audio": "voice.mp3", "words": "words.json"},
  "dials": {
    "chem": {"start": 0.9, "keys": [
      {"at": "pour", "to": 0.05, "until": {"phrase": "runs out", "edge": "end"}},
      {"at": "Not quite", "to": 0.9, "over": 0.35}
    ]},
    "push": {"start": 0, "keys": [
      {"at": "pushes", "to": 0.5, "over": 1.2},
      {"at": "start to", "to": 1, "over": 0.8},
      {"at": "creep", "to": 0.2, "over": 1.0},
      {"at": "speed of", "to": 1, "over": 0.8},
      {"at": "flow on", "to": 0.8, "over": 0.8},
      {"at": "carrying less", "to": 0.3, "over": 1.2}
    ]},
    "heat": {"start": 0, "keys": [
      {"at": "so the bulb", "to": 0.55, "over": 0.4},
      {"at": "heats up", "to": 0.8, "over": 2.0},
      {"at": "Hot metal", "to": 1, "over": 1.2}
    ]},
    "chain": {"start": 0, "keys": [
      {"at": "bicycle", "to": 0.2, "over": 0.8},
      {"at": "every link", "to": 0.5, "over": 0.8},
      {"at": "delivered", "to": 1, "over": 1.0},
      {"at": "around you", "to": 0.3, "over": 1.0},
      {"at": "Comment below", "to": 1, "over": 0.6}
    ]}
  },
  "shots": [
    {
      "id": "hook",
      "env": {"type": "studio", "floor": false, "color": {"dial": "chem", "colors": ["#3a1414", "#14303a"]}, "haze": 0},
      "camera": {"focus": ["bat", "lamp"], "framing": "close", "fill": 1.15, "angle": "front", "move": "drift", "amount": 0.3},
      "props": [
        {"id": "bat", "type": "battery", "at": [-0.45, -0.1, 0], "size": 1.5, "charge": {"dial": "chem", "to": [0, 1]}},
        {"id": "lamp", "type": "lightbulb", "at": [0.65, 0.35, 0], "size": 0.8, "on": {"dial": "chem", "to": [0, 1]}, "glow": {"dial": "chem", "to": [0, 1]}}
      ],
      "actions": [
        {"at": "what really", "do": "pulse", "prop": "bat", "strength": 0.3}
      ]
    },
    {
      "id": "pushes",
      "start": "Inside the battery",
      "transition": "dip",
      "env": {"type": "studio", "floor": false, "color": {"dial": "heat", "colors": ["#14222e", "#4a2e0e"]}, "haze": 0},
      "camera": {"focus": ["elec", "cell", "bulb"], "framing": "medium", "fill": 1.0, "angle": "high", "move": "drift", "amount": 0.3},
      "props": [
        {"id": "elec", "type": "particles", "shape": "ring", "count": 60, "look": "balls", "dot": 0.1, "at": [0, 0, 0], "size": 2.3, "color": {"dial": "push", "colors": ["#4aa8ff", "#ffe14d"]}, "speed": {"dial": "push", "to": [0.2, 3]}, "hidden": true},
        {"id": "cell", "type": "battery", "at": [-1.15, 0, 0], "size": 0.9, "charge": 0.8},
        {"id": "bulb", "type": "lightbulb", "at": [1.15, 0, 0], "size": 0.9, "on": {"dial": "heat", "to": [0, 1]}, "glow": {"dial": "heat", "to": [0, 1.2]}}
      ],
      "actions": [
        {"at": "Inside the", "do": "appear", "prop": "elec", "style": "grow", "over": 0.8},
        {"at": "the battery", "do": "label", "prop": "cell", "text": "BATTERY", "until": "a chemical"},
        {"at": "chemical reaction", "do": "pulse", "prop": "cell", "strength": 0.3},
        {"at": "electrons", "do": "label", "prop": "elec", "text": "ELECTRONS", "until": {"phrase": "end", "edge": "end"}}
      ]
    },
    {
      "id": "connect",
      "start": "Connect a wire",
      "continue": true,
      "camera": {"focus": ["elec", "cell", "bulb"], "framing": "medium", "fill": 1.0, "angle": "high", "move": "push_in", "amount": 0.3, "glide": 1.0},
      "actions": [
        {"at": "Connect a", "do": "set", "prop": "elec", "param": "spread", "to": 0.6, "over": 1.2},
        {"at": "already sitting", "do": "pulse", "prop": "elec", "strength": 0.2}
      ]
    },
    {
      "id": "creep",
      "start": "They creep",
      "continue": true,
      "camera": {"focus": ["elec", "cell", "bulb"], "framing": "medium", "fill": 1.0, "angle": "high", "move": "drift", "amount": 0.3, "glide": 1.0},
      "actions": [
        {"at": "often less", "do": "set", "prop": "elec", "param": "spread", "to": 1.2, "over": 1.0},
        {"at": "millimetre", "do": "pulse", "prop": "elec", "strength": 0.15}
      ]
    },
    {
      "id": "light-speed",
      "start": "But the push",
      "continue": true,
      "camera": {"focus": ["elec", "cell", "bulb"], "framing": "medium", "fill": 1.0, "angle": "high", "move": "drift", "amount": 0.3, "glide": 1.0},
      "actions": [
        {"at": "travels", "do": "pulse", "prop": "cell", "strength": 0.35},
        {"at": "around the loop", "do": "pulse", "prop": "elec", "strength": 0.4},
        {"at": "responds", "do": "pulse", "prop": "bulb", "strength": 0.3}
      ]
    },
    {
      "id": "squeeze",
      "start": "In the thin",
      "continue": true,
      "camera": {"focus": ["elec", "cell", "bulb"], "framing": "medium", "fill": 1.0, "angle": "high", "move": "push_in", "amount": 0.3, "glide": 1.0},
      "actions": [
        {"at": "In the thin", "do": "set", "prop": "elec", "param": "spread", "to": 0.35, "until": {"phrase": "narrower", "edge": "end"}},
        {"at": "thin tungsten", "do": "label", "prop": "bulb", "text": "FILAMENT", "until": {"phrase": "path", "edge": "end"}}
      ]
    },
    {
      "id": "bump",
      "start": "They bump",
      "continue": true,
      "camera": {"focus": ["elec", "cell", "bulb"], "framing": "medium", "fill": 1.0, "angle": "high", "move": "drift", "amount": 0.3, "glide": 1.0},
      "actions": [
        {"at": "They bump", "do": "shake", "prop": "elec", "strength": 0.35, "for": 3.0},
        {"at": "every bump", "do": "shake", "prop": "bulb", "strength": 0.25, "for": 1.5},
        {"at": "shakes the", "do": "set", "prop": "elec", "param": "spread", "to": 1.0, "over": 0.8}
      ]
    },
    {
      "id": "glow",
      "start": "The filament heats",
      "continue": true,
      "camera": {"focus": ["bulb", "elec"], "framing": "medium", "fill": 1.05, "angle": "high", "move": "push_in", "amount": 0.4, "glide": 1.2},
      "actions": [
        {"at": "well over", "do": "pulse", "prop": "bulb", "strength": 0.3},
        {"at": "well over", "do": "count", "from": 0, "to": 2000, "unit": " DEGREES C", "until": {"phrase": "Celsius", "edge": "end"}},
        {"at": "bulb lights", "do": "pulse", "prop": "bulb", "strength": 0.4}
      ]
    },
    {
      "id": "return",
      "start": "The electrons are",
      "continue": true,
      "camera": {"focus": ["elec", "cell", "bulb"], "framing": "medium", "fill": 1.0, "angle": "high", "move": "pull_out", "amount": 0.4, "glide": 1.2},
      "actions": [
        {"at": "The electrons are", "do": "set", "prop": "elec", "param": "spread", "to": 1.0, "over": 0.8},
        {"at": "not used", "do": "pulse", "prop": "elec", "strength": 0.3},
        {"at": "the battery", "do": "pulse", "prop": "cell", "strength": 0.35}
      ]
    },
    {
      "id": "chain",
      "start": "It is like",
      "transition": "dip",
      "env": {"type": "studio", "floor": false, "color": {"dial": "chain", "colors": ["#16222c", "#3a2a10"]}, "haze": 0},
      "camera": {"focus": ["gears"], "framing": "close", "fill": 1.2, "angle": "front", "move": "push_in", "amount": 0.3},
      "props": [
        {"id": "gears", "type": "gear", "count": 3, "at": [0, 0, 0], "size": 1.9, "color": {"dial": "chain", "colors": ["#8fa3b5", "#ffb02e"]}, "glow": {"dial": "chain", "to": [0, 0.8]}, "hidden": true}
      ],
      "actions": [
        {"at": "It is like", "do": "appear", "prop": "gears", "style": "grow", "over": 0.8},
        {"at": "the energy", "do": "pulse", "prop": "gears", "strength": 0.3}
      ]
    },
    {
      "id": "loop-close",
      "start": "So what else",
      "continue": true,
      "camera": {"focus": ["gears"], "framing": "close", "fill": 1.25, "angle": "front", "move": "pull_out", "amount": 0.3, "glide": 1.0},
      "actions": [
        {"at": "So what else", "do": "pulse", "prop": "gears", "strength": 0.3},
        {"at": "Comment below", "do": "pulse", "prop": "gears", "strength": 0.35}
      ]
    }
  ]
}
