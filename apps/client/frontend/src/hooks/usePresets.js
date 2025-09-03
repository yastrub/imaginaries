import { useState, useCallback } from 'react';
import { presets } from '../config/presets';

export function usePresets() {
  const [selectedPresets, setSelectedPresets] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const togglePreset = useCallback((preset, newSelectedPresets = null) => {
    if (newSelectedPresets) {
      setSelectedPresets(
        newSelectedPresets.includes(preset.id)
          ? newSelectedPresets
          : [...newSelectedPresets, preset.id]
      );
    } else {
      setSelectedPresets((prev) =>
        prev.includes(preset.id)
          ? prev.filter((id) => id !== preset.id)
          : [...prev, preset.id]
      );
    }
  }, []);

  const openPresetsModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const closePresetsModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const clearPresets = useCallback(() => {
    setSelectedPresets([]);
  }, []);

  return {
    selectedPresets,
    isModalOpen,
    togglePreset,
    openPresetsModal,
    closePresetsModal,
    clearPresets
  };
}
