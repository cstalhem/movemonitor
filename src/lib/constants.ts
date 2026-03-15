import { AudioWaveform, AudioLines, Waves } from "lucide-react";

export const intensities = [
  { value: "mycket", label: "Mycket", icon: AudioWaveform, color: "chart-1" },
  { value: "mellan", label: "Mellan", icon: AudioLines, color: "chart-2" },
  { value: "lite", label: "Lite", icon: Waves, color: "chart-3" },
] as const;

export type Intensity = (typeof intensities)[number]["value"];
