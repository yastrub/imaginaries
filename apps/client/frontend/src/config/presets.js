// Define sections with their multiselect behavior
export const presetSections = [
  {
    name: "Styles",
    allow_multiselect: true,
  },
  {
    name: "Material",
    allow_multiselect: false,
  },
  {
    name: "Stones",
    allow_multiselect: true,
  },
];

// Define presets with a section and optional group property
export const presets = [
  {
    id: 0,
    name: "Layered",
    value: "layered",
    section: "Styles",
    group: "Style",
  },
  {
    id: "2",
    name: "Minimalist",
    value: "minimalist",
    section: "Styles",
    group: "Style",
  },
  {
    id: 3,
    name: "Bold",
    value: "bold",
    section: "Styles",
    group: "Style",
  },
  {
    id: 4,
    name: "Organic Shapes",
    value: "organic shapes, inspired by nature",
    section: "Styles",
    group: "Shape",
  },
  {
    id: 7,
    name: "Geometric",
    value: "geometric patterns or shapes",
    section: "Styles",
    group: "Shape",
  },
  {
    id: 17,
    name: "Honeycombs",
    value: "honeycomb inspired patterns",
    section: "Styles",
    group: "Shape",
  },
  {
    id: 5,
    name: "Contemporary",
    value: "contemporary",
    section: "Styles",
    group: "Generation",
  },
  {
    id: 6,
    name: "Innovative",
    value: "innovative",
    section: "Styles",
    group: "Generation",
  },
  {
    id: 1,
    name: "Sci-Fi",
    value: "Sci-Fi",
    section: "Styles",
    group: "Generation",
  },
  {
    id: 8,
    name: "White Gold",
    value: "18k white gold",
    section: "Material",
  },
  {
    id: 9,
    name: "Yellow Gold",
    value: "18k yellow gold",
    section: "Material",
  },
  {
    id: 10,
    name: "Rose Gold",
    value: "18k rose gold",
    section: "Material",
  },
  {
    id: 11,
    name: "Diamond",
    value: "diamond",
    section: "Stones",
    group: "Stone",
  },
  {
    id: 12,
    name: "Ruby",
    value: "ruby",
    section: "Stones",
    group: "Stone",
  },
  {
    id: 13,
    name: "Blue Sapphire",
    value: "blue sapphire",
    section: "Stones",
    group: "Stone",
  },
  {
    id: 14,
    name: "Emerald",
    value: "emerald",
    section: "Stones",
    group: "Stone",
  },
  {
    id: 15,
    name: "Single Stone",
    value: "single stone",
    section: "Stones",
    group: "Stone Count", // Part of the "Stone Count" group
  },
  {
    id: 16,
    name: "Many Stones",
    value: "many stones",
    section: "Stones",
    group: "Stone Count", // Part of the "Stone Count" group
  },
];