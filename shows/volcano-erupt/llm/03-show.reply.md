{
 "format": 1,
 "title": "Why Do Volcanoes Actually Erupt?",
 "voice": {
  "audio": "voice.mp3",
  "words": "words.json"
 },
 "dials": {
  "erupt": {
   "start": 0.25,
   "keys": [
    {
     "at": "liquid",
     "to": 0.8,
     "over": 0.6
    },
    {
     "at": "Not quite",
     "to": 0.05,
     "over": 0.4
    },
    {
     "at": "what really",
     "to": 0.12,
     "over": 0.5
    },
    {
     "at": "Deep down",
     "to": 0.18,
     "over": 1.0
    },
    {
     "at": "That magma",
     "to": 0.25,
     "over": 1.2
    },
    {
     "at": "Dissolved gas",
     "to": 0.3,
     "over": 1.5
    },
    {
     "at": "As the magma",
     "to": 0.36,
     "over": 1.5
    },
    {
     "at": "The bubbles grow",
     "to": 0.5,
     "over": 1.2
    },
    {
     "at": "push the magma",
     "to": 0.62,
     "over": 1.5
    },
    {
     "at": "The pressure finally",
     "to": 0.78,
     "over": 0.7
    },
    {
     "at": "breaks the",
     "to": 0.95,
     "over": 0.8
    },
    {
     "at": "Lava, ash",
     "to": 1.0,
     "over": 0.5
    },
    {
     "at": "Thick, sticky",
     "to": 0.7,
     "over": 1.0
    },
    {
     "at": "traps gas",
     "to": 0.55,
     "over": 0.9
    },
    {
     "at": "so the blast",
     "to": 1.0,
     "over": 0.9
    },
    {
     "at": "Runny magma",
     "to": 0.45,
     "over": 1.2
    },
    {
     "at": "gas escape",
     "to": 0.35,
     "over": 1.0
    },
    {
     "at": "lava just",
     "to": 0.3,
     "over": 0.9
    },
    {
     "at": "Over millions",
     "to": 0.5,
     "over": 1.2
    },
    {
     "at": "gas probably",
     "to": 0.55,
     "over": 1.0
    },
    {
     "at": "build our",
     "to": 0.65,
     "over": 1.0
    },
    {
     "at": "Would you",
     "to": 0.4,
     "over": 1.0
    },
    {
     "at": "rich soil",
     "to": 0.3,
     "over": 0.8
    },
    {
     "at": "Comment below",
     "to": 0.08,
     "over": 0.6
    }
   ]
  },
  "bubbles": {
   "start": 0,
   "keys": [
    {
     "at": "Dissolved gas",
     "to": 0.1,
     "over": 0.8
    },
    {
     "at": "mostly water",
     "to": 0.2,
     "over": 1.0
    },
    {
     "at": "is trapped",
     "to": 0.15,
     "over": 0.6
    },
    {
     "at": "gas forms",
     "to": 0.5,
     "over": 1.2
    },
    {
     "at": "The bubbles grow",
     "to": 0.75,
     "over": 1.0
    },
    {
     "at": "push the magma",
     "to": 0.95,
     "over": 1.2
    }
   ]
  },
  "fizz": {
   "start": 0,
   "keys": [
    {
     "at": "shaken",
     "to": 0.45,
     "over": 1.0
    },
    {
     "at": "Open the cap",
     "to": 0.2,
     "over": 0.6
    },
    {
     "at": "pressure drops",
     "to": 0.1,
     "over": 0.8
    },
    {
     "at": "bubbles burst",
     "to": 1.0,
     "over": 0.9
    }
   ]
  }
 },
 "shots": [
  {
   "id": "hook",
   "env": {
    "type": "studio",
    "floor": true,
    "color": {
     "dial": "erupt",
     "colors": [
      "#0f1c2b",
      "#3a1c14",
      "#5c1a0a"
     ]
    },
    "haze": 0
   },
   "camera": {
    "focus": [
     "vol"
    ],
    "framing": "close",
    "angle": "front",
    "move": "push_in",
    "amount": 0.3,
    "fill": 1.3
   },
   "props": [
    {
     "id": "vol",
     "type": "volcano",
     "at": [
      0,
      -0.2,
      0
     ],
     "size": 1.8,
     "eruption": {
      "dial": "erupt",
      "to": [
       0,
       1
      ]
     },
     "glow": {
      "dial": "erupt",
      "to": [
       0,
       0.9
      ]
     }
    }
   ],
   "actions": [
    {
     "at": "full of",
     "do": "icon",
     "name": "question",
     "style": "plain",
     "size": 2.4,
     "color": "#d6c64a",
     "place": [
      0.7,
      1.2,
      0.6
     ],
     "until": "Not quite"
    },
    {
     "at": "Not quite",
     "do": "icon",
     "name": "no",
     "style": "plain",
     "size": 2.4,
     "place": [
      0.7,
      1.2,
      0.6
     ],
     "until": "what really"
    },
    {
     "at": "what really",
     "do": "pulse",
     "prop": "vol",
     "strength": 0.15
    }
   ]
  },
  {
   "id": "melt",
   "start": "Deep down",
   "transition": "dive",
   "env": {
    "type": "studio",
    "floor": true,
    "color": {
     "dial": "erupt",
     "colors": [
      "#0f1c2b",
      "#3a1c14",
      "#5c1a0a"
     ]
    },
    "haze": 0
   },
   "camera": {
    "focus": [
     "vol",
     "magma"
    ],
    "framing": "medium",
    "angle": "front",
    "move": "drift",
    "amount": 0.3,
    "fill": 1.0
   },
   "props": [
    {
     "id": "vol",
     "type": "volcano",
     "at": [
      0,
      -0.2,
      0
     ],
     "size": 1.6,
     "eruption": {
      "dial": "erupt",
      "to": [
       0,
       1
      ]
     },
     "glow": {
      "dial": "erupt",
      "to": [
       0,
       0.9
      ]
     }
    },
    {
     "id": "magma",
     "type": "particles",
     "shape": "sphere",
     "count": 70,
     "dot": 0.09,
     "size": 0.7,
     "color": "#9aa3ad",
     "at": [
      0,
      0.0,
      0.5
     ],
     "spread": 0.7,
     "speed": 0.2
    }
   ],
   "actions": [
    {
     "at": "Deep down",
     "do": "appear",
     "prop": "magma",
     "style": "grow",
     "over": 0.8
    },
    {
     "at": "mostly solid",
     "do": "shake",
     "prop": "vol",
     "strength": 0.05,
     "for": 0.5
    },
    {
     "at": "melts",
     "do": "color",
     "prop": "magma",
     "to": "orange",
     "over": 0.8
    },
    {
     "at": "melts",
     "do": "glow",
     "prop": "magma",
     "to": 1,
     "over": 0.8
    },
    {
     "at": "into magma",
     "do": "label",
     "prop": "magma",
     "text": "MAGMA",
     "until": {
      "phrase": "magma",
      "edge": "end"
     },
     "side": "right"
    }
   ]
  },
  {
   "id": "rise",
   "start": "That magma",
   "continue": true,
   "camera": {
    "focus": [
     "vol",
     "magma"
    ],
    "framing": "medium",
    "angle": "three-quarter",
    "move": "push_in",
    "amount": 0.4,
    "fill": 1.05,
    "glide": 1.0
   },
   "actions": [
    {
     "at": "That magma",
     "do": "pulse",
     "prop": "magma",
     "strength": 0.3
    },
    {
     "at": "lighter",
     "do": "move",
     "prop": "magma",
     "to": [
      0,
      0.5,
      0.5
     ],
     "until": {
      "phrase": "chamber",
      "edge": "end"
     }
    },
    {
     "at": "into a chamber",
     "do": "scale",
     "prop": "magma",
     "to": 1.5,
     "over": 0.9
    }
   ]
  },
  {
   "id": "gas",
   "start": "Dissolved gas",
   "continue": true,
   "camera": {
    "focus": [
     "vol",
     "magma",
     "gas"
    ],
    "framing": "medium",
    "angle": "front",
    "move": "drift",
    "amount": 0.3,
    "fill": 1.05,
    "glide": 1.0
   },
   "props": [
    {
     "id": "gas",
     "type": "particles",
     "shape": "sphere",
     "count": 60,
     "dot": 0.08,
     "size": 0.8,
     "at": [
      0,
      0.5,
      0.7
     ],
     "color": {
      "dial": "bubbles",
      "colors": [
       "#7fd6ff",
       "#ffffff"
      ]
     },
     "spread": {
      "dial": "bubbles",
      "to": [
       0.4,
       1.8
      ]
     },
     "speed": {
      "dial": "bubbles",
      "to": [
       0.2,
       2.5
      ]
     }
    }
   ],
   "actions": [
    {
     "at": "Dissolved gas",
     "do": "appear",
     "prop": "gas",
     "style": "grow",
     "over": 0.6
    },
    {
     "at": "Dissolved gas",
     "do": "label",
     "prop": "gas",
     "text": "GAS",
     "until": "mostly",
     "side": "left"
    },
    {
     "at": "water vapour",
     "do": "pulse",
     "prop": "gas",
     "strength": 0.3
    },
    {
     "at": "carbon dioxide",
     "do": "pulse",
     "prop": "gas",
     "strength": 0.3
    },
    {
     "at": "is trapped",
     "do": "shake",
     "prop": "gas",
     "strength": 0.2,
     "for": 0.8
    }
   ]
  },
  {
   "id": "bubbles",
   "start": "As the magma",
   "continue": true,
   "camera": {
    "focus": [
     "vol",
     "magma",
     "gas"
    ],
    "framing": "medium",
    "angle": "front",
    "move": "push_in",
    "amount": 0.4,
    "fill": 1.05,
    "glide": 1.0
   },
   "actions": [
    {
     "at": "As the magma",
     "do": "move",
     "prop": "magma",
     "to": [
      0,
      0.85,
      0.5
     ],
     "until": {
      "phrase": "drops",
      "edge": "end"
     }
    },
    {
     "at": "pressure drops",
     "do": "text",
     "text": "PRESSURE DROPS",
     "until": "gas forms"
    },
    {
     "at": "gas forms",
     "do": "label",
     "prop": "gas",
     "text": "BUBBLES",
     "until": {
      "phrase": "bubbles",
      "edge": "end"
     },
     "side": "left"
    },
    {
     "at": "gas forms",
     "do": "scale",
     "prop": "gas",
     "to": 1.2,
     "over": 0.9
    }
   ]
  },
  {
   "id": "grow",
   "start": "The bubbles grow",
   "continue": true,
   "camera": {
    "focus": [
     "vol",
     "magma",
     "gas"
    ],
    "framing": "medium",
    "angle": "low",
    "move": "push_in",
    "amount": 0.5,
    "fill": 1.05,
    "glide": 1.0
   },
   "actions": [
    {
     "at": "The bubbles grow",
     "do": "scale",
     "prop": "gas",
     "to": 1.7,
     "over": 1.2
    },
    {
     "at": "push the magma",
     "do": "move",
     "prop": "magma",
     "to": [
      0,
      1.1,
      0.5
     ],
     "until": {
      "phrase": "faster",
      "edge": "end"
     }
    },
    {
     "at": "upward",
     "do": "pulse",
     "prop": "vol",
     "strength": 0.2
    }
   ]
  },
  {
   "id": "fizz",
   "start": "It is like",
   "transition": "dip",
   "env": {
    "type": "studio",
    "floor": false,
    "color": "#12202e",
    "haze": 0
   },
   "camera": {
    "focus": [
     "fizz",
     "vol4"
    ],
    "framing": "medium",
    "angle": "front",
    "move": "push_in",
    "amount": 0.3,
    "fill": 1.0
   },
   "props": [
    {
     "id": "fizz",
     "type": "particles",
     "shape": "box",
     "count": 150,
     "dot": 0.1,
     "size": 1.6,
     "at": [
      -0.35,
      0.5,
      0
     ],
     "color": {
      "dial": "fizz",
      "colors": [
       "#7fd6ff",
       "#fff2a0"
      ]
     },
     "spread": {
      "dial": "fizz",
      "to": [
       0.2,
       2.5
      ]
     },
     "speed": {
      "dial": "fizz",
      "to": [
       0.3,
       4
      ]
     }
    },
    {
     "id": "vol4",
     "type": "volcano",
     "at": [
      0.95,
      -0.45,
      0
     ],
     "size": 0.9,
     "eruption": {
      "dial": "fizz",
      "to": [
       0,
       1
      ]
     },
     "glow": {
      "dial": "fizz",
      "to": [
       0,
       0.9
      ]
     }
    }
   ],
   "actions": [
    {
     "at": "shaken",
     "do": "shake",
     "prop": "fizz",
     "strength": 0.5,
     "for": 1.0
    },
    {
     "at": "fizzy drink",
     "do": "pulse",
     "prop": "fizz",
     "strength": 0.3
    }
   ]
  },
  {
   "id": "cap",
   "start": "Open the cap",
   "continue": true,
   "camera": {
    "focus": [
     "fizz",
     "vol4"
    ],
    "framing": "medium",
    "angle": "front",
    "move": "drift",
    "amount": 0.4,
    "fill": 1.05,
    "glide": 0.8
   },
   "actions": [
    {
     "at": "Open the cap",
     "do": "pulse",
     "prop": "fizz",
     "strength": 0.3
    },
    {
     "at": "bubbles burst",
     "do": "shake",
     "prop": "fizz",
     "strength": 0.4,
     "for": 0.8
    }
   ]
  },
  {
   "id": "plug",
   "start": "The pressure finally",
   "transition": "dip",
   "env": {
    "type": "studio",
    "floor": true,
    "color": {
     "dial": "erupt",
     "colors": [
      "#0f1c2b",
      "#3a1c14",
      "#5c1a0a"
     ]
    },
    "haze": 0
   },
   "camera": {
    "focus": [
     "vol2"
    ],
    "framing": "close",
    "angle": "front",
    "move": "push_in",
    "amount": 0.4,
    "fill": 1.2
   },
   "props": [
    {
     "id": "vol2",
     "type": "volcano",
     "at": [
      0,
      -0.2,
      0
     ],
     "size": 1.7,
     "eruption": {
      "dial": "erupt",
      "to": [
       0,
       1
      ]
     },
     "glow": {
      "dial": "erupt",
      "to": [
       0,
       0.9
      ]
     }
    }
   ],
   "actions": [
    {
     "at": "breaks",
     "do": "shake",
     "prop": "vol2",
     "strength": 0.3,
     "for": 0.8
    },
    {
     "at": "rock plug",
     "do": "pulse",
     "prop": "vol2",
     "strength": 0.3
    }
   ]
  },
  {
   "id": "blast",
   "start": "Lava, ash",
   "continue": true,
   "camera": {
    "focus": [
     "vol2",
     "plume"
    ],
    "framing": "medium",
    "angle": "low",
    "move": "push_in",
    "amount": 0.5,
    "fill": 1.0,
    "glide": 1.0
   },
   "props": [
    {
     "id": "plume",
     "type": "cloud",
     "style": "storm",
     "color": "#555a66",
     "at": [
      0,
      1.5,
      0
     ],
     "size": 1.0
    }
   ],
   "actions": [
    {
     "at": "ash and gas",
     "do": "appear",
     "prop": "plume",
     "style": "grow",
     "over": 0.8
    },
    {
     "at": "blast out",
     "do": "shake",
     "strength": 0.4,
     "for": 0.8
    }
   ]
  },
  {
   "id": "thick",
   "start": "Thick, sticky",
   "continue": true,
   "camera": {
    "focus": [
     "vol2",
     "plume"
    ],
    "framing": "medium",
    "angle": "front",
    "move": "pull_out",
    "amount": 0.4,
    "fill": 1.0,
    "glide": 1.0
   },
   "actions": [
    {
     "at": "Thick, sticky",
     "do": "scale",
     "prop": "vol2",
     "to": 1.85,
     "over": 1.2
    },
    {
     "at": "traps gas",
     "do": "shake",
     "prop": "vol2",
     "strength": 0.2,
     "for": 0.8
    },
    {
     "at": "so the blast",
     "do": "scale",
     "prop": "plume",
     "to": 1.6,
     "over": 0.9
    }
   ]
  },
  {
   "id": "runny",
   "start": "Runny magma",
   "continue": true,
   "camera": {
    "focus": [
     "vol2"
    ],
    "framing": "medium",
    "angle": "three-quarter",
    "move": "drift",
    "amount": 0.4,
    "fill": 1.0,
    "glide": 1.0
   },
   "actions": [
    {
     "at": "Runny magma",
     "do": "scale",
     "prop": "plume",
     "to": 0.5,
     "over": 1.0
    },
    {
     "at": "gas escape",
     "do": "scale",
     "prop": "vol2",
     "to": 1.6,
     "over": 1.0
    },
    {
     "at": "lava just",
     "do": "disappear",
     "prop": "plume",
     "style": "fade",
     "over": 0.6
    }
   ]
  },
  {
   "id": "why",
   "start": "Over millions",
   "continue": true,
   "camera": {
    "focus": [
     "vol2",
     "earth"
    ],
    "framing": "wide",
    "angle": "front",
    "move": "pull_out",
    "amount": 0.5,
    "glide": 1.2
   },
   "props": [
    {
     "id": "gas2",
     "type": "cloud",
     "style": "fair",
     "color": "#c9d4de",
     "at": [
      -0.6,
      1.4,
      0
     ],
     "size": 0.8
    },
    {
     "id": "earth",
     "type": "planet",
     "look": "earth",
     "at": [
      0.9,
      1.3,
      0
     ],
     "size": 0.8
    }
   ],
   "actions": [
    {
     "at": "this gas",
     "do": "appear",
     "prop": "gas2",
     "style": "grow",
     "over": 0.7
    },
    {
     "at": "our air",
     "do": "appear",
     "prop": "earth",
     "style": "pop"
    },
    {
     "at": "and oceans",
     "do": "set",
     "prop": "earth",
     "param": "atmosphere",
     "to": 1.4,
     "over": 0.8
    }
   ]
  },
  {
   "id": "close",
   "start": "Would you live",
   "transition": "dip",
   "env": {
    "type": "sky",
    "time": "sunset",
    "ground": "grass",
    "clouds": 0.4
   },
   "camera": {
    "focus": [
     "vol3",
     "house",
     "tree"
    ],
    "framing": "medium",
    "angle": "front",
    "move": "push_in",
    "amount": 0.3,
    "fill": 1.0
   },
   "props": [
    {
     "id": "vol3",
     "type": "volcano",
     "at": [
      0,
      0,
      0
     ],
     "size": 1.5,
     "eruption": {
      "dial": "erupt",
      "to": [
       0,
       1
      ]
     },
     "glow": {
      "dial": "erupt",
      "to": [
       0,
       0.9
      ]
     }
    },
    {
     "id": "house",
     "type": "house",
     "at": [
      -0.75,
      0,
      0.4
     ],
     "size": 0.5
    },
    {
     "id": "tree",
     "type": "tree",
     "style": "round",
     "at": [
      0.75,
      0,
      0.4
     ],
     "size": 0.5
    }
   ],
   "actions": [
    {
     "at": "live next",
     "do": "appear",
     "prop": "house",
     "style": "pop"
    },
    {
     "at": "rich soil",
     "do": "appear",
     "prop": "tree",
     "style": "grow",
     "over": 0.7
    },
    {
     "at": "Comment below",
     "do": "pulse",
     "prop": "vol3",
     "strength": 0.2
    }
   ]
  }
 ]
}