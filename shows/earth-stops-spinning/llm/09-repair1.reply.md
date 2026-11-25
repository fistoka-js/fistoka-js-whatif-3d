{
  "format": 1,
  "title": "What If Earth Suddenly Stopped Spinning?",
  "voice": {"audio": "voice.mp3", "words": "words.json"},
  "dials": {
    "airglow": {"start": 0, "keys": [{"at": "What if", "to": 0.4, "over": 1.0}, {"at": "air and", "to": 1, "over": 1.4}]},
    "speed": {"start": 0, "keys": [{"at": "races along", "to": 1, "over": 1.6}, {"at": "would stop", "to": 0, "over": 0.8}]},
    "day": {"start": 0, "keys": [{"at": "A single day", "to": 0.4, "over": 1.5}, {"at": "bake in", "to": 1, "over": 1.8}, {"at": "froze in", "to": 0.15, "over": 1.2}]},
    "calm": {"start": 0, "keys": [{"at": "Earth's slow", "to": 1, "over": 3.5}]}
  },
  "shots": [
    {
      "id": "hook",
      "env": {"type": "space", "nebula": "blue"},
      "camera": {"focus": ["earth"], "framing": "medium", "fill": 1.0, "angle": "front", "move": "drift", "amount": 0.3},
      "props": [
        {"id": "earth", "type": "planet", "look": "earth", "at": "center", "size": 1.3, "turn": 0, "atmosphere": {"dial": "airglow", "from": [0, 1], "to": [0.6, 0.9]}},
        {"id": "gauge", "type": "gauge", "at": [0.75, -0.55, 0.9], "size": 0.55, "arc": "green-red", "hidden": true, "value": {"dial": "speed", "to": [0.05, 0.95]}, "glow": {"dial": "speed", "to": [0, 0.6]}}
      ],
      "actions": [
        {"at": "What if", "do": "spin", "prop": "earth", "speed": 0.08},
        {"at": "Right now", "do": "appear", "prop": "gauge", "style": "pop"},
        {"at": "about one thousand", "do": "text", "text": "1,000 mph at the equator", "style": "number"}
      ]
    },
    {
      "id": "stop",
      "start": "Here is what",
      "continue": true,
      "camera": {"focus": ["earth"], "framing": "medium", "fill": 1.05, "angle": "front", "move": "push_in", "amount": 0.3, "glide": 1.0},
      "actions": [
        {"at": "Here is what", "do": "text", "text": "1,000 mph at the equator", "style": "number"},
        {"at": "would stop", "do": "spin", "prop": "earth", "speed": 0},
        {"at": "would stop", "do": "set", "prop": "earth", "param": "ocean_lon", "to": 131.14, "over": 0.1},
        {"at": "the oceans", "do": "set", "prop": "earth", "param": "ocean", "to": 0.8, "over": 0.6},
        {"at": "the oceans", "do": "set", "prop": "earth", "param": "ocean_lon", "to": 153.14, "over": 1.0}
      ]
    },
    {
      "id": "slide",
      "start": "Everything loose",
      "env": "planet_surface",
      "camera": {"focus": ["rock"], "framing": "close", "fill": 1.0, "angle": "low", "move": "push_in", "amount": 0.3},
      "props": [
        {"id": "rock", "type": "rock", "at": [-0.9, 0, 0], "size": 1.3},
        {"id": "dust", "type": "particles", "shape": "box", "count": 90, "color": "#c8a46a", "dot": 0.1, "size": 1.4, "at": [-0.5, 0.35, 0.4], "spread": 0.5, "speed": 0.3}
      ],
      "actions": [
        {"at": "Everything loose", "do": "move", "prop": "rock", "to": [0.7, 0, 0], "until": {"phrase": "ground", "edge": "end"}, "ease": "out"},
        {"at": "keep its", "do": "set", "prop": "dust", "param": "speed", "to": 1.5, "over": 0.8},
        {"at": "slide", "do": "set", "prop": "dust", "param": "spread", "to": 2, "over": 1.0}
      ]
    },
    {
      "id": "wind",
      "start": "Near the equator",
      "continue": true,
      "camera": {"focus": ["rock", "tree"], "framing": "medium", "fill": 1.0, "angle": "front", "move": "drift", "amount": 0.3, "glide": 1.0},
      "props": [
        {"id": "tree", "type": "tree", "style": "round", "at": [1.0, 0, 0], "size": 1.2},
        {"id": "gale", "type": "particles", "shape": "stream", "count": 300, "color": "#d9c08a", "dot": 0.1, "size": 2.0, "at": [0, 0.7, 0.5], "speed": 0.3, "hidden": true}
      ],
      "actions": [
        {"at": "Near the equator", "do": "appear", "prop": "tree", "style": "grow"},
        {"at": "winds of about one", "do": "text", "text": "winds of 1,000 mph", "style": "number"},
        {"at": "winds of about one", "do": "appear", "prop": "gale", "style": "fade"},
        {"at": "winds of about one", "do": "set", "prop": "gale", "param": "speed", "to": 3, "over": 1.5},
        {"at": "sweep across", "do": "set", "prop": "gale", "param": "spread", "to": 2, "over": 1.0},
        {"at": "stripping away", "do": "set", "prop": "dust", "param": "spread", "to": 3, "over": 1.0},
        {"at": "stripping away", "do": "move", "prop": "rock", "to": [1.2, 0, 0], "over": 1.5},
        {"at": "trees", "do": "disappear", "prop": "tree", "style": "fly_out", "to": "far-right"},
        {"at": "buildings", "do": "set", "prop": "gale", "param": "spread", "to": 3, "over": 0.8}
      ]
    },
    {
      "id": "drain",
      "start": "The oceans",
      "env": {"type": "space", "nebula": "blue"},
      "transition": "dip",
      "camera": {"focus": ["sea"], "framing": "medium", "fill": 1.0, "angle": "front", "move": "drift", "amount": 0.3},
      "props": [
        {"id": "sea", "type": "planet", "look": "earth", "at": "center", "size": 1.3, "turn": 0, "ocean": 0.8, "ocean_lon": 0, "ocean_lat": 0, "glow": {"dial": "day", "to": [0, 0.3]}},
        {"id": "dial2", "type": "gauge", "at": [0.75, -0.55, 0.9], "size": 0.55, "arc": "green-red", "value": {"dial": "speed", "to": [0.05, 0.95]}}
      ],
      "actions": [
        {"at": "slosh forward", "do": "set", "prop": "sea", "param": "ocean_lon", "to": 9, "over": 0.9},
        {"at": "drain toward", "do": "set", "prop": "sea", "param": "ocean_lat", "to": 13, "over": 2.2},
        {"at": "because Earth", "do": "set", "prop": "sea", "param": "ocean_lon", "to": 0, "over": 1.2},
        {"at": "slightly bulged", "do": "set", "prop": "sea", "param": "ocean", "to": 1.0, "over": 1.0}
      ]
    },
    {
      "id": "belt",
      "start": "That would leave",
      "continue": true,
      "camera": {"focus": ["sea"], "framing": "medium", "fill": 1.1, "angle": "front", "move": "push_in", "amount": 0.3, "glide": 1.0},
      "actions": [
        {"at": "huge belt", "do": "set", "prop": "sea", "param": "ocean", "to": 0.2, "over": 1.5},
        {"at": "dry land", "do": "set", "prop": "sea", "param": "atmosphere", "to": 0.4, "over": 1.0},
        {"at": "around the middle", "do": "set", "prop": "sea", "param": "ocean_lon", "to": -8, "over": 1.0}
      ]
    },
    {
      "id": "day",
      "start": "A single day",
      "continue": true,
      "camera": {"focus": ["sea"], "framing": "medium", "fill": 1.0, "angle": "front", "move": "drift", "amount": 0.3, "glide": 1.0},
      "props": [
        {"id": "star", "type": "sun", "at": [-1.15, 0.35, -0.8], "size": 0.5, "hidden": true, "brightness": {"dial": "day", "to": [0.5, 1.7]}}
      ],
      "actions": [
        {"at": "A single day", "do": "appear", "prop": "star", "style": "grow"},
        {"at": "A single day", "do": "text", "text": "1 day = 1 year", "style": "number"},
        {"at": "for about six", "do": "text", "text": "6 months light, 6 dark", "style": "number", "pos": "middle"},
        {"at": "bake in", "do": "set", "prop": "sea", "param": "atmosphere", "to": 0.7, "over": 1.5},
        {"at": "froze in", "do": "set", "prop": "sea", "param": "ocean", "to": 0.5, "over": 1.5}
      ]
    },
    {
      "id": "bus",
      "start": "It is like",
      "continue": true,
      "camera": {"focus": ["sea", "bus"], "framing": "medium", "fill": 1.0, "angle": "front", "move": "drift", "amount": 0.3, "glide": 1.0},
      "props": [
        {"id": "bus", "type": "car", "style": "bus", "color": "#ffd23a", "driving": true, "at": [-0.9, -0.6, 0.3], "size": 1.3},
        {"id": "crate1", "type": "box", "color": "#e0762a", "width": 0.35, "height": 0.35, "depth": 0.35, "at": [-1.15, 0.45, 0.4], "size": 1.0},
        {"id": "crate2", "type": "box", "color": "#e0762a", "width": 0.35, "height": 0.35, "depth": 0.35, "at": [-0.9, 0.45, 0.4], "size": 1.0},
        {"id": "crate3", "type": "box", "color": "#e0762a", "width": 0.35, "height": 0.35, "depth": 0.35, "at": [-0.65, 0.45, 0.4], "size": 1.0}
      ],
      "actions": [
        {"at": "It is like", "do": "disappear", "prop": "star", "style": "fade"},
        {"at": "It is like", "do": "disappear", "prop": "dial2", "style": "fade"},
        {"at": "It is like", "do": "move", "prop": "sea", "to": [0, 1.2, 0], "over": 0.8},
        {"at": "It is like", "do": "scale", "prop": "sea", "to": 0.55, "over": 0.8},
        {"at": "like a", "do": "move", "prop": "bus", "to": [0.5, -0.6, 0.3], "until": {"phrase": "stops", "edge": "start"}, "ease": "out"},
        {"at": "like a", "do": "move", "prop": "crate1", "to": [0.25, 0.45, 0.4], "until": {"phrase": "stops", "edge": "start"}, "ease": "out"},
        {"at": "like a", "do": "move", "prop": "crate2", "to": [0.5, 0.45, 0.4], "until": {"phrase": "stops", "edge": "start"}, "ease": "out"},
        {"at": "like a", "do": "move", "prop": "crate3", "to": [0.75, 0.45, 0.4], "until": {"phrase": "stops", "edge": "start"}, "ease": "out"},
        {"at": "but everything", "do": "move", "prop": "crate1", "to": [1.05, 0.45, 0.4], "over": 1.0, "ease": "in"},
        {"at": "but everything", "do": "move", "prop": "crate2", "to": [1.3, 0.45, 0.4], "over": 1.0, "ease": "in"},
        {"at": "but everything", "do": "move", "prop": "crate3", "to": [1.55, 0.45, 0.4], "over": 1.0, "ease": "in"},
        {"at": "flying forward", "do": "glow", "prop": "crate2", "to": 0.5, "over": 0.6}
      ]
    },
    {
      "id": "calm",
      "start": "Earth's slow",
      "env": {"type": "space", "nebula": "blue"},
      "transition": "dip",
      "camera": {"focus": ["home"], "framing": "medium", "fill": 1.0, "angle": "front", "move": "pull_out", "amount": 0.3},
      "props": [
        {"id": "home", "type": "planet", "look": "earth", "at": "center", "size": 1.3, "turn": 0.05, "atmosphere": {"dial": "calm", "to": [0.9, 0.55]}},
        {"id": "star2", "type": "sun", "at": [-1.15, 0.35, -0.8], "size": 0.5, "brightness": {"dial": "calm", "to": [1.7, 1.0]}}
      ],
      "actions": [
        {"at": "our oceans", "do": "glow", "prop": "home", "to": 0.12, "over": 1.0},
        {"at": "our days", "do": "scale", "prop": "star2", "to": 1.3, "over": 1.2}
      ]
    },
    {
      "id": "question",
      "start": "If you had",
      "continue": true,
      "camera": {"focus": ["home"], "framing": "medium", "fill": 1.05, "angle": "front", "move": "push_in", "amount": 0.3, "glide": 1.0},
      "actions": [
        {"at": "If you had", "do": "glow", "prop": "home", "to": 0.3, "over": 1.5},
        {"at": "where on Earth", "do": "scale", "prop": "star2", "to": 1.0, "over": 1.0},
        {"at": "Comment your", "do": "glow", "prop": "home", "to": 0.45, "over": 3.0}
      ]
    }
  ]
}
