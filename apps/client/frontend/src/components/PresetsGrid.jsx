import React, { useMemo, useState, useEffect } from 'react';
import { presets, presetSections } from '../config/presets';
import { usePromptContext } from '../contexts/PromptContext';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

export const PresetsGrid = React.memo(function PresetsGrid() {
  const { selectedPresets, togglePreset, clearAll, closePresetsModal } = usePromptContext();
  const [isShaking, setIsShaking] = useState(false);
  
  // Reset shake animation after it completes
  useEffect(() => {
    if (isShaking) {
      const timer = setTimeout(() => {
        setIsShaking(false);
      }, 820); // Animation duration + a little buffer
      return () => clearTimeout(timer);
    }
  }, [isShaking]);
  // Group presets by section - memoize to prevent recalculation on every render
  const groupedPresets = useMemo(() => {
    return presetSections.map((section) => ({
      ...section,
      items: presets.filter((preset) => preset.section === section.name),
    }));
  }, []);

  // Handle preset toggle with multiselect and group logic
  const handleTogglePreset = (preset, section) => {
    // Check if the preset belongs to a group
    const presetGroup = preset.group;
    if (presetGroup) {
      // If the preset is part of a group, only one preset from that group can be selected
      const otherPresetsInGroup = presets
        .filter(
          (p) =>
            p.section === section.name &&
            p.group === presetGroup &&
            p.id !== preset.id
        )
        .map((p) => p.id);

      // If the preset is already selected, deselect it
      if (selectedPresets.includes(preset.id)) {
        togglePreset(preset);
      } else {
        // Deselect all other presets in the same group and select the new one
        const newSelectedPresets = selectedPresets.filter(
          (id) => !otherPresetsInGroup.includes(id)
        );
        togglePreset(preset, newSelectedPresets);
      }
    } else if (section.allow_multiselect) {
      // If the preset is not part of a group and multiselect is allowed, toggle the preset
      togglePreset(preset);
    } else {
      // If multiselect is not allowed (e.g., Materials section), deselect all other presets in this section
      const otherPresetsInSection = presets
        .filter((p) => p.section === section.name && p.id !== preset.id)
        .map((p) => p.id);

      // If the preset is already selected, deselect it
      if (selectedPresets.includes(preset.id)) {
        togglePreset(preset);
      } else {
        // Deselect all other presets in the section and select the new one
        const newSelectedPresets = selectedPresets.filter(
          (id) => !otherPresetsInSection.includes(id)
        );
        togglePreset(preset, newSelectedPresets);
      }
    }
  };

  return (
    <div className={cn(
      'p-4 transition-transform',
      isShaking && 'animate-shake'
    )}>
      {groupedPresets.map((section) => (
        <div key={section.name} className="mb-6">
          <h3
            className="text-[10px] font-semibold uppercase mb-2 bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-blue-500"
          >
            {section.name}
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {section.items.map((preset) => {
              const isSelected = selectedPresets.includes(preset.id);
              return (
                <button
                  key={preset.id}
                  onClick={() => handleTogglePreset(preset, section)}
                  className={`preset-button ${isSelected ? 'selected' : ''}`}
                >
                  <span className="text-sm font-medium text-white">
                    {preset.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      
      {/* Action buttons */}
      <div className="mt-8 flex justify-between gap-4">
        <Button 
          variant="outline" 
          onClick={() => {
            // Clear all presets
            clearAll();
            // Trigger shake animation
            setIsShaking(true);
          }}
          className="flex-1"
        >
          Clear
        </Button>
        <Button 
          variant="default" 
          onClick={closePresetsModal}
          className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
        >
          Apply
        </Button>
      </div>
    </div>
  );
});