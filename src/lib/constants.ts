import { AudioWaveform, AudioLines, Waves } from "lucide-react";

export const intensities = [
  { value: "mycket", label: "Mycket", icon: AudioWaveform },
  { value: "mellan", label: "Mellan", icon: AudioLines },
  { value: "lite", label: "Lite", icon: Waves },
] as const;

export type Intensity = (typeof intensities)[number]["value"];
