{
  "format": 1,
  "title": "How does a battery actually light a bulb?",
  "voice": {"audio": "voice.mp3", "words": "words.json"},
  "dials": {
    "charge": {"start": 0.05, "keys": [
      {"at": "How does", "to": 0.55, "over": 1.2},
      {"at": "Here is", "to": 1, "over": 1.0}]},
    "out": {"start": 0, "keys": [
      {"at": "pushes electrons", "to": 0.35, "over": 0.8},
      {"at": "flow out", "to": 0.8, "over": 0.9},
      {"at": "already full", "to": 0.9, "over": 0.6},
      {"at": "whole line", "to": 1, "over": 0.8},
      {"at": "drifts slowly", "to": 0.2, "over": 1.0}]},
    "back": {"start": 0, "keys": [
      {"at": "pushes electrons", "to": 0.35, "over": 0.8},
      {"at": "back along", "to": 0.8, "over": 0.9},
      {"at": "already full", "to": 0.9, "over": 0.6},
      {"at": "whole line", "to": 1, "over": 0.8},
      {"at": "drifts slowly", "to": 0.2, "over": 1.0}]},
    "lit": {"start": 0, "keys": [
      {"at": "travel through", "to": 1, "over": 1.0}]},
    "pile": {"start": 1, "keys": [
      {"at": "chemical reaction", "to": 0.15, "over": 1.4},
      {"at": "shove away", "to": 1.6, "over": 0.8}]},
    "heat": {"start": 0, "keys": [
      {"at": "Now zoom", "to": 0.1, "over": 1.0},
      {"at": "Its thin", "to": 0.25, "over": 1.0},
      {"at": "Electrons squeeze", "to": 0.4, "over": 1.0},
      {"at": "Every crash", "to": 0.5, "over": 0.6},
      {"at": "jiggle faster", "to": 0.6, "over": 0.6},
      {"at": "heats up", "to": 1, "over": 2.6}]},
    "white": {"start": 0, "keys": [
      {"at": "At that", "to": 0.3, "over": 1.0},
      {"at": "bright white", "to": 1, "over": 1.2}]},
    "squeeze": {"start": 0, "keys": [
      {"at": "Think of", "to": 0.3, "over": 0.6},
      {"at": "narrow gate", "to": 1, "over": 1.2},
      {"at": "jostling", "to": 0.85, "over": 0.8}]},
    "circ": {"start": 1, "keys": [
      {"at": "anywhere", "to": 0, "over": 0.9},
      {"at": "That is why", "to": 1, "over": 0.8},
      {"at": "If you broke", "to": 0, "over": 0.7}]}
  },
  "shots": [
    {
      "id": "open",
      "env": {"type": "lab", "color": {"dial": "charge", "colors": ["#0b1118", "#13222e"]}},
      "camera": {"focus": ["bat", "bulb0"], "framing": "close", "fill": 1.1, "angle": "front", "move": "drift", "amount": 0.3},
      "props": [
        {"id": "bat", "type": "battery", "at": [-0.25, 0, 0], "size": 1.4, "charge": {"dial": "charge", "to": [0, 1]}},
        {"id": "bulb0", "type": "lightbulb", "at": [0.95, 0, -0.5], "size": 0.6}
      ],
      "actions": []
    },
    {
      "id": "loop",
      "start": "The battery pushes",
      "env": {"type": "lab", "color": {"dial": "lit", "colors": ["#0b1118", "#1c2f40"]}},
      "camera": {"focus": ["bat2", "bulb1"], "framing": "medium", "angle": "front", "move": "drift", "amount": 0.3},
      "props": [
        {"id": "bat2", "type": "battery", "at": [-0.9, 0, 0], "size": 1.2, "charge": {"dial": "charge", "to": [0, 1]}},
        {"id": "bulb1", "type": "lightbulb", "at": [0.9, 0, 0], "size": 1.0, "on": {"dial": "lit", "to": [0, 1]}, "glow": {"dial": "lit", "to": [0, 0.5]}},
        {"id": "wout", "type": "wire", "from": [-0.9, 0.95, 0], "to": [0.9, 1.0, 0], "lift": 0.7, "color": "#6fd8ff", "current": {"dial": "out", "to": [0, 1]}},
        {"id": "wback", "type": "wire", "from": [0.9, 0.04, 0], "to": [-0.9, 0.04, 0], "lift": 0, "color": "#6fd8ff", "current": {"dial": "back", "to": [0, 1]}}
      ],
      "actions": []
    },
    {
      "id": "pile",
      "start": "Inside the battery",
      "continue": true,
      "camera": {"focus": ["bat2"], "framing": "close", "angle": "front", "move": "push_in", "amount": 0.4, "glide": 1.0},
      "props": [
        {"id": "dots1", "type": "particles", "at": [-0.9, 0.3, 0], "size": 0.5, "shape": "sphere", "count": 30, "look": "dots", "dot": 0.07, "speed": 0.4, "spread": {"dial": "pile", "from": [0, 1.6], "to": [0, 1.6]}, "color": {"dial": "pile", "colors": ["#4aa8ff", "#7fe0ff"]}}
      ],
      "actions": [
        {"at": "Inside the", "do": "appear", "prop": "dots1", "style": "fade"},
        {"at": "onto the negative", "do": "glow", "prop": "dots1", "to": 1.0, "over": 0.6}
      ]
    },
    {
      "id": "out",
      "start": "Those crowded",
      "continue": true,
      "camera": {"focus": ["bat2", "bulb1"], "framing": "medium", "angle": "front", "move": "pan", "amount": 0.3, "glide": 1.0},
      "actions": []
    },
    {
      "id": "back",
      "start": "They travel",
      "continue": true,
      "camera": {"focus": ["bat2", "bulb1"], "framing": "medium", "angle": "high", "move": "drift", "amount": 0.3, "glide": 1.0},
      "actions": [
        {"at": "They travel", "do": "disappear", "prop": "dots1", "style": "fade"}
      ]
    },
    {
      "id": "whole",
      "start": "The wire was",
      "continue": true,
      "camera": {"focus": ["bat2", "bulb1"], "framing": "wide", "angle": "front", "move": "still", "amount": 0.2, "glide": 1.0},
      "actions": []
    },
    {
      "id": "drift",
      "start": "Each electron",
      "continue": true,
      "camera": {"focus": ["bat2", "bulb1"], "framing": "medium", "angle": "front", "move": "push_in", "amount": 0.5, "glide": 1.0},
      "actions": [
        {"at": "a fraction", "do": "glow", "prop": "bat2", "to": 0.3, "over": 0.8}
      ]
    },
    {
      "id": "bulb-in",
      "start": "Now zoom",
      "transition": "dive",
      "env": {"type": "lab", "color": {"dial": "heat", "colors": ["#0b1118", "#2b1a12", "#3d1f10"]}},
      "camera": {"focus": ["bulbbig"], "framing": "close", "fill": 1.1, "angle": "front", "move": "push_in", "amount": 0.4},
      "props": [
        {"id": "bulbbig", "type": "lightbulb", "at": [0, 0, 0], "size": 1.6, "on": {"dial": "heat", "from": [0, 1], "to": [0.1, 1]}, "glow": {"dial": "white", "to": [0, 1.0]}},
        {"id": "elec", "type": "particles", "at": [0, 1.04, 0], "size": 0.7, "shape": "sphere", "count": 24, "look": "dots", "dot": 0.07, "color": "#6fd8ff", "speed": 0.3, "spread": 0.8}
      ],
      "actions": [
        {"at": "Now zoom", "do": "appear", "prop": "elec", "style": "fade"},
        {"at": "thin tungsten", "do": "label", "prop": "bulbbig", "text": "FILAMENT", "side": "right"}
      ]
    },
    {
      "id": "squeeze",
      "start": "Electrons squeeze",
      "continue": true,
      "camera": {"focus": ["bulbbig"], "framing": "close", "fill": 1.3, "angle": "front", "move": "push_in", "amount": 0.4, "glide": 1.0},
      "props": [
        {"id": "atoms", "type": "particles", "at": [0, 1.04, 0], "size": 0.5, "shape": "sphere", "count": 14, "look": "balls", "dot": 0.06, "speed": 0.3, "spread": 0.6, "color": {"dial": "heat", "colors": ["#ff9a3c", "#ff2a1a"]}, "glow": {"dial": "white", "to": [0, 1.2]}}
      ],
      "actions": [
        {"at": "squeeze through", "do": "set", "prop": "elec", "param": "speed", "to": 1.5, "over": 0.8},
        {"at": "crash into", "do": "appear", "prop": "atoms", "style": "grow"},
        {"at": "jiggle faster", "do": "set", "prop": "atoms", "param": "speed", "to": 2.5, "over": 0.6}
      ]
    },
    {
      "id": "hot",
      "start": "The filament heats",
      "continue": true,
      "camera": {"focus": ["bulbbig", "thermo"], "framing": "medium", "angle": "front", "move": "drift", "amount": 0.3, "glide": 1.0},
      "props": [
        {"id": "thermo", "type": "thermometer", "at": [1.3, 0, 0], "size": 1.2, "level": {"dial": "heat", "from": [0.55, 1], "to": [0.05, 1]}}
      ],
      "actions": [
        {"at": "The filament", "do": "appear", "prop": "thermo", "style": "grow"},
        {"at": "about two thousand", "do": "text", "text": "2000 °C", "style": "number"}
      ]
    },
    {
      "id": "crowd",
      "start": "Think of",
      "env": {"type": "studio", "color": "#23324a"},
      "camera": {"focus": ["crowd", "wall-l", "wall-r"], "framing": "medium", "angle": "high", "move": "push_in", "amount": 0.4},
      "props": [
        {"id": "crowd", "type": "crowd", "at": [0, 0, 0.8], "size": {"dial": "squeeze", "to": [1.4, 0.9]}, "count": 120, "color": "#ffb84d"},
        {"id": "wall-l", "type": "box", "at": {"dial": "squeeze", "to": ["far-left", "left"]}, "size": 1, "width": 0.5, "height": 0.8, "depth": 0.3, "color": "#8a93a6"},
        {"id": "wall-r", "type": "box", "at": {"dial": "squeeze", "to": ["far-right", "right"]}, "size": 1, "width": 0.5, "height": 0.8, "depth": 0.3, "color": "#8a93a6"}
      ],
      "actions": [
        {"at": "squeezing", "do": "move", "prop": "crowd", "to": [0, 0, -0.6], "until": "jostling"}
      ]
    },
    {
      "id": "cut",
      "start": "Cut the loop",
      "env": {"type": "lab", "color": {"dial": "circ", "colors": ["#0b1118", "#1c2f40"]}},
      "camera": {"focus": ["bat3", "bulb3"], "framing": "medium", "angle": "front", "move": "drift", "amount": 0.3},
      "props": [
        {"id": "bat3", "type": "battery", "at": [-0.9, 0, 0], "size": 1.2, "charge": 1},
        {"id": "bulb3", "type": "lightbulb", "at": [0.9, 0, 0], "size": 1.0, "on": {"dial": "circ", "to": [0, 1]}, "glow": {"dial": "circ", "to": [0, 0.5]}},
        {"id": "wout3", "type": "wire", "from": [-0.9, 0.95, 0], "to": [0.9, 1.0, 0], "lift": 0.7, "color": "#6fd8ff", "current": {"dial": "circ", "to": [0, 1]}},
        {"id": "wbacka", "type": "wire", "from": [0.9, 0.04, 0], "to": [0.25, 0.04, 0], "lift": 0, "color": "#6fd8ff", "current": {"dial": "circ", "to": [0, 1]}},
        {"id": "bridge", "type": "wire", "from": [0.25, 0.04, 0], "to": [-0.25, 0.04, 0], "lift": 0, "color": "#6fd8ff", "current": {"dial": "circ", "to": [0, 1]}},
        {"id": "wbackb", "type": "wire", "from": [-0.25, 0.04, 0], "to": [-0.9, 0.04, 0], "lift": 0, "color": "#6fd8ff", "current": {"dial": "circ", "to": [0, 1]}}
      ],
      "actions": [
        {"at": "Cut the loop", "do": "disappear", "prop": "bridge", "style": "shrink"},
        {"at": "That is why", "do": "appear", "prop": "bridge", "style": "grow"}
      ]
    },
    {
      "id": "end",
      "start": "If you broke",
      "continue": true,
      "camera": {"focus": ["bat3", "bulb3"], "framing": "medium", "angle": "front", "move": "push_in", "amount": 0.5, "glide": 1.0},
      "props": [
        {"id": "pile2", "type": "particles", "at": [0, 0.25, 0.1], "size": 1.0, "shape": "sphere", "count": 30, "look": "dots", "dot": 0.08, "color": "#7fe0ff", "spread": 1.6, "speed": 0.5, "glow": 0.3}
      ],
      "actions": [
        {"at": "If you broke", "do": "disappear", "prop": "bridge", "style": "shrink"},
        {"at": "where would", "do": "appear", "prop": "pile2", "style": "fade"},
        {"at": "Comment your", "do": "set", "prop": "pile2", "param": "spread", "to": 0.4, "until": {"phrase": "below", "edge": "end"}},
        {"at": "Comment your", "do": "glow", "prop": "pile2", "to": 1.5, "until": {"phrase": "below", "edge": "end"}}
      ]
    }
  ]
}
