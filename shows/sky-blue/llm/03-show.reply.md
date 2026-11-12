{
  "format": 1,
  "title": "Why is the sky blue? It's not the ocean",
  "voice": {"audio": "voice.mp3", "words": "words.json"},
  "shots": [
    {
      "id": "hook",
      "env": {"type": "sky", "time": "day", "ground": "ocean", "clouds": 0.4},
      "camera": {"move": "push_in", "angle": "low", "framing": "medium", "amount": 0.5},
      "props": [
        {"id": "boat", "type": "ship", "style": "sail", "color": "red", "at": "center", "size": 1.4}
      ],
      "actions": [
        {"at": "the sky blue", "do": "icon", "prop": "boat", "name": "question", "until": "nothing to do"},
        {"at": "nothing to do", "do": "pulse", "prop": "boat", "strength": 0.15},
        {"at": "the ocean", "do": "icon", "prop": "boat", "name": "x"}
      ]
    },
    {
      "id": "white-light",
      "start": "Sunlight looks",
      "env": {"type": "space", "nebula": "none", "stars": 1},
      "camera": {"move": "pull_out", "angle": "front", "framing": "medium", "amount": 0.4},
      "props": [
        {"id": "sun", "type": "sun", "color": "white", "rays": true, "at": [-0.3, 0, 0], "size": 1.4},
        {"id": "red-ray", "type": "beam", "from": "sun", "to": [1.3, 0.6, 0], "color": "red", "width": 0.1},
        {"id": "blue-ray", "type": "beam", "from": "sun", "to": [1.3, -0.6, 0], "color": "#4da6ff", "width": 0.1}
      ],
      "actions": [
        {"at": "looks white", "do": "label", "prop": "sun", "text": "WHITE LIGHT", "side": "left", "until": "mix of"},
        {"at": "every colour", "do": "appear", "prop": "red-ray", "style": "fade"},
        {"at": "every colour", "do": "appear", "prop": "blue-ray", "style": "fade", "offset": 0}
      ]
    },
    {
      "id": "waves",
      "start": "Each colour",
      "env": {"type": "studio", "color": "indigo", "floor": false},
      "camera": {"move": "pan", "angle": "front", "framing": "medium", "amount": 0.4},
      "props": [
        {"id": "blue-wave", "type": "wave", "color": "#4da6ff", "wavelength": 0.15, "amplitude": 0.18, "at": [0, 0.55, 0], "size": 1.8},
        {"id": "red-wave", "type": "wave", "color": "red", "wavelength": 0.9, "amplitude": 0.18, "at": [0, -0.55, 0], "size": 1.8}
      ],
      "actions": [
        {"at": "blue waves", "do": "label", "prop": "blue-wave", "text": "BLUE: SHORT", "side": "top"},
        {"at": "red waves", "do": "label", "prop": "red-wave", "text": "RED: LONG", "side": "top"},
        {"at": "are long", "do": "pulse", "prop": "red-wave", "strength": 0.2}
      ]
    },
    {
      "id": "air-hit",
      "start": "When sunlight",
      "transition": "dip",
      "env": {"type": "micro", "tint": "cool"},
      "camera": {"move": "orbit", "angle": "three-quarter", "framing": "medium", "amount": 0.4},
      "props": [
        {"id": "n2", "type": "molecule", "formula": "n2", "at": [-0.5, -0.1, 0], "size": 1.2},
        {"id": "o2", "type": "molecule", "formula": "o2", "at": [0.55, 0.1, 0], "size": 1.2},
        {"id": "sunray", "type": "beam", "from": [-1.0, 1.0, 0.3], "to": "n2", "color": "yellow", "width": 0.08, "progress": 0}
      ],
      "actions": [
        {"at": "sunlight hits", "do": "set", "prop": "sunray", "param": "progress", "to": 1, "over": 0.8},
        {"at": "bumps into", "do": "shake", "prop": "n2", "strength": 0.6, "for": 0.6},
        {"at": "nitrogen", "do": "label", "prop": "n2", "text": "NITROGEN", "side": "left"},
        {"at": "oxygen", "do": "label", "prop": "o2", "text": "OXYGEN", "side": "right"}
      ]
    },
    {
      "id": "scatter",
      "start": "Those molecules",
      "env": {"type": "lab"},
      "camera": {"move": "push_in", "angle": "high", "framing": "medium", "amount": 0.4},
      "props": [
        {"id": "chart", "type": "bars", "values": [6, 1], "colors": ["#4da6ff", "red"], "at": "center", "size": 1.5}
      ],
      "actions": [
        {"at": "short blue waves", "do": "set", "prop": "chart", "param": "highlight", "to": 0, "over": 0.3},
        {"at": "several times more", "do": "label", "prop": "chart", "text": "BLUE SCATTERS MORE", "side": "top"},
        {"at": "long red ones", "do": "set", "prop": "chart", "param": "highlight", "to": 1, "over": 0.3}
      ]
    },
    {
      "id": "everywhere",
      "start": "So blue light",
      "env": {"type": "space", "nebula": "none", "stars": 0.6},
      "camera": {"move": "pull_out", "angle": "front", "framing": "medium", "amount": 0.4},
      "props": [
        {"id": "blue-cloud", "type": "particles", "shape": "sphere", "count": 400, "look": "dots", "color": "#4da6ff", "color2": "white", "mix": 0.2, "dot": 0.08, "at": "center", "size": 2.4, "speed": 0.8},
        {"id": "eye", "type": "eye", "color": "brown", "at": [0, 0, 0.9], "size": 1.0}
      ],
      "actions": [
        {"at": "all over the sky", "do": "set", "prop": "blue-cloud", "param": "spread", "to": 1.6, "over": 1.0},
        {"at": "into your eyes", "do": "appear", "prop": "eye", "style": "pop"},
        {"at": "from every direction", "do": "text", "text": "BLUE EVERYWHERE", "style": "title", "pos": "top"},
        {"at": "every direction", "do": "pulse", "prop": "eye", "strength": 0.2}
      ]
    },
    {
      "id": "violet",
      "start": "Then why isn't",
      "env": {"type": "studio", "color": "#1d2340", "floor": true},
      "camera": {"move": "orbit", "angle": "low", "framing": "medium", "amount": 0.4},
      "props": [
        {"id": "gem", "type": "crystal", "color": "#9b5cff", "at": "center", "size": 1.4}
      ],
      "actions": [
        {"at": "isn't the sky violet", "do": "icon", "prop": "gem", "name": "question", "until": "Violet scatters"},
        {"at": "Violet scatters", "do": "label", "prop": "gem", "text": "VIOLET", "side": "right"},
        {"at": "even more", "do": "pulse", "prop": "gem", "strength": 0.25},
        {"at": "less of it", "do": "glow", "prop": "gem", "to": 0.2, "over": 0.8},
        {"at": "see it poorly", "do": "icon", "prop": "gem", "name": "x"}
      ]
    },
    {
      "id": "sunset",
      "start": "At sunset",
      "transition": "dip",
      "env": {"type": "sky", "time": "sunset", "ground": "ocean", "clouds": 0.3},
      "camera": {"move": "rise", "angle": "low", "framing": "medium", "amount": 0.4},
      "props": [
        {"id": "sun", "type": "sun", "color": "orange", "rays": true, "at": [0, 0.85, 0], "size": 1.3}
      ],
      "actions": [
        {"at": "At sunset", "do": "text", "text": "SUNSET", "style": "title", "pos": "top", "until": "scattered away"},
        {"at": "much more air", "do": "pulse", "prop": "sun", "strength": 0.15},
        {"at": "blue is scattered", "do": "color", "prop": "sun", "to": "red", "over": 1.0},
        {"at": "red is left", "do": "label", "prop": "sun", "text": "RED IS LEFT", "side": "right"},
        {"at": "Follow", "do": "text", "text": "FOLLOW FOR MORE", "style": "title", "pos": "top"}
      ]
    }
  ]
}
