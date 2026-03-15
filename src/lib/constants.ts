export const intensities = [
  { value: "mycket", label: "Mycket" },
  { value: "mellan", label: "Mellan" },
  { value: "lite", label: "Lite" },
] as const;

export type Intensity = (typeof intensities)[number]["value"];
